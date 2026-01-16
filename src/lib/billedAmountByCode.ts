export function buildBilledAmountByCode(
  charges: Array<{
    code?: string | null;
    id?: string | null;
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
    const code = (line?.code || line?.id || "").trim();
    if (!code) {
      console.log('[DEBUG billedAmountByCode] Skipping line with no code or id:', line);
      continue;
    }
    
    // ✅ CRITICAL FIX: Try ALL possible field names and log what we find
    const raw = line?.amount ?? line?.billedAmount ?? line?.billed;
    
    console.log(`[DEBUG billedAmountByCode] Code ${code}: checking fields...`);
    console.log(`  - line.amount = ${line?.amount}`);
    console.log(`  - line.billedAmount = ${line?.billedAmount}`);
    console.log(`  - line.billed = ${line?.billed}`);
    console.log(`  - raw (selected) = ${raw}`);
    
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
    
    console.log(`[DEBUG billedAmountByCode] Code ${code}: Successfully added ${total} (amt=${amt} x units=${units})`);
  }
  
  console.log('[DEBUG billedAmountByCode] Final map:', JSON.stringify(map, null, 2));
  return map;
}
```

This version adds **detailed logging** for each charge to show us exactly which fields exist and which don't. 

After you update this file and upload the bill again, you'll see logs like:
```
[DEBUG billedAmountByCode] Code 0110: checking fields...
  - line.amount = 1545.34
  - line.billedAmount = undefined
  - line.billed = undefined
  - raw (selected) = 1545.34