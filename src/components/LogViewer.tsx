"use client";

import React, { useState } from "react";
import { LogEntry } from "../market-data/types";
import { Terminal, ChevronDown, ChevronUp, AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
      case "warn":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
      case "info":
      default:
        return <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-950 text-left transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Tester Diagnostics & Event Logs
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {logs.length} events
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>{isOpen ? "Hide" : "Show"}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 font-mono text-xs max-h-60 overflow-y-auto space-y-1.5">
          {logs.length === 0 ? (
            <div className="text-zinc-500 italic py-2">No event logs recorded yet. Connect to a WebSocket or start the mock feed.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-zinc-300 hover:bg-zinc-900/80 p-1 rounded transition-colors">
                <span className="text-zinc-500 text-[11px] shrink-0 font-sans">[{log.time}]</span>
                {getLogIcon(log.type)}
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
