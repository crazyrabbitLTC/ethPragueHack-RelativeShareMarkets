'use client';

import React, { useEffect, useRef, memo, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi, 
  Time,
  SeriesMarkerPosition,
  SeriesMarkerShape,
  DeepPartial,
  ChartOptions,
  LineSeriesOptions,
  HistogramSeriesOptions,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  AreaSeriesOptions
} from 'lightweight-charts';
import { TokenChartData } from '@/lib/hooks/useRelativeSharesChartData';
import { Position, PositionUpdate } from '@/lib/graphql/types';

export interface TradingViewWithPositionsProps {
  marketData: TokenChartData[];
  positions: Position[];
  positionUpdates: PositionUpdate[];
  height?: number;
  selectedTrader?: string;
}

interface ChartPoint {
  time: Time;
  value: number;
}

interface PnlPoint {
  time: Time;
  value: number;
  color: string;
}

const TradingViewWithPositionsComponent: React.FC<TradingViewWithPositionsProps> = ({
  marketData,
  positions,
  positionUpdates,
  height = 500,
  selectedTrader,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const marketSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const pnlSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const exposureSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  
  useEffect(() => {
    if (!chartContainerRef.current || !chartContainerRef.current.isConnected) return;
    if (marketData.length === 0) return;

    // Create chart
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
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      leftPriceScale: {
        visible: true,
        borderColor: 'rgba(197, 203, 206, 0.3)',
        scaleMargins: { top: 0.3, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add market share series (ETH/BTC)
    const tokenColors = {
      'ETH': '#627EEA',
      'BTC': '#F7931A',
      'SOL': '#00FFA3',
      'ARB': '#28A0F0',
    };

    // Clear existing series
    marketSeriesRef.current.forEach(series => {
      chart.removeSeries(series);
    });
    marketSeriesRef.current.clear();

    // Add market data series
    if (marketData.length > 0) {
      // marketData is TokenChartData[] format
      marketData.forEach((tokenData) => {
        // Only show ETH and BTC
        if (tokenData.symbol !== 'ETH' && tokenData.symbol !== 'BTC') return;
        
        const lineOptions: DeepPartial<LineSeriesOptions> = {
          color: tokenColors[tokenData.symbol] || '#888888',
          lineWidth: 2,
          title: `${tokenData.symbol} Share`,
          priceScaleId: 'right',
          priceFormat: {
            type: 'custom',
            formatter: (price: any) => `${price.toFixed(2)}%`,
          },
        };
        const series = chart.addSeries(LineSeries, lineOptions);

        series.setData(tokenData.data);
        marketSeriesRef.current.set(tokenData.symbol, series);
      });
    }

    // Add P&L histogram series
    if (positions.length > 0 && positionUpdates.length > 0) {
      // Filter positions and updates by selected trader
      const traderPositions = selectedTrader 
        ? positions.filter(p => p.trader === selectedTrader)
        : positions;
        
      const traderUpdates = selectedTrader
        ? positionUpdates.filter(u => u.trader === selectedTrader)
        : positionUpdates;

      // Create P&L data
      const pnlData: PnlPoint[] = traderUpdates.map(update => {
        const pnl = Number(update.unrealizedPnl) / 1e18;
        return {
          time: update.timestamp as Time,
          value: pnl,
          color: pnl >= 0 ? '#26a69a' : '#ef5350',
        };
      });

      // Add P&L histogram
      const histogramOptions: DeepPartial<HistogramSeriesOptions> = {
        color: '#26a69a',
        priceScaleId: 'left',
        title: 'P&L',
        priceFormat: {
          type: 'custom',
          formatter: (price: any) => `$${price.toFixed(0)}`,
        },
      };
      const pnlSeries = chart.addSeries(HistogramSeries, histogramOptions);

      pnlSeries.setData(pnlData);
      pnlSeriesRef.current = pnlSeries;

      // Add position markers
      traderPositions.forEach(position => {
        const isLong = position.isLong;
        const entryTime = position.openedAt;
        const exitTime = position.closedAt;
        const entryShare = Number(position.entryShares) / 1e18;
        const exitShare = position.exitShares ? Number(position.exitShares) / 1e18 : null;

        // Find the appropriate series (ETH for now)
        const ethSeries = marketSeriesRef.current.get('ETH');
        if (ethSeries) {
          // Entry marker
          ethSeries.setMarkers([
            ...ethSeries.markers() || [],
            {
              time: entryTime as Time,
              position: 'aboveBar' as SeriesMarkerPosition,
              color: isLong ? '#26a69a' : '#ef5350',
              shape: isLong ? 'arrowUp' as SeriesMarkerShape : 'arrowDown' as SeriesMarkerShape,
              text: `${isLong ? 'L' : 'S'} Entry`,
              size: 2,
            }
          ]);

          // Exit marker if position is closed
          if (exitTime && exitShare !== null) {
            ethSeries.setMarkers([
              ...ethSeries.markers() || [],
              {
                time: exitTime as Time,
                position: 'belowBar' as SeriesMarkerPosition,
                color: isLong ? '#26a69a' : '#ef5350',
                shape: 'square' as SeriesMarkerShape,
                text: `${isLong ? 'L' : 'S'} Exit`,
                size: 2,
              }
            ]);
          }
        }
      });

      // Add exposure area (shaded regions for open positions)
      const exposureData: ChartPoint[] = [];
      
      traderPositions.forEach(position => {
        if (position.status === 'open') {
          const startTime = position.openedAt;
          const currentTime = Math.floor(Date.now() / 1000);
          const leverage = Number(position.leverage) / 1e18;
          const notional = Number(position.notional) / 1e18;
          const exposure = notional * leverage;

          // Create exposure band
          const relevantUpdates = traderUpdates
            .filter(u => u.positionId === position.id && u.timestamp >= startTime)
            .sort((a, b) => a.timestamp - b.timestamp);

          relevantUpdates.forEach(update => {
            exposureData.push({
              time: update.timestamp as Time,
              value: position.isLong ? exposure : -exposure,
            });
          });

          // Add current point if position is still open
          if (!position.closedAt) {
            exposureData.push({
              time: currentTime as Time,
              value: position.isLong ? exposure : -exposure,
            });
          }
        }
      });

      // Add exposure area series
      if (exposureData.length > 0) {
        const areaOptions: DeepPartial<AreaSeriesOptions> = {
          topColor: 'rgba(38, 166, 154, 0.1)',
          bottomColor: 'rgba(239, 83, 80, 0.1)',
          lineColor: 'rgba(255, 255, 255, 0.2)',
          lineWidth: 1,
          priceScaleId: 'left',
          title: 'Exposure',
          crosshairMarkerVisible: false,
        };
        const exposureSeries = chart.addSeries(AreaSeries, areaOptions);

        exposureSeries.setData(exposureData.sort((a, b) => (a.time as number) - (b.time as number)));
        exposureSeriesRef.current = exposureSeries;
      }
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Fit content
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, [marketData, positions, positionUpdates, height, selectedTrader]);

  return (
    <div className="relative w-full">
      <div ref={chartContainerRef} className="rounded-xl border border-gray-800 overflow-hidden" />
      {selectedTrader && (
        <div className="absolute top-4 right-4 bg-gray-900/90 px-3 py-1 rounded-lg border border-gray-700">
          <span className="text-xs text-gray-400">Trader: </span>
          <span className="text-xs font-mono text-white">
            {selectedTrader.slice(0, 6)}...{selectedTrader.slice(-4)}
          </span>
        </div>
      )}
    </div>
  );
};

export const TradingViewWithPositions = memo(TradingViewWithPositionsComponent);