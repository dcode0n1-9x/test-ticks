import { GridApi } from "ag-grid-community";
import { Tick } from "./types";

/**
 * Batches incoming ticks into pending adds and updates,
 * periodically applying transactions asynchronously to AG Grid.
 * Prevents high frequency socket messages from choking React or AG Grid.
 */
export class GridUpdateQueue {
  private pendingAdds = new Map<string, Tick>();
  private pendingUpdates = new Map<string, Tick>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private gridApi: GridApi | null = null;
  private flushIntervalMs: number;

  constructor(flushIntervalMs: number = 50) {
    this.flushIntervalMs = flushIntervalMs;
  }

  public setGridApi(api: GridApi | null) {
    this.gridApi = api;
  }

  public setFlushInterval(ms: number) {
    this.flushIntervalMs = ms;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  public queueTick(tick: Tick, alreadyExists: boolean) {
    if (alreadyExists) {
      this.pendingUpdates.set(tick.symbol, tick);
    } else {
      this.pendingAdds.set(tick.symbol, tick);
    }
  }

  public start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public flush() {
    if (!this.gridApi) return;
    if (this.pendingAdds.size === 0 && this.pendingUpdates.size === 0) {
      return;
    }

    const adds = Array.from(this.pendingAdds.values());
    const updates = Array.from(this.pendingUpdates.values());

    this.gridApi.applyTransactionAsync({
      add: adds,
      update: updates,
    });

    this.pendingAdds.clear();
    this.pendingUpdates.clear();
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
