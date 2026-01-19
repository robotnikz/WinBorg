# OPERATIONS (WinBorg)

This document is the day-2 operations runbook for WinBorg (install, backup/restore, troubleshooting).

## Scope

WinBorg is an Electron desktop app. Most persistent state is stored under Electron `userData`.

- App runtime: Windows 10/11
- Backup engine runtime: Borg inside WSL2 Linux distro (Ubuntu/Debian)

## Where data lives

WinBorg persists JSON files under Electron `userData`:

- `data.json` (repos, jobs, settings, UI state)
- `secrets.json` (repo passphrases; stored separately)
- `notifications.json` (notification config)

The main process uses atomic writes and `.bak` fallbacks.

## Backups (WinBorg configuration)

### Backup user data (recommended before upgrading)

1. Close WinBorg.
2. Locate `userData` (varies by install channel):
   - In general: `%APPDATA%/<ProductName>` (Electron default)
3. Copy the entire folder to a safe location.

### Restore user data

1. Close WinBorg.
2. Replace the current `userData` folder with the previously backed up one.
3. Start WinBorg.

## Upgrades

- Prefer upgrading via the normal installer flow.
- If an upgrade appears to “reset” data, verify the `userData` location and whether it was preserved.

## Troubleshooting

### WSL missing / disabled

Symptoms:
- Onboarding shows WSL missing.

Checks:
- `wsl --status`
- `wsl --list`

Common causes:
- Windows optional components disabled.
- Virtualization not enabled (BIOS/UEFI).

### “No distro installed” / Docker default distro

Symptoms:
- Onboarding reports WSL enabled but no Ubuntu/Debian.

Fix:
- Install Ubuntu via onboarding or `wsl --install -d Ubuntu`.

### Borg missing inside WSL

Symptoms:
- Onboarding reports Borg missing.

Fix:
- Use onboarding “Install Borg (Auto)”.

### Mounts fail (FUSE missing)

Symptoms:
- Mount flow shows a WSL/FUSE configuration modal.

Fix:
- Follow the instructions in-app (WSL configuration / required packages) and re-try.

## Diagnostics bundle

When reporting issues, collect:

- App version + Windows version
- WSL status (`wsl --status`, `wsl --list`)
- A redacted copy of `data.json` (remove passwords/hosts if needed)
- E2E report if relevant: `npx playwright show-report`
