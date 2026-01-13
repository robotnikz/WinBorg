import React, { useEffect, useState } from 'react';
import { HardDrive, Server, Settings, LayoutDashboard, Database, Activity, Github, Code2, Heart, ArrowUpCircle } from 'lucide-react';
import { View } from '../types';
import AppLogo from './AppLogo';
import { getAppVersion } from '../utils/appVersion';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  updateAvailable?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, updateAvailable }) => {
  const [appVersion, setAppVersion] = useState<string | null>((process.env as any)?.APP_VERSION ?? null);

  useEffect(() => {
    let isMounted = true;
    getAppVersion().then((v) => {
      if (isMounted) setAppVersion(v);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const navItems = [
    { view: View.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { view: View.REPOSITORIES, label: 'Repositories', icon: Server },
    { view: View.ARCHIVES, label: 'Archives', icon: Database },
    { view: View.MOUNTS, label: 'Mounts', icon: HardDrive },
    { view: View.ACTIVITY, label: 'Activity', icon: Activity },
  ];

  // Developer Config
  const devProfile = {
      name: "robotnikz",
      role: "Developer",
      repo: "robotnikz/WinBorg",
      version: "v" + (appVersion || '0.0.0')
  };

  const handleOpenRepo = (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          const { shell } = (window as any).require('electron');
          shell.openExternal(`https://github.com/${devProfile.repo}`);
      } catch(err) {
          window.open(`https://github.com/${devProfile.repo}`, '_blank');
      }
  };

  return (
    <div className="w-64 flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/50 border-r border-gray-200/50 dark:border-slate-800 backdrop-blur-xl pt-6 select-none transition-colors duration-300">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 px-6 mb-8">
        <div className="shadow-lg shadow-blue-500/20 rounded-xl overflow-hidden shrink-0">
            <AppLogo className="w-10 h-10" />
        </div>
        <div className="min-w-0">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-100 tracking-tight block leading-none">WinBorg</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Manager</span>
        </div>
      </div>

      {/* NAV ITEMS */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onChangeView(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              currentView === item.view
                ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400 ring-1 ring-black/5 dark:ring-white/5'
                : 'text-slate-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <item.icon className={`w-4 h-4 ${currentView === item.view ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500'}`} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* BOTTOM SECTION */}
      <div className="p-3">
        {/* Settings Button */}
        <button
          onClick={() => onChangeView(View.SETTINGS)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 mb-3 ${
            currentView === View.SETTINGS
              ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        {/* Developer / About Footer */}
        <div className="border-t border-gray-200 dark:border-slate-800 pt-4 mt-2 px-2 pb-4">
            <div 
                onClick={handleOpenRepo}
                className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all cursor-pointer"
                title="View on GitHub"
            >
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-inner group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                    <Code2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Developed by</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{devProfile.name}</div>
                    <div className="flex items-center justify-between mt-1">
                         <div className="flex items-center gap-1.5">
                            <Github className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400 group-hover:text-blue-500 transition-colors">Source</span>
                         </div>
                         <div className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-[10px] font-bold text-blue-600 dark:text-blue-400 shadow-sm flex items-center gap-1">
                            {devProfile.version}
                            {updateAvailable && <ArrowUpCircle className="w-3 h-3 text-white bg-green-500 rounded-full" />}
                         </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
