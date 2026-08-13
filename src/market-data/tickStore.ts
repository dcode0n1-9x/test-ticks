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
    const exists = this.ticksBySymbol.has(tick.symbol);
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
