import React from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
  // Use window.require to access Electron API safely in the renderer
  const handleMinimize = () => {
    try {
      (window as any).require('electron').ipcRenderer.send('window-minimize');
    } catch (e) {
      console.error("Electron not found");
    }
  };

  const handleMaximize = () => {
    try {
      (window as any).require('electron').ipcRenderer.send('window-maximize');
    } catch (e) {
      console.error("Electron not found");
    }
  };

  const handleClose = () => {
    try {
      (window as any).require('electron').ipcRenderer.send('window-close');
    } catch (e) {
      console.error("Electron not found");
    }
  };

  return (
    <div className="h-9 bg-[#f3f3f3] dark:bg-[#0f172a] flex justify-between items-center select-none fixed top-0 left-0 right-0 z-[9999] border-b border-black/5 dark:border-white/5 transition-colors duration-300">
      {/* Drag Region */}
      <div 
        className="flex-1 h-full flex items-center pl-4 app-drag-region"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">WinBorg Manager</span>
      </div>

      {/* Window Controls - No Drag */}
      <div 
        className="flex h-full items-center" 
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button 
            onClick={handleMinimize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-colors"
            title="Minimize"
        >
            <Minus size={16} />
        </button>
        <button 
            onClick={handleMaximize}
            className="h-full w-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition-colors"
            title="Maximize"
        >
            <Square size={14} />
        </button>
        <button 
            onClick={handleClose}
            className="h-full w-12 flex items-center justify-center hover:bg-[#e81123] hover:text-white text-slate-600 dark:text-slate-400 transition-colors"
            title="Close"
        >
            <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;