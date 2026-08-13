"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface SymbolSearchProps {
  search: string;
  setSearch: (value: string) => void;
  resultCount?: number;
}

export const SymbolSearch: React.FC<SymbolSearchProps> = ({ search, setSearch, resultCount }) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-zinc-400" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search by symbol or description (e.g. PEP, PEPUS, HG, SI, GOLD...)"
          className="w-full pl-9 pr-9 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {resultCount !== undefined && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono px-1 shrink-0">
          Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{resultCount}</span> matching instruments
        </div>
      )}
    </div>
  );
};
