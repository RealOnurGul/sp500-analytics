"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  LineStyle,
} from "lightweight-charts";
import type { IndicatorState } from "./IndicatorControls";
import {
  ema,
  vwap as vwapCalc,
  bollingerBands,
  parabolicSAR,
  ema8SlopeRegime,
  confirmedRegimeFromEma8,
  EMA_RIBBON_PERIODS,
  RIBBON_OPACITIES,
  EMA_50_PERIOD,
  EMA_200_PERIOD,
} from "@/lib/indicators";

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VisibleRange {
  from: number;
  to: number;
}

/** LineData point for indicators */
function toLineData(times: string[], values: (number | null)[]): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < times.length; i++) {
    if (values[i] != null && !Number.isNaN(values[i]!)) {
      out.push({ time: times[i] as string, value: values[i]! });
    }
  }
  return out;
}

/** TradingView-style ribbon: per-point color from regime + opacity by line index. */
function toRibbonLineData(
  times: string[],
  values: (number | null)[],
  regime: ("bullish" | "bearish")[],
  lineIndex: number
): LineData[] {
  const opacity = RIBBON_OPACITIES[Math.min(lineIndex, RIBBON_OPACITIES.length - 1)];
  const out: LineData[] = [];
  for (let i = 0; i < times.length; i++) {
    if (values[i] == null || Number.isNaN(values[i]!)) continue;
    const r = regime[i];
    const color =
      r === "bullish"
        ? `rgba(124, 58, 237, ${opacity})` // purple/blue
        : `rgba(220, 38, 127, ${opacity})`; // red/magenta
    out.push({ time: times[i] as string, value: values[i]!, color });
  }
  return out;
}

/** VWAP line: same bullish/bearish colors as ribbon, opacity 1.0. */
function toVwapLineData(
  times: string[],
  values: (number | null)[],
  regime: ("bullish" | "bearish")[]
): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < times.length; i++) {
    if (values[i] == null || Number.isNaN(values[i]!)) continue;
    const r = regime[i];
    const color =
      r === "bullish"
        ? "rgba(124, 58, 237, 1)"
        : "rgba(220, 38, 127, 1)";
    out.push({ time: times[i] as string, value: values[i]!, color });
  }
  return out;
}

