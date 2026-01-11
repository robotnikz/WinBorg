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
*   **Background Jobs:** Schedule backups to run automatically (Hourly/Daily/Weekly).
*   **Notifications:** Get native Windows toasts, **Discord Webhook** alerts, or **Email Notifications** (SMTP) when backups finish or fail.
*   **Pruning:** Automated retention policies (e.g., "Keep 7 daily, 4 weekly").

---

## 🚀 Getting Started

WinBorg leverages the power of WSL (Windows Subsystem for Linux) to provide a robust background engine, but handles the complexity for you.

### 1. Installation & Setup
1.  **Download:** Get the latest installer (`.exe`) from the [Releases Page](https://github.com/robotnikz/WinBorg/releases).
2.  **Install & Launch:** Run the setup.
3.  **Automatic Onboarding:** On first run, WinBorg performs a system health check:
    *   **WSL:** Verifies if the Windows Subsystem for Linux is active. **If missing, WinBorg installs it automatically (requires restart).**
    *   **Borg:** Checks for the backup engine. **If missing, WinBorg installs it for you automatically.**
    *   *WinBorg guides you through the entire process, minimizing/eliminating the need for manual terminal commands.*

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
