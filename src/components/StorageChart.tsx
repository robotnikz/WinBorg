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

  // Horizontal padding is tiny because the Y-axis labels now live in a separate
  // HTML gutter (see below). Vertical padding keeps headroom above the peak and a
  // baseline below. The SVG is stretched (preserveAspectRatio="none"), so anything
  // we render inside it gets distorted — that's why the labels are kept outside it.
  const padX = 6;
  const padY = 24;
  const chartWidth = 800; // Internal coordinate system width
  const chartHeight = height; // Use the prop directly for the SVG viewBox
  const plotWidth = chartWidth - padX * 2;
  const plotHeight = chartHeight - padY * 2;

  const maxVal = processedData[0]?.max ?? 0;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  // Vertical position (as a fraction of the container) of a given tick / grid line.
  const topFraction = (t: number) => (chartHeight - padY - t * plotHeight) / chartHeight;

  const points = processedData.map(d => {
    const px = padX + d.x * plotWidth;
    const py = chartHeight - padY - (d.y * plotHeight);
    return `${px},${py}`;
  }).join(' ');

  // Create area path (close the loop down to bottom)
  const firstX = padX;
  const lastX = padX + plotWidth;
  const bottomY = chartHeight - padY;

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

      <div className="relative flex-1 min-h-0 w-full flex">
        {/* Y-axis labels: rendered as HTML in a fixed-width gutter so they keep a
            constant size and never get clipped by the stretched SVG. */}
        <div className="relative w-14 shrink-0">
          {ticks.map(t => (
            <span
              key={t}
              className="absolute right-1.5 -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums text-gray-500"
              style={{ top: `${topFraction(t) * 100}%` }}
            >
              {formatBytes(maxVal * t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-h-0">
        {/* We use preserveAspectRatio="none" to allow stretching to container */}
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {/* Grid Lines */}
          {ticks.map(t => {
            const y = chartHeight - padY - (t * plotHeight);
            return (
              <line key={t} x1={0} y1={y} x2={chartWidth} y2={y} stroke="#374151" strokeDasharray="4 4" />
            );
          })}

          {/* Area */}
          <path d={areaPath} className="fill-blue-500/20" />

          {/* Line */}
          <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Points */}
          {processedData.map((d, i) => {
            const px = padX + d.x * plotWidth;
            const py = chartHeight - padY - (d.y * plotHeight);
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
    </div>
  );
};

export default StorageChart;
