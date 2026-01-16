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

  console.log('[DEBUG billedAmountByCode] Input charges:', JSON.stringify(charges, null, 2));

  if (!Array.isArray(charges)) {
    console.log('[DEBUG billedAmountByCode] charges is not an array, returning empty map');
    return map;
  }

  for (const line of charges) {
    const code = (line?.code || "").trim();
    if (!code) {
      console.log('[DEBUG billedAmountByCode] Skipping line with no code:', line);
      continue;
    }

    // ✅ FIX: AI sometimes returns 'billed' or 'billedAmount' instead of 'amount'
    const raw = line?.amount ?? line?.billed ?? line?.billedAmount;
    console.log(`[DEBUG billedAmountByCode] Code ${code}: raw amount value =`, raw, '| amount:', line?.amount, '| billed:', line?.billed, '| billedAmount:', line?.billedAmount);
    
    let amt: number | null = null;

    if (typeof raw === "number" && isFinite(raw)) amt = raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[$,\s]/g, "").trim();
      const n = parseFloat(cleaned);
      if (isFinite(n)) amt = n;
    }

    if (!amt || amt <= 0) {
      console.log(`[DEBUG billedAmountByCode] Code ${code}: No valid amount found (amt=${amt})`);
      continue;
    }

    const units = typeof line?.units === "number" && isFinite(line.units) && line.units > 0 ? line.units : 1;
    const total = amt * units;

    map[code] = (map[code] || 0) + total;
    console.log(`[DEBUG billedAmountByCode] Code ${code}: Added ${total} (amt=${amt} x units=${units})`);
  }

  console.log('[DEBUG billedAmountByCode] Final map:', JSON.stringify(map, null, 2));
  return map;
}
