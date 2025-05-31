'use client';

import React, { useEffect, useRef, memo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';

export interface TradingViewChartProps {
  data: LineData[];
  baseToken?: string;
  currentShare?: number;
}

const TradingViewChartComponent: React.FC<TradingViewChartProps> = ({ data, baseToken = 'Token', currentShare }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<\"Line\"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300, // Or dynamic height
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: {
          color: 'rgba(197, 203, 206, 0.1)',
        },
        horzLines: {
          color: 'rgba(197, 203, 206, 0.1)',
        },
      },
      crosshair: {
        mode: 1, // Magnet mode for crosshair
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;
    const lineSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
    });
    seriesRef.current = lineSeries;
    lineSeries.setData(data);

    chart.timeScale().fitContent();

    // Resize chart on window resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [data]); // Re-run effect if data changes

  // Update series data when `data` prop changes without full re-render
  useEffect(() => {
    if (seriesRef.current && data) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  return (
    <div className="relative w-full aspect-video bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
      <div ref={chartContainerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 bg-gray-800/80 rounded-lg px-3 py-1.5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">{baseToken} Market Share</h3>
      </div>
      {currentShare !== undefined && (
         <div className="absolute top-4 right-4 bg-gray-800/80 rounded-lg px-4 py-2 border border-gray-700">
            <div className="text-sm text-gray-400">Current Share</div>
            <div className="text-2xl font-bold text-cyan-400">{currentShare.toFixed(1)}%</div>
        </div>
      )}
    </div>
  );
};

export const TradingViewChart = memo(TradingViewChartComponent); 