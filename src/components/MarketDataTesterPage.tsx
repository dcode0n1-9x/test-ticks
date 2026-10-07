"use client";

import React, { useState, useEffect } from "react";
import { useMarketDataSocket } from "../hooks/useMarketDataSocket";
import { WebSocketControls } from "./WebSocketControls";
import { MarketDataMetrics } from "./MarketDataMetrics";
import { SymbolSearch } from "./SymbolSearch";
import { MarketDataGrid } from "./MarketDataGrid";
import { LogViewer } from "./LogViewer";
import { Activity, ShieldCheck, Sun, Moon } from "lucide-react";

export function MarketDataTesterPage() {
  const {
    sockets,
    addSocket,
    removeSocket,
    updateSocket,
    connectSocket,
    disconnectSocket,
    connectAll,
    disconnectAll,
    overallStatus,
    flushIntervalMs,
    setFlushIntervalMs,
    metrics,
    logs,
    clearData,
    isMockRunning,
    toggleMockGenerator,
    tickStore,
    gridQueue,
  } = useMarketDataSocket("ws://trade.indianifty.com:9001?format=compact");

  const [search, setSearch] = useState<string>("");
  const [filteredCount, setFilteredCount] = useState<number>(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("market_tester_theme") as "dark" | "light" | null;
      if (saved) return saved;
    }
    return "dark";
  });

  // Update HTML root class whenever theme state changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    }
    localStorage.setItem("market_tester_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                WebSocket Live Market Data Tester
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20">
                AG Grid Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Multi-WebSocket collective market data streaming tester with batched AG Grid transactions &amp; single latest symbol state mapping.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark / Light Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-indigo-600" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Tester Utility v2.0 (Multi-WS)</span>
            </div>
          </div>
        </header>

        {/* 1. WebSocket Connection Controls */}
        <section>
          <WebSocketControls
            sockets={sockets}
            addSocket={addSocket}
            removeSocket={removeSocket}
            updateSocket={updateSocket}
            connectSocket={connectSocket}
            disconnectSocket={disconnectSocket}
            connectAll={connectAll}
            disconnectAll={disconnectAll}
            overallStatus={overallStatus}
            flushIntervalMs={flushIntervalMs}
            setFlushIntervalMs={setFlushIntervalMs}
            clearData={clearData}
            isMockRunning={isMockRunning}
            toggleMockGenerator={toggleMockGenerator}
          />
        </section>

        {/* 2. Real-time Market Metrics */}
        <section>
          <MarketDataMetrics metrics={metrics} status={overallStatus} />
        </section>

        {/* 3. Symbol & Description Search */}
        <section>
          <SymbolSearch search={search} setSearch={setSearch} resultCount={filteredCount} />
        </section>

        {/* 4. AG Grid Table */}
        <section>
          <MarketDataGrid
            tickStore={tickStore}
            gridQueue={gridQueue}
            search={search}
            theme={theme}
            onFilteredCountChange={setFilteredCount}
          />
        </section>

        {/* 5. Diagnostics & Event Log Viewer */}
        <section>
          <LogViewer logs={logs} />
        </section>
      </div>
    </div>
  );
}
