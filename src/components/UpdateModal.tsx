import React, { useMemo, useState } from 'react';
import { Download, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Button from './Button';

interface UpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Trigger download or install
    version: string;
    downloading: boolean;
    progress?: number;
    readyToInstall?: boolean;
    releaseNotes?: unknown;
}

function normalizeReleaseNotes(releaseNotes: unknown): string {
    if (!releaseNotes) return '';

    // electron-updater can provide either a string or an array of { version, note }
    // where note can be a string or (rarely) an object.
    if (typeof releaseNotes === 'string') return releaseNotes;
    if (Array.isArray(releaseNotes)) {
        const parts = releaseNotes
            .map((x) => {
                if (typeof x === 'string') return x;
                if (x && typeof x === 'object') {
                    const anyX = x as any;
                    if (typeof anyX.note === 'string') return anyX.note;
                    if (typeof anyX.notes === 'string') return anyX.notes;
                }
                return '';
            })
            .filter(Boolean);
        return parts.join('\n\n');
    }

    try {
        return JSON.stringify(releaseNotes, null, 2);
    } catch {
        return String(releaseNotes);
    }
}

function toPlainText(input: string): string {
    // Some release notes come as HTML. We render as plain text to avoid HTML injection.
    // Use DOMParser/textContent instead of regex-based sanitization (avoids CodeQL issues).
    if (!input) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(input, 'text/html');
        const text = (doc.body && doc.body.textContent) ? doc.body.textContent : '';
        return String(text).replace(/\r\n/g, '\n').trim();
    } catch {
        return String(input).replace(/\r\n/g, '\n').trim();
    }
}

const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose, onUpdate, version, downloading, progress, readyToInstall, releaseNotes }) => {
    if (!isOpen) return null;

    const [showChangelog, setShowChangelog] = useState(false);
    const changelogText = useMemo(() => {
        const raw = normalizeReleaseNotes(releaseNotes);
        const cleaned = toPlainText(raw);
        return cleaned;
    }, [releaseNotes]);

    const hasChangelog = !downloading && !!changelogText;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-500" />
                        {readyToInstall ? 'Update Ready' : 'Update Available'}
                    </h3>
                    {!downloading && (
                         <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                             <X size={18} />
                         </button>
                    )}
                </div>
                
                <div className="p-6">
                    {!downloading ? (
                        <>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                                        {readyToInstall ? `Version ${version} Downloaded` : `Version ${version} is ready!`}
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {readyToInstall 
                                            ? "The update has been downloaded. Restart now to install the new version."
                                            : "A new version of WinBorg Manager is available. Would you like to update now? The app will restart automatically."
                                        }
                                    </p>
                                </div>
                            </div>

                            {hasChangelog && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-900/60 transition-colors"
                                        onClick={() => setShowChangelog(v => !v)}
                                        aria-expanded={showChangelog}
                                        aria-controls="update-changelog"
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Changelog</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">What\'s new in {version}</div>
                                        </div>
                                        <span className="text-slate-500 dark:text-slate-300">
                                            {showChangelog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </span>
                                    </button>

                                    {showChangelog && (
                                        <div
                                            id="update-changelog"
                                            className="mt-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 p-3 max-h-56 overflow-auto"
                                        >
                                            <pre className="whitespace-pre-wrap text-sm leading-5 text-slate-700 dark:text-slate-200 font-sans">
                                                {changelogText}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex gap-3 justify-end mt-6">
                                <Button variant="secondary" onClick={onClose}>
                                    Later
                                </Button>
                                <Button onClick={onUpdate}>
                                    {readyToInstall ? 'Restart & Install' : 'Update Now'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="mb-4">
                                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <h4 className="font-semibold text-slate-900 dark:text-white">Downloading Update...</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Please wait while we set things up.</p>
                            </div>
                            
                            {progress !== undefined && (
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 mb-2 overflow-hidden">
                                    <div 
                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            )}
                            {progress !== undefined && (
                                <span className="text-xs font-mono text-slate-400">{Math.round(progress)}%</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdateModal;
