# Release checklist

This checklist is the practical “ship it” procedure for WinBorg.

## Automated gates

- `npm run test:pr`
- `npm run test:e2e:full` (recommended before tagging/releases)
- `npm run dist` (packaging)
- `npm audit --omit=dev --audit-level=high` (production deps; see `AUDIT.md` for known dev-tooling-only alerts)

## Manual verification (high-value)

### Fresh machine onboarding

Preconditions:

- Windows 11
- WSL not installed / no Ubuntu distro
- Borg not installed inside Ubuntu

Steps:

1. Launch WinBorg → onboarding opens.
2. Install WSL (admin) → confirm restart required.
3. Restart Windows → relaunch WinBorg.
4. Install Ubuntu (non-admin) → complete username/password prompt.
5. Install Borg (auto) → reach “System Ready”.

### Repo lifecycle

- For SSH repos: create at least one Connection; generate/deploy SSH key; verify **Test SSH** succeeds.
- Add SSH repo by selecting the Connection + repo path; verify host key behavior (strict vs disabled) matches Settings.
- Initialize encrypted repo; verify passphrase handling.

### Job run + notifications

- Create job, run now, verify success toast/log.
- Trigger test notification for configured channels (Windows toast / Discord / Email).

### Mounts

- Mount archive → verify path opens / drive appears.
- Unmount archive → verify cleanup.

## Diagnostics artifacts

When something fails:

- Capture Playwright HTML report (`npx playwright show-report`).
- Attach app logs (main process console output).
- Attach the relevant JSON files from `userData` if safe (redact secrets).
