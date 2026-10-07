import { Tick } from "./types";

// Cached high-speed time formatter instance to avoid recurring object creation
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});

export function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  try {
    return timeFormatter.format(ts);
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

/**
 * Normalizes incoming array-based row data into a canonical Tick structure.
 *
 * Precomputes dailyChange and formattedTime on ingestion to ensure O(1)
 * zero-overhead cell rendering in AG Grid.
 */
export function mapRowToTick(row: unknown, source?: string): Tick {
  if (!Array.isArray(row)) {
    const now = Date.now();
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
      timestamp: now,
      extra: "",
      source: source || "",
      dailyChange: 0,
      direction: "neutral",
      formattedTime: formatTimestamp(now),
    };
  }

  const rawTs = row[9];
  let ts = Date.now();

  if (typeof rawTs === "number") {
    ts = rawTs;
  } else if (typeof rawTs === "string" && rawTs.trim().length > 0) {
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

  const finalTs = Number.isFinite(ts) ? ts : Date.now();
  const ltp = Number(row[2] ?? 0);
  const prevClose = Number(row[8] ?? 0);
  const dailyChange = prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;

  const rawDesc = row[1];
  const cleanedDescription =
    rawDesc === 0 || rawDesc === "0" || rawDesc == null
      ? ""
      : String(rawDesc).trim();

  return {
    symbol: String(row[0] ?? "").trim(),
    description: cleanedDescription,
    ltp,
    bid: Number(row[3] ?? 0),
    ask: Number(row[4] ?? 0),
    open: Number(row[5] ?? 0),
    high: Number(row[6] ?? 0),
    low: Number(row[7] ?? 0),
    prevClose,
    timestamp: finalTs,
    extra: String(row[10] ?? ""),
    source: source || "",
    dailyChange,
    direction: "neutral",
    formattedTime: formatTimestamp(finalTs),
  };
}

/**
 * Calculates daily percentage change based on LTP and prevClose.
 * Returns 0 if prevClose <= 0 to avoid division by zero.
 */
export function calculateDailyChange(tick: Tick): number {
  if (typeof tick.dailyChange === "number") {
    return tick.dailyChange;
  }
  if (!tick.prevClose || tick.prevClose <= 0) {
    return 0;
  }
  return ((tick.ltp - tick.prevClose) / tick.prevClose) * 100;
}

/**
 * Formats price value with tabular precision, ensuring aligned 2-decimal minimum while preserving sub-cent values.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return "0.00";
  }
  const str = value.toString();
  const dotIndex = str.indexOf(".");
  if (dotIndex === -1) {
    return value.toFixed(2);
  }
  const decimals = str.length - dotIndex - 1;
  if (decimals === 1) {
    return value.toFixed(2);
  }
  return str;
}
