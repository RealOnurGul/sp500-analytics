"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { label: "Explore", href: "/explore/correlations" },
  { label: "Analyze", href: "/analyze/pair" },
  { label: "Algorithms", href: "/algorithms/pairs-mean-reversion" },
];

export default function TradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="flex shrink-0 items-center gap-6 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2">
        <Link href="/" className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
          ← Charts
        </Link>
        <nav className="flex gap-1">
          {NAV.map((item) => {
            const segment = item.href.split("/")[1];
            const isActive = segment ? pathname.startsWith(`/${segment}`) : pathname === item.href;
            return (
              <div key={item.label} className="relative">
                <Link
                  href={item.href}
                  className={`block rounded px-3 py-1.5 text-sm font-medium ${
                    isActive ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
