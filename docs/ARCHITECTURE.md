# Architecture

## High-level view

WinBorg is a Windows desktop app built with Electron.

- **Renderer (UI):** React + TypeScript under `src/`
- **Main process (backend):** `electron-main.js`
- **Unit-testable main modules:** `main/` (scheduler, process manager, persistence helpers, WSL/system handlers)
- **External runtime dependencies:** WSL2 + a Linux distro (Ubuntu) + BorgBackup (inside the distro)

The renderer never runs Borg directly. It calls the main process via Electron IPC. The main process performs privileged operations (process spawning, filesystem writes, WSL, SSH, notifications) and returns results.

## Key modules

### Renderer (`src/`)

- `src/App.tsx`: top-level state, early system checks (WSL/Borg), view routing.
- `src/services/borgService.ts`: the renderer’s IPC client. It wraps `ipcRenderer.invoke/send/on` and provides higher-level methods like `runCommand`, repo init, archive operations.
- `src/views/*`: screen-level flows (dashboard, repositories, jobs, restore (archives/mounts), settings).
- `src/components/*`: reusable UI elements and modals (onboarding, job creation, archive browser, etc.).

Renderer fallback behavior:
- When Electron APIs are not available (e.g. browser/Vite mode), `borgService` provides a safe mock `ipcRenderer` to avoid a white-screen crash.

### Main process (`electron-main.js`)

Responsibilities:

- Creates the main window + tray integration.
- Implements the IPC contract (channels registered via `ipcMain.handle/on`).
- Implements system flows (WSL install/check, Ubuntu install, Borg install/check).
- Spawns Borg and helper processes (`wsl`, `ssh`, `powershell`, etc.) and streams terminal output back to the renderer.
- Maintains runtime state (scheduled jobs, active mounts, active processes).
- Persists app state (repos/jobs/settings) and secrets (repo passphrases) under Electron’s `userData` directory.

Test-mode behavior:
- When `NODE_ENV=test`, the app isolates `userData` to a unique temp folder to make repeated Electron launches stable under Playwright.

### Unit-testable main modules (`main/`)

- `main/persistence.js`: safe read (with `.bak` fallback) and atomic writes for JSON files.
- `main/scheduler.js`: pure scheduling logic (time-based triggers + run de-duplication).
- `main/processManager.js`: child-process tracking/kill utilities; power-save blocker integration.
- `main/systemHandlers.js`: WSL/Borg install/check logic; mostly shelling out to Windows/WSL.
- `main/mountPreflight.js`: preflight checks for FUSE/mounting.
- `main/sshHelpers.js`: SSH key install option resolution.

### WSL + Borg

- Borg is executed in Linux (WSL). WinBorg typically uses `wsl --exec borg ...` and passes environment variables via `WSLENV`.
- Secrets (Borg passphrases) are not injected by the renderer. The main process injects them when required.

## Persistence model

WinBorg uses JSON files in `app.getPath('userData')`:

- `data.json`: main DB (repos, jobs, settings, UI state)
- `secrets.json`: repo passphrases (stored separately)
- `notifications.json`: notification config

Writes are atomic (temp file + replace) and (best-effort) backed up to `.bak`. Reads fall back to `.bak` if the primary is missing/corrupt.

## Main user flows (summary)

- **Onboarding:** renderer calls `system-check-wsl` and `system-check-borg`; if missing, guides user through `system-install-wsl`/`system-install-ubuntu`/`system-install-borg` and reboot.
- **Repositories:** create/edit/delete; connect via SSH; can trigger remote Borg install checks/installation.
- **Connections:** manage SSH hosts (server URL), SSH key generation, key deployment, and SSH connectivity tests.
- **Backups (jobs):** schedule + “run now”; execution happens in main process via `borg-spawn`.
- **Restore (archives & mounts):** list, diff, browse, extract; mount/unmount via `borg-mount` / `borg-unmount` with preflight checks.
- **Notifications:** toast/email/discord (configured in settings, tested via IPC).
- **Updates:** electron-updater channels for check/download/install.
