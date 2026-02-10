"use client";

import { useEffect, useRef, useMemo } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlesChartProps {
  candles: Candle[];
  className?: string;
}

export function CandlesChart({ candles, className = "" }: CandlesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const candleData: CandlestickData[] = useMemo(
    () =>
      candles.map((c) => ({
        time: c.time as string,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    [candles]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2a2e39" },
        horzLines: { color: "#2a2e39" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });
    if (candleData.length > 0) {
      candlestickSeries.setData(candleData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart created once on mount; data updated in separate effect
  }, []);

  useEffect(() => {
    if (!seriesRef.current || candleData.length === 0) return;
    seriesRef.current.setData(candleData);
    chartRef.current?.timeScale().fitContent();
  }, [candleData]);

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full" style={{ height: 400 }} />
    </div>
  );
}
