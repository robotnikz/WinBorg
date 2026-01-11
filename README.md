<div align="center">

  <img src="public/icon.png" alt="WinBorg Logo" width="128" height="128" />

  # WinBorg Manager
  
  **The Ultimate Windows GUI for BorgBackup.**
  
  Stop wrestling with CLI. Start backing up. Enterprise-grade security with Windows 11 elegance.

  <!-- Badges -->
  [![Release](https://img.shields.io/github/v/release/robotnikz/WinBorg?style=for-the-badge&color=blue)](https://github.com/robotnikz/WinBorg/releases)
  [![CI/CD Status](https://img.shields.io/github/actions/workflow/status/robotnikz/WinBorg/release.yml?style=for-the-badge)](https://github.com/robotnikz/WinBorg/actions/workflows/release.yml)
  [![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%2010-0078D6?style=for-the-badge&logo=windows)](https://microsoft.com)
  [![License](https://img.shields.io/github/license/robotnikz/WinBorg?style=for-the-badge)](LICENSE)
  [![Tech Stack](https://img.shields.io/badge/Stack-Electron%20%7C%20React%20%7C%20TS-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
  
</div>

---

## ⚡ What is WinBorg?

BorgBackup is amazing, but using it on Windows via command line can be a hassle. **WinBorg Manager** changes that. 

It acts as a native bridge to **WSL (Windows Subsystem for Linux)**, giving you the raw speed and reliability of Linux-native Borg, wrapped in a beautiful **Windows 11 Mica-style** interface. Whether you are backing up to a local NAS, Hetzner StorageBox, or BorgBase, WinBorg makes it seamless.

## ✨ Key Features

### 🛡️ Secure & Reliable
Don't trust the cloud? Good.
*   **Encryption Support:** Full support for **Repokey & Keyfile** encryption. Your keys never leave your machine.
*   **Native Borg Core:** Runs the official Borg binary inside WSL for 100% compatibility and reliability.
*   **Automated Pruning:** Set it and forget it. WinBorg automatically cleans up old archives based on your rules (Keep 7 dailies, 4 weeklies, etc.).

### 📂 Seamless Integration
Use your backups like a regular drive.
*   **Mount as Drive:** Mount any backup archive as a virtual drive (e.g., `Z:`) with a single click.
*   **Explorer Support:** Browse, drag, drop, and restore single files directly via Windows Explorer.
*   **Visual Diff Viewer:** Wondering what changed? The built-in Diff Viewer highlights added, modified, and deleted files between any two archives.

### 🤖 Automation & Alerts
*   **Background Scheduler:** Persistent hourly or daily backup jobs that run even when the main window is closed (System Tray mode).
*   **Smart Notifications:** Get a native Windows notification, **Discord Ping**, or **Email** immediately when a backup succeeds or fails.
*   **Storage Efficiency:** Live dashboard tracking deduplication ratio, compressed size, and original size.

---

## 📸 Screenshots

| **Dashboard View** | **Repository Management** |
|:---:|:---:|
| <img src="public/dashboard.png" alt="Dashboard" width="400"/> | *Coming soon: Repo View* |
| *Real-time statistics & Active Jobs* | *Manage multiple remote repositories* |

---

## 🚀 Getting Started

WinBorg leverages the power of WSL to provide a robust backend.

### Prerequisites (One-time Setup)
1.  **Enable WSL:** Open PowerShell as Admin and run: `wsl --install`. Restart your PC.
2.  **Dependencies:** Use the built-in **Auto-Setup** (WinBorg will prompt you) or manually run:
    ```bash
    wsl -u root apt update && wsl -u root apt install borgbackup -y
    ```

### Installation
1.  Download the latest `.exe` from the [Releases Page](https://github.com/robotnikz/WinBorg/releases).
2.  Run the installer.
    > *Note: Windows SmartScreen may warn you as this open-source app is not code-signed. Click "More Info" -> "Run Anyway".*
3.  **Onboarding:** The app will automatically check if your system is ready and guide you through the setup.

### Your First Backup
1.  **Add Repo:** Click `+` and paste your SSH URL (e.g., `ssh://u123@u123.your-storagebox.de:23/./backups`).
2.  **Create Job:** Select your repo, click the Briefcase icon 💼, and set up a "Daily" job for your `Documents` folder.
3.  **Run:** Click Play ▶️ and watch the magic happen!

---

## 🛠 Tech Stack

*   **Frontend:** React 18, TypeScript, Tailwind CSS (Dark/Light Mode).
*   **Backend:** Electron, Node.js (IPC).
*   **Core:** BorgBackup (via WSL Ubuntu/Debian).

## 🤝 Contributing

Found a bug? Want to add a feature?

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes.
4.  Push to the branch.
5.  Open a Pull Request.

---

<div align="center">
  <sub>Built with 🛡️ and ☕ by Robotnikz</sub>
</div>
