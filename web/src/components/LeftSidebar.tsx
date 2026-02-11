"use client";

import Link from "next/link";

interface LeftSidebarProps {
  onOpenSearch: (mode: "chart" | "watchlist") => void;
}

export function LeftSidebar({ onOpenSearch }: LeftSidebarProps) {
  return (
    <aside className="sidebar flex h-full w-[64px] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
      <div className="flex h-14 items-center justify-center border-b border-[var(--sidebar-border)]">
        <span className="text-sm font-semibold text-[var(--sidebar-text)]">
          S&P
        </span>
      </div>
      <nav className="flex flex-1 flex-col items-center gap-2 py-3">
        <button
          type="button"
          onClick={() => onOpenSearch("chart")}
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
          title="Search"
        >
          <svg
            className="h-5 w-5 opacity-80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
        <Link
          href="/explore/correlations"
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
          title="Explore correlations"
        >
          <svg className="h-5 w-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </Link>
      </nav>
    </aside>
  );
}
