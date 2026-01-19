import React, { useEffect, useId, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Terminal, HardDrive, Wifi, Server } from 'lucide-react';
import { getAppVersion } from '../utils/appVersion';
import { getIpcRendererOrNull } from '../services/electron';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemStatus {
  wslInstalled: boolean;
  wslDefaultDistro: string;
  borgVersion: string;
  borgPath: string;
  networkStatus: 'connected' | 'offline';
  backendVersion: string;
}

const SystemStatusModal: React.FC<SystemStatusModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkSystemStatus();
      setTimeout(() => closeButtonRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const checkSystemStatus = async () => {
    setLoading(true);
    try {
      const ipcRenderer = getIpcRendererOrNull();
      if (!ipcRenderer) {
        setStatus({
          wslInstalled: false,
          wslDefaultDistro: 'Unavailable',
          borgVersion: 'Unavailable',
          borgPath: 'Unavailable',
          networkStatus: navigator.onLine ? 'connected' : 'offline',
          backendVersion: 'Web Dev'
        });
        return;
      }
      
      // Parallel system checks
      const [wslResult, borgResult, appVersion] = await Promise.all([
        ipcRenderer.invoke('system-check-wsl'),
        ipcRenderer.invoke('system-check-borg'),
        getAppVersion(),
      ]);

      setStatus({
        wslInstalled: wslResult.installed,
        wslDefaultDistro: wslResult.distro || 'Unknown',
        borgVersion: borgResult.installed ? (borgResult.version || 'Detected') : 'Not Found',
        borgPath: borgResult.path || 'Unknown',
        networkStatus: navigator.onLine ? 'connected' : 'offline',
        backendVersion: appVersion ? `v${appVersion}` : 'Unknown'
      });
    } catch (e) {
      console.error("Status Check Failed", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
          <h3 id={titleId} className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-500" />
            System Diagnostics
          </h3>
          <button 
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-slate-500">Running system checks...</span>
             </div>
          ) : status ? (
            <>
               <StatusItem 
                  icon={HardDrive}
                  label="WSL Environment"
                  value={status.wslInstalled ? `Active (${status.wslDefaultDistro})` : "Not Found"}
                  isGood={status.wslInstalled}
               />
               
               <StatusItem 
                  icon={Server}
                  label="Borg Binary"
                  value={status.borgVersion}
                  subValue={status.borgPath}
                  isGood={status.borgVersion !== 'Not Found'}
               />

               <StatusItem 
                  icon={Wifi}
                  label="Network Connectivity"
                  value={status.networkStatus === 'connected' ? "Online" : "Offline"}
                  isGood={status.networkStatus === 'connected'}
               />

               <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-400">WinBorg Client {status.backendVersion}</p>
               </div>
            </>
          ) : (
            <div className="text-center text-red-500 py-4">Failed to load system details.</div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

const StatusItem = ({ icon: Icon, label, value, subValue, isGood }: { icon: any, label: string, value: string, subValue?: string, isGood: boolean }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isGood ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
                {subValue && <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={subValue}>{subValue}</div>}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isGood ? 'text-slate-800 dark:text-white' : 'text-red-500'}`}>{value}</span>
            {isGood ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
        </div>
    </div>
);

export default SystemStatusModal;
