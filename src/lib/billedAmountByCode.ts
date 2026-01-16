export function buildBilledAmountByCode(
  charges: Array<{
    code?: string | null;
    amount?: number | string | null;
    billed?: number | string | null;
    billedAmount?: number | string | null;
    units?: number | null;
  }>,
): Record<string, number> {
  const map: Record<string, number> = {};

  if (!Array.isArray(charges)) return map;

  for (const line of charges) {
    const code = (line?.code || "").trim();
    if (!code) continue;

    // ✅ FIX: AI sometimes returns 'billed' or 'billedAmount' instead of 'amount'
    const raw = line?.amount ?? line?.billed ?? line?.billedAmount;
    // ... rest of code
    let amt: number | null = null;

    if (typeof raw === "number" && isFinite(raw)) amt = raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[$,\s]/g, "").trim();
      const n = parseFloat(cleaned);
      if (isFinite(n)) amt = n;
    }

    if (!amt || amt <= 0) continue;

    const units = typeof line?.units === "number" && isFinite(line.units) && line.units > 0 ? line.units : 1;
    const total = amt * units;

    map[code] = (map[code] || 0) + total;
  }

  return map;
}
