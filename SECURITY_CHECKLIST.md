# SECURITY_CHECKLIST (WinBorg)

Practical security checklist for WinBorg releases.

## Secrets & sensitive data

- Passphrases are stored separately from the main DB (not in `data.json`).
- Passphrases are not logged (console, terminal log stream, crash reports).
- Export/import flows do not include secrets unless explicitly requested.

## IPC surface

- IPC channel names are treated as API; contract tests pass.
- No IPC handler accepts arbitrary shell command strings.
- Prefer `execFile` / `spawn` with argument arrays over shell invocations.

## SSH safety

- Host key checking is on by default.
- Any “disable host check” option is clearly labeled and opt-in.
- SSH key install paths do not expose credentials in logs.

## WSL/Borg orchestration

- Commands executed in WSL are parameterized (no string concatenation from untrusted input).
- Paths are validated/sanitized where applicable.

## Updater

- Release artifacts are built from CI.
- Ensure update channels and signing settings are correct for Windows.

## Dependencies

- Run `npm audit` (or equivalent) before release.
- Confirm no new critical vulnerabilities without a mitigation plan.
