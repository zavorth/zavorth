# Zavorth Desktop and Setup

Zavorth now has two native desktop surfaces:

- **Zavorth Setup** installs, updates, repairs and checks the local runtime before daily use.
- **Zavorth Desktop** is the daily native chat shell. It manages the local runtime token in the main process, starts the runtime when needed, calls the local API directly and exposes approvals, memory, skills, channels and settings without leaking the token to the renderer.

## Setup Flow

1. Start the setup app.
2. Choose the default install path or keep the current workspace path.
3. Let Setup run the runtime installer, prepare local access and run the safe check.
4. Open Zavorth Desktop.

Setup keeps each step explicit, cancellable and local. It never prints the dashboard token in logs.

## Desktop Flow

1. Desktop checks the local runtime status.
2. If the runtime is already live, Desktop loads the native chat and hydrates it from `/api/experience/home`.
3. If the runtime is not live, Desktop can start it and then retry the native API calls.
4. If access breaks, Desktop can repair the token file and show the log folder.
5. The renderer only sends local API paths to Electron; the main process injects the bearer token and blocks non-API or unsafe paths.

The old web control surface remains available during migration, but Desktop is the intended daily product surface once each feature area is covered natively.

## Commands

```bash
npm run zavorth-desktop:dev
npm run zavorth-desktop:check
npm run zavorth-setup:dev
npm run zavorth-setup:check
npm run zavorth:desktop-setup:check
```

## Packaging Direction

Zavorth Setup is a Tauri app so the installer can stay small. Zavorth Desktop is an Electron app with its own React UI and a native bridge for runtime, files, logs, notifications and update affordances.
