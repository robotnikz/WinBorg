import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, Download, Terminal, XCircle, Loader2 } from 'lucide-react';
import Button from './Button';

interface OnboardingModalProps {
  onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'checking' | 'wsl-missing' | 'wsl-installing' | 'restart-required' | 'borg-missing' | 'installing' | 'success'>('checking');
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

  const handleInstallWSL = async () => {
        setStep('wsl-installing'); // Show instructions state
        try {
            const { ipcRenderer } = (window as any).require('electron');
            const res = await ipcRenderer.invoke('system-install-wsl');
            if (res.success) {
                setStep('restart-required');
            } else {
               setErrorDetails("Failed to launch WSL installer: " + res.error);
               setStep('wsl-missing');
            }
        } catch(e: any) {
            setErrorDetails(e.message);
            setStep('wsl-missing');
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
              const msg = res.error ? `Error: ${res.error}` : 'Installation failed.';
              setErrorDetails(`${msg} Try running "sudo apt install borgbackup" in your WSL terminal manually.`);
          }
      } catch (e: any) {
          setErrorDetails(e.message);
          setStep('borg-missing');
      }
  };

  const handleReboot = () => {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('system-reboot');
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
                        WinBorg can install WSL automatically. You will need to accept the <b>administrator prompt</b>.
                    </p>
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded border border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs">
                        ⚠️ A computer restart will be required after installation.
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" onClick={checkPrerequisites}>Retry Check</Button>
                        <Button variant="primary" onClick={handleInstallWSL}>Install WSL (Admin)</Button>
                    </div>
                </div>
            )}

            {step === 'wsl-installing' && (
                 <div className="space-y-4">
                     <div className="flex flex-col items-center justify-center py-4 space-y-4 text-blue-600 dark:text-blue-400">
                        <Terminal className="w-12 h-12 animate-pulse" />
                        <h4 className="font-bold text-lg">In Progress...</h4>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-sm space-y-2 border border-slate-200 dark:border-slate-700">
                        <p className="font-semibold mb-2">Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                            <li>Wait for the <b>PowerShell</b> window to open.</li>
                            <li>Accept the Windows Admin prompt (Yes).</li>
                            <li>Wait for Ubuntu to download and install.</li>
                            <li>Enter a <b>new username</b> and password when asked.</li>
                            <li>Once you see the green command prompt - <b>close the window</b> manually.</li>
                        </ol>
                    </div>

                    <p className="text-xs text-center text-slate-400">
                        Waiting for terminal to close...
                    </p>
                </div>
            )}

            {step === 'restart-required' && (
                 <div className="space-y-6 text-center py-4">
                     <div className="mx-auto w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="w-8 h-8" />
                     </div>
                     
                     <h3 className="text-xl font-bold text-slate-800 dark:text-white">Restart Required!</h3>
                     
                     <p className="text-slate-600 dark:text-slate-300">
                         WSL installation is complete, but Windows needs a full restart to enable the virtualization features.
                     </p>
                     
                     <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-amber-800 text-sm font-semibold">
                         Please restart your computer now, then open WinBorg again.
                     </div>
                     
                     <div className="flex justify-center mt-4">
                        <Button variant="danger" onClick={handleReboot}>Restart Computer Now</Button>
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
                    {errorDetails && (
                        <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900">
                            <pre className="text-[10px] text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono break-all leading-tight">{errorDetails}</pre>
                        </div>
                    )}
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
