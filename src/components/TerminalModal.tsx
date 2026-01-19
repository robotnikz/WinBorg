import React, { useEffect, useRef } from 'react';
import { Terminal, X, Loader2 } from 'lucide-react';

interface TerminalModalProps {
  isOpen: boolean;
  title: string;
  logs: string[];
  onClose?: () => void;
  isProcessing: boolean;
}

const TerminalModal: React.FC<TerminalModalProps> = ({ isOpen, title, logs, onClose, isProcessing }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (isOpen && !isProcessing && onClose) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen, isProcessing, onClose]);

  useEffect(() => {
    if (!isOpen || isProcessing || !onClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!isProcessing && onClose) onClose();
      }}
    >
      <div
        className="bg-[#1e1e1e] w-full max-w-2xl rounded-lg shadow-2xl border border-gray-700 overflow-hidden flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-black/20">
          <div className="flex items-center gap-2 text-gray-300">
            <Terminal className="w-4 h-4" />
            <span className="text-sm font-mono font-medium">{title}</span>
          </div>
          {!isProcessing && onClose && (
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Terminal Output */}
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-1" aria-live="polite">
          {logs.map((log, index) => (
            <div key={index} className="text-gray-300 break-all border-l-2 border-transparent hover:border-gray-600 pl-2">
              <span className="text-gray-500 select-none mr-2">[{new Date().toLocaleTimeString()}]</span>
              {log}
            </div>
          ))}
          {isProcessing && (
             <div className="flex items-center gap-2 text-blue-400 mt-2 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
             </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;