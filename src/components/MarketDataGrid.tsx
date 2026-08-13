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
import { SlidersHorizontal } from "lucide-react";

// Register all community modules for AG Grid v36
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

  const gridThemeClass = theme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz";

  // Column definitions with clean inherited text colors for crisp readability on dark/light themes
  const columnDefs = useMemo<ColDef<Tick>[]>(() => {
    const baseCols: ColDef<Tick>[] = [
      {
        field: "symbol",
        headerName: "Symbol",
        sortable: true,
        sort: "asc",
        pinned: "left",
        width: 130,
        cellClass: "font-mono font-bold",
      },
      {
        field: "description",
        headerName: "Description",
        sortable: true,
        width: 190,
        cellClass: "font-sans text-xs sm:text-sm opacity-90",
      },
      {
        field: "bid",
        headerName: "Bid",
        sortable: true,
        width: 110,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        enableCellChangeFlash: true,
        cellClass: "font-mono font-semibold text-emerald-600 dark:text-emerald-400",
      },
      {
        field: "ask",
        headerName: "Ask",
        sortable: true,
        width: 110,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        enableCellChangeFlash: true,
        cellClass: "font-mono font-semibold text-rose-600 dark:text-rose-400",
      },
      {
        headerName: "Daily Change",
        sortable: true,
        width: 120,
        type: "numericColumn",
        valueGetter: (params) => (params.data ? calculateDailyChange(params.data) : 0),
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => {
          const val = params.value ?? 0;
          if (val === 0) return "0.00%";
          return `${val > 0 ? "+" : ""}${val.toFixed(2)}%`;
        },
        cellClass: (params: CellClassParams<Tick, number>) => {
          const val = params.value ?? 0;
          if (val > 0) return "font-mono font-semibold text-emerald-600 dark:text-emerald-400";
          if (val < 0) return "font-mono font-semibold text-rose-600 dark:text-rose-400";
          return "font-mono opacity-60";
        },
      },
    ];

    if (!showAllColumns) {
      return baseCols;
    }

    const extendedCols: ColDef<Tick>[] = [
      ...baseCols,
      {
        field: "ltp",
        headerName: "LTP",
        sortable: true,
        width: 110,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        enableCellChangeFlash: true,
        cellClass: "font-mono font-medium opacity-90",
      },
      {
        field: "open",
        headerName: "Open",
        sortable: true,
        width: 100,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "font-mono opacity-70 text-xs",
      },
      {
        field: "high",
        headerName: "High",
        sortable: true,
        width: 100,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "font-mono opacity-70 text-xs",
      },
      {
        field: "low",
        headerName: "Low",
        sortable: true,
        width: 100,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "font-mono opacity-70 text-xs",
      },
      {
        field: "prevClose",
        headerName: "Prev Close",
        sortable: true,
        width: 110,
        type: "numericColumn",
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => formatPrice(params.value ?? 0),
        cellClass: "font-mono opacity-70 text-xs",
      },
      {
        field: "timestamp",
        headerName: "Timestamp",
        sortable: true,
        width: 160,
        valueFormatter: (params: ValueFormatterParams<Tick, number>) => {
          if (!params.value) return "—";
          const date = new Date(params.value);
          return date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            fractionalSecondDigits: 3,
          });
        },
        cellClass: "font-mono text-xs opacity-60",
      },
    ];

    return extendedCols;
  }, [showAllColumns]);

  // Handle grid ready & responsive column sizing
  const onGridReady = useCallback(
    (params: GridReadyEvent<Tick>) => {
      setGridApi(params.api);
      gridQueue.setGridApi(params.api);

      // Initial load from tickStore
      const initialRows = tickStore.getAll();
      params.api.setGridOption("rowData", initialRows);

      if (search) {
        params.api.setGridOption("quickFilterText", search);
      }
    },
    [gridQueue, search, tickStore]
  );

  // Sync quickFilterText whenever search prop changes
  useEffect(() => {
    if (gridApi) {
      gridApi.setGridOption("quickFilterText", search);
    }
  }, [gridApi, search]);

  // Update parent with displayed row count on model changes
  const onModelUpdated = () => {
    if (gridApi && onFilteredCountChange) {
      onFilteredCountChange(gridApi.getDisplayedRowCount());
    }
  };

  // Unique Row ID mapping according to Section 6
  const getRowId = (params: GetRowIdParams<Tick>) => params.data.symbol;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm flex flex-col transition-colors duration-200">
      {/* Grid Toolbar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Grid Options</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] sm:text-xs">
            <input
              type="checkbox"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
            />
            Extended Columns (LTP, Open, High, Low, PrevClose, Timestamp)
          </label>
        </div>
      </div>

      {/* AG Grid Container with responsive height and theme class */}
      <div className={`w-full h-[450px] sm:h-[540px] ${gridThemeClass} transition-colors duration-200`}>
        <AgGridReact<Tick>
          columnDefs={columnDefs}
          getRowId={getRowId}
          onGridReady={onGridReady}
          onModelUpdated={onModelUpdated}
          defaultColDef={{
            sortable: true,
            resizable: true,
            filter: true,
            enableCellChangeFlash: true,
          }}
          animateRows={false} // turned off for maximum high frequency streaming performance
          rowBuffer={20}
          suppressCellFocus={true}
        />
      </div>
    </div>
  );
};
