# Zavorth Desktop and Setup

Zavorth now has two native desktop surfaces:

- **Zavorth Setup** installs, updates, repairs and checks the local runtime before daily use.
- **Zavorth Desktop** opens the daily chat shell, manages the local runtime token, starts the runtime when needed and exposes quick access to logs and repair.

## Setup Flow

1. Start the setup app.
2. Choose the default install path or keep the current workspace path.
3. Let Setup run the runtime installer, prepare local access and run the safe check.
4. Open Zavorth Desktop.

Setup keeps each step explicit, cancellable and local. It never prints the dashboard token in logs.

## Desktop Flow

1. Desktop checks the local runtime status.
2. If the runtime is already live, it opens the dashboard with a short-lived local token route.
3. If the runtime is not live, Desktop can start it and then open the dashboard.
4. If access breaks, Desktop can repair the token file and show the log folder.

The dashboard remains the main daily product. The desktop shell exists to remove manual terminal steps and keep startup, repair and local access in one place.

## Commands

```bash
npm run zavorth-desktop:dev
npm run zavorth-desktop:check
npm run zavorth-setup:dev
npm run zavorth-setup:check
npm run zavorth:desktop-setup:check
```

## Packaging Direction

Zavorth Setup is a Tauri app so the installer can stay small. Zavorth Desktop is an Electron app so it can reuse the web dashboard shell while adding native runtime, files, logs, notifications and update affordances.
