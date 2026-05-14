import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { config } from '../../src/config/index.js';

export type ProductionValidationCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type ProductionValidationReport = {
  ok: boolean;
  checkedAt: string;
  composePath: string;
  dockerfilePath: string;
  hardeningScriptPath: string;
  disasterRecoveryPlanPath: string;
  sandboxPaths: {
    sandboxDoctorPath: string;
    gvisorBootstrapPath: string;
    firecrackerBootstrapPath: string;
    firecrackerSmokePath: string;
  };
  checks: ProductionValidationCheck[];
};

type ValidatorRuntime = {
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

function assertCheck(condition: boolean, id: string, detail: string): ProductionValidationCheck {
  return { id, ok: condition, detail };
}

export class ProductionHardeningValidator {
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;

  constructor(runtime: ValidatorRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public validate(): ProductionValidationReport {
    const composePath = path.resolve(this.projectRoot, 'deploy', 'docker-compose.prod.yml');
    const dockerfilePath = path.resolve(this.projectRoot, 'deploy', 'production.Dockerfile');
    const hardeningScriptPath = path.resolve(this.projectRoot, 'ops', 'production', 'host-hardening.sh');
    const disasterRecoveryPlanPath = path.resolve(this.projectRoot, 'ops', 'recovery', 'DisasterRecoveryPlan.md');
    const sandboxDoctorPath = path.resolve(this.projectRoot, 'scripts', 'sandbox-doctor.sh');
    const gvisorBootstrapPath = path.resolve(this.projectRoot, 'scripts', 'gvisor-wsl-bootstrap.ps1');
    const firecrackerBootstrapPath = path.resolve(this.projectRoot, 'scripts', 'firecracker-host-bootstrap.sh');
    const firecrackerSmokePath = path.resolve(this.projectRoot, 'scripts', 'firecracker-smoke.sh');

    const composeRaw = this.safeRead(composePath);
    const dockerfileRaw = this.safeRead(dockerfilePath);
    const hardeningRaw = this.safeRead(hardeningScriptPath);
    const disasterRecoveryRaw = this.safeRead(disasterRecoveryPlanPath);
    const sandboxDoctorRaw = this.safeRead(sandboxDoctorPath);
    const gvisorBootstrapRaw = this.safeRead(gvisorBootstrapPath);
    const firecrackerBootstrapRaw = this.safeRead(firecrackerBootstrapPath);
    const firecrackerSmokeRaw = this.safeRead(firecrackerSmokePath);
    const compose = this.safeYaml(composeRaw);
    const zavorth = compose?.services?.zavorth || {};

    const healthcheckTest = JSON.stringify(zavorth?.healthcheck?.test || []);
    const volumes = Array.isArray(zavorth?.volumes) ? zavorth.volumes.map(String) : [];
    const securityOpt = Array.isArray(zavorth?.security_opt) ? zavorth.security_opt.map(String) : [];
    const capDrop = Array.isArray(zavorth?.cap_drop) ? zavorth.cap_drop.map(String) : [];
    const tmpfs = Array.isArray(zavorth?.tmpfs) ? zavorth.tmpfs.map(String) : [];
    const ports = Array.isArray(zavorth?.ports) ? zavorth.ports.map(String) : [];
    const environment = this.normalizeEnvironment(zavorth?.environment);
    const loggingOptions = zavorth?.logging?.options || {};

    const checks: ProductionValidationCheck[] = [
      assertCheck(this.existsSync(composePath), 'compose.exists', 'compose de producao existe no deploy oficial'),
      assertCheck(Boolean(compose?.services?.zavorth), 'compose.service', 'compose de producao declara o servico zavorth'),
      assertCheck(zavorth?.restart === 'unless-stopped', 'compose.restart', 'compose reinicia apenas sob politica controlada'),
      assertCheck(environment.NODE_ENV === 'production', 'compose.env.node_env', 'compose declara NODE_ENV=production'),
      assertCheck(environment.ZAVORTH_PROFILE === 'ops', 'compose.env.profile', 'compose usa perfil ops para operacao supervisionada'),
      assertCheck(
        environment.ZAVORTH_CAPABILITY_POLICY === 'ask-on-demand',
        'compose.env.capability_policy',
        'compose preserva capability policy sob demanda',
      ),
      assertCheck(
        environment.ZAVORTH_SELFMOD_POLICY === 'owner_trusted',
        'compose.env.selfmod_policy',
        'compose restringe selfmod real a owner/trusted',
      ),
      assertCheck(
        environment.ZAVORTH_ALLOW_STARTUP_INSTALL === 'false',
        'compose.env.no_startup_install',
        'compose impede instalacao automatica de startup',
      ),
      assertCheck(String(zavorth?.mem_limit || '') === '2048m', 'compose.mem_limit', 'compose fixa limite de memoria de producao'),
      assertCheck(Number(zavorth?.cpus || 0) <= 2, 'compose.cpus', 'compose limita CPU do runtime de producao'),
      assertCheck(Number(zavorth?.pids_limit || 0) <= 256, 'compose.pids_limit', 'compose limita quantidade de processos'),
      assertCheck(zavorth?.read_only === true, 'compose.read_only', 'compose de producao usa rootfs read_only'),
      assertCheck(securityOpt.includes('no-new-privileges:true'), 'compose.no_new_privileges', 'compose de producao ativa no-new-privileges'),
      assertCheck(capDrop.includes('ALL'), 'compose.cap_drop', 'compose de producao remove capabilities extras'),
      assertCheck(tmpfs.includes('/tmp'), 'compose.tmpfs', 'compose de producao usa tmpfs em /tmp'),
      assertCheck(ports.some((entry) => entry.includes('33333')), 'compose.port', 'compose de producao publica a porta 33333'),
      assertCheck(volumes.some((entry) => entry.includes('/usr/src/app/data')), 'compose.volume.data', 'compose de producao persiste /data'),
      assertCheck(volumes.some((entry) => entry.includes('/usr/src/app/tmp')), 'compose.volume.tmp', 'compose de producao persiste /tmp'),
      assertCheck(volumes.some((entry) => entry.includes('/usr/src/app/memory')), 'compose.volume.memory', 'compose de producao persiste /memory'),
      assertCheck(healthcheckTest.includes('/api/auth/status'), 'compose.healthcheck', 'compose de producao valida /api/auth/status'),
      assertCheck(zavorth?.logging?.driver === 'json-file', 'compose.logging.driver', 'compose usa logging json-file previsivel'),
      assertCheck(loggingOptions['max-size'] === '25m', 'compose.logging.max_size', 'compose limita log em 25 MB por arquivo'),
      assertCheck(loggingOptions['max-file'] === '5', 'compose.logging.max_file', 'compose limita rotacao a 5 arquivos'),
      assertCheck(this.existsSync(dockerfilePath), 'dockerfile.exists', 'Dockerfile de producao existe'),
      assertCheck(/CMD\s+\["node",\s*"dist\/host\.js"\]/.test(dockerfileRaw), 'dockerfile.cmd', 'Dockerfile de producao sobe dist/host.js'),
      assertCheck(/USER\s+zavorth/.test(dockerfileRaw), 'dockerfile.user', 'Dockerfile de producao executa como usuario zavorth'),
      assertCheck(/EXPOSE\s+33333/.test(dockerfileRaw), 'dockerfile.port', 'Dockerfile de producao expoe a porta 33333'),
      assertCheck(/VOLUME\s+\["\/usr\/src\/app\/data",\s*"\/usr\/src\/app\/tmp",\s*"\/usr\/src\/app\/memory"\]/.test(dockerfileRaw), 'dockerfile.volumes', 'Dockerfile de producao declara volumes persistentes'),
      assertCheck(/ZAVORTH_PROFILE=ops/.test(dockerfileRaw), 'dockerfile.profile', 'Dockerfile herda perfil ops seguro'),
      assertCheck(/ZAVORTH_CAPABILITY_POLICY=ask-on-demand/.test(dockerfileRaw), 'dockerfile.capability_policy', 'Dockerfile preserva capabilities sob demanda'),
      assertCheck(/ZAVORTH_ALLOW_STARTUP_INSTALL=false/.test(dockerfileRaw), 'dockerfile.no_startup_install', 'Dockerfile bloqueia startup install automatico'),
      assertCheck(this.existsSync(hardeningScriptPath), 'hardening.exists', 'script de hardening existe'),
      assertCheck(/^#!\/usr\/bin\/env bash/m.test(hardeningRaw), 'hardening.shebang', 'script de hardening usa shebang bash'),
      assertCheck(/^set -euo pipefail$/m.test(hardeningRaw), 'hardening.strict', 'script de hardening ativa modo estrito'),
      assertCheck(/ufw default deny incoming/.test(hardeningRaw), 'hardening.ufw.default', 'script de hardening fecha incoming por padrao'),
      assertCheck(/ufw allow "\$\{SSH_PORT\}\/tcp"/.test(hardeningRaw), 'hardening.ufw.ssh', 'script de hardening libera SSH parametrico'),
      assertCheck(/ufw allow "\$\{ZAVORTH_PORT\}\/tcp"/.test(hardeningRaw), 'hardening.ufw.zavorth', 'script de hardening libera porta do Zavorth'),
      assertCheck(/systemctl enable auditd/.test(hardeningRaw) && /systemctl start auditd/.test(hardeningRaw), 'hardening.auditd', 'script de hardening prepara auditd'),
      assertCheck(/99-zavorth-hardening\.conf/.test(hardeningRaw) && /kernel\.dmesg_restrict=1/.test(hardeningRaw), 'hardening.sysctl', 'script aplica sysctl baseline defensivo'),
      assertCheck(/setfacl -m u:node:rw \/dev\/kvm/.test(hardeningRaw), 'hardening.kvm_acl', 'script de hardening ajusta ACL de /dev/kvm quando presente'),
      assertCheck(this.existsSync(disasterRecoveryPlanPath), 'dr.exists', 'runbook de disaster recovery existe'),
      assertCheck(/npm run ops:backup -- --json/.test(disasterRecoveryRaw), 'dr.backup', 'runbook de DR inclui snapshot antes de restaurar'),
      assertCheck(/npm run ops:restore -- --manifest/.test(disasterRecoveryRaw), 'dr.restore', 'runbook de DR inclui restore e dry-run'),
      assertCheck(/npm run ops:production:check -- --json/.test(disasterRecoveryRaw), 'dr.production_check', 'runbook de DR encerra com check de producao'),
      assertCheck(/npm run sandbox:doctor:smoke/.test(disasterRecoveryRaw), 'dr.sandbox_doctor', 'runbook de DR valida sandbox depois da recuperacao'),
      assertCheck(/npm run sandbox:firecracker:smoke/.test(disasterRecoveryRaw), 'dr.firecracker_smoke', 'runbook de DR cobre Firecracker quando habilitado'),
      assertCheck(this.existsSync(sandboxDoctorPath), 'sandbox.doctor.exists', 'sandbox doctor Linux existe'),
      assertCheck(/^set -euo pipefail$/m.test(sandboxDoctorRaw), 'sandbox.doctor.strict', 'sandbox doctor usa modo estrito'),
      assertCheck(/command -v runsc/.test(sandboxDoctorRaw), 'sandbox.gvisor.runsc', 'sandbox doctor valida runsc/gVisor'),
      assertCheck(/command -v firecracker/.test(sandboxDoctorRaw), 'sandbox.firecracker.binary', 'sandbox doctor valida binario Firecracker'),
      assertCheck(/\/dev\/kvm/.test(sandboxDoctorRaw), 'sandbox.kvm', 'sandbox doctor valida acesso a /dev/kvm'),
      assertCheck(/--smoke/.test(sandboxDoctorRaw), 'sandbox.smoke_mode', 'sandbox doctor possui modo smoke'),
      assertCheck(this.existsSync(gvisorBootstrapPath), 'sandbox.gvisor.bootstrap.exists', 'bootstrap gVisor/WSL existe'),
      assertCheck(/runsc/.test(gvisorBootstrapRaw) && /dockerd/.test(gvisorBootstrapRaw), 'sandbox.gvisor.bootstrap', 'bootstrap gVisor configura runsc no Docker isolado'),
      assertCheck(this.existsSync(firecrackerBootstrapPath), 'sandbox.firecracker.bootstrap.exists', 'bootstrap Firecracker existe'),
      assertCheck(/firecracker/.test(firecrackerBootstrapRaw) && /\/dev\/kvm/.test(firecrackerBootstrapRaw), 'sandbox.firecracker.bootstrap', 'bootstrap Firecracker valida KVM e binario'),
      assertCheck(this.existsSync(firecrackerSmokePath), 'sandbox.firecracker.smoke.exists', 'smoke Firecracker existe'),
      assertCheck(/ZAVORTH_FIRECRACKER_ENABLED/.test(firecrackerSmokeRaw) && /FirecrackerSandboxRuntime/.test(firecrackerSmokeRaw), 'sandbox.firecracker.smoke', 'smoke Firecracker aciona runtime real sob flag explicita'),
    ];

    return {
      ok: checks.every((entry) => entry.ok),
      checkedAt: new Date().toISOString(),
      composePath,
      dockerfilePath,
      hardeningScriptPath,
      disasterRecoveryPlanPath,
      sandboxPaths: {
        sandboxDoctorPath,
        gvisorBootstrapPath,
        firecrackerBootstrapPath,
        firecrackerSmokePath,
      },
      checks,
    };
  }

  private safeRead(filePath: string): string {
    try {
      return String(this.readFileSync(filePath, 'utf8') || '');
    } catch {
      return '';
    }
  }

  private safeYaml(input: string): Record<string, any> {
    try {
      return (yaml.load(input) || {}) as Record<string, any>;
    } catch {
      return {};
    }
  }

  private normalizeEnvironment(value: unknown): Record<string, string> {
    if (Array.isArray(value)) {
      return Object.fromEntries(
        value
          .map((entry) => String(entry || '').split('='))
          .filter(([key]) => Boolean(String(key || '').trim()))
          .map(([key, ...rest]) => [String(key).trim(), rest.join('=').trim()]),
      );
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .map(([key, entry]) => [key, String(entry ?? '').trim()]),
      );
    }
    return {};
  }
}
