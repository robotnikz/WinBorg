<div align="center">

  <img src="public/icon.png" alt="WinBorg Logo" width="128" height="128" />

  # WinBorg Manager

  **The native Windows GUI for BorgBackup.**

  Borg backups on Windows — with guided setup, scheduling, and restores.

  <!-- Badges (optional: keep consistent with README.md) -->
  [![Release](https://img.shields.io/github/v/release/robotnikz/WinBorg?style=for-the-badge&color=blue)](https://github.com/robotnikz/WinBorg/releases)
  [![CI/CD](https://img.shields.io/github/actions/workflow/status/robotnikz/WinBorg/cicd.yml?branch=main&style=for-the-badge&label=CI%2FCD)](https://github.com/robotnikz/WinBorg/actions/workflows/cicd.yml)
  [![Downloads](https://img.shields.io/github/downloads/robotnikz/WinBorg/total?style=for-the-badge&label=Downloads&color=brightgreen)](https://github.com/robotnikz/WinBorg/releases)
  [![License](https://img.shields.io/github/license/robotnikz/WinBorg?style=for-the-badge)](LICENSE)
  [![Tech Stack](https://img.shields.io/badge/Stack-Electron%20%7C%20React%20%7C%20TS-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)

  **Quick links:**
  [Download (Installer)](https://github.com/robotnikz/WinBorg/releases/latest) •
  [All Releases](https://github.com/robotnikz/WinBorg/releases) •
  [Docs](docs/README.md) •
  [Testing](docs/TESTING.md) •
  [Security](SECURITY.md)

</div>

---

## ⚡ What is WinBorg?

WinBorg Manager is a modern Windows 10/11 desktop app that brings **[BorgBackup](https://borgbackup.readthedocs.io/en/stable/)** to a **Windows-native GUI**:

- **Encrypted, deduplicated, compressed backups** (Borg)
- **Guided onboarding** for **WSL2 + Ubuntu + Borg** (no CLI wrestling)
- **Jobs & schedules**, **retention/prune**, **notifications**
- **Restore, browse, diff, mount** — because backups without restore aren’t backups

> WinBorg is **Windows-first**. Your backups remain **standard Borg repositories** (no vendor lock-in).

---

## 🖼️ Gallery

<div align="center">
  <img src="public/dashboard.png" alt="Dashboard" width="45%" />
  &nbsp;
  <img src="public/repos.png" alt="Repositories" width="45%" />
  <br/>
  <br/>
  <img src="public/archives.png" alt="Archives" width="45%" />
  &nbsp;
  <img src="public/mounts.png" alt="Mounts" width="45%" />
</div>

---

## 🚀 Quickstart (5 minutes)

1. **Download the installer**: https://github.com/robotnikz/WinBorg/releases/latest
2. Launch WinBorg → follow onboarding for **WSL2 + Ubuntu + BorgBackup**.
3. **Add a repository** (e.g. BorgBase / Hetzner StorageBox / NAS via SSH).
4. **Create a job** (e.g. Documents/Desktop/Pictures) → **Run**.
5. Recommended: do a **test restore** (extract a file from an older archive).

If anything gets stuck, see [docs/OPERATIONS.md](docs/OPERATIONS.md) and [docs/TESTING.md](docs/TESTING.md).

---

## 🧰 Manual install (advanced)

If you prefer to install dependencies yourself (or you’re in a locked-down environment), you can prepare WSL + Ubuntu + Borg manually and then run WinBorg.

### 1) Enable WSL (Admin)

Run PowerShell **as Administrator**:

```powershell
wsl --install --no-distribution
# Restart Windows after this finishes.
```

### 2) Install Ubuntu (Non-Admin)

After reboot, run PowerShell as your normal user:

```powershell
wsl --install -d Ubuntu
```

Ubuntu may prompt you to create a new Linux username/password — complete that step.

### 3) Install BorgBackup inside Ubuntu

Open the Ubuntu terminal and run:

```bash
sudo apt update
sudo apt install -y borgbackup
```

### 4) Verify Borg

```bash
which borg
# Expected: /usr/bin/borg
```

After that, open WinBorg and you should be able to skip most onboarding steps.

---

## 🧩 Why WSL?

Borg is most stable and best supported on Linux. WinBorg uses **WSL2** to run the **official Linux Borg binaries** — while giving you a polished Windows UI.

This means:
- maximum compatibility with the Borg ecosystem (CLI, BorgBase, borgmatic, etc.)
- no proprietary backup format
- Windows integration where it matters (tray, autostart, Explorer open, etc.)

---

## ✨ Features (user-facing)

### Setup & Security
- Guided system checks and installation for **WSL2**, **Ubuntu**, **BorgBackup**
- SSH key management: generate keys, deploy keys, test connectivity
- Optional provisioning: install Borg on a remote Debian/Ubuntu server
- **Key export / recovery** for Borg repositories

### Backup & Automation
- Jobs with **multiple source paths**, exclude patterns, compression
- Scheduling (e.g. hourly/daily) + rules (e.g. battery/offline)
- Retention/Prune policies (e.g. keep 7 daily, 4 weekly, …)
- Maintenance: prune + compact

### Restore & Transparency
- Archive list with metadata & stats
- **Archive browser**: find files/folders in older snapshots
- **Restore / extract**: selectively bring data back
- **Diff viewer**: see what changed between two archives
- **Mounts**: mount archives as a filesystem (FUSE inside WSL)

### Monitoring & UX
- Native Windows notifications + Discord webhook + SMTP
- Tray menu (quick actions, update check, stop mounts)
- Settings export/import (optionally including secrets)

---

## 🎯 Who is WinBorg for?

- Windows users who want Borg but don’t want to live in a Borg CLI
- HomeLab/NAS users with SSH-based repositories
- BorgBase / Hetzner StorageBox users
- Security- and ransomware-aware users (client-side encryption + append-only via BorgBase)

---

## ✅ Requirements

- Windows 10/11 with **WSL2** (virtualization enabled)
- Ubuntu WSL distro (WinBorg can install this during onboarding)
- BorgBackup inside Ubuntu (WinBorg can install this during onboarding)
- For remote repos: SSH access to your backup target (StorageBox/BorgBase/VPS/NAS)
- For mounts: FUSE prerequisites inside WSL (WinBorg checks/fixes many things automatically; missing `/dev/fuse` may require WSL update + reboot/shutdown)

---

## 🛠️ Troubleshooting (FAQ)

- **WSL setup required / install fails**: ensure virtualization (VT-x/AMD-V) is enabled; reboot after `wsl --install`.
- **Ubuntu asks for username/password**: expected; complete Ubuntu first-run setup.
- **BorgBackup not found**: use WinBorg auto-install or run `sudo apt update && sudo apt install -y borgbackup` in Ubuntu.
- **SSH permission denied (publickey)**: use WinBorg’s “Install SSH Key”; verify host/user/port (Hetzner StorageBox often uses port 23).
- **Mounts fail**: FUSE preflight runs; if `/dev/fuse` is missing, update WSL and reboot/shutdown; see [docs/OPERATIONS.md](docs/OPERATIONS.md).

---

## 🆚 Comparison (short & honest)

- **Vorta**: excellent Borg desktop client, but primarily macOS/Linux — WinBorg is Windows-first with WSL onboarding.
- **Duplicati**: huge range of cloud backends and central management — WinBorg focuses on Borg-native workflows, restore/mount UX, and no lock-in.
- **BorgBase**: hosting/monitoring/2FA/append-only — WinBorg is a great Windows client for BorgBase repositories.

---

## 🔒 Security

Please read [SECURITY.md](SECURITY.md).

Important: With Borg, if you lose **both** your key **and** passphrase, the data cannot be recovered. WinBorg includes key export/recovery to help prevent this.

---

## 🧪 Testing

See [docs/TESTING.md](docs/TESTING.md)

```bash
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
```

---

## 🧱 Developers / Project structure

- Renderer: React + TypeScript in `src/`
- Main process: `electron-main.js`
- Unit-testable main modules: `main/`

More: [docs/README.md](docs/README.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
npm run test:e2e:manual
```

More details: see [docs/TESTING.md](docs/TESTING.md).

## 🤝 Contributing

We welcome contributions!

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/NewThing`).
3.  Commit your changes (we use **Semantic Release**, so please use conventional commits like `feat:`, `fix:`, `docs:`).
4.  Push and open a Pull Request targeting `main`.

### Running Locally
```bash
# Install deps
npm install

# Run dev mode (Vite + Electron)
# - `electron` uses the default Vite port (5174)
# - `electron:dev` auto-picks a free port (handy if 5174 is already in use)
npm run electron
# or
npm run electron:dev

# Run tests
npm run test
```

---
