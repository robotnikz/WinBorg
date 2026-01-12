<div align="center">

  <img src="public/icon.png" alt="WinBorg Logo" width="128" height="128" />

  # WinBorg Manager
  
  **The native Windows GUI for BorgBackup.**
  
  Stop wrestling with CLI commands. Start backing up reliably.
  Enterprise-grade security meets Windows 11 elegance.

  <!-- Badges -->
  [![Release](https://img.shields.io/github/v/release/robotnikz/WinBorg?style=for-the-badge&color=blue)](https://github.com/robotnikz/WinBorg/releases)
  [![License](https://img.shields.io/github/license/robotnikz/WinBorg?style=for-the-badge)](LICENSE)
  [![Tech Stack](https://img.shields.io/badge/Stack-Electron%20%7C%20React%20%7C%20TS-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
  
</div>

---

## ⚡ What is WinBorg?

WinBorg Manager is a modern GUI that brings the power of **BorgBackup** to Windows without the complexity. 

By leveraging **WSL2 (Windows Subsystem for Linux)**, it runs the official, unmodified Linux binaries of BorgBackup for maximum stability and performance, while presenting you with a completely native, polished Windows 11-style interface.

Whether you're backing up your local Documents to a NAS, or your entire dev environment to BorgBase or Hetzner StorageBox, WinBorg makes it simple.

## ✨ Key Features

### 🛡️ Core Reliability
*   **WSL Native:** Runs *inside* your WSL distribution for 100% Borg compatibility. No experimental Windows binaries or Cygwin hacks.
*   **Encryption First:** Full support for `repokey` (password protected) and `keyfile` encryption.
*   **Auto-Healing:** Automatically runs checks on your repositories to ensure data integrity.

### 📂 Full Management Suite
*   **Repositories:** Add and manage multiple remote (SSH) or local repositories.
*   **Archives:** Browse all your snapshots with detailed metadata (size, time, duration).
*   **File Browser:** Explore the contents of *any* old archive and download/restore specific files effortlessly.
*   **Mounting:** Mount archives as a FUSE filesystem (requires configured FUSE inside WSL).
*   **Diff Viewer:** See exactly what changed between two backups (Added/Modified/Deleted files) with a visual diff tool.

### 🤖 Automation & Monitoring
*   **Auto-Updater:** Built-in update system that checks for new releases on startup. Supports silent background downloading and "Update Later" workflow functionality.
*   **Background Jobs:** Schedule backups to run automatically (Hourly/Daily/Weekly).
*   **Notifications:** Get native Windows toasts, **Discord Webhook** alerts, or **Email Notifications** (SMTP) when backups finish or fail.
*   **Pruning:** Automated retention policies (e.g., "Keep 7 daily, 4 weekly").

---

## � Gallery

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

## �🚀 Getting Started

WinBorg leverages the power of WSL (Windows Subsystem for Linux) to provide a robust background engine, but handles the complexity for you.
### 📋 Prerequisites for Remote Backups
If you plan to backup to a remote server (e.g. Storage Box, VPS, NAS), please ensure:
1.  **BorgBackup is installed on the remote server:** The `borg` binary must be installed and executable on the target machine. WinBorg needs it to initiate the SSH tunnel and manage the repository.
2.  **SSH Authentication:** WinBorg uses the SSH keys inside your WSL distribution. You should configure **key-based authentication** (e.g. `ssh-copy-id`) so WinBorg can connect without manual password prompts during background jobs.
### 1. Installation & Setup
1.  **Download:** Get the latest installer (`.exe`) from the [Releases Page](https://github.com/robotnikz/WinBorg/releases).
2.  **Install & Launch:** Run the setup.
3.  **Automatic Onboarding:** On first run, WinBorg performs a system health check. If components are missing, follow these steps:
    *   **Install WSL:** If prompted, click "Install WSL" and accept the admin prompt.
    *   **Restart:** **You MUST restart your computer** after the WSL installation finishes.
    *   **Re-Open WinBorg:** After restarting, launch WinBorg again. It will detect that WSL is ready.
    *   **Install Borg:** WinBorg will then automatically install the Borg backup engine for you.
    *   *WinBorg guides you through the entire process, minimizing the need for manual terminal commands.*

### 🔧 Manual Setup (Advanced Users)
If you prefer tight control over your system environment, you can install the dependencies manually before running WinBorg. This allows you to skip parts of the auto-onboarding flow.

**1. Install WSL (Ubuntu/Debian)**
WinBorg requires a Debian-based distribution (Ubuntu is recommended).
```powershell
# Open PowerShell as Administrator
wsl --install -d Ubuntu
# RESTART YOUR COMPUTER after this finishes!
```

**2. Install BorgBackup**
After restarting, open your WSL terminal (search "Ubuntu" in Start menu) and run:
```bash
sudo apt update
sudo apt install -y borgbackup
```

**3. Verify Installation**
WinBorg automatically looks for the binary. Verify it exists:
```bash
which borg
# Should return: /usr/bin/borg
```

### 2. Your First Backup
1.  Go to the **Repositories** tab and click `+ Add Repository`.
2.  Enter your SSH URL (e.g., `ssh://u123@your-provider.com/./backups`) or a local path.
3.  Once connected, go to **Dashboard**, create a Job ("Backup Documents"), and hit Run ▶️.

---

## 🛠 Project Structure

WinBorg is built with:
*   **Frontend:** React 18, TypeScript, Tailwind CSS (Custom Dark/Light Theme).
*   **Backend:** Electron (Main Process handles Node-pty & WSL interactions).
*   **Testing:** Vitest (Unit) & Playwright (E2E).

## 🤝 Contributing

We welcome contributions! Please follow the `dev` branch workflow:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/NewThing`).
3.  Commit your changes (we use **Semantic Release**, so please use conventional commits like `feat:`, `fix:`, `docs:`).
4.  Push and open a Pull Request to `dev`.

### Running Locally
```bash
# Install deps
npm install

# Run dev mode (Vite + Electron)
npm run electron

# Run tests
npm run test
```

---
