import { Tick } from "./types";

/**
 * In-memory store that maintains only the latest tick per symbol.
 * Serves as the single source of truth for symbol states.
 */
export class TickStore {
  private ticksBySymbol = new Map<string, Tick>();

  public get(symbol: string): Tick | undefined {
    return this.ticksBySymbol.get(symbol);
  }

  public set(tick: Tick): boolean {
    const prev = this.ticksBySymbol.get(tick.symbol);
    const exists = prev !== undefined;

    if (prev) {
      if (tick.ltp > prev.ltp) {
        tick.direction = "up";
      } else if (tick.ltp < prev.ltp) {
        tick.direction = "down";
      } else {
        tick.direction = prev.direction ?? "neutral";
      }
    } else {
      tick.direction = "neutral";
    }

    this.ticksBySymbol.set(tick.symbol, tick);
    return exists;
  }

  public has(symbol: string): boolean {
    return this.ticksBySymbol.has(symbol);
  }

  public getAll(): Tick[] {
    return Array.from(this.ticksBySymbol.values());
  }

  public size(): number {
    return this.ticksBySymbol.size;
  }

  public clear(): void {
    this.ticksBySymbol.clear();
  }

  public getMap(): Map<string, Tick> {
    return this.ticksBySymbol;
  }
}
