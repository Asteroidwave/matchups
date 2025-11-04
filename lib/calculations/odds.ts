/**
 * Odds conversion utilities (ported from Python scripts)
 */

/**
 * Convert fractional odds to decimal
 * Example: "4/1" -> 4.0, "5/2" -> 2.5
 * Note: This matches your Python implementation (no +1)
 */
export function fractionalToDecimal(odds: string | null | undefined): number | null {
  if (!odds) return null;
  
  try {
    const parts = odds.trim().split('/');
    if (parts.length !== 2) return null;
    
    const numerator = parseFloat(parts[0]);
    const denominator = parseFloat(parts[1]);
    
    if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
      return null;
    }
    
    return Math.round((numerator / denominator) * 100) / 100;
  } catch {
    return null;
  }
}

/**
 * Check if a starter is also eligible
 * Matches the logic from PVP.py
 */
export function isAlsoEligible(starter: Record<string, any>): boolean {
  const scratchIndicator = String(starter.scratchIndicator || '').trim().toUpperCase();
  if (scratchIndicator === 'A') return true;
  
  // Check various field names for also eligible flag
  const alsoEligibleFields = [
    'alsoEligible',
    'also_eligible',
    'alsoEligibleIndicator',
    'isAlsoEligible',
    'alsoEligibleFlag',
  ];
  
  for (const field of alsoEligibleFields) {
    if (starter[field] === true) return true;
  }
  
  // Check string fields for "also eligible" keywords
  const stringFields = ['status', 'entryType', 'notes', 'comments', 'conditions'];
  for (const field of stringFields) {
    const value = starter[field];
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower.includes('also') && lower.includes('elig')) {
        return true;
      }
    }
  }
  
  return false;
}

