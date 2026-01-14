import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============= SAFE FORMATTING UTILITIES =============

/**
 * Safely format currency amount, handling null/undefined gracefully
 */
export function formatAmount(
  amount: number | null | undefined,
  options?: {
    showZero?: boolean; // Default: false
    placeholder?: string; // Default: "Not detected"
    prefix?: string; // Default: "$"
  },
): string {
  const { showZero = false, placeholder = "Not detected", prefix = "$" } = options || {};

  if (amount === null || amount === undefined) {
    return placeholder;
  }

  if (amount === 0) {
    return showZero ? `${prefix}0.00` : placeholder;
  }

  return `${prefix}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Safely calculate and format multiple (billed / reference ratio)
 */
export function formatMultiple(billed: number | null | undefined, reference: number | null | undefined): string {
  if (!billed || !reference || reference === 0) {
    return "Unable to calculate";
  }

  const multiple = billed / reference;
  return `${multiple.toFixed(2)}×`;
}

/**
 * Safely format percentage
 */
export function formatPercent(
  value: number | null | undefined,
  options?: {
    isDecimal?: boolean; // Default: true - value is 0-1
    decimals?: number; // Default: 0
    placeholder?: string; // Default: "Not available"
  },
): string {
  const { isDecimal = true, decimals = 0, placeholder = "Not available" } = options || {};

  if (value === null || value === undefined) {
    return placeholder;
  }

  const percent = isDecimal ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Format comparison status based on multiple
 */
export function formatComparisonStatus(multiple: number | null | undefined): {
  status: "fair" | "high" | "very_high" | "unknown";
  label: string;
  color: "green" | "yellow" | "red" | "gray";
} {
  if (multiple === null || multiple === undefined) {
    return {
      status: "unknown",
      label: "Unable to determine",
      color: "gray",
    };
  }

  if (multiple <= 2.0) {
    return {
      status: "fair",
      label: "Fair (within 2× Medicare)",
      color: "green",
    };
  } else if (multiple <= 3.0) {
    return {
      status: "high",
      label: "High (2-3× Medicare)",
      color: "yellow",
    };
  } else {
    return {
      status: "very_high",
      label: "Very High (over 3× Medicare)",
      color: "red",
    };
  }
}

/**
 * Format difference between two amounts
 */
export function formatDifference(amount1: number | null | undefined, amount2: number | null | undefined): string {
  if (amount1 === null || amount1 === undefined || amount2 === null || amount2 === undefined) {
    return "Unable to calculate";
  }

  const diff = amount1 - amount2;
  const sign = diff >= 0 ? "+" : "";
  const formatted = formatAmount(Math.abs(diff));

  return formatted === "Not detected" ? "Unable to calculate" : `${sign}${formatted}`;
}

/**
 * Validate that a comparison is meaningful
 */
export function validateComparison(
  billedTotal: number | null | undefined,
  medicareTotal: number | null | undefined,
  options?: {
    minBilled?: number;
    minMedicare?: number;
    maxRatio?: number;
  },
): {
  isValid: boolean;
  warnings: string[];
  canCompare: boolean;
} {
  const { minBilled = 1, minMedicare = 1, maxRatio = 100 } = options || {};

  const warnings: string[] = [];
  let isValid = true;
  let canCompare = true;

  if (billedTotal === null || billedTotal === undefined) {
    warnings.push("Billed amount not detected");
    canCompare = false;
    isValid = false;
  }

  if (medicareTotal === null || medicareTotal === undefined) {
    warnings.push("Medicare reference not calculated");
    canCompare = false;
    isValid = false;
  }

  if (!canCompare) {
    return { isValid, warnings, canCompare };
  }

  if (billedTotal! < minBilled) {
    warnings.push("Billed amount is too small for reliable comparison");
    isValid = false;
  }

  if (medicareTotal! < minMedicare) {
    warnings.push("Medicare reference is too small for reliable comparison");
    isValid = false;
  }

  const ratio = billedTotal! / medicareTotal!;
  if (ratio > maxRatio) {
    warnings.push(`Ratio (${ratio.toFixed(0)}×) is unusually high - check for data errors`);
    isValid = false;
  }

  if (ratio < 0.1) {
    warnings.push("Billed amount is much lower than Medicare - may be patient balance after insurance");
    isValid = false;
  }

  return { isValid, warnings, canCompare };
}
