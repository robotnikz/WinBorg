import React from 'react';
import { Activity, Clock, Terminal, Trash2 } from 'lucide-react';
import { ActivityLogEntry } from '../types';
import Button from '../components/Button';
import { formatDate } from '../utils/formatters';

interface ActivityViewProps {
    logs: ActivityLogEntry[];
    onClearLogs: () => void;
}

const ActivityView: React.FC<ActivityViewProps> = ({ logs, onClearLogs }) => {
    // Helper to format "time ago" roughly or just use absolute date
    const formatTime = (iso: string) => {
        try {
            const date = new Date(iso);
            return date.toLocaleString();
        } catch(e) { return iso; }
    };

    // Group logs by date for better scannability
    const getDateLabel = (iso: string): string => {
        try {
            const date = new Date(iso);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const logDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const diffDays = Math.round((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return 'Unknown';
        }
    };

    // Build grouped structure
    const groupedLogs: { label: string; items: ActivityLogEntry[] }[] = [];
    let currentLabel = '';
    for (const log of logs) {
        const label = getDateLabel(log.time);
        if (label !== currentLabel) {
            currentLabel = label;
            groupedLogs.push({ label, items: [log] });
        } else {
            groupedLogs[groupedLogs.length - 1].items.push(log);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto pb-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Activity className="w-6 h-6 text-blue-400" />Activity Log</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        History of operations and background tasks
                        {logs.length > 0 && <span className="ml-2 text-slate-400 dark:text-slate-500">({logs.length} entries)</span>}
                    </p>
                </div>
                {logs.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={onClearLogs} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear History
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                {logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No activity recorded yet.</p>
                    </div>
                ) : (
                    groupedLogs.map((group) => (
                        <div key={group.label}>
                            {/* Date Group Header */}
                            <div className="sticky top-0 z-10 px-6 py-2 bg-gray-50 dark:bg-slate-900/80 backdrop-blur-sm border-b border-gray-100 dark:border-slate-700">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.label}</span>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-slate-700">
                                {group.items.map((log) => (
                            <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex gap-4 items-start group">
                                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${
                                    log.status === 'success' ? 'bg-green-500 shadow-green-500/50' : 
                                    log.status === 'warning' ? 'bg-yellow-500 shadow-yellow-500/50' : 
                                    log.status === 'error' ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500 shadow-blue-500/50'
                                }`}></div>
                                
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{log.title}</h3>
                                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono flex items-center gap-1 flex-shrink-0 ml-2">
                                            <Clock className="w-3 h-3" /> {formatTime(log.time)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 truncate">{log.detail}</p>
                                    
                                    {log.cmd && (
                                        <div className="mt-3 bg-slate-900 rounded p-2 hidden group-hover:block animate-in fade-in slide-in-from-top-1 duration-200 border border-slate-700">
                                            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 border-b border-slate-700 pb-1">
                                                <Terminal className="w-3 h-3" />
                                                <span>Command Executed</span>
                                            </div>
                                            <code className="text-xs font-mono text-green-400 break-all whitespace-pre-wrap">{log.cmd}</code>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ActivityView;