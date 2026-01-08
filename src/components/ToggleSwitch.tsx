import React from 'react';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: 'blue' | 'indigo' | 'orange' | 'green' | 'red';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, color = 'blue' }) => {
    const colorClasses = {
        blue: 'peer-checked:bg-blue-600',
        indigo: 'peer-checked:bg-indigo-600',
        orange: 'peer-checked:bg-orange-600',
        green: 'peer-checked:bg-green-600',
        red: 'peer-checked:bg-red-600',
    };

    const colorClass = colorClasses[color] || colorClasses.blue;

  return (
    <div className="flex items-center gap-2">
        <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out">
            <input 
                type="checkbox" 
                id={id}
                className="peer sr-only"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <label htmlFor={id} className={`block w-10 h-5 bg-gray-200 dark:bg-slate-600 rounded-full cursor-pointer ${colorClass} transition-colors`}></label>
            <span className="absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-5 pointer-events-none"></span>
        </div>
    </div>
  );
};

export default ToggleSwitch;
