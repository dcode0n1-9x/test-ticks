import { Tick } from "./types";

/**
 * Normalizes incoming array-based row data into a canonical Tick structure.
 *
 * Array mapping:
 * Index 0: Symbol ("PEPUS")
 * Index 1: Description ("PEPUS.sp")
 * Index 2: LTP ("140.035")
 * Index 3: Bid ("140.02")
 * Index 4: Ask ("140.05")
 * Index 5: Open ("0")
 * Index 6: High ("0")
 * Index 7: Low ("0")
 * Index 8: Previous Close ("0")
 * Index 9: Timestamp ("2026-08-13 T 14:06:13" or timestamp number)
 * Index 10: Extra ("")
 */
export function mapRowToTick(row: any): Tick {
  if (!Array.isArray(row)) {
    return {
      symbol: "",
      description: "",
      ltp: 0,
      bid: 0,
      ask: 0,
      open: 0,
      high: 0,
      low: 0,
      prevClose: 0,
      timestamp: Date.now(),
      extra: "",
    };
  }

  const rawTs = row[9];
  let ts = Date.now();

  if (typeof rawTs === "number") {
    ts = rawTs;
  } else if (typeof rawTs === "string" && rawTs.trim().length > 0) {
    // Handle space inside timestamp string if needed, e.g. "2026-08-13 T 14:06:13" -> "2026-08-13T14:06:13"
    const cleanedTs = rawTs.replace(/\s+/g, "");
    const parsed = Date.parse(cleanedTs);
    if (Number.isFinite(parsed)) {
      ts = parsed;
    } else {
      const fallbackParsed = Date.parse(rawTs);
      if (Number.isFinite(fallbackParsed)) {
        ts = fallbackParsed;
      }
    }
  }

  return {
    symbol: String(row[0] ?? "").trim(),
    description: String(row[1] ?? "").trim(),
    ltp: Number(row[2] ?? 0),
    bid: Number(row[3] ?? 0),
    ask: Number(row[4] ?? 0),
    open: Number(row[5] ?? 0),
    high: Number(row[6] ?? 0),
    low: Number(row[7] ?? 0),
    prevClose: Number(row[8] ?? 0),
    timestamp: Number.isFinite(ts) ? ts : Date.now(),
    extra: String(row[10] ?? ""),
  };
}

/**
 * Calculates daily percentage change based on LTP and prevClose.
 * Returns 0 if prevClose <= 0 to avoid division by zero.
 */
export function calculateDailyChange(tick: Tick): number {
  if (!tick.prevClose || tick.prevClose <= 0) {
    return 0;
  }
  return ((tick.ltp - tick.prevClose) / tick.prevClose) * 100;
}

/**
 * Formats price value preserving precise incoming numbers without forced rounding.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return value.toString();
}
