# WinBorg Manager

![WinBorg Manager Dashboard](public/dashboard.png)

**The modern, Windows 11-styled GUI for BorgBackup.**

WinBorg Manager bridges the gap between the powerful deduplicating backup tool **BorgBackup** and the **Windows** desktop experience. It leverages the **Windows Subsystem for Linux (WSL)** to run Borg[...] 

> **Status:** Public Beta (v0.1.0)

## 💡 Motivation

I wanted a simple, clean and modern alternative to Vorta — something that fits naturally into Windows 11 and lets me occasionally pull files from my Borg archives without having to use the command line or run a full Linux VM. WinBorg Manager was created because I wanted a GUI that brings BorgBackup’s power to Windows users while providing familiar workflows (mount as a drive, Explorer integration, native notifications). In short: a practical, user-friendly tool for people who work on Windows but still want the reliability and features of Borg.

Note: Although this started as a private project, it may still be useful to others. Feel free to use, adapt, or learn from it..

## 🚀 Features

### Core Functionality
*   **WSL Integration:** Runs Borg in a native Linux environment (Ubuntu/Debian) for maximum stability, speed, and compatibility.
*   **Repository Management:** Add, edit, and monitor local or remote (SSH/Hetzner/BorgBase/Rsync.net) repositories.
*   **Encryption Support:** Full support for `repokey` and `keyfile` encryption modes with secure passphrase management.

### Backup & Scheduling
*   **Automated Scheduler:** Built-in scheduler to run backups **Hourly** or **Daily** automatically in the background.
*   **Job Management:** Define multiple backup jobs (e.g., "Documents", "Projects") with specific source paths and retention policies.
*   **Retention Policies (Pruning):** Automatically clean up old archives (keep daily, weekly, monthly, yearly).
*   **Compression:** Support for `lz4`, `zstd`, and `zlib` compression algorithms.

### Restoration & Analysis
*   **One-Click Mount:** Mount archives to a drive letter (e.g., `Z:`) and browse files seamlessly in **Windows Explorer**.
*   **Archive Browser:** Built-in file browser to find and extract specific files without mounting.
*   **Diff Viewer:** Visually compare two archives to see exactly what files were added, removed, or modified.
*   **Integrity Checks:** Run `borg check` operations with real-time progress bars and ETA calculation.

### UX & System
*   **Windows 11 Design:** Clean UI with Mica effects, dark mode support, and native look & feel.
*   **System Tray:** Minimizes to tray to keep backups running quietly in the background.
*   **Notifications:** Native Windows notifications for backup success/failure.
*   **Lock Management:** Automatically detects stalled lock files (`lock.roster`) and offers a UI to break locks safely.

---

## 🛠️ Installation & Setup Guide

### Prerequisites

1.  **WSL (Windows Subsystem for Linux):**
    *   Open PowerShell as Administrator and run: `wsl --install`
    *   Restart your PC.
    *   Open "Ubuntu" from the Start Menu to finish the setup (create a username/password).

2.  **BorgBackup (Inside WSL):**
    *   Open your Ubuntu terminal and run:
        ```bash
        sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
        ```

3.  **FUSE Configuration (For Mounting):**
    *   To allow Windows Explorer to see mounted drives, run this in Ubuntu:
        ```bash
        echo "user_allow_other" | sudo tee -a /etc/fuse.conf
        sudo chmod 666 /dev/fuse
        ```

### Installation

1.  Download the latest installer (`.exe`) from the [Releases Page](https://github.com/robotnikz/WinBorg/releases).
2.  Run the installer.
3.  *Note:* Since this is an open-source tool without a paid certificate, Windows SmartScreen may warn you. Click **"More Info" -> "Run Anyway"**.

---

## 📖 Quick Start

### 1. Connect a Repository
*   Go to the **Repositories** tab.
*   Click **Add Repository**.
*   Choose a template (Hetzner, BorgBase) or enter your SSH URL manually.
    *   *Tip:* Check "Trust Host" if connecting to a new server to avoid SSH key errors.

### 2. Create a Backup Job
*   On the Repository card, click the **Briefcase Icon** (Manage Jobs).
*   Click **Create First Job**.
*   **General:** Name your job (e.g., "Work Files") and select the Source Folder on your C: drive.
*   **Schedule:** Enable "Schedule" and choose "Daily" at a specific time.
*   **Retention:** Enable "Prune" to automatically delete old backups (e.g., Keep 7 Days, 4 Weeks).
*   Click **Save Job**. The scheduler is now active!

### 3. Restore Files
*   **Option A (Mount):** Go to the **Archives** tab, click **Mount** on a snapshot. Go to the **Mounts** tab and click **Open**. Windows Explorer opens the folder.
*   **Option B (Browser):** In the **Archives** tab, click the **Folder Icon** to browse files inside the app. Select files and click **Download Selection**.

---

## 🔧 Troubleshooting

**"Connection Closed" or SSH Errors**
*   Ensure your SSH Public Key is added to your backup provider.
*   You can generate a key in WSL via `ssh-keygen -t ed25519` and view it with `cat ~/.ssh/id_ed25519.pub`.

**"Mount Failed: FUSE missing"**
*   WinBorg attempts to fix permissions automatically. If it fails, ensure you ran the FUSE configuration commands in the "Prerequisites" section above.

**App says "Repo Locked"**
*   This happens if a previous backup was interrupted (power loss, crash).
*   Go to the **Repositories** tab and click the **Unlock** button on the repository card.

---

## 💻 Development

Contributions are welcome!

```bash
# Clone the repo
git clone https://github.com/robotnikz/WinBorg.git

# Install dependencies
npm install

# Run React Frontend + Electron Backend in Dev Mode
npm run electron
```

## 📄 License

MIT License.