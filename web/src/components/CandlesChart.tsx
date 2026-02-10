"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
} from "lightweight-charts";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlesChartProps {
  ticker?: string;
  candles: Candle[];
  className?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

interface HoverInfo {
  time: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  changePct?: number;
}

function formatNum(value: number | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "–";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function CandlesChart({ ticker, candles, className = "" }: CandlesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [showVolume, setShowVolume] = useState(true);
  // Fraction of chart height used for the volume pane at the bottom
  const [volumeHeight, setVolumeHeight] = useState(0.25);

  const isDraggingRef = useRef(false);
  const lastYRef = useRef<number | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

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

  const volumeData: HistogramData[] = useMemo(
    () =>
      candles.map((c) => ({
        time: c.time as string,
        value: c.volume,
        color: c.close >= c.open ? "#16a34a" : "#dc2626",
      })),
    [candles]
  );

  const candleByTime = useMemo(() => {
    const map = new Map<string, Candle>();
    candles.forEach((c) => {
      map.set(c.time, c);
    });
    return map;
  }, [candles]);

  const defaultInfo: HoverInfo | null = useMemo(() => {
    if (candles.length === 0) return null;
    const last = candles[candles.length - 1];
    const changePct =
      last.open != null && last.open !== 0
        ? ((last.close - last.open) / last.open) * 100
        : undefined;
    return {
      time: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      changePct,
    };
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#0f172a",
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderDownColor: "#dc2626",
      borderUpColor: "#16a34a",
      wickDownColor: "#dc2626",
      wickUpColor: "#16a34a",
    });

    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
    });

    if (candleData.length > 0) {
      candlestickSeries.setData(candleData);
      volumeSeries.setData(volumeData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chart created once on mount; data updated in separate effects
  }, []);

  // Update series data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || candleData.length === 0) return;
    candleSeriesRef.current.setData(candleData);

    if (volumeSeriesRef.current && volumeData.length > 0) {
      volumeSeriesRef.current.setData(volumeData);
    }

    chartRef.current?.timeScale().fitContent();
  }, [candleData, volumeData]);

  // Apply layout for volume pane height (price chart stays stable)
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const priceScale = chart.priceScale("right");
    priceScale.applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: volumeHeight,
      },
    });
  }, [volumeHeight]);

  // Apply volume pane visibility without changing overall chart layout
  useEffect(() => {
    if (!chartRef.current || !volumeSeriesRef.current) return;
    const chart = chartRef.current;
    const volumeScale = chart.priceScale("volume");

    volumeScale.applyOptions({
      scaleMargins: { top: 1 - volumeHeight + 0.02, bottom: 0 },
    });
    volumeSeriesRef.current.applyOptions({
      visible: showVolume,
    });
  }, [showVolume, volumeHeight]);

  // Crosshair move: update hover info without recreating chart
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const handler = (param: any) => {
      if (!param || !param.time) {
        setHoverInfo(null);
        return;
      }
      const time = String(param.time);
      const candle = candleByTime.get(time);
      if (!candle) {
        setHoverInfo(null);
        return;
      }
      const changePct =
        candle.open != null && candle.open !== 0
          ? ((candle.close - candle.open) / candle.open) * 100
          : undefined;
      setHoverInfo({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        changePct,
      });
    };

    chart.subscribeCrosshairMove(handler);
    return () => {
      chart.unsubscribeCrosshairMove(handler);
    };
  }, [candleByTime]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    if (!showVolume) return;
    isDraggingRef.current = true;
    lastYRef.current = event.clientY;

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!rect.height) return;
      const lastY = lastYRef.current ?? e.clientY;
      const deltaY = e.clientY - lastY;
      lastYRef.current = e.clientY;
      const deltaRatio = deltaY / rect.height;
      setVolumeHeight((prev) => clamp(prev - deltaRatio, 0.1, 0.5));
    };

    const handleUp = () => {
      isDraggingRef.current = false;
      lastYRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [showVolume]);

  const info = hoverInfo ?? defaultInfo;
  const changeClass =
    info && info.changePct != null
      ? info.changePct >= 0
        ? "text-[var(--green)]"
        : "text-[var(--red)]"
      : "text-[var(--text-muted)]";

  return (
    <div className={className}>
      {info && (
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-[var(--text)]">
          <span className="font-semibold">{ticker}</span>
          <span className="text-[var(--text-muted)]">{info.time}</span>
          {info.open != null && (
            <span>
              O: <span className="font-medium">{formatNum(info.open)}</span>
            </span>
          )}
          {info.high != null && (
            <span>
              H: <span className="font-medium">{formatNum(info.high)}</span>
            </span>
          )}
          {info.low != null && (
            <span>
              L: <span className="font-medium">{formatNum(info.low)}</span>
            </span>
          )}
          <span>
            C: <span className="font-medium">{formatNum(info.close)}</span>
          </span>
          <span className={changeClass}>
            {info.changePct != null
              ? `${info.changePct >= 0 ? "+" : ""}${formatNum(info.changePct)}%`
              : "–%"}
          </span>
        </div>
      )}
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setShowVolume((v) => !v)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)] hover:bg-gray-100"
        >
          {showVolume ? "Hide volume" : "Show volume"}
        </button>
      </div>
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: 400 }}
      >
        {showVolume && (
          <div
            className="absolute left-0 right-0 h-1 cursor-row-resize bg-[var(--border)]/70"
            style={{ top: `${(1 - volumeHeight) * 100}%` }}
            onMouseDown={handleDragStart}
          />
        )}
      </div>
    </div>
  );
}
