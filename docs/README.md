# WinBorg Documentation

This folder contains developer-facing documentation for WinBorg.

## Public repository note

This repository is public. Please keep documentation safe to publish:

- Do not include real customer/user data, real hostnames, IPs, emails, or internal URLs.
- Do not include secrets (tokens, passwords, private keys). Use placeholders like `user@host`.
- If you need to share sensitive operational details, keep them in a private/internal location instead of `docs/`.

## Start here

- [Architecture](ARCHITECTURE.md)
- [IPC contract (Renderer ↔ Main)](IPC.md)
- [Testing](TESTING.md)
- [Test strategy (risk-based)](TEST_STRATEGY.md)

## Supporting checklists

- [Test plan](TESTPLAN.md)
- [Functional test matrix](FUNCTIONAL_TEST_MATRIX.md)
- [Compatibility matrix](COMPATIBILITY.md)
- [Operations](OPERATIONS.md)
- [Audit notes](AUDIT.md)
- [Security checklist](SECURITY_CHECKLIST.md)
- [UX checklist](UX_CHECKLIST.md)

## Release & operations

- [Release checklist](RELEASE_CHECKLIST.md)

## Notes

- The app is an Electron desktop application.
- Most “backend” behavior lives in the Electron main process (`electron-main.js`) and small, unit-testable modules under `main/`.
- Borg runs inside WSL (Linux), but the UI is native Windows.
