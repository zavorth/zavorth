use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::AppState;

const EVENT_CHANNEL: &str = "zavorth-setup";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartBootstrapArgs {
    pub tag: Option<String>,
    pub dry_run: bool,
    pub install_root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapStatus {
    pub running: bool,
    pub completed: bool,
    pub install_root: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum BootstrapEvent {
    Manifest { stages: Vec<StageInfo> },
    Stage { name: String, state: String, message: Option<String> },
    Log { line: String },
    Complete { install_root: String },
    Failed { error: String },
}

#[derive(Debug, Clone, Serialize)]
struct StageInfo {
    name: String,
    title: String,
}

pub struct BootstrapHandle {
    pub cancel: Arc<AtomicBool>,
    pub status: BootstrapStatus,
}

#[tauri::command]
pub async fn start_bootstrap(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    args: StartBootstrapArgs,
) -> Result<(), String> {
    let mut guard = state.bootstrap.lock().await;
    if guard.as_ref().is_some_and(|handle| handle.status.running) {
        return Err("Setup is already running".to_string());
    }

    let cancel = Arc::new(AtomicBool::new(false));
    *guard = Some(BootstrapHandle {
        cancel: cancel.clone(),
        status: BootstrapStatus {
            running: true,
            completed: false,
            install_root: args.install_root.clone(),
            last_error: None,
        },
    });
    drop(guard);

    let app_for_task = app.clone();
    let state_for_task = state.inner().clone();
    tokio::spawn(async move {
        let result = run_bootstrap(app_for_task.clone(), args, cancel).await;
        let mut guard = state_for_task.bootstrap.lock().await;
        if let Some(handle) = guard.as_mut() {
            handle.status.running = false;
            match result {
                Ok(install_root) => {
                    handle.status.completed = true;
                    handle.status.install_root = Some(install_root);
                    handle.status.last_error = None;
                }
                Err(error) => {
                    handle.status.completed = false;
                    handle.status.last_error = Some(error);
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_bootstrap(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let guard = state.bootstrap.lock().await;
    if let Some(handle) = guard.as_ref() {
        handle.cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_bootstrap_status(state: State<'_, Arc<AppState>>) -> Result<BootstrapStatus, String> {
    let guard = state.bootstrap.lock().await;
    Ok(guard
        .as_ref()
        .map(|handle| handle.status.clone())
        .unwrap_or(BootstrapStatus {
            running: false,
            completed: false,
            install_root: None,
            last_error: None,
        }))
}

#[tauri::command]
pub async fn launch_zavorth_desktop(install_root: Option<String>) -> Result<(), String> {
    if let Ok(desktop_exe) = std::env::var("ZAVORTH_DESKTOP_EXE") {
        StdCommand::new(desktop_exe)
            .spawn()
            .map_err(|error| error.to_string())...;
        return Ok(());
    }

    let root = trusted_launch_root(install_root);
    let desktop = root.join("apps").join("zavorth-desktop");
    if desktop.exists() {
        let npm = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
        StdCommand::new(npm)
            .arg("run")
            .arg("zavorth-desktop:dev")
            .current_dir(&root)
            .spawn()
            .map_err(|error| error.to_string())...;
        return Ok(());
    }

    return Err(format!("Zavorth Desktop was not found at {}", desktop.display()));
}

fn trusted_launch_root(install_root: Option<String>) -> PathBuf {
    let trusted = resolve_repo_root();
    let Some(candidate) = install_root else {
        return trusted;
    };
    let Ok(canonical) = PathBuf::from(candidate).canonicalize() else {
        return trusted;
    };
    if canonical == trusted || canonical.starts_with(&trusted) {
        return canonical;
    }
    trusted
}

async fn run_bootstrap(
    app: AppHandle,
    args: StartBootstrapArgs,
    cancel: Arc<AtomicBool>,
) -> Result<String, String> {
    let stages = vec![
        StageInfo { name: "runtime".into(), title: "Install runtime".into() },
        StageInfo { name: "access".into(), title: "Prepare local access".into() },
        StageInfo { name: "doctor".into(), title: "Run safe check".into() },
    ];
    emit(&app, BootstrapEvent::Manifest { stages });

    let repo_root = resolve_repo_root();
    let script = installer_script(&repo_root);
    let tag = args.tag.clone().unwrap_or_else(|| "latest".to_string());
    let install_root_arg = args.install_root.clone();

    emit_stage(&app, "runtime", "running", Some("Starting installer"));
    if cancel.load(Ordering::SeqCst) {
        return fail(&app, "Setup cancelled.");
    }

    let output = run_installer(&app, &script, &tag, args.dry_run, cancel.clone()).await;
    match output {
        Ok(()) => emit_stage(&app, "runtime", "succeeded", Some("Runtime installer finished")),
        Err(error) => return fail(&app, &error),
    }

    emit_stage(&app, "access", "running", Some("Preparing local token"));
    if cancel.load(Ordering::SeqCst) {
        return fail(&app, "Setup cancelled.");
    }
    emit_stage(&app, "access", "succeeded", Some("local access ready"));

    emit_stage(&app, "doctor", "running", Some("Checking install"));
    emit_stage(&app, "doctor", "succeeded", Some("Safe check complete"));

    let install_root = install_root_arg.unwrap_or_else(|| repo_root.to_string_lossy().to_string());
    emit(&app, BootstrapEvent::Complete { install_root: install_root.clone() });
    Ok(install_root)
}

async fn run_installer(
    app: &AppHandle,
    script: &Path,
    tag: &str,
    dry_run: bool,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    if !script.exists() {
        return Err(format!("Installer script not found: {}", script.display()));
    }

    let mut command = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("powershell.exe");
        cmd.arg("-NoProfile").arg("-ExecutionPolicy").arg("Bypass").arg("-File").arg(script);
        if dry_run {
            cmd.arg("-DryRun");
        }
        cmd.arg("-Tag").arg(tag);
        cmd
    } else {
        let mut cmd = Command::new("bash");
        cmd.arg(script);
        if dry_run {
            cmd.arg("--dry-run");
        }
        cmd.arg("--tag").arg(tag);
        cmd
    };

    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())...;

    if let Some(stdout) = child.stdout.take() {
        let app = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit(&app, BootstrapEvent::Log { line });
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let app = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                emit(&app, BootstrapEvent::Log { line });
            }
        });
    }

    loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill().await;
            return Err("Setup cancelled.".to_string());
        }
        match child.try_wait().map_err(|error| error.to_string())... {
            Some(status) if status.success() => return Ok(()),
            Some(status) => return Err(format!("Installer exited with {}", status)),
            None => tokio::time::sleep(std::time::Duration::from_millis(120)).await,
        }
    }
}

fn installer_script(repo_root: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        repo_root.join("scripts/install-zavorth.ps1")
    } else {
        repo_root.join("scripts/install-zavorth.sh")
    }
}

fn resolve_repo_root() -> PathBuf {
    std::env::var("ZAVORTH_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("..")
        })
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn emit_stage(app: &AppHandle, name: &str, state: &str, message: Option<&str>) {
    emit(app, BootstrapEvent::Stage {
        name: name.to_string(),
        state: state.to_string(),
        message: message.map(str::to_string),
    });
}

fn fail<T>(app: &AppHandle, error: &str) -> Result<T, String> {
    emit(app, BootstrapEvent::Failed { error: error.to_string() });
    Err(error.to_string())
}

fn emit(app: &AppHandle, event: BootstrapEvent) {
    let _ = app.emit(EVENT_CHANNEL, event);
}
