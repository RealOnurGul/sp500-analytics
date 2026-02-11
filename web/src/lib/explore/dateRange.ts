import type { Bar } from "./types";
import { RANGE_DAYS, type RangeKey } from "./types";

export function filterBarsByRange(bars: Bar[], rangeKey: RangeKey): Bar[] {
  if (bars.length === 0) return [];
  const days = RANGE_DAYS[rangeKey];
  if (days == null) return bars;
  const sorted = [...bars].sort((a, b) => a.time.localeCompare(b.time));
  const cutoff = new Date(sorted[sorted.length - 1].time);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sorted.filter((b) => b.time >= cutoffStr);
}

export function filterBarsByCustomRange(bars: Bar[], start: string, end: string): Bar[] {
  return bars.filter((b) => b.time >= start && b.time <= end);
}
