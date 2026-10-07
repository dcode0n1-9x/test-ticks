"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  ColDef,
  GridApi,
  GetRowIdParams,
  GridReadyEvent,
  ValueFormatterParams,
  CellClassParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { TickStore } from "../market-data/tickStore";
import { GridUpdateQueue } from "../market-data/gridUpdateQueue";
import { calculateDailyChange, formatPrice } from "../market-data/mapRowToTick";
import { Tick } from "../market-data/types";
import {
  SlidersHorizontal,
  Zap,
  Maximize2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

// Register all community modules for AG Grid v36 once
ModuleRegistry.registerModules([AllCommunityModule]);

interface MarketDataGridProps {
  tickStore: TickStore;
  gridQueue: GridUpdateQueue;
  search: string;
  theme: "dark" | "light";
  onFilteredCountChange?: (count: number) => void;
}

export const MarketDataGrid: React.FC<MarketDataGridProps> = ({
  tickStore,
  gridQueue,
  search,
  theme,
  onFilteredCountChange,
}) => {
  const [gridApi, setGridApi] = useState<GridApi<Tick> | null>(null);
  const [showAllColumns, setShowAllColumns] = useState<boolean>(true);
  const [cellFlashEnabled, setCellFlashEnabled] = useState<boolean>(true);

  const gridThemeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  // Pre-compiled column definitions for maximum throughput
  const columnDefs = useMemo<ColDef<Tick>[]>(() => {
    const baseCols: ColDef<Tick>[] = [
      {
        field: "symbol",
        headerName: "Symbol",
        sortable: true,
        sort: "asc",
        pinned: "left",
        width: 125,
        minWidth: 100,
        suppressMovable: true,
        cellClass: "cell-symbol",
      },
      {
        field: "description",
        headerName: "Description",
        sortable: true,
        width: 170,
        minWidth: 120,
        valueFormatter: (params: ValueFormatterParams<Tick, string>) => {
          const val = params.value;
          if (!val || val === "0") return "—";
          return val;
        },
        cellClass: (params: CellClassParams<Tick, string>) => {
          const val = params.value;
          if (!val || val === "0") return "cell-description cell-description-empty";
          return "cell-description truncate";
        },
      },
      {
        field: "bid",
        headerName: "Bid",
        sortable: true,
        width: 105,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        enableCellChangeFlash: cellFlashEnabled,
        cellClass: "cell-bid",
      },
      {
        field: "ask",
        headerName: "Ask",
        sortable: true,
        width: 105,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        enableCellChangeFlash: cellFlashEnabled,
        cellClass: "cell-ask",
      },
      {
        field: "ltp",
        headerName: "LTP",
        sortable: true,
        width: 125,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => {
          const p = formatPrice(params.value ?? 0);
          const dir = params.data?.direction;
          if (dir === "up") return `${p} ▲`;
          if (dir === "down") return `${p} ▼`;
          return p;
        },
        cellClass: (params: CellClassParams<Tick, number>) => {
          const dir = params.data?.direction;
          if (dir === "up") return "cell-ltp-up";
          if (dir === "down") return "cell-ltp-down";
          return "cell-ltp-neutral";
        },
        enableCellChangeFlash: cellFlashEnabled,
      },
      {
        field: "dailyChange",
        headerName: "Change %",
        sortable: true,
        width: 115,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => {
          const val = params.value ?? (params.data ? calculateDailyChange(params.data) : 0);
          if (val === 0) return "0.00%";
          return `${val > 0 ? "+" : ""}${val.toFixed(2)}%`;
        },
        cellClass: (params: CellClassParams<Tick, number>) => {
          const val = params.value ?? (params.data ? calculateDailyChange(params.data) : 0);
          if (val > 0) return "cell-change-up";
          if (val < 0) return "cell-change-down";
          return "cell-change-neutral";
        },
        enableCellChangeFlash: cellFlashEnabled,
      },
    ];

    if (!showAllColumns) {
      return baseCols;
    }

    const extendedCols: ColDef<Tick>[] = [
      ...baseCols,
      {
        field: "open",
        headerName: "Open",
        sortable: true,
        width: 100,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "cell-num",
      },
      {
        field: "high",
        headerName: "High",
        sortable: true,
        width: 100,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "cell-num",
      },
      {
        field: "low",
        headerName: "Low",
        sortable: true,
        width: 100,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "cell-num",
      },
      {
        field: "prevClose",
        headerName: "Prev Close",
        sortable: true,
        width: 110,
        type: "numericColumn",
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "cell-num",
      },
      {
        field: "source",
        headerName: "Feed Source",
        sortable: true,
        width: 140,
        valueFormatter: (params: ValueFormatterParams<Tick, string>) => params.value || "—",
        cellClass: "cell-source",
      },
      {
        field: "timestamp",
        headerName: "Timestamp",
        sortable: true,
        width: 130,
        filter: false,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => {
          return params.data?.formattedTime || (params.value ? new Date(params.value).toLocaleTimeString() : "—");
        },
        cellClass: "cell-timestamp",
      },
    ];

    return extendedCols;
  }, [showAllColumns, cellFlashEnabled]);

  // Handle grid ready
  const onGridReady = useCallback(
    (params: GridReadyEvent<Tick>) => {
      setGridApi(params.api);
      gridQueue.setGridApi(params.api);

      // Initial fast load from tickStore
      const initialRows = tickStore.getAll();
      params.api.setGridOption("rowData", initialRows);

      if (search) {
        params.api.setGridOption("quickFilterText", search);
      }
    },
    [gridQueue, search, tickStore]
  );

  // Instant search filtering with zero delay
  useEffect(() => {
    if (!gridApi) return;
    gridApi.setGridOption("quickFilterText", search);
  }, [gridApi, search]);

  // Update parent with displayed row count on model changes
  const onModelUpdated = useCallback(() => {
    if (gridApi && onFilteredCountChange) {
      onFilteredCountChange(gridApi.getDisplayedRowCount());
    }
  }, [gridApi, onFilteredCountChange]);

  // Unique Row ID mapping
  const getRowId = useCallback((params: GetRowIdParams<Tick>) => params.data.symbol, []);

  // Quick action: Fit all columns to view
  const handleFitColumns = useCallback(() => {
    if (gridApi) {
      gridApi.sizeColumnsToFit();
    }
  }, [gridApi]);

  // Quick action: Reset column sorting
  const handleResetSort = useCallback(() => {
    if (gridApi) {
      gridApi.applyColumnState({
        defaultState: { sort: null },
      });
    }
  }, [gridApi]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors duration-200">
      {/* Grid Toolbar & Performance Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Market Data Engine</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span>60fps Virtualized AG Grid</span>
          </div>
        </div>

        {/* Quick Toolbar Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Extended Columns Toggle */}
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] sm:text-xs">
            <input
              type="checkbox"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
            />
            Extended Columns
          </label>

          {/* Flash Toggle */}
          <button
            type="button"
            onClick={() => setCellFlashEnabled((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer border ${
              cellFlashEnabled
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
            title="Toggle real-time visual flash on cell updates"
          >
            <Sparkles className="h-3 w-3" />
            {cellFlashEnabled ? "Flash On" : "Flash Off"}
          </button>

          {/* Fit Width */}
          <button
            type="button"
            onClick={handleFitColumns}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-medium transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700/60"
            title="Auto-fit columns to container"
          >
            <Maximize2 className="h-3 w-3" />
            Fit Width
          </button>

          {/* Reset Sort */}
          <button
            type="button"
            onClick={handleResetSort}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-medium transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700/60"
            title="Reset column sorting"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Sort
          </button>
        </div>
      </div>

      {/* AG Grid Container with responsive height and GPU hardware acceleration */}
      <div className={`w-full h-[450px] sm:h-[540px] ${gridThemeClass} transition-colors duration-200`}>
        <AgGridReact<Tick>
          columnDefs={columnDefs}
          getRowId={getRowId}
          onGridReady={onGridReady}
          onModelUpdated={onModelUpdated}
          defaultColDef={{
            sortable: true,
            resizable: true,
            enableCellChangeFlash: cellFlashEnabled,
          }}
          headerHeight={38}
          rowHeight={38}
          animateRows={false}
          rowBuffer={10}
          suppressCellFocus={true}
          suppressScrollOnNewData={true}
          deltaSort={true}
          suppressMaintainUnsortedOrder={true}
          suppressFieldDotNotation={true}
          includeHiddenColumnsInQuickFilter={false}
          debounceVerticalScrollbar={true}
          suppressDragLeaveHidesColumns={true}
          asyncTransactionWaitMillis={0}
          cellFlashDuration={300}
          cellFadeDuration={500}
        />
      </div>
    </div>
  );
};
