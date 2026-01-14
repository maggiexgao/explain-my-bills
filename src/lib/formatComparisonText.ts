export function formatBillVsReferenceSentence(bill: number, reference: number): string {
  if (!isFinite(bill) || !isFinite(reference) || bill <= 0 || reference <= 0) {
    return '';
  }

  const ratio = bill / reference;

  if (ratio >= 1) {
    return `Your bill of $${bill.toFixed(0)} is about ${ratio.toFixed(2)}× higher than this reference price.`;
  }

  const pctLower = (1 - ratio) * 100;
  return `Your bill of $${bill.toFixed(0)} is about ${ratio.toFixed(2)}× of this reference price (about ${pctLower.toFixed(
    0
  )}% lower).`;
}
