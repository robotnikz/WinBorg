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

### 🛡️ Smart & Secure Setup
*   **Automatic SSH Key Management:** WinBorg handles the complex SSH setup for you. 
    *   **Generate:** Integrated key generator creates secure `Ed25519` keys.
    *   **Deploy:** One-click deployment of your public key to any remote server (Linux VPS, Hetzner StorageBox, etc.).
*   **Remote Server Provisioning:** No need to SSH into your server manually. WinBorg can **automatically install BorgBackup** on your remote Debian/Ubuntu server directly from the GUI.
*   **Strict Security:** Enforces safe practices like mandatory passphrases for encrypted repos and validates host keys.

### 📂 Full Management Suite
*   **Easy Repository Wizard:** 
    *   **Quick Start Templates:** One-click presets for popular providers like **Hetzner Storage Box**, **BorgBase**, **Rsync.net**, and local NAS.
    *   **Smart Auto-Detection:** Automatically detects standard paths and ports (e.g., Port 23 for Hetzner) to prevent configuration errors.
    *   **Connect:** Smart detection of existing repositories.
    *   **Initialize:** Interactive guide to set up new encrypted repositories with secure presets.
*   **Archives:** Browse all your snapshots with detailed metadata (size, time, duration).
*   **File Browser:** Explore the contents of *any* old archive and download/restore specific files effortlessly.
*   **Mounting:** Mount archives as a FUSE filesystem (requires configured FUSE inside WSL).
*   **Diff Viewer:** See exactly what changed between two backups (Added/Modified/Deleted files).

### 🤖 Automation & Monitoring
*   **Auto-Updater:** Built-in update system that checks for new releases periodically.
*   **Background Jobs:** Schedule backups to run automatically (Hourly/Daily/Weekly).
*   **Notifications:** Get native Windows toasts, **Discord Webhook** alerts, or **Email Notifications** (SMTP) when backups finish or fail.
*   **Pruning:** Automated retention policies (e.g., "Keep 7 daily, 4 weekly").
*   **Settings Export/Import:** Backup and restore your WinBorg configuration after reinstalling.

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

## 🚀 Installation & Getting Started

WinBorg is designed to be usable by everyone, not just sysadmins. It automatically handles the installation of the underlying Linux database (Windows Subsystem for Linux) for you.
### 1. Simple Installation
1.  **Download:** Get the latest installer (`.exe`) from the [Releases Page](https://github.com/robotnikz/WinBorg/releases).
2.  **Run Installer:** Double-click the downloaded file. Windows might ask for permission; click "Yes".
3.  **Launch:** Open "WinBorg Manager" from your desktop or Start Menu.

### 2. Automatic Onboarding
When you first open WinBorg, it will check your system health:
1.  **WSL Check:** If you don't have the Linux subsystem installed, WinBorg will offer to install it with one click. 
    *   *Note: You must restart your computer after this step if prompted!*
2.  **Borg Installation:** After the restart, launch WinBorg again. It will automatically download and install the Borg engine effectively creating a "Backup Engine" in the background.

### 3. Creating your First Backup
1.  Click **"Add Repository"**.
2.  **Remote Backup (Recommended):** Use a service like **Hetzner Storage Box** or **BorgBase**.
    *   Enter the Server URL (e.g., `ssh://user@your-server.com`).
    *   **SSH Key Missing?** WinBorg will detect this. Click **"Install SSH Key"**, enter your server password *once*, and WinBorg will secure the connection forever.
    *   **Borg Missing on Server?** If the server doesn't have backup software, WinBorg offers to **"Install Borg on Server"** automatically.
3.  **Initialize:** Give your repo a name and a secure password.
4.  **Done!** You can now create your first backup.

### 🔧 Manual Details (For Advanced Users)
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
*   **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS.
*   **Desktop App:** Electron (main process in `electron-main.js`).
*   **Main-process modules:** `main/` contains dependency-injected helpers used by the Electron main process (keeps logic unit-testable).
*   **WSL/Borg Integration:** Borg runs inside WSL2 using the official Linux binaries.
*   **Testing:** Vitest (unit) + Playwright (Electron E2E with deterministic IPC mocks).
*   **CI:** GitHub Actions runs typecheck, unit tests with coverage, build, and E2E.

## ✅ Testing

```bash
# Unit tests
npm test

# Unit tests with coverage (threshold-gated)
npm run test:coverage

# E2E (Playwright launches Electron)
# Note: the E2E scripts run a build first via pretest hooks.
npm run test:e2e

# Fast smoke subset
npm run test:e2e:smoke
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
