import React, { useMemo, useState, useEffect } from 'react';
import { formatBytes } from '../utils/formatters';

interface ChartPoint {
  label: string;
  value: number; // in bytes
  tooltipRaw: any;
}

interface StorageChartProps {
  data: { date: string, size: number, originalSize: number }[];
  height?: number;
}

const StorageChart: React.FC<StorageChartProps> = ({ data, height = 300 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(height);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If we have a ref, we can try to fit to parent, but for now fixed height is safer for SVG logic
    // unless we reimplement resize observer. Let's stick to the prop but allow the chart to be flexible visually.
    if(containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || height);
    }
  }, []);

  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    const max = Math.max(...data.map(d => d.size)) * 1.1; // 10% headroom
    return data.map((d, i) => ({
      x: i / (data.length - 1 || 1), // 0 to 1
      y: d.size / max, // 0 to 1 relative to height
      val: d.size,
      original: d.originalSize,
      date: d.date,
      max
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-8 text-gray-400">
        No history data available for the last 30 days.
      </div>
    );
  }

  const padding = 40;
  const chartWidth = 800; // Internal coordinate system width
  const chartHeight = height; // Use the prop directly for the SVG viewBox
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - padding * 2;

  const points = processedData.map(d => {
    const px = padding + d.x * plotWidth;
    const py = chartHeight - padding - (d.y * plotHeight);
    return `${px},${py}`;
  }).join(' ');

  // Create area path (close the loop down to bottom)
  const firstX = padding;
  const lastX = padding + plotWidth;
  const bottomY = chartHeight - padding;
  
  const areaPath = `M ${points.split(' ')[0]} L ${points} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0 rounded-xl bg-gray-900/50 p-4 border border-white/5 backdrop-blur-sm flex flex-col">
      <div className="mb-2 flex items-center justify-between shrink-0">
         <h3 className="text-xs font-medium text-gray-300">Storage Growth (Last 30 Days)</h3>
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span className="text-[10px] text-gray-400">Dedup Size</span>
         </div>
      </div>

      <div className="relative flex-1 min-h-0 w-full">
        {/* We use preserveAspectRatio="none" to allow stretching to container */}
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = chartHeight - padding - (t * plotHeight);
            return (
              <g key={t}>
                <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke="#374151" strokeDasharray="4 4" />
                <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-500">
                  {formatBytes(processedData[0]?.max * t || 0)}
                </text>
              </g>
            );
          })}

          {/* Area */}
          <path d={areaPath} className="fill-blue-500/20" />

          {/* Line */}
          <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Points */}
          {processedData.map((d, i) => {
            const px = padding + d.x * plotWidth;
            const py = chartHeight - padding - (d.y * plotHeight);
            const isHovered = hoveredIndex === i;
            
            return (
              <g key={i} 
                 onMouseEnter={() => setHoveredIndex(i)} 
                 onMouseLeave={() => setHoveredIndex(null)}
                 className="cursor-pointer">
                
                {/* Invisible hit target */}
                <circle cx={px} cy={py} r="15" fill="transparent" />
                
                {/* Visible dot */}
                <circle 
                  cx={px} 
                  cy={py} 
                  r={isHovered ? 6 : 4} 
                  className={`transition-all duration-200 ${isHovered ? 'fill-white stroke-blue-500 stroke-2' : 'fill-blue-500'}`} 
                />

                {/* Tooltip */}
                {isHovered && (
                  <foreignObject x={Math.min(px + 10, chartWidth - 160)} y={Math.min(py - 80, chartHeight - 100)} width="150" height="100" className="pointer-events-none z-50">
                    <div className="rounded-lg bg-gray-800 p-2 text-xs shadow-xl border border-gray-700">
                      <div className="font-bold text-white mb-1">{new Date(d.date).toLocaleDateString()}</div>
                      <div className="grid grid-cols-2 gap-x-2 text-gray-300">
                         <span>Dedup:</span> 
                         <span className="text-right text-blue-400 font-mono">{formatBytes(d.val)}</span>
                         <span>Original:</span> 
                         <span className="text-right text-gray-400 font-mono">{formatBytes(d.original)}</span>
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default StorageChart;
