/**
 * REAL BACKEND FOR WINBORG
 */

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, safeStorage, nativeImage, dialog, Notification, powerSaveBlocker, powerMonitor, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- SINGLE INSTANCE LOCK ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // If we don't get the lock, another instance is already running.
  // We quit this new instance immediately.
  app.quit();
} else {
  // This is the first instance.
  // Set up a listener for any subsequent attempts to launch a second instance.
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance. We should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      new Notification({
        title: 'WinBorg Manager',
        body: 'WinBorg Manager is already running. Focusing the existing window.'
      }).show();
    }
  });
}

// OPTIONAL: Nodemailer for Emails
let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    console.warn("[WinBorg] Nodemailer module not found. Email notifications will be disabled until 'npm install' is run.");
}

// --- CONFIGURATION ---
const GITHUB_REPO = "robotnikz/WinBorg"; 

// Fix for Windows Notifications Title / Grouping
if (process.platform === 'win32') {
    app.setAppUserModelId('com.winborg.manager');
}

let mainWindow;
let tray = null;
let isQuitting = false;
let closeToTray = false; 

// --- SCHEDULER STATE ---
let scheduledJobs = [];
let availableRepos = [];
let schedulerInterval = null;

const activeMounts = new Map();
const activeProcesses = new Map();
let powerBlockerId = null;

// --- PERSISTENCE PATHS ---
const userDataPath = app.getPath('userData');
const secretsPath = path.join(userDataPath, 'secrets.json');
const notificationsPath = path.join(userDataPath, 'notifications.json');
const databasePath = path.join(userDataPath, 'data.json'); // Main DB for Repos, Jobs, Settings

// --- IN-MEMORY CACHE ---
let secretsCache = {};
let dbCache = {
    repos: [],
    jobs: [],
    archives: [],
    activityLogs: [],
    settings: {
        useWsl: true,
        borgPath: 'borg',
        disableHostCheck: false,
        closeToTray: false,
        startWithWindows: false,
        startMinimized: false,
        limitBandwidth: false,
        bandwidthLimit: 1000,
        stopOnBattery: true,
        stopOnLowSignal: false
    }
};

// Notification Config
let notificationConfig = {
    notifyOnSuccess: true, 
    notifyOnError: true,   
    discordEnabled: false,
    discordWebhook: '',
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpFrom: '',
    smtpTo: ''
};

// --- LOAD DATA ON STARTUP ---
function loadData() {
    // 1. Secrets
    try {
        if (fs.existsSync(secretsPath)) {
            secretsCache = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        }
    } catch (e) { console.error("Failed to load secrets", e); }

    // 2. Notifications
    try {
        if (fs.existsSync(notificationsPath)) {
            const loaded = JSON.parse(fs.readFileSync(notificationsPath, 'utf8'));
            notificationConfig = { ...notificationConfig, ...loaded };
        }
    } catch (e) { console.error("Failed to load notifications", e); }

    // 3. Main Database (Repos, Jobs, Settings)
    try {
        if (fs.existsSync(databasePath)) {
            const loaded = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
            dbCache = { ...dbCache, ...loaded };
            
            // Sync internal variables
            closeToTray = dbCache.settings.closeToTray || false;
            availableRepos = dbCache.repos || [];
            scheduledJobs = dbCache.jobs || [];
            applyAutoStartSettings(); // Apply autostart setting on load
        }
    } catch (e) { console.error("Failed to load database", e); }
}

loadData();

// --- AUTOSTART LOGIC ---
function applyAutoStartSettings() {
    if (process.platform === 'win32') {
        const settings = dbCache.settings;
        app.setLoginItemSettings({
            openAtLogin: settings.startWithWindows,
            path: app.getPath('exe'),
            args: (settings.startWithWindows && settings.startMinimized) ? ['--hidden'] : []
        });
    }
}

// --- PERSISTENCE HELPERS ---
function persistSecrets() {
    try { fs.writeFileSync(secretsPath, JSON.stringify(secretsCache)); } catch (e) { console.error(e); }
}

