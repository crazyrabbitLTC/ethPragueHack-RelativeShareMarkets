'use client';

import React, { useEffect, useRef, memo } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi, 
  LineSeries,
  AreaSeries,
  LineSeriesOptions,
  AreaSeriesOptions,
  DeepPartial,
  Time
} from 'lightweight-charts';
import { TokenChartData } from '@/lib/hooks/useRelativeSharesChartData';

export interface RelativeSharesChartProps {
  data: TokenChartData[];
  height?: number;
  showAsArea?: boolean;
}

const RelativeSharesChartComponent: React.FC<RelativeSharesChartProps> = ({
  data,
  height = 400,
  showAsArea = false,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'> | ISeriesApi<'Area'>>>(new Map());

  useEffect(() => {
    if (!chartContainerRef.current || !chartContainerRef.current.isConnected) return;
    if (data.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
        horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
      },
      crosshair: { 
        mode: 1, // Magnet mode
        vertLine: {
          labelBackgroundColor: 'rgba(32, 38, 46, 0.9)',
        },
        horzLine: {
          labelBackgroundColor: 'rgba(32, 38, 46, 0.9)',
        },
      },
      rightPriceScale: { 
        borderColor: 'rgba(197, 203, 206, 0.2)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.2)',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    chartRef.current = chart;

    // Create a series for each token
    data.forEach((tokenData) => {
      let series;
      
      if (showAsArea) {
        const areaOptions: DeepPartial<AreaSeriesOptions> = {
          lineColor: tokenData.color,
          topColor: tokenData.color + '40', // Add transparency
          bottomColor: 'transparent',
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `${price.toFixed(1)}%`,
          },
        };
        series = chart.addSeries(AreaSeries, areaOptions);
      } else {
        const lineOptions: DeepPartial<LineSeriesOptions> = {
          color: tokenData.color,
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => `${price.toFixed(1)}%`,
          },
        };
        series = chart.addSeries(LineSeries, lineOptions);
      }
      
      if (series && tokenData.data.length > 0) {
        series.setData(tokenData.data);
        seriesRefs.current.set(tokenData.symbol, series);
      }
    });

    // Fit content and set visible range
    chart.timeScale().fitContent();
    
    // Set y-axis range to 0-100%
    chart.priceScale('right').applyOptions({
      autoScale: false,
      scaleMargins: {
        top: 0.05,
        bottom: 0.05,
      },
    });

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
      seriesRefs.current.clear();
    };
  }, [data, height, showAsArea]);

  // Update series data when data changes
  useEffect(() => {
    data.forEach((tokenData) => {
      const series = seriesRefs.current.get(tokenData.symbol);
      if (series && tokenData.data.length > 0) {
        series.setData(tokenData.data);
      }
    });
  }, [data]);

  return (
    <div className="relative w-full bg-gray-900/30 rounded-xl border border-gray-800 overflow-hidden">
      <div ref={chartContainerRef} />
      
      {/* Chart Header */}
      <div className="absolute top-4 left-4 bg-gray-800/80 rounded-lg px-3 py-1.5 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">Relative Market Shares</h3>
      </div>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-gray-800/80 rounded-lg px-3 py-2 border border-gray-700">
        <div className="flex flex-col space-y-1">
          {data.map((token) => (
            <div key={token.symbol} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: token.color }}
              />
              <span className="text-xs text-gray-300">{token.symbol}</span>
              {token.data.length > 0 && (
                <span className="text-xs text-gray-400">
                  {token.data[token.data.length - 1].value.toFixed(1)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RelativeSharesChart = memo(RelativeSharesChartComponent); 