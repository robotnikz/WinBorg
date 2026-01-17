# COMPATIBILITY (WinBorg)

This document defines the practical compatibility matrix for WinBorg and the environments we expect it to run in.

WinBorg is an Electron app on Windows that orchestrates BorgBackup inside WSL2.

## Target platforms

- **Primary target:** Windows 11 (user-facing UX and most testing focus)
- **Expected to work:** Windows 10 with WSL2 available (behavior depends on WSL/virtualization state)

## Required components

- **WSL2** enabled
- A supported **Linux distro** installed in WSL (WinBorg primarily targets **Ubuntu**)
- **BorgBackup** installed inside that distro (WinBorg can guide/automate installation)

Optional components (feature-dependent):

- **FUSE inside WSL** for mounting archives
- Network access for remote repos (SSH)

## Common environment states (onboarding)

WinBorg’s onboarding must tolerate these states:

- **WSL missing/disabled** → user must enable/install WSL (admin prompt may be required)
- **WSL enabled, but no distro installed** → user must install Ubuntu (non-admin)
- **WSL enabled, “wrong/default” distro (e.g. Docker)** → user must install/switch to a supported distro
- **Borg missing inside distro** → install Borg via onboarding (“Install Borg (Auto)”) or manually

## Virtualization / VM notes

WSL2 requires virtualization. In VMs, you may need **nested virtualization** enabled.

Symptoms:
- WSL install succeeds but distro fails to start
- Onboarding reports virtualization or kernel issues

## Mounts (FUSE) notes

Archive mounting relies on FUSE inside WSL.

Symptoms:
- Mount fails with guidance to install/configure FUSE

Expected operator action:
- Follow the in-app preflight instructions, then retry.

## CI environment assumptions

CI tests are deterministic and do **not** require real WSL/SSH/Borg:

- Unit tests run in Node/Vitest.
- Electron E2E runs with IPC mocks injected into the renderer.
- “Admin actions / reboot-ish behavior” is kept out of PR smoke tests.

## Known-good matrix (recommended baseline)

| Component | Baseline | Notes |
|---|---|---|
| Windows | Windows 11 | Primary target |
| WSL | WSL2 enabled | Required |
| Distro | Ubuntu | Primary supported distro |
| Borg | Installed inside distro | Required for backup operations |
| Mounts | FUSE configured | Required only for mount features |

## Where to look next

- Testing overview: `docs/TESTING.md`
- Risk-based test plan: `TESTPLAN.md`
- Operations/troubleshooting: `OPERATIONS.md`
- Release procedure: `docs/RELEASE_CHECKLIST.md`
