# WinBorg Manager

![WinBorg Manager Dashboard](public/dashboard.png)

[![Release](https://github.com/robotnikz/WinBorg/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/robotnikz/WinBorg/actions/workflows/release.yml)

**The modern, native Windows GUI for BorgBackup.**

WinBorg Manager bridges the gap between the powerful, command-line-driven **BorgBackup** and the familiar **Windows** desktop experience. It leverages the **Windows Subsystem for Linux (WSL)** to run Borg in its native environment, providing maximum performance and reliability while offering a clean, modern UI styled for Windows 11.

## 🌟 Why WinBorg?

*   **Native Performance, Native UI:** Get the full speed and stability of Borg running on Linux, without sacrificing the comfort of a polished, intuitive Windows application.
*   **Set It and Forget It:** A powerful built-in scheduler and automatic pruning policies mean you can set up your backups once and have peace of mind.
*   **Seamless Integration:** Mount your backup archives as virtual drives and browse them directly in Windows Explorer, just like any other folder.
*   **Built for Security:** Securely manages your repository passphrases using Windows' built-in credential manager.

## 🚀 Features

### Core Functionality
*   **Stable WSL Integration:** Runs Borg in a native Linux environment (Ubuntu/Debian) for maximum speed and compatibility.
*   **Broad Repository Support:** Manage local or remote repositories (SSH, Hetzner Storage Box, BorgBase, Rsync.net).
*   **Secure Encryption:** Full support for `repokey` and `keyfile` encryption modes with secure, isolated passphrase management.

### Backup & Scheduling
*   **Automated Scheduler:** Run backup jobs **Hourly** or **Daily** automatically in the background, even when the app is closed to the tray.
*   **Persistent Backup Jobs:** Define multiple jobs (e.g., "Documents", "Projects") with specific source paths and exclusion filters.
*   **Advanced Retention Policies (Pruning):** Automatically clean up old archives using flexible rules (keep daily, weekly, monthly, yearly).
*   **Efficient Compression:** Full support for `lz4`, `zstd`, and `zlib` compression to save space.

### Restoration & Analysis
*   **One-Click Mounting:** Mount archives to a drive letter (e.g., `Z:`) and browse files seamlessly in **Windows Explorer**.
*   **Integrated Archive Browser:** Find and restore specific files or folders directly from the app without mounting.
*   **Visual Diff Viewer:** Visually compare two archives to see exactly what files were added, removed, or modified.
*   **Repository Health:** Run `borg check` and `borg compact` operations with real-time progress bars and ETA calculation.

### UX & System Integration
*   **Modern Windows 11 Design:** A clean, responsive UI with Mica effects, dark mode support, and a native look & feel.
*   **System Tray Icon:** Minimizes to the tray to keep backup jobs running quietly and efficiently in the background.
*   **Native Notifications:** Get native Windows notifications for backup success, failure, or scheduled runs.
*   **Automatic Lock Management:** Detects and helps resolve stalled lock files (`lock.roster`) with a simple UI.

---

## 🛠️ Installation & Setup Guide

### Prerequisites

1.  **WSL (Windows Subsystem for Linux):**
    *   Open PowerShell as Administrator and run: `wsl --install`
    *   This will typically install the "Ubuntu" distribution. Restart your PC after it's done.
    *   Open "Ubuntu" from the Start Menu to complete the initial setup (create a username/password).

2.  **BorgBackup & FUSE (Inside WSL):**
    *   Open your Ubuntu terminal and run the following command to install everything you need:
        ```bash
        sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
        ```

3.  **FUSE Configuration (For Mounting):**
    *   To allow Windows Explorer to see mounted archives, run this once in your Ubuntu terminal:
        ```bash
        echo "user_allow_other" | sudo tee -a /etc/fuse.conf
        ```

### Installation

1.  Download the latest installer (`.exe`) from the [**Releases Page**](https://github.com/robotnikz/WinBorg/releases).
2.  Run the installer.
3.  *Note:* As the app is not code-signed, Windows SmartScreen will likely show a warning. Click **"More Info" -> "Run Anyway"** to proceed.

---

## 📖 Quick Start

### 1. Connect a Repository
*   Go to the **Repositories** view.
*   Click **Add Repository**.
*   Choose a template (like Hetzner or BorgBase) or enter your SSH path manually.
    *   *Tip:* Check "Trust Host" on the first connection to a new server to automatically add its key.

### 2. Create a Backup Job
*   On the Repository card, click the **Briefcase Icon** (Manage Jobs).
*   Click **Create First Job**.
*   **General Tab:** Name your job (e.g., "Work Files") and select the Source Folder on your PC.
*   **Schedule Tab:** Enable "Schedule" and choose a daily time.
*   **Retention Tab:** Enable "Prune" and configure your desired retention policy (e.g., Keep 7 Days, 4 Weeks).
*   Click **Save Job**. The scheduler is now active and will run automatically!

### 3. Restore Files
*   **Option A (Mount in Explorer):** Go to the **Archives** view, click **Mount** on any snapshot. Then, navigate to the **Mounts** view and click **Open** to browse files in Windows Explorer.
*   **Option B (In-App Browser):** In the **Archives** view, click the **Folder Icon** to browse files directly inside the app. Select what you need and click **Download Selection**.

---

## 🔧 Troubleshooting

**"Connection Closed" or SSH Errors**
*   This almost always means your SSH Public Key is not authorized on the server.
*   You can generate a new key in WSL via `ssh-keygen -t ed25519` and view the public key with `cat ~/.ssh/id_ed25519.pub`. Copy this key to your backup provider.

**"Mount Failed: FUSE missing or permission denied"**
*   Ensure you ran the FUSE configuration command from the "Prerequisites" section above. WinBorg will attempt to fix permissions, but this initial setup is sometimes required.

**App says "Repo is Locked"**
*   This happens if a backup was interrupted (e.g., PC shutdown, network loss). Borg creates a lock to prevent data corruption.
*   Go to the **Repositories** view and click the **Unlock** button on the affected repository card. Use this only if you are sure no other process is currently using the repository.

---

## 💻 Development

Contributions and ideas are welcome!

```bash
# Clone the repository
git clone https://github.com/robotnikz/WinBorg.git

# Install dependencies
npm install

# Run the app in development mode
npm run electron
```

## 📄 License

This project is licensed under the MIT License.