# Security Policy

Thanks for helping keep WinBorg secure.

## Supported versions

Security fixes are provided for the latest released version. Please update to the newest release before reporting.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security reports.

Instead, report via GitHub Security Advisories:
- Go to: https://github.com/robotnikz/WinBorg/security/advisories
- Click **Report a vulnerability**

If you cannot use GitHub advisories, you may open a draft advisory or contact the maintainer via an alternative channel and include:
- A clear description of the issue and impact
- Reproduction steps / PoC (if safe)
- Affected version(s)
- Any relevant logs (please redact secrets)

## Scope notes

WinBorg interacts with WSL, BorgBackup, SSH keys, and credentials. Please be especially careful not to include:
- Passphrases, private keys, or tokens
- Full repo URLs that contain credentials

## Coordinated disclosure

After receiving a report, we’ll confirm receipt and work on a fix. Please allow reasonable time for triage and a patch release.
