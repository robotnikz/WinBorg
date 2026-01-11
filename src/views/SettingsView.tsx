import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import ToggleSwitch from '../components/ToggleSwitch';
import { Save, Terminal, Key, Check, Network, Info, Download, Monitor, XCircle, Layout, Bell, Mail, Hash, AlertTriangle, Loader2, Battery, WifiOff, Zap } from 'lucide-react';
import { borgService } from '../services/borgService';

const SettingsView: React.FC = () => {
  const [useWsl, setUseWsl] = useState(true); 
  const [borgPath, setBorgPath] = useState('borg');
  const [borgPassphrase, setBorgPassphrase] = useState('');
  const [disableHostCheck, setDisableHostCheck] = useState(false);
  const [closeToTray, setCloseToTray] = useState(false);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [limitBandwidth, setLimitBandwidth] = useState(false);
  const [bandwidthLimit, setBandwidthLimit] = useState(1000);
  
  // SMART SETTINGS
  const [stopOnBattery, setStopOnBattery] = useState(true);
  const [stopOnLowSignal, setStopOnLowSignal] = useState(false);
  
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState('');

  // NOTIFICATION STATE
  const [notifyConfig, setNotifyConfig] = useState({
    notifyOnSuccess: true,
    notifyOnError: true,
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
            }
        });

        // Load Notification Config
        ipc.invoke('get-notification-config').then((cfg: any) => {
            setNotifyConfig(prev => ({ ...prev, ...cfg }));
        });
    } else {
        // Fallback for non-electron (legacy localStorage for dev)
        const storedWsl = localStorage.getItem('winborg_use_wsl');
        setUseWsl(storedWsl === null ? true : storedWsl === 'true');
    }
  }, []);

  const handleSave = () => {
    const ipc = getElectron()?.ipcRenderer;
    if (ipc) {
        // Save General Settings to DB
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
                bandwidthLimit
            }
        });
        
        // Save Notifications
        ipc.invoke('save-notification-config', notifyConfig);
    } else {
        // Legacy fallback
        localStorage.setItem('winborg_use_wsl', String(useWsl));
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('loading');
    setTestOutput('');
    const success = await borgService.runCommand(['--version'], (log) => {
        console.log(log);
        setTestOutput(prev => prev + log);
    });
    setTestStatus(success ? 'success' : 'error');
  };

  const handleTestNotification = async (type: 'discord' | 'email') => {
      setNotifyTestStatus('loading');
      const ipc = getElectron()?.ipcRenderer;
      if (ipc) {
          try {
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
          alert("Updates are handled by Electron Main Process (not available in browser mode)");
      }
  };

  const inputClass = "w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors placeholder:text-slate-400";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure application preferences and integrations</p>
      </div>
      
       {/* App Behavior Section */}
       <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
           <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
               <Layout className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Application Behavior
           </h2>
           
           <div className="space-y-4">
               {/* Close to Tray */}
               <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${closeToTray ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                          {closeToTray ? <Monitor className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="tray-toggle">Close to Tray</label>
                           <p className="text-xs text-slate-500 dark:text-slate-400">
                               {closeToTray 
                                ? "Window minimizes to tray icon when closed." 
                                : "Window quits application when closed."}
                           </p>
                       </div>
                   </div>
                   <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                        <input 
                            type="checkbox" 
                            id="tray-toggle" 
                            className="peer sr-only"
                            checked={closeToTray}
                            onChange={(e) => setCloseToTray(e.target.checked)}
                        />
                        <label htmlFor="tray-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                        <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 pointer-events-none"></span>
                    </div>
               </div>

               {/* Start with Windows */}
               <div className="p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${startWithWindows ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                              {startWithWindows ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                           </div>
                           <div>
                               <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="autostart-toggle">Start with Windows</label>
                               <p className="text-xs text-slate-500 dark:text-slate-400">
                                   {startWithWindows 
                                    ? "WinBorg Manager will start automatically." 
                                    : "WinBorg Manager will not start automatically."}
                               </p>
                           </div>
                       </div>
                       <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                            <input 
                                type="checkbox" 
                                id="autostart-toggle" 
                                className="peer sr-only"
                                checked={startWithWindows}
                                onChange={(e) => {
                                    setStartWithWindows(e.target.checked);
                                    // Also disable start minimized if autostart is turned off
                                    if (!e.target.checked) {
                                        setStartMinimized(false);
                                    }
                                    const ipc = getElectron()?.ipcRenderer;
                                    if (ipc) {
                                        ipc.send('settings:toggleAutoStart', e.target.checked);
                                    }
                                }}
                            />
                            <label htmlFor="autostart-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                            <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 pointer-events-none"></span>
                        </div>
                   </div>
                   {/* Start Minimized Sub-option */}
                   <div className={`mt-3 ml-8 pl-5 border-l-2 border-slate-200 dark:border-slate-700 transition-opacity ${startWithWindows ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                id="start-minimized-check" 
                                className="h-4 w-4 rounded border-gray-300 dark:bg-slate-800 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                checked={startMinimized}
                                onChange={(e) => setStartMinimized(e.target.checked)}
                                disabled={!startWithWindows}
                            />
                            <div>
                                <label htmlFor="start-minimized-check" className="text-sm font-medium text-slate-800 dark:text-slate-200">Start minimized to tray</label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    If enabled, the app will not show its window on startup.
                                </p>
                            </div>
                        </div>
                   </div>
               </div>

               {/* Updates */}
               <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600">
                           <Download className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Updates</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Check GitHub repository for new releases</p>
                        </div>
                   </div>
                   <Button variant="secondary" onClick={handleCheckUpdate} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                       Check Now
                   </Button>
               </div>
           </div>
       </div>

       {/* Smart Auto-Pilot Section */}
       <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
               <Zap className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Smart Auto-Pilot
           </h2>
           
           <div className="space-y-4">
                {/* Battery Check */}
                <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${stopOnBattery ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                          {stopOnBattery ? <Battery className="w-5 h-5" /> : <Battery className="w-5 h-5 opacity-50" />}
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="battery-toggle">Power Saving Mode</label>
                           <p className="text-xs text-slate-500 dark:text-slate-400">
                               {stopOnBattery 
                                ? "Jobs will be skipped if the device is running on battery." 
                                : "Jobs will run even on battery power."}
                           </p>
                       </div>
                   </div>
                   <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                        <input 
                            type="checkbox" 
                            id="battery-toggle" 
                            className="peer sr-only"
                            checked={stopOnBattery}
                            onChange={(e) => setStopOnBattery(e.target.checked)}
                        />
                        <label htmlFor="battery-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-orange-600 transition-colors"></label>
                        <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 pointer-events-none"></span>
                    </div>
               </div>

                {/* Offline Check */}
                <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                   <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-full ${stopOnLowSignal ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                          {stopOnLowSignal ? <WifiOff className="w-5 h-5" /> : <Network className="w-5 h-5" />}
                       </div>
                       <div>
                           <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer" htmlFor="offline-toggle">Offline Protection</label>
                           <p className="text-xs text-slate-500 dark:text-slate-400">
                               {stopOnLowSignal 
                                ? "Strictly skip jobs if no internet connection is detected." 
                                : "Attempt to run jobs regardless of connectivity status."}
                           </p>
                       </div>
                   </div>
                   <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                        <input 
                            type="checkbox" 
                            id="offline-toggle" 
                            className="peer sr-only"
                            checked={stopOnLowSignal}
                            onChange={(e) => setStopOnLowSignal(e.target.checked)}
                        />
                        <label htmlFor="offline-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-red-600 transition-colors"></label>
                        <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 pointer-events-none"></span>
                    </div>
               </div>
           </div>
       </div>

       {/* Notifications Section */}
       <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
           <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
               <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" /> Notifications
           </h2>

           {/* Notification Rules */}
           <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Notification Events</label>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2">
                        <ToggleSwitch 
                            id="notify-on-success"
                            checked={notifyConfig.notifyOnSuccess}
                            onChange={(checked) => setNotifyConfig({...notifyConfig, notifyOnSuccess: checked})}
                            color="green"
                        />
                        <label htmlFor="notify-on-success" className="text-sm text-slate-700 dark:text-slate-200 font-medium cursor-pointer">Notify on Success</label>
                    </div>
                    <div className="flex items-center gap-2">
                        <ToggleSwitch 
                            id="notify-on-failure"
                            checked={notifyConfig.notifyOnError}
                            onChange={(checked) => setNotifyConfig({...notifyConfig, notifyOnError: checked})}
                            color="red"
                        />
                        <label htmlFor="notify-on-failure" className="text-sm text-slate-700 dark:text-slate-200 font-medium cursor-pointer">Notify on Failure</label>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">These rules apply to both Discord and Email notifications.</p>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Discord Column */}
                <div className={`p-4 rounded-xl border ${notifyConfig.discordEnabled ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-slate-700'}`}>
                     <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                             <Hash className="w-4 h-4" /> Discord
                         </div>
                         <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out">
                            <input 
                                type="checkbox" 
                                id="discord-toggle"
                                className="peer sr-only"
                                checked={notifyConfig.discordEnabled}
                                onChange={(e) => setNotifyConfig({...notifyConfig, discordEnabled: e.target.checked})}
                            />
                            <label htmlFor="discord-toggle" className="block w-10 h-5 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-indigo-600 transition-colors"></label>
                            <span className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 pointer-events-none"></span>
                        </div>
                     </div>
                     
                     <div className={notifyConfig.discordEnabled ? '' : 'opacity-50 pointer-events-none'}>
                         <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Webhook URL</label>
                         <input 
                            type="text" 
                            placeholder="https://discord.com/api/webhooks/..."
                            className={inputClass}
                            value={notifyConfig.discordWebhook}
                            onChange={(e) => setNotifyConfig({...notifyConfig, discordWebhook: e.target.value})}
                         />
                         <div className="mt-3 flex justify-end">
                             <Button size="sm" variant="secondary" onClick={() => handleTestNotification('discord')} disabled={notifyTestStatus === 'loading'}>Test</Button>
                         </div>
                     </div>
                </div>

                {/* Email Column */}
                <div className={`p-4 rounded-xl border ${notifyConfig.emailEnabled ? 'border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-slate-700'}`}>
                     <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold">
                             <Mail className="w-4 h-4" /> SMTP Email
                         </div>
                         <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out">
                            <input 
                                type="checkbox" 
                                id="email-toggle"
                                className="peer sr-only"
                                checked={notifyConfig.emailEnabled}
                                onChange={(e) => setNotifyConfig({...notifyConfig, emailEnabled: e.target.checked})}
                            />
                            <label htmlFor="email-toggle" className="block w-10 h-5 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-orange-600 transition-colors"></label>
                            <span className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 pointer-events-none"></span>
                        </div>
                     </div>
                     
                     <div className={`space-y-3 ${notifyConfig.emailEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                         <div className="grid grid-cols-3 gap-3">
                             <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Host</label>
                                <input 
                                    type="text" 
                                    placeholder="smtp.gmail.com"
                                    className={inputClass}
                                    value={notifyConfig.smtpHost}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpHost: e.target.value})}
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Port</label>
                                <input 
                                    type="number" 
                                    className={inputClass}
                                    value={notifyConfig.smtpPort}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpPort: parseInt(e.target.value)})}
                                />
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">User</label>
                                <input 
                                    type="text" 
                                    className={inputClass}
                                    value={notifyConfig.smtpUser}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpUser: e.target.value})}
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Password</label>
                                <input 
                                    type="password" 
                                    placeholder={notifyConfig.hasSmtpPass ? "Saved (Unchanged)" : "Required"}
                                    className={inputClass}
                                    value={notifyConfig.smtpPass}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpPass: e.target.value})}
                                />
                             </div>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From Email</label>
                                <input 
                                    type="text" 
                                    className={inputClass}
                                    value={notifyConfig.smtpFrom}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpFrom: e.target.value})}
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To Email</label>
                                <input 
                                    type="text" 
                                    className={inputClass}
                                    value={notifyConfig.smtpTo}
                                    onChange={(e) => setNotifyConfig({...notifyConfig, smtpTo: e.target.value})}
                                />
                             </div>
                         </div>

                         <div className="flex justify-end pt-1">
                             <Button size="sm" variant="secondary" onClick={() => handleTestNotification('email')} disabled={notifyTestStatus === 'loading'}>
                                 {notifyTestStatus === 'loading' ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Test Email'}
                             </Button>
                         </div>
                     </div>
                </div>

           </div>
       </div>

       {/* System Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-slate-600 dark:text-slate-400" /> System Integration
        </h2>
        
        {/* Toggle WSL */}
        <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Use Windows Subsystem for Linux (WSL)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Runs Borg inside your default Linux distribution (e.g. Ubuntu). This is the recommended way to use Borg on Windows.
                </p>
            </div>
            <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                <input 
                    type="checkbox" 
                    id="wsl-toggle" 
                    className="peer sr-only"
                    checked={useWsl}
                    onChange={(e) => setUseWsl(e.target.checked)}
                />
                <label htmlFor="wsl-toggle" className="block w-12 h-6 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer peer-checked:bg-blue-600 transition-colors"></label>
                <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 pointer-events-none"></span>
            </div>
        </div>

        {/* Dynamic Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-5 mb-6 text-sm text-slate-700 dark:text-slate-300 space-y-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> 
                {useWsl ? 'Environment: WSL (Ubuntu/Linux)' : 'Environment: Windows Native (Powershell)'}
            </h3>
            
            {useWsl ? (
                <div className="space-y-3">
                    <p className="text-xs">WinBorg will execute commands via <code>wsl --exec borg ...</code>.</p>
                    <p className="text-xs">Ensure Borg and FUSE bindings are installed in your default distro:</p>
                    <div className="bg-slate-900 rounded p-3 font-mono text-xs">
                        <code className="block text-green-400 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y && sudo chmod 666 /dev/fuse')}>
                            sudo apt update && sudo apt install borgbackup fuse3 libfuse2 python3-llfuse python3-pyfuse3 -y
                        </code>
                        <div className="text-slate-500 text-[10px] mt-1 text-right">(Click to copy)</div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                     <p className="text-xs font-semibold text-red-500">Warning: Borg binaries for Windows are experimental.</p>
                     <p className="text-xs">The easiest way is using <a href="https://scoop.sh" target="_blank" className="underline text-blue-600">Scoop</a>.</p>
                     <div className="bg-slate-900 rounded p-3 font-mono text-xs text-yellow-400">
                        <code className="block select-all cursor-pointer" onClick={() => navigator.clipboard.writeText('scoop bucket add extras && scoop install borgbackup')}>
                            scoop bucket add extras<br/>scoop install borgbackup
                        </code>
                    </div>
                </div>
            )}
        </div>

        <div className="space-y-6">
            {!useWsl && (
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Borg Command / Path</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                        value={borgPath}
                        onChange={(e) => setBorgPath(e.target.value)}
                        placeholder="borg"
                    />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">If 'borg' is in your PATH, leave as is. Otherwise paste full path to borg.exe.</p>
            </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default Passphrase (Fallback)</label>
                <div className="flex gap-2 relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="password" 
                        className="flex-1 pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={borgPassphrase}
                        onChange={(e) => setBorgPassphrase(e.target.value)}
                        placeholder="••••••••••••"
                    />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    Used automatically if a repository does <b>not</b> have a specific passphrase saved.
                </p>
            </div>

            {/* SSH Options */}
             <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                 <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                     <Network className="w-4 h-4" /> SSH & Connection
                 </h3>
                 <div className="flex items-center gap-3">
                     <input 
                        type="checkbox" 
                        id="host-check" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={disableHostCheck}
                        onChange={(e) => setDisableHostCheck(e.target.checked)}
                     />
                     <div>
                         <label htmlFor="host-check" className="text-sm font-medium text-slate-800 dark:text-slate-200">Disable Strict Host Key Checking</label>
                         <p className="text-xs text-slate-500 dark:text-slate-400">
                             Essential for automation. Automatically accepts new SSH host keys.
                         </p>
                     </div>
                 </div>

                 {/* Bandwidth Limit */}
                 <div className="flex items-center justify-between mt-3">
                     <div className='flex items-center gap-3'>
                        <input 
                            type="checkbox" 
                            id="bw-limit-check" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={limitBandwidth}
                            onChange={(e) => setLimitBandwidth(e.target.checked)}
                        />
                        <div>
                            <label htmlFor="bw-limit-check" className="text-sm font-medium text-slate-800 dark:text-slate-200">Limit Remote Bandwidth</label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Set a maximum speed for all remote repository operations.
                            </p>
                        </div>
                     </div>
                     <div className={`flex items-center gap-2 ${!limitBandwidth ? 'opacity-50' : ''}`}>
                         <input
                             type="number"
                             id="bw-limit-value"
                             className="w-28 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-colors"
                             value={bandwidthLimit}
                             onChange={(e) => setBandwidthLimit(parseInt(e.target.value) || 0)}
                             disabled={!limitBandwidth}
                         />
                         <span className='text-xs text-slate-500 dark:text-slate-400'>KB/s</span>
                     </div>
                 </div>
             </div>
            
            <div className="pt-4">
                 <Button 
                    variant="secondary" 
                    onClick={handleTest}
                    disabled={testStatus === 'loading'}
                    className={`w-full ${testStatus === 'success' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20' : testStatus === 'error' ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20' : 'dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}
                >
                    {testStatus === 'loading' ? 'Testing Connection...' : testStatus === 'success' ? 'Borg Found & Working!' : testStatus === 'error' ? 'Borg Not Found / Error' : 'Test Borg Installation'}
                </Button>
                {testStatus === 'error' && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded border border-red-100 dark:border-red-900 font-mono whitespace-pre-wrap">
                        {testOutput || "Could not execute command. Check if installed."}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-700">
        <Button size="lg" onClick={handleSave} className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
            {saved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />} 
            {saved ? "Saved" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsView;
