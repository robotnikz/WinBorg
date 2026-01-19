
import React, { useEffect, useRef } from 'react';
import { CheckCircle2, FolderOpen, X } from 'lucide-react';
import Button from './Button';
import { borgService } from '../services/borgService';

interface ExtractionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: string;
}

const ExtractionSuccessModal: React.FC<ExtractionSuccessModalProps> = ({ isOpen, onClose, path }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenFolder = () => {
    borgService.openPath(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
    >
       <div
         className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 p-6 relative"
         role="dialog"
         aria-modal="true"
         aria-label="Download Successful"
       >
           
           <button ref={closeButtonRef} onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" aria-label="Close dialog" title="Close dialog">
             <X size={20} />
           </button>

           <div className="flex flex-col items-center text-center">
               <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-5 shadow-sm ring-4 ring-green-50 dark:ring-green-900/20">
                   <CheckCircle2 className="w-8 h-8" />
               </div>
               
               <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Download Successful</h3>
               <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                   Your selected files have been successfully extracted from the archive.
               </p>

               <div className="w-full bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-3 mb-6 text-left shadow-inner">
                   <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Download Location</p>
                   <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all select-all hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-text">
                       {path}
                   </p>
               </div>

               <div className="flex gap-3 w-full">
                   <Button variant="secondary" onClick={onClose} className="flex-1 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                       Close
                   </Button>
                   <Button onClick={handleOpenFolder} className="flex-1 shadow-lg shadow-blue-500/20">
                       <FolderOpen className="w-4 h-4 mr-2" />
                       Open Folder
                   </Button>
               </div>
           </div>
       </div>
    </div>
  );
};

export default ExtractionSuccessModal;