function persistNotifications() {
    try { fs.writeFileSync(notificationsPath, JSON.stringify(notificationConfig)); } catch (e) { console.error(e); }
}

function persistDb() {
    try { fs.writeFileSync(databasePath, JSON.stringify(dbCache, null, 2)); } catch (e) { console.error(e); }
}

// Helper: Get decrypted password
function getDecryptedPassword(id) {
    if (!id || !secretsCache[id]) return null;
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const buffer = Buffer.from(secretsCache[id], 'hex');
            return safeStorage.decryptString(buffer);
        }
    } catch (e) {
        console.error("Failed to decrypt password for " + id, e);
    }
    return null;
}

const isDev = !app.isPackaged;

function getIconPath() {
    const p = isDev ? path.join(__dirname, 'public/icon.png') : path.join(__dirname, 'dist/icon.png');
    return fs.existsSync(p) ? p : null;
}

function createWindow(shouldStartMinimized = false) {
  const iconPath = getIconPath();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
      webSecurity: false 
    },
    backgroundColor: '#f3f3f3',
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    show: !shouldStartMinimized
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('close', (event) => {
      if (!isQuitting) {
          if (closeToTray) {
              event.preventDefault();
              mainWindow.hide();
              new Notification({ 
                  title: 'WinBorg', 
                  body: 'Running in background. Click tray icon to open.',
                  icon: getIconPath() || undefined
              }).show();
              return false;
          }
      }
  });
}

// ... [Notification Logic & Power Save Blocker remains mostly same, summarized for brevity] ...

