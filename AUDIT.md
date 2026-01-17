# AUDIT (WinBorg)

This document captures the security posture and audit notes for WinBorg.

WinBorg is an Electron app that orchestrates backups via WSL2 + Borg.

## Threat model (practical)

### Trust boundaries

- **Renderer (UI):** untrusted inputs (user-provided repo URLs, paths, passwords) enter here.
- **Main process:** privileged boundary; performs file I/O, spawns processes, handles secrets.
- **WSL / remote hosts:** external systems; outputs and errors must be treated as untrusted.

### High-risk inputs

- SSH targets/URLs and custom ports
- Local paths and mount points
- Passphrases / passwords
- Environment variables passed into WSL/Borg (`WSLENV`, `BORG_RSH`, etc.)

## Key controls

- IPC channel names are treated as a stable API; drift is protected by unit tests.
- Prefer argument-array process execution (spawn/execFile) over shell strings.
- Secrets are stored separately from main DB and should not be logged.
- CI uses deterministic E2E IPC mocks (no real WSL/SSH/Borg required).

## Known risky areas to review on changes

- `electron-main.js` IPC handlers: ensure no handler accepts arbitrary shell commands.
- WSL helper logic: ensure distro parsing and `wsl` invocation remains safe.
- SSH flows: ensure host-key checking remains opt-in when disabled.
- Export/import: ensure secrets are only included when explicitly requested.

## Release security checklist

- See [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md).

## Notes

This is not a formal third-party audit report; it is the project’s living security notes.
