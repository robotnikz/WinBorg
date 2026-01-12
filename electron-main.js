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

const { getPreferredWslDistro } = require('./wsl-helper');

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

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'test';

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

    // Resolve distro outside of the Promise executor to allow await
    let detectedDistro = null;
    if (useWsl) {
        detectedDistro = await getPreferredWslDistro();
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
            
            const linuxCmd = forceBinary || (executablePath === 'borg' ? '/usr/bin/borg' : executablePath) || '/usr/bin/borg';
            let execArgs = [];
            
            // Target specific distro if we found one (Ubuntu/Debian) to avoid running in Docker/Default
            if (detectedDistro) {
                execArgs.push('-d', detectedDistro);
            }

            if (wslUser) execArgs = [...execArgs, '-u', wslUser];
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

ipcMain.handle('system-reboot', async () => {
    // Reboot Windows immediately
    exec('shutdown /r /t 0', (err) => {
        if (err) console.error("Reboot failed:", err);
    });
    return true;
});

ipcMain.handle('system-check-wsl', async () => {
    return new Promise((resolve) => {
        // Step 1: Check if 'wsl' command exists and is functional at all
        exec('wsl --status', { encoding: 'utf16le' }, (err) => {
            if (err) {
                 return resolve({ installed: false, error: "WSL is not enabled on this machine." });
            }

            // Step 2: Check for a functional DEFAULT distribution
            // Docker Desktop sometimes registers itself as default, which is bad for us.
            exec('wsl --list --verbose', { encoding: 'utf16le' }, (error, stdout) => {
                 let hasUbuntu = false;
                 let defaultDistro = '';
                 
                 if (stdout) {
                     // Parse output line by line (skip header)
                     const lines = stdout.split('\n').slice(1);
                     for (const line of lines) {
                         const cleanLine = line.trim();
                         if (!cleanLine) continue;
                         // Format: [*] <Name> <State> <Version>
                         // Example: * Ubuntu Running 2
                         const parts = cleanLine.split(/\s+/);
                         const isDefault = cleanLine.startsWith('*');
                         const nameIndex = isDefault ? 1 : 0;
                         const name = parts[nameIndex];
                         
                         if (isDefault) defaultDistro = name;
                         if (name && (name.toLowerCase().includes('ubuntu') || name.toLowerCase().includes('debian'))) {
                             hasUbuntu = true;
                         }
                     }
                 }

                 // If default is Docker-related and no Ubuntu is found, fail or warn
                 if (defaultDistro.toLowerCase().includes('docker') && !hasUbuntu) {
                     console.warn("WSL Default is Docker, no Ubuntu found.");
                     // We force fail so user sees "WSL Missing" and trigger "Install WSL" which will install Ubuntu.
                     return resolve({ installed: false, error: `Default distro is '${defaultDistro}'. We need Ubuntu/Debian.` });
                 }

                 // Step 3: Verify execution capability
                 exec('wsl --exec echo wsl_active', (execErr, execOut) => {
                    const cleanStdout = execOut ? execOut.toString().trim() : '';
                    if (execErr || cleanStdout !== 'wsl_active') {
                        resolve({ installed: false, error: "WSL installed but cannot execute commands (No distro?)" });
                    } else {
                        resolve({ installed: true, details: `Default: ${defaultDistro}` });
                    }
                 });
            });
        });
    });
});

ipcMain.handle('system-install-wsl', async () => {
    return new Promise((resolve) => {
        // Runs `wsl --install -d Ubuntu` via PowerShell with Admin privileges.
        // Specifying `-d Ubuntu` ensures that if WSL is already enabled but no distro is present,
        // it actively installs Ubuntu instead of just showing the help text.
        const cmd = 'Start-Process powershell -Verb RunAs -ArgumentList "wsl --install -d Ubuntu" -Wait';
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
    const distro = await getPreferredWslDistro();
    return new Promise((resolve) => {
        // Use spawn instead of exec to avoid shell quoting issues with distro names
        const runCheck = (checkArgs) => {
            return new Promise(r => {
                const wslArgs = distro ? ['-d', distro] : [];
                const finalArgs = [...wslArgs, ...checkArgs];
                const p = spawn('wsl', finalArgs);
                let out = '';
                p.stdout.on('data', d => out += d.toString());
                p.on('close', code => r({ success: code === 0, out }));
                p.on('error', () => r({ success: false, out: '' }));
            });
        };

        (async () => {
            // 1. Check generic PATH
            let res = await runCheck(['--exec', 'borg', '--version']);
            if (res.success && res.out.includes('borg')) {
                 return resolve({ installed: true, version: res.out.trim(), distro: distro || 'Default' });
            }

            // 2. Check explicit /usr/bin/borg
            res = await runCheck(['--exec', '/usr/bin/borg', '--version']);
            if (res.success && res.out.includes('borg')) {
                 return resolve({ installed: true, version: res.out.trim(), distro: distro || 'Default', path: '/usr/bin/borg' });
            }

            console.log(`[Check] Borg check failed on distro '${distro || 'default'}'`);
            resolve({ installed: false });
        })();
    });
});

ipcMain.handle('system-install-borg', async (event) => {
    const targetDistro = await getPreferredWslDistro();
    
    return new Promise((resolve) => {
        console.log("[Setup] Installing Borg via WSL (root)...");
        
        if (targetDistro) console.log(`[Setup] Targeted distro: '${targetDistro}'`);

        // Use full path /usr/bin/apt-get to avoid PATH issues in non-interactive sh
        const script = 'export DEBIAN_FRONTEND=noninteractive && /usr/bin/apt-get update --allow-releaseinfo-change && /usr/bin/apt-get install -y --no-install-recommends --fix-missing borgbackup';
        
        // Construct args: if we found a distro, target it explicitly (-d).
        const wslArgs = ['-u', 'root'];
        if (targetDistro) {
            wslArgs.push('-d', targetDistro);
        }
        wslArgs.push('-e', 'sh', '-c', script);

        console.log(`[Setup] Spawning: wsl ${wslArgs.join(' ')}`);
        const child = spawn('wsl', wslArgs);
        
        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (d) => { output += d.toString(); });
        child.stderr.on('data', (d) => { errorOutput += d.toString(); });

        child.on('close', (code) => {
            if (code === 0) {
                console.log("[Setup] Install command finished with code 0. Verifying...");
                
                // DOUBLE CHECK: Verify it actually works before claiming success
                
                // Helper to perform check using spawn (more reliable than exec on Windows)
                const checkBorg = async (distro, args) => {
                     return new Promise(resolve => {
                         const wslArgs = distro ? ['-d', distro] : [];
                         // Note: wsl args must be strictly ordered: wsl [options] [command]
                         const finalArgs = [...wslArgs, ...args];
                         
                         const childArgsStr = `wsl ${finalArgs.join(' ')}`;
                         console.log(`[Setup] Verifying with: ${childArgsStr}`);

                         const p = spawn('wsl', finalArgs);
                         let out = '', stderr = '';
                         p.stdout.on('data', d => out += d.toString());
                         p.stderr.on('data', d => stderr += d.toString());
                         p.on('close', code => resolve({ err: code === 0 ? null : { code }, out, stderr }));
                         p.on('error', e => resolve({ err: e, out, stderr }));
                     });
                };

                (async () => {
                    // 1. Try generic 'borg' in path (most likely)
                    // equivalent to: wsl -d Distro --exec borg --version
                    let res = await checkBorg(targetDistro, ['--exec', 'borg', '--version']);
                    
                    if (res.err || !res.out.includes('borg')) {
                        console.log("[Setup] Generic 'borg' check failed. Trying explicit /usr/bin/borg...");
                        // 2. Try explicit path
                        res = await checkBorg(targetDistro, ['--exec', '/usr/bin/borg', '--version']);
                    }

                    if (!res.err && res.out.includes('borg')) {
                         console.log("[Setup] Verified: Borg is installed and runnable.");
                         resolve({ success: true });
                    } else {
                         console.warn("[Setup] Verification failed despite code 0!", res.err);
                         
                         // Try to find WHERE it is to help debug
                         const whichCheck = await checkBorg(targetDistro, ['--exec', 'which', 'borg']);
                         
                         // Capture the last lines of the installer output to help debug
                         const logSnippet = output.slice(-2000) + "\n" + errorOutput.slice(-2000); 
                         const debugInfo = `\n\nDebug Info:\nTarget Distro: ${targetDistro || 'Default'}\nExit Code: ${res.err ? res.err.code : '0'}\nStdout: ${res.out}\nStderr: ${res.stderr}\n'which borg' output: ${whichCheck.out}\n'which' error: ${whichCheck.stderr}`;

                         resolve({ 
                             success: false, 
                             error: `Installation appeared successful, but verification failed.\n\nCommand Output:\n${logSnippet}${debugInfo}` 
                         });
                    }
                })();
            } else {
                console.error("[Setup] Install failed code:", code);
                
                // Construct a helpful error message
                let friendlyError = `Installation failed (Code ${code}).`;
                const lowerErr = errorOutput.toLowerCase();
                
                // Detect triggers
                if (lowerErr.includes('apt-get: not found') || lowerErr.includes('command not found')) {
                     friendlyError += " It seems 'apt-get' is missing. WinBorg requires a Debian-based WSL distro (likely Ubuntu).";
                     // Debug hint:
                     friendlyError += "\nTry running 'wsl --list --verbose' in PowerShell to see which distro is default.";
                } else {
                     // Include detailed error output for debugging
                     const lines = errorOutput.split('\n').filter(l => l.trim().length > 0);
                     const snippet = lines.slice(-10).join('\n'); // Last 10 lines
                     friendlyError += `\n\nError Details:\n${snippet}`;
                }

                // Append output of cat /etc/os-release if possible for debugging context
                // (We can't easily run it here without complex chaining, so we rely on user report)
                
                resolve({ success: false, error: friendlyError });
            }
        });

        child.on('error', (err) => {
            console.error("[Setup] Spawn error:", err);
            resolve({ success: false, error: "Failed to start WSL process: " + err.message });
        });
    });
});

ipcMain.handle('ssh-key-manage', async (event, { action, type }) => {
    // type default = 'ed25519' (could be rsa)
    const keyType = type || 'ed25519'; 
    const keyFile = `~/.ssh/id_${keyType}`;
    const keyFilePub = `${keyFile}.pub`;
    
    // We get the preferred distro so we operate on the same one as Borg
    const targetDistro = await getPreferredWslDistro();
    const wslBaseArgs = targetDistro ? ['-d', targetDistro] : [];
    
    // Helper to run
    const runWsl = (cmd) => {
        return new Promise((resolve) => {
            // exec via bash -c to handle ~ expansion and redirects
            const args = [...wslBaseArgs, '--exec', 'bash', '-c', cmd];
            console.log(`[SSH] Running: wsl ${args.join(' ')}`);
            const child = spawn('wsl', args);
            let out = '', err = '';
            child.stdout.on('data', d => out += d.toString());
            child.stderr.on('data', d => err += d.toString());
            child.on('close', code => resolve({ code, out, err }));
            child.on('error', e => resolve({ code: -1, out: '', err: e.message }));
        });
    };

    try {
        if (action === 'check') {
            const res = await runWsl(`test -f ${keyFilePub} && echo "exists"`);
            return { 
                success: true, 
                exists: res.out.trim().includes('exists'), 
                path: keyFilePub 
            };
        }
        
        if (action === 'generate') {
            // Ensure .ssh dir exists
            await runWsl('mkdir -p ~/.ssh && chmod 700 ~/.ssh');
            // Remove old if exists (or ssh-keygen fails?) - ssh-keygen fails if file exists without -f?
            // Actually -f overwrites? No, it asks. We should probably only generate if check returns false, or rm first.
            // Let's assume the UI asks for confirmation before "Overwrite/Regenerate".
            // Adding -q (quiet) and -N "" (no passphrase)
            // Use yes | to auto-overwrite if it exists? Or just rm first.
            const rmRes = await runWsl(`rm -f ${keyFile} ${keyFilePub}`);
            const res = await runWsl(`ssh-keygen -t ${keyType} -N "" -f ${keyFile}`);
            
            if (res.code === 0) {
                 return { success: true };
            } else {
                 return { success: false, error: res.err || res.out };
            }
        }
        
        if (action === 'read') {
            const res = await runWsl(`cat ${keyFilePub}`);
            if (res.code === 0) {
                return { success: true, key: res.out.trim() };
            } else {
                return { success: false, error: "Could not read key file." };
            }
        }
        
        return { success: false, error: "Unknown action" };
        
    } catch (error) {
        console.error("[SSH] Error:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ssh-key-install', async (event, { target, password, port }) => {
    // Generate unique ID for temp files
    const runId = Date.now().toString();
    const passFile = `/tmp/winborg-pass-${runId}`;
    const scriptFile = `/tmp/winborg-ssh-${runId}.py`;
    
    // HETZNER STORAGE BOX FIX:
    // Hetzner Storage Boxes require Port 23 for SSH key management (Port 22 is SFTP only with RFC4716 keys).
    // If we detect a Hetzner URL and no port is specified, force Port 23.
    let finalPort = port;
    let isHetzner = false;

    if (target.includes('storagebox.de')) {
        isHetzner = true;
        if (!finalPort || finalPort === '22') {
            console.log("[SSH-Install] Detected Hetzner Storage Box. Enforcing Port 23.");
            finalPort = '23';
        }
    }
    
    const safePort = finalPort ? finalPort.replace(/'/g, "\\'") : '';
    // Extract user from target
    const parts = target.split('@');
    const remoteUser = parts.length > 1 ? parts[0] : '';
    
    // We will read the password from the temp file effectively verifying it's raw content
    const pythonScript = `
import pty
import os
import sys
import time
import subprocess

# Read password safely from file
try:
    with open('${passFile}', 'r') as f:
        password = f.read()
        # Safety trim: usually we don't want trailing newlines in passwords unless explicit.
        # But if the user's password HAS a trailing newline, this breaks it.
        # Given the Hex transfer method, we trust the content is exact.
        # However, to be safe against file system quirks:
        if password.endswith('\\n'):
            password = password[:-1]
except:
    print("Failed to read password file", flush=True)
    sys.exit(1)

target_host = '${target}'
target_port = '${safePort}'
remote_user = '${remoteUser}'
use_sftp = ${isHetzner ? 'True' : 'False'}

def read(fd):
    return os.read(fd, 1024)

print("Starting PTY...", flush=True)
print(f"Password length: {len(password)}", flush=True)
if len(password) > 2:
    print(f"Password starts with: {password[:2]}...", flush=True)

# Try to get user safely without relying on controlling terminal
try:
    import pwd
    username = pwd.getpwuid(os.getuid()).pw_name
    print(f"User: {username}", flush=True)
except:
    print("User: (detection failed)", flush=True)

try:
    pid, fd = pty.fork()
except Exception as e:
    print(f"Fork failed: {e}", flush=True)
    sys.exit(1)

if pid == 0:
    # Child
    try:
        # Use execvp to find ssh-copy-id in PATH automatically
        # Expand user path manually just in case
        pubkey = os.path.expanduser('~/.ssh/id_ed25519.pub')
        print(f"Using key: {pubkey}", flush=True)
        
        if not os.path.exists(pubkey):
             rsa = os.path.expanduser('~/.ssh/id_rsa.pub')
             if os.path.exists(rsa):
                 print(f"Ed25519 not found, switching to RSA: {rsa}", flush=True)
                 pubkey = rsa
             else:
                 sys.stderr.write(f"Public key not found at {pubkey}\\n")
                 sys.exit(1)

        # SELECT STRATEGY
        if use_sftp: # use_sftp is True for Hetzner detected via IS_HETZNER flag or hostname
             # HETZNER SPECIAL: Use install-ssh-key command
             # Logic: pipe local key to remote install-ssh-key command via ssh
             
             cmd_str = f"cat {pubkey} | ssh -p {target_port if target_port else '23'} -o StrictHostKeyChecking=no -o PreferredAuthentications=password,keyboard-interactive {target_host} install-ssh-key"
             
             print(f"Running Hetzner native install command: {cmd_str}", flush=True)
             # We must run via shell to handle the pipe
             os.execvp('bash', ['bash', '-c', cmd_str])
        else:
             # GENERIC LINUX: Use standard ssh-copy-id
             args = [
                'ssh-copy-id', 
                '-i', pubkey, 
                '-o', 'StrictHostKeyChecking=no',
                '-o', 'PreferredAuthentications=password,keyboard-interactive'
             ]
             if target_port: args.extend(['-p', target_port])
             args.append(target_host)
             
             print(f"Running standard ssh-copy-id: {args}", flush=True)
             os.execvp('ssh-copy-id', args)

    except Exception as e:
        sys.stderr.write(f"Exec failed: {e}\\n")
        sys.exit(1)
else:
    # Parent (PTY Handler)
    # Simple loop that just handles password Authentication.
    # The Child command (ssh-copy-id OR ssh ... install-ssh-key) handles the logic.
    try:
        output = b""
        password_sent = False
        
        while True:
            try:
                chunk = read(fd)
                if not chunk: break
                
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
                
                output += chunk
                lower_chunk = chunk.lower()

                # --- 1. Auth ---
                if b"continue connecting" in lower_chunk:
                    print("\\n[PTY] Host check detected, sending yes...", flush=True)
                    os.write(fd, b"yes\\n")
                    time.sleep(1.0)
                
                if b"password:" in lower_chunk and not password_sent:
                    print("\\n[PTY] Prompt detected, sending password...", flush=True)
                    time.sleep(0.5)
                    os.write(fd, password.encode() + b'\\r')
                    password_sent = True 
                    time.sleep(1.0)
                
                if b"permission denied" in lower_chunk and password_sent:
                     print("\\n[PTY] Permission denied detected.", flush=True)
                     password_sent = False
                    
            except OSError:
                break
    except Exception as e:
        print(f"Parent loop error: {e}", flush=True)
        sys.exit(1)

        
    # Wait for child
    _, status = os.waitpid(pid, 0)
    # Forward exit code
    exit_code = os.WEXITSTATUS(status)
    print(f"Child exited with {exit_code}", flush=True)
    sys.exit(exit_code)
`;

    const targetDistro = await getPreferredWslDistro();
    const wslBaseArgs = targetDistro ? ['-d', targetDistro] : [];
    
    // Helper to write file to WSL via hex
    const writeWslFile = async (filePath, content) => {
        const hex = Buffer.from(content).toString('hex');
        const cmd = `echo "${hex}" | python3 -c "import sys, binascii; sys.stdout.buffer.write(binascii.unhexlify(sys.stdin.read().strip()))" > ${filePath}`;
        // Ensure no history? it's in a variable. 
        const proc = spawn('wsl', [...wslBaseArgs, '--exec', 'bash', '-c', cmd]);
        return new Promise(r => proc.on('close', r));
    };
    
    try {
        // 1. Write password to temp file
        await writeWslFile(passFile, password);

        // 2. Write python script to temp file
        await writeWslFile(scriptFile, pythonScript);
        
        // 3. Run the script with python3 -u (unbuffered)
        console.log(`[SSH-Install] Running python PTY script on ${target}...`);
        const runProc = spawn('wsl', [...wslBaseArgs, '--exec', 'python3', '-u', scriptFile]);
        
        let out = '';
        let err = '';
        runProc.stdout.on('data', d => out += d.toString());
        runProc.stderr.on('data', d => err += d.toString());
        
        const code = await new Promise(resolve => runProc.on('close', resolve));
        
        // 4. Cleanup
        spawn('wsl', [...wslBaseArgs, '--exec', 'rm', '-f', scriptFile, passFile]);
        
        if (code === 0) {
            return { success: true };
        } else {
            // Analyze output for common errors
            console.error("SSH Install Failed:", out, err);
            return { success: false, error: `Process exited with code ${code}.\nOutput: ${out}\nError: ${err}` };
        }
    } catch (e) {
        // Try cleanup on error
        spawn('wsl', [...wslBaseArgs, '--exec', 'rm', '-f', scriptFile, passFile]);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('ssh-install-borg', async (event, { target, password, port }) => {
    // Generate unique ID for temp files
    const runId = Date.now().toString();
    const passFile = `/tmp/winborg-pass-${runId}`;
    const scriptFile = `/tmp/winborg-borg-${runId}.py`;
    
    // Default port
    const finalPort = port || '22';
    const safePort = finalPort.replace(/'/g, "\\'");
    
    // Python script to handle the interactive session via PTY
    // This handles both SSH login (if needed) and sudo password (if needed)
    // using the SAME password provided.
    const pythonScript = `
import pty
import os
import sys
import time
import subprocess
import select
import base64

# Read password
try:
    with open('${passFile}', 'r') as f:
        password = f.read()
        if password.endswith('\\n'):
            password = password[:-1]
except:
    sys.exit(1)

target_host = '${target}'
target_port = '${safePort}'

def read(fd):
    return os.read(fd, 1024)

# The complex remote command to detect and install borg
# We check for borg, then check for apt-get, then try install.
remote_cmd = """
export DEBIAN_FRONTEND=noninteractive
if command -v borg >/dev/null 2>&1; then
    echo "WINBORG_STATUS: BORG_ALREADY_INSTALLED"
    exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "WINBORG_STATUS: UNSUPPORTED_DISTRO"
    exit 1
fi

echo "WINBORG_STATUS: INSTALLING"
if [ "$(id -u)" -eq 0 ]; then
    apt-get update && apt-get install -y borgbackup
else
    # sudo will prompt for password, which our PTY handler will catch
    sudo -p "sudo_password_prompt:" apt-get update && sudo -p "sudo_password_prompt:" apt-get install -y borgbackup
fi
"""

# Base64 encode the script to avoid SSH/Shell escaping hell
b64_script = base64.b64encode(remote_cmd.encode()).decode()
# Run: echo <b64> | base64 -d | bash
final_cmd = f"echo {b64_script} | base64 -d | bash"

ssh_cmd = [
    'ssh',
    '-p', target_port,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'PreferredAuthentications=publickey,password,keyboard-interactive',
    '-t', # Force pseudo-tty allocation so sudo detects a terminal
    target_host,
    final_cmd
]

pid, fd = pty.fork()

if pid == 0:
    # Child
    try:
        os.execvp('ssh', ssh_cmd)
    except Exception as e:
        sys.exit(1)
else:
    # Parent
    try:
        output_buffer = b"" # Rolling buffer for pattern matching
        password_sent_count = 0
        last_pwd_time = 0
        
        while True:
            r, _, _ = select.select([fd], [], [], 0.1)
            if fd in r:
                try:
                    chunk = read(fd)
                    if not chunk: break
                except OSError:
                    break
                    
                sys.stdout.buffer.write(chunk)
                sys.stdout.buffer.flush()
                
                # Append to rolling buffer, keep last 200 chars to ensure we don't miss split patterns
                output_buffer += chunk
                if len(output_buffer) > 200:
                    output_buffer = output_buffer[-200:]
                
                lower_buffer = output_buffer.lower()
                
                # Answer verify host
                if b"continue connecting" in lower_buffer:
                    print("\\n[PTY] Host check detected, sending yes...", flush=True)
                    os.write(fd, b"yes\\n")
                    # Clear buffer to avoid re-triggering? 
                    # Actually better to just ensure we don't loop fast.
                    time.sleep(1.0)
                    output_buffer = b""

                # Answer Password Prompts (SSH or explicit Sudo)
                # Matches "password:" or our custom "sudo_password_prompt:"
                if (b"password:" in lower_buffer or b"sudo_password_prompt:" in lower_buffer):
                     now = time.time()
                     # Simple debounce: wait at least 2 seconds between passwords
                     if now - last_pwd_time > 2.0:
                         print("\\n[PTY] Password prompt detected, sending password...", flush=True)
                         time.sleep(0.5)
                         os.write(fd, password.encode() + b'\\n')
                         last_pwd_time = time.time()
                         password_sent_count += 1
                         output_buffer = b"" # Reset buffer after handling
            else:
                # Check if child exited
                if os.waitpid(pid, os.WNOHANG) != (0, 0):
                    break
                    
    except Exception as e:
        print(f"Parent loop error: {e}", flush=True)


    # Wait for child
    try:
        _, status = os.waitpid(pid, 0)
        exit_code = os.WEXITSTATUS(status)
    except:
        exit_code = 1
        
    print(f"Child exited with {exit_code}", flush=True)
    sys.exit(exit_code)
`;

    const targetDistro = await getPreferredWslDistro();
    const wslBaseArgs = targetDistro ? ['-d', targetDistro] : [];
    
    // Helper to write file
    const writeWslFile = async (filePath, content) => {
        const hex = Buffer.from(content).toString('hex');
        const cmd = `echo "${hex}" | python3 -c "import sys, binascii; sys.stdout.buffer.write(binascii.unhexlify(sys.stdin.read().strip()))" > ${filePath}`;
        const proc = spawn('wsl', [...wslBaseArgs, '--exec', 'bash', '-c', cmd]);
        return new Promise(r => proc.on('close', r));
    };
    
    try {
        await writeWslFile(passFile, password);
        await writeWslFile(scriptFile, pythonScript);
        
        const runProc = spawn('wsl', [...wslBaseArgs, '--exec', 'python3', '-u', scriptFile]);
        
        let out = '';
        let err = '';
        runProc.stdout.on('data', d => out += d.toString());
        runProc.stderr.on('data', d => err += d.toString());
        
        const code = await new Promise(resolve => runProc.on('close', resolve));
        
        spawn('wsl', [...wslBaseArgs, '--exec', 'rm', '-f', scriptFile, passFile]);
        
        if (code === 0) {
            return { success: true, output: out };
        } else {
            return { success: false, error: "Usage Error or Failed. Check Logs.", details: out + err };
        }
    } catch (e) {
        spawn('wsl', [...wslBaseArgs, '--exec', 'rm', '-f', scriptFile, passFile]);
        return { success: false, error: e.message };
    }
});
