import React, { useMemo } from 'react';

interface ActivityHeatmapProps {
  archiveDates: string[]; // ISO Strings
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ archiveDates }) => {
  
  // Process dates into a Set of "YYYY-MM-DD" for O(1) lookup
  const activeDays = useMemo(() => {
    const set = new Set<string>();
    archiveDates.forEach(dateStr => {
      try {
        const d = new Date(dateStr);
        set.add(d.toISOString().split('T')[0]);
      } catch (e) {}
    });
    return set;
  }, [archiveDates]);

  // Generate last 365 days
  const calendarGrid = useMemo(() => {
    const today = new Date();
    const days = [];
    // Start 52 weeks ago (approx 1 year)
    // Align to Sunday before 365 days ago to keep grid consistent
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);
    
    // Adjust start date to Sunday
    const dayOfWeek = startDate.getDay(); // 0 = Sunday
    startDate.setDate(startDate.getDate() - dayOfWeek);

    // Loop until we reach today (or end of this week)
    const current = new Date(startDate);
    while (current <= endDate || current.getDay() !== 0) {
       days.push(new Date(current));
       current.setDate(current.getDate() + 1);
       if (days.length > 371) break; // Safety break (53 * 7)
    }
    return days;
  }, []);

  // Group by weeks for column layout
  const weeks = useMemo(() => {
    const w: Date[][] = [];
    let currentWeek: Date[] = [];
    
    calendarGrid.forEach(day => {
       if (currentWeek.length === 7) {
         w.push(currentWeek);
         currentWeek = [];
       }
       currentWeek.push(day);
    });
    if (currentWeek.length > 0) w.push(currentWeek);
    return w;
  }, [calendarGrid]);

  const months = useMemo(() => {
     // Helper to place month labels
     // Returns list of { label: 'Jan', index: 3 } (column index)
     const m: { label: string, index: number }[] = [];
     let lastMonth = -1;
     weeks.forEach((week, i) => {
        const firstDay = week[0];
        if (firstDay && firstDay.getMonth() !== lastMonth) {
            m.push({ label: firstDay.toLocaleString('default', { month: 'short' }), index: i });
            lastMonth = firstDay.getMonth();
        }
     });
     return m;
  }, [weeks]);

  return (
    <div className="w-full overflow-x-auto">
       <div className="min-w-[700px] w-max mx-auto flex flex-col gap-1">
          {/* Months Header */}
          <div className="flex text-xs text-gray-400 h-4 relative mb-1">
             {months.map((m, i) => (
                <span key={i} style={{ left: `${m.index * 14}px` }} className="absolute">
                   {m.label}
                </span>
             ))}
          </div>

          <div className="flex gap-[3px]">
             {/* Week Days Labels */}
             <div className="flex flex-col gap-[3px] text-[9px] text-gray-500 justify-between py-[2px] pr-2">
                 <span className="h-[10px] leading-[10px]">Mon</span>
                 <span className="h-[10px] leading-[10px]">&nbsp;</span>
                 <span className="h-[10px] leading-[10px]">Wed</span>
                 <span className="h-[10px] leading-[10px]">&nbsp;</span>
                 <span className="h-[10px] leading-[10px]">Fri</span>
                 <span className="h-[10px] leading-[10px]">&nbsp;</span>
                 <span className="h-[10px] leading-[10px]">&nbsp;</span>
             </div>

             {/* The Grid */}
             {weeks.map((week, wIndex) => (
                <div key={wIndex} className="flex flex-col gap-[3px]">
                   {week.map((day, dIndex) => {
                      const dateStr = day.toISOString().split('T')[0];
                      const isActive = activeDays.has(dateStr);
                      const isFuture = day > new Date();

                      return (
                         <div 
                           key={dIndex}
                           title={`${dateStr}${isActive ? ': Backup available' : ''}`}
                           className={`
                              w-[10px] h-[10px] rounded-sm transition-colors border border-black/10 dark:border-white/5
                              ${isFuture ? 'invisible' : ''}
                              ${isActive 
                                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.4)]' 
                                  : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
                              }
                           `}
                         />
                      );
                   })}
                </div>
             ))}
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 justify-end">
             <span>Less</span>
             <div className="w-[10px] h-[10px] rounded-sm bg-gray-800 border border-white/5"></div>
             <div className="w-[10px] h-[10px] rounded-sm bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]"></div>
             <span>More</span>
          </div>
       </div>
    </div>
  );
};

export default ActivityHeatmap;
