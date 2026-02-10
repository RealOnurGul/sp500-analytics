"use client";

import { useEffect, useMemo, useState } from "react";
import type { RangeKey } from "./RangeButtons";

interface WatchItem {
  id: string;
  ticker: string;
}

interface Folder {
  id: string;
  name: string;
  items: WatchItem[];
}

type WatchRange = Extract<RangeKey, "1M" | "3M" | "6M" | "1Y">;
const WATCH_RANGES: WatchRange[] = ["1M", "3M", "6M", "1Y"];

interface WatchlistProps {
  onSelectTicker: (ticker: string) => void;
  onRequestSearchForAdd: (addToFolder: (ticker: string) => void) => void;
}

interface ChangeStats {
  changeAbs: number;
  changePct: number;
}

export function Watchlist({ onSelectTicker, onRequestSearchForAdd }: WatchlistProps) {
  const [folders, setFolders] = useState<Folder[]>([
    {
      id: "stocks",
      name: "Stocks",
      items: [
        { id: "aapl", ticker: "AAPL" },
        { id: "amzn", ticker: "AMZN" },
        { id: "nvda", ticker: "NVDA" },
        { id: "googl", ticker: "GOOGL" },
        { id: "msft", ticker: "MSFT" },
        { id: "avgo", ticker: "AVGO" },
        { id: "meta", ticker: "META" },
        { id: "tsla", ticker: "TSLA" },
        { id: "brk-b", ticker: "BRK-B" },
        { id: "lly", ticker: "LLY" },
      ],
    },
  ]);
  const [activeFolderId, setActiveFolderId] = useState<string>("stocks");
  const [range, setRange] = useState<WatchRange>("1M");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadingTickers, setLoadingTickers] = useState<Record<string, boolean>>({});
  const [changes, setChanges] = useState<Record<string, ChangeStats | null>>({});

  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? folders[0];
  const activeItems = activeFolder?.items ?? [];

  // Fetch change stats for all tickers in active folder when folder or range changes
  useEffect(() => {
    if (!activeFolder) return;
    const tickers = activeFolder.items.map((i) => i.ticker);
    if (tickers.length === 0) return;

    setLoadingTickers((prev) => {
      const copy = { ...prev };
      tickers.forEach((t) => {
        copy[t] = true;
      });
      return copy;
    });

    (async () => {
      const entries = await Promise.all(
        tickers.map(async (t) => {
          try {
            const res = await fetch(
              `/api/prices?ticker=${encodeURIComponent(t)}&range=${encodeURIComponent(range)}`
            );
            if (!res.ok) throw new Error("failed");
            const data = await res.json();
            const candles = data.candles as { close: number }[] | undefined;
            if (!candles || candles.length < 2) return [t, null] as const;
            const first = candles[0].close;
            const last = candles[candles.length - 1].close;
            if (!first || !last) return [t, null] as const;
            const changeAbs = last - first;
            const changePct = (changeAbs / first) * 100;
            return [t, { changeAbs, changePct }] as const;
          } catch {
            return [t, null] as const;
          }
        })
      );
      setChanges((prev) => {
        const copy = { ...prev };
        for (const [t, stat] of entries) {
          copy[t] = stat;
        }
        return copy;
      });
      setLoadingTickers((prev) => {
        const copy = { ...prev };
        tickers.forEach((t) => {
          copy[t] = false;
        });
        return copy;
      });
    })();
  }, [activeFolder, range]);

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36);
    setFolders((prev) => [...prev, { id, name, items: [] }]);
    setNewFolderName("");
    setActiveFolderId(id);
  };

  const startRename = (folder: Folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  const commitRename = () => {
    const val = renameValue.trim();
    if (!renamingId || !val) {
      setRenamingId(null);
      return;
    }
    setFolders((prev) =>
      prev.map((f) => (f.id === renamingId ? { ...f, name: val } : f))
    );
    setRenamingId(null);
  };

  const insertTicker = (rawTicker: string) => {
    const raw = rawTicker.trim().toUpperCase();
    if (!raw || !activeFolder) return;
    if (activeFolder.items.some((i) => i.ticker === raw)) {
      return;
    }
    const newItem: WatchItem = {
      id: raw.toLowerCase() + "-" + Date.now().toString(36),
      ticker: raw,
    };
    setFolders((prev) =>
      prev.map((f) =>
        f.id === activeFolder.id ? { ...f, items: [...f.items, newItem] } : f
      )
    );
  };

  const formatChange = (stat: ChangeStats | null | undefined) => {
    if (!stat) return { text: "–", className: "text-[var(--text-muted)]" };
    const sign = stat.changeAbs >= 0 ? "+" : "";
    const cls =
      stat.changeAbs >= 0 ? "text-[var(--green)]" : "text-[var(--red)]";
    const pct = stat.changePct.toFixed(2);
    return { text: `${sign}${pct}%`, className: cls };
  };

  const rangeLabel = useMemo(() => range, [range]);

  return (
    <aside className="flex h-full flex-col rounded border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">Watchlist</h2>
        <div className="flex gap-1">
          {WATCH_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-2 py-0.5 text-xs ${
                r === range
                  ? "bg-[var(--text-muted)] text-[var(--bg)]"
                  : "bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--border)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 max-h-32 overflow-auto rounded border border-[var(--border)] bg-[var(--bg)]">
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => setActiveFolderId(folder.id)}
            className={`flex w-full items-center justify-between px-2 py-1 text-xs text-left ${
              folder.id === activeFolder.id
                ? "bg-[var(--surface)] text-[var(--text)]"
                : "text-[var(--text)] hover:bg-[var(--border)]/70"
            }`}
          >
            <span className="truncate">{folder.name}</span>
            {folder.id === activeFolder.id && (
              <span className="text-[8px] text-[var(--text-muted)]">Active</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-1">
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New folder"
          className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--text-muted)] focus:outline-none"
        />
        <button
          type="button"
          onClick={addFolder}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--border)]"
        >
          Add
        </button>
      </div>

      {activeFolder && (
        <div className="mb-2 flex items-center gap-1">
          {renamingId === activeFolder.id ? (
            <>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] focus:border-[var(--text-muted)] focus:outline-none"
              />
            </>
          ) : (
            <>
              <span className="text-xs text-[var(--text-muted)]">
                Folder: {activeFolder.name}
              </span>
              <button
                type="button"
                onClick={() => startRename(activeFolder)}
                className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[10px] text-[var(--text)] hover:bg-[var(--border)]"
              >
                Rename
              </button>
            </>
          )}
        </div>
      )}

      <div className="mb-2">
        <button
          type="button"
          onClick={() => {
            if (!activeFolder) return;
            onRequestSearchForAdd((ticker) => insertTicker(ticker));
          }}
          className="flex w-full items-center justify-between rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--border)]/70"
        >
          <span>Add ticker to folder</span>
          <span className="text-[10px] text-[var(--text-muted)]">Search</span>
        </button>
      </div>

      <div className="mt-2 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="py-1 text-left font-normal">Symbol</th>
              <th className="py-1 text-right font-normal">{rangeLabel} %</th>
            </tr>
          </thead>
          <tbody>
            {activeItems.map((item) => {
              const stat = changes[item.ticker];
              const { text, className } = formatChange(stat);
              const isLoading = loadingTickers[item.ticker];
              return (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--border)]/60"
                  onClick={() => onSelectTicker(item.ticker)}
                >
                  <td className="py-1 pl-1 pr-2 text-[var(--text)]">
                    {item.ticker}
                  </td>
                  <td className="py-1 pl-2 pr-1 text-right">
                    {isLoading ? (
                      <span className="text-[var(--text-muted)]">…</span>
                    ) : (
                      <span className={className}>{text}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {activeItems.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="py-2 text-center text-[var(--text-muted)]"
                >
                  No symbols in this folder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

