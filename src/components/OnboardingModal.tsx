import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Download, Terminal, XCircle, Loader2 } from 'lucide-react';
import Button from './Button';

interface OnboardingModalProps {
  onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'checking' | 'wsl-missing' | 'borg-missing' | 'installing' | 'success'>('checking');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    checkPrerequisites();
  }, []);

  const checkPrerequisites = async () => {
    try {
        const { ipcRenderer } = (window as any).require('electron');
        
        // 1. Check WSL
        const wslRes = await ipcRenderer.invoke('system-check-wsl');
        if (!wslRes.installed) {
            setStep('wsl-missing');
            setErrorDetails(wslRes.error || 'WSL command failed');
            return;
        }

        // 2. Check Borg
        const borgRes = await ipcRenderer.invoke('system-check-borg');
        if (!borgRes.installed) {
            setStep('borg-missing');
            return;
        }

        // All good
        setStep('success');
        setTimeout(onComplete, 1500);

    } catch (e: any) {
        setStep('wsl-missing'); // Fallback
        setErrorDetails(e.message);
    }
  };

  const handleInstallBorg = async () => {
      setStep('installing');
      try {
          const { ipcRenderer } = (window as any).require('electron');
          const res = await ipcRenderer.invoke('system-install-borg');
          if (res.success) {
              setStep('success');
              setTimeout(onComplete, 1500);
          } else {
              setStep('borg-missing');
              setErrorDetails('Installation failed. Try running "sudo apt install borgbackup" in your WSL terminal manually.');
          }
      } catch (e: any) {
          setErrorDetails(e.message);
          setStep('borg-missing');
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-gray-200 dark:border-[#333] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-50 dark:bg-[#252526] px-6 py-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-500" />
                System Setup
            </h3>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
            
            {step === 'checking' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    <p>Checking prerequisites...</p>
                </div>
            )}

            {step === 'wsl-missing' && (
                <div className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3 text-red-700 dark:text-red-400">
                        <XCircle className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold">WSL Not Found</p>
                            <p>WinBorg requires Windows Subsystem for Linux.</p>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Please open PowerShell as Administrator and run:
                    </p>
                    <code className="block w-full p-3 bg-gray-100 dark:bg-[#2d2d2d] rounded border border-gray-200 dark:border-[#444] text-sm font-mono select-all">
                        wsl --install
                    </code>
                    <p className="text-sm text-gray-500">After installation, please restart your computer.</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="primary" onClick={checkPrerequisites}>Retry Check</Button>
                    </div>
                </div>
            )}

            {step === 'borg-missing' && (
                <div className="space-y-4">
                     <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-3 text-amber-700 dark:text-amber-400">
                        <Terminal className="w-5 h-5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-bold">BorgBackup Not Found</p>
                            <p>Borg is not installed in your default WSL distro.</p>
                        </div>
                    </div>
                    {errorDetails && <p className="text-xs text-red-500">{errorDetails}</p>}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        WinBorg can attempt to install it automatically for you.
                    </p>

                    <div className="flex justify-end gap-2 mt-4">
                         <Button variant="secondary" onClick={checkPrerequisites}>Check Again</Button>
                        <Button variant="primary" onClick={handleInstallBorg}>
                            Install Borg (Auto)
                        </Button>
                    </div>
                </div>
            )}

            {step === 'installing' && (
                 <div className="flex flex-col items-center justify-center py-8 space-y-4 text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    <p>Installing BorgBackup...</p>
                    <span className="text-xs text-center max-w-xs">Running: apt-get upgrade & install borgbackup... (This may take a while)</span>
                </div>
            )}

            {step === 'success' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4 text-green-600 dark:text-green-500">
                    <CheckCircle2 className="w-12 h-12" />
                    <p className="font-semibold text-lg">System Ready!</p>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
