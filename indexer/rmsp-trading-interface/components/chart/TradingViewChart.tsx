'use client';

import React, { useEffect, useRef, memo } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time, LineSeriesPartialOptions } from 'lightweight-charts';

export interface TradingViewChartProps {
  data: LineData[];
  baseToken?: string;
  currentShare?: number;
  chartType?: 'Line' | 'Area'; // Allow specifying chart type
  lineColor?: string;
}

const TradingViewChartComponent: React.FC<TradingViewChartProps> = ({
  data,
  baseToken = 'Token',
  currentShare,
  chartType = 'Line',
  lineColor = '#2962FF',
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<typeof chartType> | null>(null); // Use typeof chartType for generic series

  useEffect(() => {
    if (!chartContainerRef.current || !chartContainerRef.current.isConnected) return;
    // Ensure data is not empty, otherwise Lightweight Charts might throw an error
    if (data.length === 0) {
        // Optionally clear the chart if data becomes empty
        if(chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }
        return;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 300, 
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      crosshair: { mode: 1 }, // Magnet mode
      rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.2)' },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    let series;
    if (chartType === 'Line') {
      series = chart.addLineSeries({
        color: lineColor,
        lineWidth: 2,
      });
    } else if (chartType === 'Area') {
      series = chart.addAreaSeries({
        lineColor: lineColor,
        topColor: 'rgba(41, 98, 255, 0.4)', // Example area color
        bottomColor: 'rgba(41, 98, 255, 0)',
        lineWidth: 2,
      });
    }
    seriesRef.current = series as ISeriesApi<typeof chartType>; // Cast to specific type
    seriesRef.current.setData(data);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  // IMPORTANT: Only include data in dependencies if you want to re-create the chart on data change.
  // For data updates, use a separate useEffect as shown below.
  }, [chartType, lineColor]); // Recreate chart if type or color changes, not data itself

  // Update series data when `data` prop changes
  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      seriesRef.current.setData(data);
    } else if (seriesRef.current && data && data.length === 0) {
      // Clear data if an empty array is passed
      seriesRef.current.setData([]);
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