interface CandlesChartProps {
  ticker?: string;
  candles: Candle[];
  indicators?: IndicatorState;
  className?: string;
  /** Sync: report crosshair time when user moves crosshair */
  onCrosshairMove?: (time: string) => void;
  /** Sync: report visible range when user scrolls/zooms */
  onVisibleRangeChange?: (range: VisibleRange) => void;
  /** Sync: when set, scroll this chart to show this time (crosshair sync) */
  syncedCrosshairTime?: string | null;
  /** Sync: when set, apply this visible range (time/date range sync) */
  syncedVisibleRange?: VisibleRange | null;
  syncCrosshair?: boolean;
  syncTime?: boolean;
  syncDateRange?: boolean;
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

const INDICATOR_COLORS = {
  /** EMA 50/200 constant colors (not regime-based). */
  ema50: "#eab308",
  ema200: "#f97316",
  bollinger: "#64748b",
  bollingerBand: "#94a3b8",
  sar: "#06b6d4",
};

export function CandlesChart({
  ticker,
  candles,
  indicators,
  className = "",
  onCrosshairMove,
  onVisibleRangeChange,
  syncedCrosshairTime,
  syncedVisibleRange,
  syncCrosshair = false,
  syncTime = false,
  syncDateRange = false,
}: CandlesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ribbonSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollingerSeriesRef = useRef<{ upper: ISeriesApi<"Line">; middle: ISeriesApi<"Line">; lower: ISeriesApi<"Line"> } | null>(null);
  const sarSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const skipVisibleRangeRef = useRef(false);

  const [showVolume, setShowVolume] = useState(true);
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

  const ind = indicators ?? { emaRibbon: false, ema50: true, ema200: true, vwap: false, bollinger: false, sar: false };
  const indicatorData = useMemo(() => {
    if (candles.length === 0) return null;
    const close = candles.map((c) => c.close);
    const high = candles.map((c) => c.high);
    const low = candles.map((c) => c.low);
    const volume = candles.map((c) => c.volume);
    const times = candles.map((c) => c.time);
    const sarValues = ind.sar ? parabolicSAR(high, low, close) : null;
    const needRegime = ind.emaRibbon || ind.vwap;
    const ema8 = needRegime ? ema(close, 8) : null;
    const regime = ema8 ? ema8SlopeRegime(ema8) : null;
    const vwapConfirmedRegime = ind.vwap && ema8 ? confirmedRegimeFromEma8(ema8) : null;
    const vwapValues = ind.vwap ? vwapCalc(high, low, close, volume) : null;
    return {
      times,
      ribbon:
        ind.emaRibbon && regime
          ? EMA_RIBBON_PERIODS.map((p, lineIndex) =>
              toRibbonLineData(times, ema(close, p), regime, lineIndex)
            )
          : [],
      vwap:
        ind.vwap && vwapConfirmedRegime && vwapValues
          ? toVwapLineData(times, vwapValues, vwapConfirmedRegime)
          : [],
      ema50: ind.ema50 ? toLineData(times, ema(close, EMA_50_PERIOD)) : [],
      ema200: ind.ema200 ? toLineData(times, ema(close, EMA_200_PERIOD)) : [],
      bollinger: ind.bollinger ? bollingerBands(close, 20, 2) : null,
      sar: sarValues ? toLineData(times, sarValues) : [],
    };
  }, [
    candles,
    `${ind.emaRibbon}-${ind.ema50}-${ind.ema200}-${ind.vwap}-${ind.bollinger}-${ind.sar}`,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const w = el.clientWidth || 400;
    const h = Math.max(200, el.clientHeight || 400);

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#0f172a",
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      width: w,
      height: h,
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

    const applySize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = Math.max(200, containerRef.current.clientHeight);
      chartRef.current.applyOptions({ width, height });
    };

    const ro = new ResizeObserver(applySize);
    ro.observe(el);
    window.addEventListener("resize", applySize);

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

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applySize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ribbonSeriesRef.current = [];
      vwapSeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema200SeriesRef.current = null;
      bollingerSeriesRef.current = null;
      sarSeriesRef.current = null;
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

  // Indicator series: create/remove and update data
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || !indicatorData || candleData.length === 0) return;

    const { times, ribbon, vwap: vwapData, ema50, ema200, bollinger, sar } = indicatorData;

    // EMA Ribbon (slope-based regime color, opacity gradient, EMA8 thicker)
    if (ind.emaRibbon) {
      if (ribbonSeriesRef.current.length !== ribbon.length) {
        ribbonSeriesRef.current.forEach((s) => chart.removeSeries(s));
        ribbonSeriesRef.current = ribbon.map((_, i) =>
          chart.addLineSeries({
            color: "rgba(124, 58, 237, 0.6)",
            lineWidth: i === 0 ? 2 : 1,
            priceLineVisible: false,
            lastValueVisible: false,
          })
        );
      }
      ribbonSeriesRef.current.forEach((s, i) => s.setData(ribbon[i]));
    } else {
      ribbonSeriesRef.current.forEach((s) => chart.removeSeries(s));
      ribbonSeriesRef.current = [];
    }

    // VWAP (above ribbon, same regime colors, bold line)
    if (ind.vwap) {
      if (!vwapSeriesRef.current) {
        vwapSeriesRef.current = chart.addLineSeries({
          color: "rgba(124, 58, 237, 1)",
          lineWidth: 3,
          priceLineVisible: false,
          lastValueVisible: true,
        });
      }
      vwapSeriesRef.current.setData(vwapData);
    } else {
      if (vwapSeriesRef.current) {
        chart.removeSeries(vwapSeriesRef.current);
        vwapSeriesRef.current = null;
      }
    }

    // EMA 50
    if (ind.ema50) {
      if (!ema50SeriesRef.current) {
        ema50SeriesRef.current = chart.addLineSeries({
          color: INDICATOR_COLORS.ema50,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
      }
      ema50SeriesRef.current.setData(ema50);
    } else {
      if (ema50SeriesRef.current) {
        chart.removeSeries(ema50SeriesRef.current);
        ema50SeriesRef.current = null;
      }
    }

    // EMA 200
    if (ind.ema200) {
      if (!ema200SeriesRef.current) {
        ema200SeriesRef.current = chart.addLineSeries({
          color: INDICATOR_COLORS.ema200,
          lineWidth: 3,
          priceLineVisible: false,
          lastValueVisible: true,
        });
      }
      ema200SeriesRef.current.setData(ema200);
    } else {
      if (ema200SeriesRef.current) {
        chart.removeSeries(ema200SeriesRef.current);
        ema200SeriesRef.current = null;
      }
    }

    // Bollinger Bands
    if (ind.bollinger && bollinger) {
      if (!bollingerSeriesRef.current) {
        bollingerSeriesRef.current = {
          upper: chart.addLineSeries({
            color: INDICATOR_COLORS.bollingerBand,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          }),
          middle: chart.addLineSeries({
            color: INDICATOR_COLORS.bollinger,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          }),
          lower: chart.addLineSeries({
            color: INDICATOR_COLORS.bollingerBand,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
          }),
        };
      }
      bollingerSeriesRef.current.upper.setData(toLineData(times, bollinger.upper));
      bollingerSeriesRef.current.middle.setData(toLineData(times, bollinger.middle));
      bollingerSeriesRef.current.lower.setData(toLineData(times, bollinger.lower));
    } else {
      if (bollingerSeriesRef.current) {
        chart.removeSeries(bollingerSeriesRef.current.upper);
        chart.removeSeries(bollingerSeriesRef.current.middle);
        chart.removeSeries(bollingerSeriesRef.current.lower);
        bollingerSeriesRef.current = null;
      }
    }

    // Parabolic SAR
    if (ind.sar) {
      if (!sarSeriesRef.current) {
        sarSeriesRef.current = chart.addLineSeries({
          color: INDICATOR_COLORS.sar,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: LineStyle.Dashed,
        });
      }
      sarSeriesRef.current.setData(sar);
    } else {
      if (sarSeriesRef.current) {
        chart.removeSeries(sarSeriesRef.current);
        sarSeriesRef.current = null;
      }
    }

    candleSeries.setMarkers([]);
  }, [
    candleData.length,
    indicatorData,
    `${ind.emaRibbon}-${ind.ema50}-${ind.ema200}-${ind.vwap}-${ind.bollinger}-${ind.sar}`,
  ]);

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

  // Crosshair move: update hover info and optionally report for sync
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const handler = (param: any) => {
      if (!param || !param.time) return;
      const time = String(param.time);
      onCrosshairMove?.(time);
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
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [candleByTime, onCrosshairMove]);

  // Subscribe to visible range change for Time/Date range sync
  useEffect(() => {
    if (!chartRef.current || (!onVisibleRangeChange && !syncedVisibleRange)) return;
    const chart = chartRef.current;

    const handler = (range: { from: number; to: number } | null) => {
      if (skipVisibleRangeRef.current || !range) return;
      onVisibleRangeChange?.({ from: range.from, to: range.to });
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  }, [onVisibleRangeChange, syncedVisibleRange]);

  // Crosshair sync: set crosshair on this chart to the synced time (same date as other charts).
  // Also update hover info so the OHLC bar reflects the synced time on every chart.
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    const chart = chartRef.current;

    if (!syncCrosshair || !syncedCrosshairTime) {
      chart.clearCrosshairPosition();
      setHoverInfo(null);
      return;
    }

    const candle = candleByTime.get(syncedCrosshairTime);
    if (candle != null) {
      chart.setCrosshairPosition(
        candle.close,
        syncedCrosshairTime as string,
        candleSeriesRef.current
      );
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
    } else {
      chart.clearCrosshairPosition();
      setHoverInfo(null);
    }
  }, [syncCrosshair, syncedCrosshairTime, candleByTime]);

  // Apply synced visible range (Time / Date range sync)
  useEffect(() => {
    if (
      (!syncTime && !syncDateRange) ||
      !syncedVisibleRange ||
      !chartRef.current
    )
      return;
    skipVisibleRangeRef.current = true;
    chartRef.current.timeScale().setVisibleLogicalRange(syncedVisibleRange);
    setTimeout(() => {
      skipVisibleRangeRef.current = false;
    }, 50);
  }, [syncTime, syncDateRange, syncedVisibleRange]);

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
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {info && (
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text)]">
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
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setShowVolume((v) => !v)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text)] hover:bg-gray-100"
        >
          {showVolume ? "Hide volume" : "Show volume"}
        </button>
      </div>
      <div ref={containerRef} className="relative min-h-[120px] w-full flex-1">
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
