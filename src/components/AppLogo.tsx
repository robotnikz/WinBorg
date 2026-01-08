import React from 'react';

const AppLogo: React.FC<React.SVGProps<SVGSVGElement>> = ({ className, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="server_body" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="20%" stopColor="#334155" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="80%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        
        <linearGradient id="server_top" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        <linearGradient id="shield_grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        
        <filter id="blue_glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* SERVER TOWER - Centered at 256, 240 */}
      <g transform="translate(256, 240)">
          {/* Main Cylinder Body */}
          <path d="M-90 -100 L-90 120 C-90 150, 90 150, 90 120 L90 -100" fill="url(#server_body)" stroke="#475569" strokeWidth="2"/>
          
          {/* Cylinder Top Cap */}
          <ellipse cx="0" cy="-100" rx="90" ry="35" fill="url(#server_top)" stroke="#64748b" strokeWidth="2"/>
          
          {/* Server Rack Lights / Slots */}
          {/* Slot 1 */}
          <path d="M-60 -40 Q0 -10, 60 -40" stroke="#0f172a" strokeWidth="8" fill="none" strokeLinecap="round"/>
          <circle cx="-50" cy="-40" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
          <circle cx="50" cy="-40" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
          
          {/* Slot 2 */}
          <path d="M-60 10 Q0 40, 60 10" stroke="#0f172a" strokeWidth="8" fill="none" strokeLinecap="round"/>
          <circle cx="-50" cy="10" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
          <circle cx="50" cy="10" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
          
           {/* Slot 3 */}
          <path d="M-60 60 Q0 90, 60 60" stroke="#0f172a" strokeWidth="8" fill="none" strokeLinecap="round"/>
          <circle cx="-50" cy="60" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
          <circle cx="50" cy="60" r="3" fill="#3b82f6" filter="url(#blue_glow)" />
      </g>
      
      {/* SHIELD OVERLAY (Bottom Right) */}
      <g transform="translate(320, 320) scale(1.1)">
          {/* Shield Body */}
          <path d="M0 0 C30 0, 55 25, 55 60 C55 100, 0 130, 0 130 C0 130, -55 100, -55 60 C-55 25, -30 0, 0 0 Z" 
                fill="url(#shield_grad)" stroke="#60a5fa" strokeWidth="3" />
          
          {/* Checkmark */}
          <path d="M-20 50 L-5 65 L25 35" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#blue_glow)" />
      </g>
    </svg>
  );
};

export default AppLogo;