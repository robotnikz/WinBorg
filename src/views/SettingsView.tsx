import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import ToggleSwitch from '../components/ToggleSwitch';
import { 
  Save, Terminal, Key, Check, Network, Info, Download, Monitor, XCircle, 
  Layout, Bell, Mail, Hash, AlertTriangle, Loader2, Battery, WifiOff, Zap,
    Settings, Shield, Globe, Cpu, ChevronRight, Upload
} from 'lucide-react';
import { borgService } from '../services/borgService';
import { getAppVersion } from '../utils/appVersion';

// Helper component for Section Cards
const SettingsCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    description?: string;
    children: React.ReactNode;
}> = ({ title, icon, description, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex items-start sm:items-center justify-between gap-4">
           <div>
               <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                   <span className="text-slate-500 dark:text-slate-400">{icon}</span>
                   {title}
               </h2>
               {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-7">{description}</p>}
           </div>
        </div>
        <div className="p-6">
            {children}
        </div>
    </div>
);

type SettingsTab = 'general' | 'automation' | 'notifications' | 'system';

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    const [appVersion, setAppVersion] = useState<string | null>((process.env as any)?.APP_VERSION ?? null);

  // Application Settings
  const [useWsl, setUseWsl] = useState(true);
  const [disableHostCheck, setDisableHostCheck] = useState(false);
  const [closeToTray, setCloseToTray] = useState(false);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  
  // Borg & Backend Settings
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [limitBandwidth, setLimitBandwidth] = useState(false);
  const [bandwidthLimit, setBandwidthLimit] = useState(1000);

  // Smart Settings
  const [stopOnBattery, setStopOnBattery] = useState(true);
  const [stopOnLowSignal, setStopOnLowSignal] = useState(false);
  
  // Scheduler / Time Window
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleStart, setScheduleStart] = useState("02:00");
  const [scheduleEnd, setScheduleEnd] = useState("06:00");
  const [scheduleStrict, setScheduleStrict] = useState(false);

  // States
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState('');

  // Notification State
  const [notifyConfig, setNotifyConfig] = useState({
    notifyOnSuccess: true,
    notifyOnError: true,
        notifyOnUpdate: false,
    discordEnabled: false,
    discordWebhook: '',
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    smtpTo: '',
    hasSmtpPass: false
  });
  const [notifyTestStatus, setNotifyTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Settings transfer
    const [includeSecretsInBackup, setIncludeSecretsInBackup] = useState(false);
    const [transferStatus, setTransferStatus] = useState<'idle' | 'exporting' | 'importing' | 'success' | 'error'>('idle');
    const [transferMessage, setTransferMessage] = useState('');

  // Helper to access Electron
  const getElectron = () => {
      try { return (window as any).require('electron'); } catch (e) { return null; }
  };

  useEffect(() => {
    const ipc = getElectron()?.ipcRenderer;
    if (ipc) {
        // Load General Settings from DB
        ipc.invoke('get-db').then((db: any) => {
            if (db.settings) {
                setUseWsl(db.settings.useWsl !== undefined ? db.settings.useWsl : true);
                setBorgPath(db.settings.borgPath || 'borg');
                setBorgPassphrase(db.settings.borgPassphrase || '');
                setDisableHostCheck(db.settings.disableHostCheck || false);
                setCloseToTray(db.settings.closeToTray || false);
                setStartWithWindows(db.settings.startWithWindows || false);
                setStartMinimized(db.settings.startMinimized || false);
                setStopOnBattery(db.settings.stopOnBattery !== undefined ? db.settings.stopOnBattery : true);
                setStopOnLowSignal(db.settings.stopOnLowSignal !== undefined ? db.settings.stopOnLowSignal : false);
                setLimitBandwidth(db.settings.limitBandwidth || false);
                setBandwidthLimit(db.settings.bandwidthLimit || 1000);
                
                // Scheduler
                setScheduleEnabled(db.settings.scheduleEnabled || false);
                setScheduleStart(db.settings.scheduleStart || "02:00");
                setScheduleEnd(db.settings.scheduleEnd || "06:00");
                setScheduleStrict(db.settings.scheduleStrict || false);
            }
        });

        // Load Notification Config
        ipc.invoke('get-notification-config').then((cfg: any) => {
            setNotifyConfig(prev => ({ ...prev, ...cfg }));
        });
    } else {
        // Fallback for non-electron
        const storedWsl = localStorage.getItem('winborg_use_wsl');
        setUseWsl(storedWsl === null ? true : storedWsl === 'true');
    }
  }, []);

    useEffect(() => {
        let isMounted = true;
        getAppVersion().then((v) => {
            if (isMounted) setAppVersion(v);
        });
        return () => {
            isMounted = false;
        };
    }, []);

  useEffect(() => {
      const ipc = getElectron()?.ipcRenderer;
      if (!ipc || typeof ipc.on !== 'function' || typeof ipc.removeListener !== 'function') return;

      const onImported = () => {
          // Import affects repos/jobs/settings across the whole app; easiest is a full reload.
          window.location.reload();
      };

      ipc.on('app-data-imported', onImported);
      return () => {
          ipc.removeListener('app-data-imported', onImported);
      };
  }, []);

  const handleExportAppData = async () => {
      const ipc = getElectron()?.ipcRenderer;
      if (!ipc) {
          alert('Export is only available in the packaged Electron app.');
          return;
      }

      try {
          setTransferStatus('exporting');
          setTransferMessage('');
          const res = await ipc.invoke('export-app-data', { includeSecrets: includeSecretsInBackup });
          if (res?.canceled) {
              setTransferStatus('idle');
              return;
          }
          if (res?.filePath) {
              setTransferStatus('success');
              setTransferMessage(`Exported to: ${res.filePath}`);
              setTimeout(() => setTransferStatus('idle'), 3000);
          } else {
              setTransferStatus('error');
              setTransferMessage('Export failed.');
          }
      } catch (e) {
          setTransferStatus('error');
          setTransferMessage('Export failed.');
      }
  };

  const handleImportAppData = async () => {
      const ipc = getElectron()?.ipcRenderer;
      if (!ipc) {
          alert('Import is only available in the packaged Electron app.');
          return;
      }

      const ok = confirm(
          'This will replace your current WinBorg repositories, jobs, and settings with the contents of the backup file. Continue?'
      );
      if (!ok) return;

      try {
          setTransferStatus('importing');
          setTransferMessage('');
          const res = await ipc.invoke('import-app-data', { includeSecrets: includeSecretsInBackup });
          if (res?.canceled) {
              setTransferStatus('idle');
              return;
          }
          if (res?.ok) {
              setTransferStatus('success');
              setTransferMessage(
                  `Imported: ${res.imported?.repos ?? 0} repos, ${res.imported?.jobs ?? 0} jobs${res.imported?.secrets ? ', secrets included' : ''}. Reloading...`
              );
              // main process emits 'app-data-imported' -> reload
          } else {
              setTransferStatus('error');
              setTransferMessage(res?.error || 'Import failed.');
          }
      } catch (e) {
          setTransferStatus('error');
          setTransferMessage('Import failed.');
      }
  };

  const handleSave = () => {
    const ipc = getElectron()?.ipcRenderer;
    if (ipc) {
        ipc.invoke('save-db', {
            settings: {
                useWsl,
                borgPath,
                borgPassphrase,
                disableHostCheck,
                closeToTray,
                startWithWindows,
                startMinimized,
                stopOnBattery,
                stopOnLowSignal,
                limitBandwidth,
                bandwidthLimit,
                scheduleEnabled,
                scheduleStart,
                scheduleEnd,
                scheduleStrict
            }
        });
        ipc.invoke('save-notification-config', notifyConfig);
    } else {
        localStorage.setItem('winborg_use_wsl', String(useWsl));
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('loading');
    setTestOutput('');
    const success = await borgService.runCommand(['--version'], (log) => {
        setTestOutput(prev => prev + log);
    });
    setTestStatus(success ? 'success' : 'error');
  };

  const handleTestNotification = async (type: 'discord' | 'email') => {
      setNotifyTestStatus('loading');
      const ipc = getElectron()?.ipcRenderer;
      if (ipc) {
          try {
              // Save temp config first so backend uses current values
              await ipc.invoke('save-notification-config', notifyConfig);
              await ipc.invoke('test-notification', type);
              setNotifyTestStatus('success');
              setTimeout(() => setNotifyTestStatus('idle'), 3000);
          } catch(e) {
              setNotifyTestStatus('error');
              setTimeout(() => setNotifyTestStatus('idle'), 3000);
          }
      }
  };

  const handleCheckUpdate = async () => {
      const ipc = getElectron()?.ipcRenderer;
      if (ipc) {
          await ipc.invoke('check-for-updates');
      } else {
          alert("Updates are handled by Electron Main Process");
      }
  };

  const inputClass = "w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors placeholder:text-slate-400";

  // Navigation Item Helper
  const renderSidebarItem = (id: SettingsTab, label: string, icon: React.ReactNode) => (
      <button
          onClick={() => setActiveTab(id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === id 
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
          }`}
      >
          {icon}
          <span>{label}</span>
          {activeTab === id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
      </button>
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden max-w-6xl mx-auto animate-in fade-in duration-300">
      
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 pr-6 border-r border-gray-100 dark:border-slate-700/50 hidden md:block">
          <div className="space-y-1">
              <div className="px-4 py-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Preferences</div>
              {renderSidebarItem('general', 'General', <Layout className="w-4 h-4" />)}
              {renderSidebarItem('automation', 'Performance & Rules', <Zap className="w-4 h-4" />)}
              {renderSidebarItem('notifications', 'Notifications', <Bell className="w-4 h-4" />)}
              
              <div className="px-4 py-2 mb-2 mt-6 text-xs font-bold text-slate-400 uppercase tracking-wider">System</div>
              {renderSidebarItem('system', 'System & Backend', <Terminal className="w-4 h-4" />)}
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pl-0 md:pl-6 pb-20 custom-scrollbar">
          
          <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Manage configuration and preferences</p>
              </div>
              
              <Button size="lg" onClick={handleSave} className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
                {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {saved ? "Saved" : "Save Changes"}
              </Button>
          </div>

          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <SettingsCard title="Application Behavior" icon={<Monitor className="w-5 h-5"/>} description="Customize how the app integrates with your desktop">
                       <div className="space-y-4">
                           {/* Close to Tray */}
                           <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                               <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-full ${closeToTray ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                       {closeToTray ? <Monitor className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                   </div>
                                   <div>
                                       <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="tray-toggle">Minimize to Tray</label>
                                       <p className="text-xs text-slate-500 dark:text-slate-400">Keep application running in background when closed</p>
                                   </div>
                               </div>
                               <ToggleSwitch id="tray-toggle" checked={closeToTray} onChange={setCloseToTray} />
                           </div>

                           {/* Autostart */}
                           <div className="p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                               <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                       <div className={`p-2 rounded-full ${startWithWindows ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                           {startWithWindows ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                       </div>
                                       <div>
                                           <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="autostart-toggle">Start with Windows</label>
                                           <p className="text-xs text-slate-500 dark:text-slate-400">Automatically launch WinBorg on system startup</p>
                                       </div>
                                   </div>
                                   <ToggleSwitch 
                                      id="autostart-toggle" 
                                      checked={startWithWindows} 
                                      onChange={(checked) => {
                                          setStartWithWindows(checked);
                                          if (!checked) setStartMinimized(false);
                                          getElectron()?.ipcRenderer?.send('settings:toggleAutoStart', checked);
                                      }}
                                   />
                               </div>
                               
                               {/* Start Minimized */}
                               <div className={`mt-3 ml-12 pl-4 border-l-2 border-slate-200 dark:border-slate-700 transition-all ${startWithWindows ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="start-minimized-check"
                                            className="h-4 w-4 rounded border-gray-300 dark:bg-slate-800 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                            checked={startMinimized}
                                            onChange={(e) => setStartMinimized(e.target.checked)}
                                            disabled={!startWithWindows}
                                        />
                                        <label htmlFor="start-minimized-check" className="text-sm text-slate-700 dark:text-slate-300">Start minimized to tray</label>
                                    </div>
                               </div>
                           </div>
                       </div>
                  </SettingsCard>

                  <SettingsCard title="Updates & Maintenance" icon={<Download className="w-5 h-5"/>}>
                       <div className="flex items-center justify-between p-1">
                           <div>
                               <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Check for Updates</div>
                               <p className="text-xs text-slate-500 dark:text-slate-400">Current version: {appVersion || (process.env as any).APP_VERSION || 'Web Dev'}</p>
                           </div>
                           <Button variant="secondary" onClick={handleCheckUpdate} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                               Check Now
                           </Button>
                       </div>
                  </SettingsCard>
              </div>
          )}

          {/* TAB: AUTOMATION (PERFORMANCE & RULES) */}
          {activeTab === 'automation' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                   {/* 1. Time Window / Scheduler */}
                   <SettingsCard title="Backup Schedule Window" icon={<Monitor className="w-5 h-5"/>} description="Restrict backups to specific hours (e.g., night time)">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-full ${scheduleEnabled ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                       <Layout className="w-5 h-5" />
                                   </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="sched-toggle">Active Hours Only</label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Only run scheduled jobs within the specified time window</p>
                                    </div>
                                </div>
                                <ToggleSwitch id="sched-toggle" checked={scheduleEnabled} onChange={setScheduleEnabled} color="blue" />
                            </div>

                            {/* Time Inputs */}
                            <div className={`grid grid-cols-2 gap-4 pl-14 transition-all duration-300 ${!scheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={scheduleStart}
                                        onChange={(e) => setScheduleStart(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">End Time</label>
                                    <input 
                                        type="time" 
                                        value={scheduleEnd}
                                        onChange={(e) => setScheduleEnd(e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                            
                            {/* Strict Mode */}
                             <div className={`flex items-center gap-2 pl-14 ${!scheduleEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                <input
                                    type="checkbox"
                                    id="strict-sched"
                                    checked={scheduleStrict}
                                    onChange={(e) => setScheduleStrict(e.target.checked)}
                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                />
                                <label htmlFor="strict-sched" className="text-sm text-slate-700 dark:text-slate-300">
                                    <span className="font-medium">Force Stop</span> (Cancel running jobs if time ends)
                                </label>
                             </div>
                        </div>
                   </SettingsCard>

                   {/* 2. Bandwidth & Performance */}
                   <SettingsCard title="Performance & Limits" icon={<Cpu className="w-5 h-5"/>} description="Manage resource usage">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                 <div className='flex items-center gap-3'>
                                    <div className={`p-2 rounded-full ${limitBandwidth ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                       <Network className="w-5 h-5" />
                                   </div>
                                    <div>
                                        <label htmlFor="bw-limit-check" className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">Upload Bandwidth Limit</label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Restrict speed to prevent network congestion</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <div className={`flex items-center gap-2 ${!limitBandwidth ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <input
                                            type="number"
                                            className="w-24 px-2 py-1 text-sm bg-white dark:bg-slate-900 dark:text-white border border-gray-300 dark:border-slate-600 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            value={bandwidthLimit}
                                            onChange={(e) => setBandwidthLimit(parseInt(e.target.value) || 0)}
                                        />
                                        <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>KB/s</span>
                                     </div>
                                     <ToggleSwitch id="bw-limit-check" checked={limitBandwidth} onChange={setLimitBandwidth} color="indigo" />
                                 </div>
                             </div>
                        </div>
                   </SettingsCard>

                   {/* 3. Conditions (Battery / Mobile) */}
                   <SettingsCard title="Smart Conditions" icon={<Shield className="w-5 h-5"/>}>
                        <div className="space-y-4">
                            {/* Battery */}
                            <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                               <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-full ${stopOnBattery ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                       <Battery className="w-5 h-5" />
                                   </div>
                                   <div>
                                       <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="battery-toggle">On Battery Power</label>
                                       <p className="text-xs text-slate-500 dark:text-slate-400">Pause/Skip jobs when device is unplugged</p>
                                   </div>
                               </div>
                               <ToggleSwitch id="battery-toggle" checked={stopOnBattery} onChange={setStopOnBattery} color="orange" />
                           </div>

                           {/* Offline */}
                           <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                               <div className="flex items-center gap-3">
                                   <div className={`p-2 rounded-full ${stopOnLowSignal ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                                       {stopOnLowSignal ? <WifiOff className="w-5 h-5" /> : <Network className="w-5 h-5" />}
                                   </div>
                                   <div>
                                       <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="offline-toggle">Offline / Metered Connection</label>
                                       <p className="text-xs text-slate-500 dark:text-slate-400">Skip jobs when internet is unavailable or expensive</p>
                                   </div>
                               </div>
                               <ToggleSwitch id="offline-toggle" checked={stopOnLowSignal} onChange={setStopOnLowSignal} color="red" />
                           </div>
                        </div>
                   </SettingsCard>

              </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <SettingsCard title="Trigger Rules" icon={<Bell className="w-5 h-5"/>} description="When should you be notified?">
                      <div className="flex flex-col sm:flex-row gap-6">
                            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30 flex-1">
                                <ToggleSwitch id="notify-success" checked={notifyConfig.notifyOnSuccess} onChange={(c) => setNotifyConfig({...notifyConfig, notifyOnSuccess: c})} color="green" />
                                <label htmlFor="notify-success" className="text-sm font-medium text-slate-700 dark:text-slate-200">Notify on Success</label>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30 flex-1">
                                <ToggleSwitch id="notify-error" checked={notifyConfig.notifyOnError} onChange={(c) => setNotifyConfig({...notifyConfig, notifyOnError: c})} color="red" />
                                <label htmlFor="notify-error" className="text-sm font-medium text-slate-700 dark:text-slate-200">Notify on Failure</label>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 flex-1">
                                <ToggleSwitch id="notify-updates" checked={notifyConfig.notifyOnUpdate} onChange={(c) => setNotifyConfig({...notifyConfig, notifyOnUpdate: c})} color="blue" />
                                <label htmlFor="notify-updates" className="text-sm font-medium text-slate-700 dark:text-slate-200">Notify on Updates</label>
                            </div>
                      </div>
                  </SettingsCard>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <div className={`rounded-xl border transition-all ${notifyConfig.discordEnabled ? 'border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-800 shadow-md ring-1 ring-indigo-500/20' : 'border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                          <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
                              <h3 className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><Hash className="w-4 h-4"/> Discord</h3>
                              <ToggleSwitch id="discord-toggle" checked={notifyConfig.discordEnabled} onChange={(c) => setNotifyConfig({...notifyConfig, discordEnabled: c})} color="indigo" />
                          </div>
                          <div className={`p-4 ${!notifyConfig.discordEnabled && 'opacity-50 pointer-events-none'}`}>
                              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Webhook URL</label>
                              <input type="text" placeholder="https://discord.com/api/webhooks/..." className={inputClass} value={notifyConfig.discordWebhook} onChange={(e) => setNotifyConfig({...notifyConfig, discordWebhook: e.target.value})} />
                              
                              <div className="mt-4 flex justify-end">
                                 <Button size="sm" variant="secondary" onClick={() => handleTestNotification('discord')} disabled={notifyTestStatus === 'loading'}>Test Integration</Button>
                              </div>
                          </div>
                      </div>

                      <div className={`rounded-xl border transition-all ${notifyConfig.emailEnabled ? 'border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-800 shadow-md ring-1 ring-orange-500/20' : 'border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
                          <div className="p-4 border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between">
                              <h3 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2"><Mail className="w-4 h-4"/> SMTP Email</h3>
                              <ToggleSwitch id="email-toggle" checked={notifyConfig.emailEnabled} onChange={(c) => setNotifyConfig({...notifyConfig, emailEnabled: c})} color="orange" />
                          </div>
                          <div className={`p-4 space-y-3 ${!notifyConfig.emailEnabled && 'opacity-50 pointer-events-none'}`}>
                               <div className="grid grid-cols-3 gap-3">
                                   <div className="col-span-2">
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Host</label>
                                      <input type="text" placeholder="smtp.gmail.com" className={inputClass} value={notifyConfig.smtpHost} onChange={(e) => setNotifyConfig({...notifyConfig, smtpHost: e.target.value})} />
                                   </div>
                                   <div>
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Port</label>
                                      <input type="number" className={inputClass} value={notifyConfig.smtpPort} onChange={(e) => setNotifyConfig({...notifyConfig, smtpPort: parseInt(e.target.value)})} />
                                   </div>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                   <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">User</label><input type="text" className={inputClass} value={notifyConfig.smtpUser} onChange={(e) => setNotifyConfig({...notifyConfig, smtpUser: e.target.value})} /></div>
                                   <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Password</label><input type="password" placeholder={notifyConfig.hasSmtpPass ? "(Saved)" : "Required"} className={inputClass} value={notifyConfig.smtpPass} onChange={(e) => setNotifyConfig({...notifyConfig, smtpPass: e.target.value})} /></div>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                   <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label><input type="text" className={inputClass} value={notifyConfig.smtpFrom} onChange={(e) => setNotifyConfig({...notifyConfig, smtpFrom: e.target.value})} /></div>
                                   <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label><input type="text" className={inputClass} value={notifyConfig.smtpTo} onChange={(e) => setNotifyConfig({...notifyConfig, smtpTo: e.target.value})} /></div>
                               </div>
                               <div className="mt-4 flex justify-end">
                                  <Button size="sm" variant="secondary" onClick={() => handleTestNotification('email')} disabled={notifyTestStatus === 'loading'}>
                                      {notifyTestStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Test Email'}
                                  </Button>
                               </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* TAB: SYSTEM */}
          {activeTab === 'system' && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <SettingsCard title="Backend Environment" icon={<Terminal className="w-5 h-5"/>} description="Configure how WinBorg executes commands">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">Use Windows Subsystem for Linux (WSL)</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">RECOMMENDED</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">Runs Borg inside a real Linux environment (e.g. Ubuntu).</p>
                                </div>
                                <ToggleSwitch id="wsl-toggle" checked={useWsl} onChange={setUseWsl} />
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg p-5 text-sm">
                                <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-3">
                                    <Info className="w-4 h-4 text-blue-500" />
                                    {useWsl ? 'WSL Environment (Ubuntu/Debian)' : 'Windows Powershell Environment'}
                                </h3>
                                {useWsl ? (
                                    <div className="space-y-3">
                                        <p className="text-xs text-blue-800 dark:text-blue-300">Requires <code>borgbackup</code> and <code>fuse3</code> installed in your default distro:</p>
                                        <div className="bg-slate-900 rounded p-3 font-mono text-xs shadow-inner">
                                            <code className="block text-green-400 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y')}>
                                                sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
                                            </code>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-red-500">Warning: Windows binaries are experimental.</p>
                                        <div className="bg-slate-900 rounded p-3 font-mono text-xs shadow-inner text-yellow-400">
                                            <code className="block select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('scoop install borgbackup')}>
                                                scoop bucket add extras; scoop install borgbackup
                                            </code>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                  </SettingsCard>

                  <SettingsCard title="Borg Configuration" icon={<Cpu className="w-5 h-5"/>}>
                       <div className="space-y-4">
                           {!useWsl && (
                               <div>
                                   <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Borg Binary Path</label>
                                   <div className="flex gap-2">
                                       <input type="text" className={inputClass} value={borgPath} onChange={(e) => setBorgPath(e.target.value)} placeholder="borg" />
                                   </div>
                               </div>
                           )}
                           
                           <div>
                               <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Global Fallback Passphrase</label>
                               <div className="relative">
                                   <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                   <input 
                                     type="password" 
                                     className={`${inputClass} pl-9`} 
                                     value={borgPassphrase} 
                                     onChange={(e) => setBorgPassphrase(e.target.value)} 
                                     placeholder="••••••••" 
                                   />
                               </div>
                               <p className="text-[10px] text-slate-400 mt-1">Used if a repo has no specific key saved.</p>
                           </div>

                           <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" id="host-check" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={disableHostCheck} onChange={(e) => setDisableHostCheck(e.target.checked)} />
                                    <div>
                                        <label htmlFor="host-check" className="text-sm font-medium text-slate-800 dark:text-slate-200">Disable Strict Host Key Checking</label>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Accept new SSH keys automatically (Required for background tasks)</p>
                                    </div>
                                </div>
                           </div>

                           <div className="pt-2">
                                <Button variant="secondary" onClick={handleTest} disabled={testStatus === 'loading'} className={`w-full ${testStatus === 'success' ? 'border-green-500 text-green-600 bg-green-50' : ''}`}>
                                   {testStatus === 'loading' ? 'Testing...' : testStatus === 'success' ? 'Connection Successful' : 'Test Borg Connection'}
                                </Button>
                                {testStatus === 'error' && (
                                    <div className="mt-2 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-100 font-mono whitespace-pre-wrap">{testOutput}</div>
                                )}
                           </div>
                       </div>
                  </SettingsCard>

                  <SettingsCard title="Backup & Restore" icon={<Download className="w-5 h-5"/>} description="Export/import your WinBorg repositories, jobs and settings">
                      <div className="space-y-4">
                          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <input
                                  type="checkbox"
                                  id="include-secrets"
                                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  checked={includeSecretsInBackup}
                                  onChange={(e) => setIncludeSecretsInBackup(e.target.checked)}
                              />
                              <div>
                                  <label htmlFor="include-secrets" className="text-sm font-medium text-slate-800 dark:text-slate-200">Include encrypted secrets (advanced)</label>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      Includes stored repo passphrases and SMTP password from this Windows user profile. Treat the export file as sensitive.
                                  </p>
                              </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                              <Button
                                  variant="secondary"
                                  onClick={handleExportAppData}
                                  disabled={transferStatus === 'exporting' || transferStatus === 'importing'}
                                  className="w-full"
                              >
                                  <Download className="w-4 h-4" />
                                  <span className="ml-2">Export Settings</span>
                              </Button>
                              <Button
                                  variant="secondary"
                                  onClick={handleImportAppData}
                                  disabled={transferStatus === 'exporting' || transferStatus === 'importing'}
                                  className="w-full"
                              >
                                  <Upload className="w-4 h-4" />
                                  <span className="ml-2">Import Settings</span>
                              </Button>
                          </div>

                          {transferMessage && (
                              <div className={`text-xs rounded border p-3 ${transferStatus === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-800 dark:text-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30'}`}>
                                  {transferMessage}
                              </div>
                          )}
                      </div>
                  </SettingsCard>
              </div>
          )}

      </div>
    </div>
  );
};

export default SettingsView;