async function sendDiscordWebhook(title, message, isSuccess) {
    if (!notificationConfig.discordEnabled || !notificationConfig.discordWebhook) return;
    const color = isSuccess ? 5763719 : 15548997;
    const safeMessage = message.length > 2000 ? message.substring(0, 1990) + "\n... (Log truncated)" : message;
    const payload = { embeds: [{ title: title, description: safeMessage, color: color, footer: { text: "WinBorg Manager" }, timestamp: new Date().toISOString() }] };
    try { await fetch(notificationConfig.discordWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) {}
}

async function sendEmail(title, message, isSuccess) {
    if (!nodemailer) return;
    if (!notificationConfig.emailEnabled || !notificationConfig.smtpHost) return;
    const pass = getDecryptedPassword('smtp_password');
    if (!pass) return;
    try {
        let transporter = nodemailer.createTransport({
            host: notificationConfig.smtpHost,
            port: notificationConfig.smtpPort,
            secure: notificationConfig.smtpPort === 465,
            auth: { user: notificationConfig.smtpUser, pass: pass },
        });
        await transporter.sendMail({
            from: notificationConfig.smtpFrom,
            to: notificationConfig.smtpTo,
            subject: `[WinBorg] ${title}`,
            text: message,
            html: `<div style="font-family: sans-serif;"><h2 style="color: ${isSuccess ? '#16a34a' : '#dc2626'}">${title}</h2><div style="background: #f4f4f5; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap;">${message}</div><hr><small>Sent by WinBorg Manager</small></div>`
        });
    } catch (e) {}
}

async function dispatchNotifications(jobName, success, details) {
    if (success && notificationConfig.notifyOnSuccess === false) return;
    if (!success && notificationConfig.notifyOnError === false) return;
    const status = success ? "SUCCESS" : "FAILED";
    const title = `Backup ${status}: ${jobName}`;
    let message = success ? `The backup job '${jobName}' completed successfully.` : `The backup job '${jobName}' encountered errors.`;
    if (details) message += `\n\n--- LOG OUTPUT ---\n${details}`;
    sendDiscordWebhook(title, message, success);
    sendEmail(title, message, success);
}

function updatePowerBlocker() {
    const isBusy = activeProcesses.size > 0 || activeMounts.size > 0;
    if (isBusy && !powerBlockerId) {
        powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    } else if (!isBusy && powerBlockerId !== null) {
        powerSaveBlocker.stop(powerBlockerId);
        powerBlockerId = null;
    }
    updateTrayMenu();
}

// ... [Tray creation remains same] ...
function createTray() {
    const iconPath = getIconPath();
    if (!iconPath) return; 
    try {
        const image = nativeImage.createFromPath(iconPath);
        if (image.isEmpty()) return;
        const trayIcon = image.resize({ width: 16, height: 16 });
        tray = new Tray(trayIcon);
        tray.setToolTip('WinBorg Manager');
        updateTrayMenu();
        tray.on('double-click', () => {
            if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        });
    } catch (e) {}
}

function updateTrayMenu() {
    if (!tray) return;
    const template = [
        { label: 'WinBorg Manager', enabled: false },
        { label: activeProcesses.size > 0 ? `Running: ${activeProcesses.size} Tasks` : 'Status: Idle', enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: () => mainWindow.show() },
        { type: 'separator' }
    ];
    if (scheduledJobs.length > 0) {
        template.push({ label: 'Run Backup Job', enabled: false });
        scheduledJobs.forEach(job => {
            template.push({ label: `▶ ${job.name}`, click: () => executeBackgroundJob(job) });
        });
        template.push({ type: 'separator' });
    }
    if (activeMounts.size > 0) {
        template.push({ label: 'Active Mounts', enabled: false });
        template.push({
            label: 'Stop All Mounts',
            click: () => {
                activeMounts.forEach((proc, id) => { proc.kill(); activeMounts.delete(id); });
                updatePowerBlocker();
                if(mainWindow) mainWindow.webContents.send('mount-exited', { mountId: 'all', code: 0 });
            }
        });
        template.push({ type: 'separator' });
    }
    template.push({ label: 'Check for Updates', click: () => checkForUpdates(true) });
    template.push({ type: 'separator' });
    template.push({ label: 'Quit', click: () => { isQuitting = true; app.quit(); }});
    const contextMenu = Menu.buildFromTemplate(template);
    tray.setContextMenu(contextMenu);
}

// ... [Scheduler logic remains same] ...
function startScheduler() {
    if (schedulerInterval) clearInterval(schedulerInterval);
    schedulerInterval = setInterval(() => {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${currentHour}:${currentMinute}`;
        scheduledJobs.forEach(job => {
            if (!job.scheduleEnabled) return;
            if (job.scheduleType === 'daily' && job.scheduleTime === timeString) executeBackgroundJob(job);
            if (job.scheduleType === 'hourly' && currentMinute === '00') executeBackgroundJob(job);
        });
    }, 60000); 
}

async function executeBackgroundJob(job) {
    console.log(`[Scheduler] Triggering Job: ${job.name}`);

    // --- SMART CHECKS ---
    const settings = dbCache.settings || {};
    
    // 1. Power Source Check
    if (settings.stopOnBattery !== false) {
        if (powerMonitor.isOnBatteryPower()) {
            console.log(`[Scheduler] Skipped job ${job.name} because device is on battery.`);
            new Notification({ 
                title: 'Backup Skipped', 
                body: `Job '${job.name}' put on hold (On Battery).`,
                silent: true 
            }).show();
            return;
        }
    }

    // 2. Connectivity Check
    if (settings.stopOnLowSignal === true) {
        if (!net.online) {
             console.log(`[Scheduler] Skipped job ${job.name} because device is offline.`);
             // Silent skip, no notification needed for offline usually
             return;
        }
    }

    const repo = availableRepos.find(r => r.id === job.repoId);
    if (!repo) return;
    new Notification({ 
        title: 'Backup Started', 
        body: `Job: ${job.name}`,
        icon: getIconPath() || undefined
    }).show();
    if (mainWindow) mainWindow.webContents.send('job-started', job.id);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
    const archiveName = `${job.archivePrefix}-${dateStr}-${timeStr}`;
    
    // Use DB setting or default
    const useWsl = dbCache.settings.useWsl !== false;
    
    let sourcePath = job.sourcePath;
    if (useWsl && /^[a-zA-Z]:[\\/]/.test(sourcePath)) {
         const drive = sourcePath.charAt(0).toLowerCase();
         const rest = sourcePath.slice(3).replace(/\\/g, '/');
         sourcePath = `/mnt/${drive}/${rest}`;
    }

    const createArgs = ['create', '--stats', `${repo.url}::${archiveName}`, sourcePath];
    if (job.compression && job.compression !== 'auto') {
        createArgs.unshift(job.compression);
        createArgs.unshift('--compression');
    }

    const createResult = await runBorgInternal(createArgs, repo.id, useWsl, job.name);
    
    if (createResult.success) {
        let pruneSummary = '';
        if (job.pruneEnabled) {
            const pruneArgs = ['prune', '-v', '--list', repo.url];
            if (job.keepDaily) pruneArgs.push('--keep-daily', job.keepDaily.toString());
            if (job.keepWeekly) pruneArgs.push('--keep-weekly', job.keepWeekly.toString());
            if (job.keepMonthly) pruneArgs.push('--keep-monthly', job.keepMonthly.toString());
            if (job.keepYearly) pruneArgs.push('--keep-yearly', job.keepYearly.toString());
            
            const pruneResult = await runBorgInternal(pruneArgs, repo.id, useWsl, job.name + " (Prune)");
            pruneSummary = pruneResult.success ? "\nPrune: Success" : "\nPrune: Failed";
        }
        
        new Notification({ 
            title: 'Backup Success', 
            body: `Job '${job.name}' finished.`,
            icon: getIconPath() || undefined
        }).show();
        dispatchNotifications(job.name, true, `Archive created: ${archiveName}${pruneSummary}\n\n${getLastLines(createResult.output, 10)}`);
        if (mainWindow) mainWindow.webContents.send('job-complete', { jobId: job.id, success: true });
        
    } else {
        new Notification({ 
            title: 'Backup Failed', 
            body: `Job '${job.name}' failed. Check logs.`,
            icon: getIconPath() || undefined
        }).show();
        const logSnippet = getLastLines(createResult.output, 25);
        dispatchNotifications(job.name, false, `The Borg command exited with a non-zero status code.\n\nError Log:\n${logSnippet}`);
        if (mainWindow) mainWindow.webContents.send('job-complete', { jobId: job.id, success: false });
    }
}

function getLastLines(text, count) {
    if (!text) return "";
    const lines = text.split('\n');
    return lines.slice(-count).join('\n');
}

function runBorgInternal(args, repoId, useWsl, jobName) {
    return new Promise((resolve) => {
        const internalId = `bg-${Date.now()}`;
        activeProcesses.set(internalId, { kill: () => {} });
        updatePowerBlocker();

        let bin = 'borg';
        let finalArgs = args;
        const envVars = {
            BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK: 'yes',
            BORG_RELOCATED_REPO_ACCESS_IS_OK: 'yes',
            BORG_DISPLAY_PASSPHRASE: 'no',
            BORG_RSH: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=no'
        };

        const secret = getDecryptedPassword(repoId);
        if (secret) envVars.BORG_PASSPHRASE = secret;

        if (useWsl) {
            bin = 'wsl';
            if (process.env.WSLENV) {
                 envVars.WSLENV = process.env.WSLENV + ':BORG_PASSPHRASE:BORG_RSH';
            } else {
                 envVars.WSLENV = 'BORG_PASSPHRASE:BORG_RSH';
            }
            finalArgs = ['--exec', 'borg', ...args];
        }

        const child = spawn(bin, finalArgs, { env: { ...process.env, ...envVars } });
        activeProcesses.set(internalId, child);

        let output = '';
        child.stdout.on('data', d => output += d);
        child.stderr.on('data', d => output += d);

        child.on('close', (code) => {
            activeProcesses.delete(internalId);
            updatePowerBlocker();
            if (mainWindow) {
                mainWindow.webContents.send('activity-log', {
                    title: code === 0 ? 'Scheduled Backup Success' : 'Scheduled Backup Failed',
                    detail: `${jobName} - Code ${code}`,
                    status: code === 0 ? 'success' : 'error',
                    cmd: output
                });
            }
            resolve({ success: code === 0, output: output });
        });
    });
}

// --- UPDATER LOGIC ---
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
// autoUpdater.logger = require("electron-log");
// autoUpdater.logger.transports.file.level = "info";

let isManualCheck = false;
let isDownloading = false;

autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info);
    isManualCheck = false; 
});

autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && isManualCheck) {
        dialog.showMessageBox(mainWindow, { type: 'info', title: 'No Updates', message: 'You are using the latest version.', detail: `Version: ${info.version}` });
    }
    isManualCheck = false;
});

autoUpdater.on('error', (err) => {
    if (mainWindow && isManualCheck) {
         dialog.showMessageBox(mainWindow, { type: 'error', title: 'Update Check Failed', message: err.message });
    }
    console.error("[AutoUpdater] Error:", err);
    
    // Only show error on frontend if manually checked or downloading
    if (mainWindow && (isManualCheck || isDownloading)) {
        mainWindow.webContents.send('update-error', err.message);
    }
    isManualCheck = false;
    isDownloading = false; 
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    isDownloading = false;
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

// Start update download when requested
ipcMain.on('download-update', () => {
    isDownloading = true;
autoUpdater.on('update-downloaded', (info) => {
    isDownloading = false;
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
});

// Start update download when requested
ipcMain.on('download-update', () => {
    isDownloading = true;
    autoUpdater.downloadUpdate();
});

// Install update when requested (this will quit the app)
ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

async function checkForUpdates(manual = false) {
    isManualCheck = manual;
    try {
        await autoUpdater.checkForUpdates();
    } catch (e) {
        // Errors usually handled by 'error' event, but just in case sync throw.
        console.error("Check for updates threw:", e);
    }
}

// Function that handles cleanup before app quit
function cleanupAndQuit() {
    if (schedulerInterval) clearInterval(schedulerInterval);
    
    // Kill active mounts
    activeMounts.forEach((proc) => {
        try { proc.kill(); } catch(e) {}
    });
    activeMounts.clear();

    // Kill active background processes
    activeProcesses.forEach((proc) => {
        try { proc.kill(); } catch(e) {}
    });
    activeProcesses.clear();

    app.quit();
}

app.whenReady().then(() => {
    const shouldStartMinimized = process.argv.includes('--hidden');
    createWindow(shouldStartMinimized);
    createTray();
    startScheduler();
    if (shouldStartMinimized) {
        new Notification({ 
            title: 'WinBorg Started', 
            body: 'Application is running minimized in the system tray.',
            icon: getIconPath() || undefined
        }).show();
    }
    setTimeout(() => checkForUpdates(false), 3000);
});

app.on('before-quit', () => { isQuitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !closeToTray) cleanupAndQuit(); });

// --- IPC HANDLERS FOR PERSISTENCE ---

ipcMain.handle('get-db', () => dbCache);

ipcMain.handle('save-db', (event, partialData) => {
    // Merge new data into cache
    dbCache = { ...dbCache, ...partialData };
    
    // Sync critical variables for main process usage
    if (partialData.settings) {
        if (partialData.settings.closeToTray !== undefined) closeToTray = partialData.settings.closeToTray;
    }
    if (partialData.repos) availableRepos = partialData.repos;
    if (partialData.jobs) scheduledJobs = partialData.jobs;
    
    persistDb();
    updateTrayMenu();
    return true;
});

// Original legacy handler kept for compatibility during migration, mapped to save-db logic essentially
ipcMain.on('set-close-behavior', (event, shouldCloseToTray) => {
    closeToTray = shouldCloseToTray;
    dbCache.settings.closeToTray = shouldCloseToTray;
    persistDb();
});

ipcMain.on('sync-scheduler-data', (event, { jobs, repos }) => {
    // This is called by frontend, we just update memory and db
    scheduledJobs = jobs;
    availableRepos = repos;
    dbCache.jobs = jobs;
    dbCache.repos = repos;
    persistDb();
    updateTrayMenu();
});

// --- IPC HANDLERS ---
ipcMain.on('settings:toggleAutoStart', (event, enable) => {
    dbCache.settings.startWithWindows = enable;
    persistDb();
    applyAutoStartSettings();
});

ipcMain.on('settings:getAutoStartStatus', (event) => {
    event.returnValue = dbCache.settings.startWithWindows;
});

// ... [Existing IPCs for windows/updates/borg command] ...
ipcMain.handle('check-for-updates', async () => await checkForUpdates(true));
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => { if (mainWindow) { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); }});
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.on('set-progress', (event, progress) => { if (mainWindow) mainWindow.setProgressBar(progress); });
ipcMain.on('open-path', (event, pathString) => {
    if (pathString.startsWith('/') || pathString.startsWith('\\\\wsl')) {
        let linuxPath = pathString;
        if (pathString.startsWith('\\\\')) { shell.openPath(pathString).catch(err => console.error(err)); return; }
        const cmd = `wsl --exec explorer.exe "${linuxPath}"`;
        exec(cmd, (err) => { if (err) console.error(err); });
    } else { shell.openPath(pathString).catch(err => console.error(err)); }
});

// Notifications
ipcMain.handle('get-notification-config', () => ({
    notifyOnSuccess: notificationConfig.notifyOnSuccess,
    notifyOnError: notificationConfig.notifyOnError,
    discordEnabled: notificationConfig.discordEnabled,
    discordWebhook: notificationConfig.discordWebhook,
    emailEnabled: notificationConfig.emailEnabled,
    smtpHost: notificationConfig.smtpHost,
    smtpPort: notificationConfig.smtpPort,
    smtpUser: notificationConfig.smtpUser,
    smtpFrom: notificationConfig.smtpFrom,
    smtpTo: notificationConfig.smtpTo,
    hasSmtpPass: !!getDecryptedPassword('smtp_password')
}));

ipcMain.handle('save-notification-config', async (event, config) => {
    const { smtpPass, ...rest } = config;
    notificationConfig = { ...notificationConfig, ...rest };
    persistNotifications();
    if (smtpPass) {
         if (safeStorage.isEncryptionAvailable()) {
            const buffer = safeStorage.encryptString(smtpPass);
            secretsCache['smtp_password'] = buffer.toString('hex');
            persistSecrets();
        }
    }
    return true;
});

ipcMain.handle('test-notification', async (event, type) => {
    if (type === 'discord') await sendDiscordWebhook("Test Notification", "This is a test.", true);
    else if (type === 'email') await sendEmail("Test Notification", "This is a test.", true);
    return true;
});

// Borg Commands
ipcMain.handle('save-secret', async (event, { repoId, passphrase }) => {
    if (safeStorage.isEncryptionAvailable()) {
        const buffer = safeStorage.encryptString(passphrase);
        secretsCache[repoId] = buffer.toString('hex');
        persistSecrets();
        return true;
    }
    return false;
});
ipcMain.handle('delete-secret', async (event, { repoId }) => {
    if (secretsCache[repoId]) { delete secretsCache[repoId]; persistSecrets(); }
    return true;
});
ipcMain.handle('has-secret', async (event, { repoId }) => ({ hasSecret: !!secretsCache[repoId] }));
ipcMain.handle('get-downloads-path', () => app.getPath('downloads'));
ipcMain.handle('create-directory', async (event, dirPath) => {
    try { if (!fs.existsSync(dirPath)){ fs.mkdirSync(dirPath, { recursive: true }); } return true; } catch (e) { return false; }
});
ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return { canceled: true };
    return await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
});

ipcMain.handle('borg-spawn', async (event, { args, commandId, useWsl, executablePath, envVars, forceBinary, repoId, cwd, wslUser }) => {
    // WINBORG: Inject bandwidth limit if necessary
    if (dbCache.settings.limitBandwidth && dbCache.settings.bandwidthLimit > 0) {
        let repoArg = '';
        // Find the argument that specifies the repository
        for (const arg of args) {
            if (arg.includes('::') || arg.includes('@') || arg.startsWith('ssh://')) {
                repoArg = arg;
                break;
            }
        }
        // Fallback for commands like 'prune' where the repo is the last arg
        if (!repoArg && args.length > 0) {
            const lastArg = args[args.length - 1];
            if (!lastArg.startsWith('-')) { // Simple check to avoid flags
                repoArg = lastArg;
            }
        }

        // Check if the repo path is remote
        const isRemote = repoArg.includes('@') || repoArg.startsWith('ssh://');
        if (isRemote) {
            const limit = dbCache.settings.bandwidthLimit.toString();
            // Inject the flag. Right after the subcommand is usually safe.
            if (args.length > 1) {
                args.splice(1, 0, '--remote-ratelimit', limit);
            } else {
                args.push('--remote-ratelimit', limit);
            }
            console.log(`[WinBorg] Bandwidth limit of ${limit} KB/s applied for remote operation.`);
        }
    }

    return new Promise((resolve) => {
        let bin = forceBinary || executablePath || 'borg';
        let finalArgs = args;
        let spawnEnv = { ...process.env, ...envVars };
        if (repoId) {
            const secret = getDecryptedPassword(repoId);
            if (secret) {
                spawnEnv.BORG_PASSPHRASE = secret;
                if (useWsl) {
                    if (spawnEnv.WSLENV) spawnEnv.WSLENV = spawnEnv.WSLENV + ':BORG_PASSPHRASE';
                    else spawnEnv.WSLENV = 'BORG_PASSPHRASE/u';
                }
            }
        }
        if (useWsl) {
            bin = 'wsl';
            const linuxCmd = forceBinary || 'borg';
            let execArgs = [];
            if (wslUser) execArgs = ['-u', wslUser];
            execArgs = [...execArgs, '--exec', linuxCmd, ...args];
            finalArgs = execArgs;
        }
        console.log(`[Spawn] ${bin} ${finalArgs.join(' ')} (ID: ${commandId})`);
        const child = spawn(bin, finalArgs, { env: spawnEnv, cwd: cwd || undefined });
        activeProcesses.set(commandId, child);
        updatePowerBlocker();
        child.stdout.on('data', (data) => mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() }));
        child.stderr.on('data', (data) => mainWindow.webContents.send('terminal-log', { id: commandId, text: data.toString() }));
        child.on('close', (code) => {
            activeProcesses.delete(commandId);
            updatePowerBlocker();
            resolve({ success: code === 0 });
        });
        child.on('error', (err) => {
            activeProcesses.delete(commandId);
            updatePowerBlocker();
            mainWindow.webContents.send('terminal-log', { id: commandId, text: `Error: ${err.message}` });
            resolve({ success: false, error: err.message });
        });
    });
});

ipcMain.handle('borg-stop', async (event, { commandId }) => {
    const child = activeProcesses.get(commandId);
    if (child) { child.kill(); activeProcesses.delete(commandId); updatePowerBlocker(); return { success: true }; }
    return { success: false };
});

ipcMain.handle('borg-mount', async (event, { args, mountId, useWsl, executablePath, envVars, repoId }) => {
    let bin = executablePath || 'borg';
    let finalArgs = args;
    let spawnEnv = { ...process.env, ...envVars };
    if (repoId) {
        const secret = getDecryptedPassword(repoId);
        if (secret) {
            spawnEnv.BORG_PASSPHRASE = secret;
            if (useWsl) {
                 if (spawnEnv.WSLENV) spawnEnv.WSLENV = spawnEnv.WSLENV + ':BORG_PASSPHRASE';
                 else spawnEnv.WSLENV = 'BORG_PASSPHRASE/u';
            }
        }
    }
    if (useWsl) { bin = 'wsl'; finalArgs = ['--exec', 'borg', ...args]; }
    const child = spawn(bin, finalArgs, { env: spawnEnv });
    activeMounts.set(mountId, child);
    updatePowerBlocker();
    return new Promise((resolve) => {
        let hasExited = false;
        let startupLog = '';
        const timeout = setTimeout(() => { if (!hasExited) resolve({ success: true }); }, 2500);
        child.stdout.on('data', (data) => { const t = data.toString(); startupLog += t; mainWindow.webContents.send('terminal-log', { id: 'mount', text: t }); });
        child.stderr.on('data', (data) => { const t = data.toString(); startupLog += t; mainWindow.webContents.send('terminal-log', { id: 'mount', text: t }); });
        child.on('close', (code) => {
            hasExited = true; clearTimeout(timeout); activeMounts.delete(mountId); updatePowerBlocker();
            mainWindow.webContents.send('mount-exited', { mountId, code });
            resolve({ success: false, error: `Exited with code ${code}. Log: ${startupLog}` });
        });
    });
});

ipcMain.handle('borg-unmount', async (event, { mountId, localPath, useWsl, executablePath }) => {
    const child = activeMounts.get(mountId);
    if (child) { child.kill(); activeMounts.delete(mountId); updatePowerBlocker(); return { success: true }; }
    let bin = executablePath || 'borg';
    let args = ['umount', localPath];
    if (useWsl) { bin = 'wsl'; args = ['--exec', 'borg', 'umount', localPath]; }
    return new Promise(resolve => { const p = spawn(bin, args); p.on('close', (code) => resolve({ success: code === 0 })); });
});

// --- ONBOARDING & SYSTEM CHECKS ---

ipcMain.handle('system-check-wsl', async () => {
    return new Promise((resolve) => {
        exec('wsl --status', { encoding: 'utf16le' }, (error, stdout, stderr) => {
            // Windows typically returns WSL status in UTF-16 sometimes, or just UTF-8. 
            // 'wsl --status' returns 0 even if no distro defaults set sometimes, but usually reliable to check presence.
            if (error) {
                console.error("WSL Check Failed:", error);
                resolve({ installed: false, error: error.message });
            } else {
                resolve({ installed: true });
            }
        });
    });
});

ipcMain.handle('system-install-wsl', async () => {
    return new Promise((resolve) => {
        // Runs `wsl --install` via PowerShell with Admin privileges
        // This will pop up a UAC prompt for the user
        const cmd = 'Start-Process powershell -Verb RunAs -ArgumentList "wsl --install" -Wait';
        const child = spawn('powershell.exe', ['-Command', cmd]);
        
        child.on('close', (code) => {
            // We can't easily valid exit code of the elevated process from here due to Start-Process decoupling,
            // but if the powershell wrapper exits cleanly (code 0), we assume the prompt was launched.
            // The user will need to restart their PC afterwards.
            resolve({ success: code === 0 });
        });
        
        child.on('error', (err) => {
             resolve({ success: false, error: err.message });
        });
    });
});

ipcMain.handle('system-check-borg', async () => {
     return new Promise((resolve) => {
        exec('wsl --exec borg --version', (error, stdout, stderr) => {
            if (error) {
                resolve({ installed: false });
            } else {
                resolve({ installed: true, version: stdout.trim() });
            }
        });
    });
});

ipcMain.handle('system-install-borg', async (event) => {
    return new Promise((resolve) => {
        // We use root (-u root) to avoid password prompt. sudo typically requires interactive password.
        // Assuming default Ubuntu/Debian distro.
        console.log("[Setup] Installing Borg via WSL (root)...");
        const cmd = 'wsl -u root sh -c "apt-get update && apt-get upgrade -y && apt-get install -y borgbackup"';
        
        const child = exec(cmd);
        
        child.on('close', (code) => {
            resolve({ success: code === 0 });
        });
    });
});
