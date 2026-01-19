# IPC contract (Renderer ↔ Main)

This document describes the stable IPC surface between the renderer and the Electron main process.

## Principles

- **Renderer calls main**, never the reverse, unless streaming logs/events.
- Prefer `ipcRenderer.invoke(...)` / `ipcMain.handle(...)` for request/response.
- Use `ipcRenderer.send(...)` / `ipcMain.on(...)` for fire-and-forget events.
- Treat channel names as a public API. If you rename one, update both sides and the IPC contract tests.

## Channels

The following list is derived from `electron-main.js` IPC registrations.

### App / window / updater

- `get-app-version` (invoke → string)
- `check-for-updates` (invoke)
- `download-update` (send)
- `install-update` (send)
- `update-available` (event)
- `download-progress` (event)
- `update-downloaded` (event)
- `update-error` (event)
- `window-minimize` (send)
- `window-maximize` (send)
- `window-close` (send)
- `set-progress` (send)

### Persistence

- `get-db` (invoke → DB snapshot)
- `save-db` (invoke, payload: partial DB)
- `export-app-data` (invoke, payload: `{ includeSecrets?: boolean }`)
- `import-app-data` (invoke, payload: `{ includeSecrets?: boolean }`)

### Settings / tray behavior

- `set-close-behavior` (send, payload: boolean)
- `sync-scheduler-data` (send, payload: `{ jobs, repos }`)
- `settings:toggleAutoStart` (send, payload: boolean)
- `settings:getAutoStartStatus` (send)

### Notifications

- `get-notification-config` (invoke)
- `save-notification-config` (invoke, payload: config object)
- `test-notification` (invoke, payload: type)

### Secrets

- `save-secret` (invoke, payload: `{ repoId, passphrase }`)
- `delete-secret` (invoke, payload: `{ repoId }`)
- `has-secret` (invoke, payload: `{ repoId }` → `{ hasSecret: boolean }`)

### File system helpers

- `get-downloads-path` (invoke)
- `create-directory` (invoke, payload: dirPath)
- `select-directory` (invoke)
- `open-path` (send, payload: pathString)

### Borg execution + mounts

- `borg-spawn` (invoke, payload: `{ args, commandId, useWsl, executablePath, envVars, forceBinary?, repoId?, cwd?, wslUser? }`)
- `borg-stop` (invoke, payload: `{ commandId }`)
- `borg-mount` (invoke, payload: `{ args, mountId, useWsl, executablePath, envVars, repoId? }`)
- `borg-unmount` (invoke, payload: `{ mountId, localPath, useWsl, executablePath }`)
- `terminal-log` (event, payload: `{ id, text }`) — streamed output

### System onboarding (WSL/Borg)

- `system-check-wsl` (invoke)
- `system-install-wsl` (invoke)
- `system-install-ubuntu` (invoke)
- `system-check-borg` (invoke)
- `system-install-borg` (invoke)
- `system-reboot` (invoke)

### SSH

- `ssh-key-manage` (invoke, payload: `{ action, type }`)
- `ssh-key-install` (invoke, payload: `{ target, password, port? }`)
- `ssh-install-borg` (invoke, payload: `{ target, password, port? }`)
- `ssh-test-connection` (invoke, payload: `{ target, port? }`)
- `ssh-check-borg` (invoke, payload: `{ target, port? }`)

## Tests that protect this contract

- Unit-level channel presence and drift checks live under `src/test/`.
- Playwright E2E tests inject deterministic IPC mocks for the renderer.
