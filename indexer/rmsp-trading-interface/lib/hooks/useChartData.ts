import { useState, useEffect } from 'react';
import { LineData, Time } from 'lightweight-charts';

// Generates mock time-series data for the chart
const generateMockChartData = (points = 100): LineData[] => {
  const data: LineData[] = [];
  let value = 50;
  const startTime = Math.floor(Date.now() / 1000) - points * 60 * 60; // Start `points` hours ago

  for (let i = 0; i < points; i++) {
    const time = (startTime + i * 60 * 60) as Time; // Increment by 1 hour
    value += Math.random() * 4 - 2; // Random walk
    value = Math.max(10, Math.min(90, value)); // Clamp between 10 and 90
    data.push({ time, value });
  }
  return data;
};

export function useChartData() {
  const [chartData, setChartData] = useState<LineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate fetching data
    setLoading(true);
    try {
      const mockData = generateMockChartData(24 * 7); // 7 days of hourly data
      setChartData(mockData);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to generate chart data'));
      setLoading(false);
    }
  }, []);

  // TODO: Replace with actual data fetching from the indexer
  // This will involve:
  // 1. Querying `priceUpdates` or a new entity that stores historical share prices.
  // 2. Transforming the data into the LineData[] format.
  // 3. Handling loading and error states from the GraphQL query.

  return { data: chartData, loading, error };
} 