import { GridApi } from "ag-grid-community";
import { Tick } from "./types";

/**
 * High-performance transaction batching queue for AG Grid.
 *
 * Coalesces microsecond WebSocket tick events into debounced transaction batches,
 * eliminating duplicate pending transactions, preventing layout thrashing, and
 * delivering silky smooth 60fps rendering under heavy streaming loads.
 */
export class GridUpdateQueue {
  private pendingAdds = new Map<string, Tick>();
  private pendingUpdates = new Map<string, Tick>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private gridApi: GridApi<Tick> | null = null;
  private flushIntervalMs: number;
  private isFlushing = false;

  constructor(flushIntervalMs: number = 0) {
    this.flushIntervalMs = flushIntervalMs;
  }

  public setGridApi(api: GridApi<Tick> | null) {
    this.gridApi = api;
    if (this.isZeroDelay()) {
      this.flushSync();
    }
  }

  public setFlushInterval(ms: number) {
    this.flushIntervalMs = ms;
    this.stop();
    if (ms > 0) {
      this.start();
    } else {
      this.flushSync();
    }
  }

  public isZeroDelay(): boolean {
    return this.flushIntervalMs <= 0;
  }

  /**
   * Enqueues a tick.
   * If a symbol is already queued in pendingAdds, it updates the existing pending add
   * instead of adding to pendingUpdates, preventing duplicate key transaction collisions.
   */
  public queueTick(tick: Tick, alreadyExists: boolean) {
    if (this.pendingAdds.has(tick.symbol)) {
      this.pendingAdds.set(tick.symbol, tick);
    } else if (alreadyExists) {
      this.pendingUpdates.set(tick.symbol, tick);
    } else {
      this.pendingAdds.set(tick.symbol, tick);
    }
  }

  public start() {
    if (this.flushIntervalMs <= 0) return;
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Flushes queued additions and updates asynchronously to AG Grid.
   */
  public flush() {
    if (!this.gridApi || this.isFlushing) return;
    if (this.pendingAdds.size === 0 && this.pendingUpdates.size === 0) {
      return;
    }

    this.isFlushing = true;
    try {
      const tx: { add?: Tick[]; update?: Tick[] } = {};

      if (this.pendingAdds.size > 0) {
        tx.add = Array.from(this.pendingAdds.values());
        this.pendingAdds.clear();
      }

      if (this.pendingUpdates.size > 0) {
        tx.update = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();
      }

      // Dispatch async transaction to AG Grid
      this.gridApi.applyTransactionAsync(tx);
    } catch {
      // Catch any transient grid update issues gracefully
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Synchronous flush for immediate updates (e.g. initial loads).
   */
  public flushSync() {
    if (!this.gridApi) return;
    if (this.pendingAdds.size === 0 && this.pendingUpdates.size === 0) return;

    try {
      const tx: { add?: Tick[]; update?: Tick[] } = {};
      if (this.pendingAdds.size > 0) {
        tx.add = Array.from(this.pendingAdds.values());
        this.pendingAdds.clear();
      }
      if (this.pendingUpdates.size > 0) {
        tx.update = Array.from(this.pendingUpdates.values());
        this.pendingUpdates.clear();
      }
      this.gridApi.applyTransaction(tx);
    } catch {
      // ignore
    }
  }

  public clear() {
    this.pendingAdds.clear();
    this.pendingUpdates.clear();
  }

  public getPendingCounts() {
    return {
      adds: this.pendingAdds.size,
      updates: this.pendingUpdates.size,
    };
  }
}
