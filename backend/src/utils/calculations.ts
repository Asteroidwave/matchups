/**
 * Calculation utilities (ported from Python scripts)
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

/**
 * Calculate salary based on decimal odds
 * Matches Talha's salary calculation method from unified_matchup_generator.py
 */
export function calculateSalaryBasedOnOdds(
  odds: number | null | undefined,
  isAlsoEligible: boolean = false
): number {
  if (!odds || odds <= 0) return 0;
  
  // Also Eligible handling (from Python code - exact match)
  if (isAlsoEligible) {
    if (0 <= odds && odds <= 5.99) return 300;
    if (6.0 <= odds && odds <= 12.99) return 200;
    if (odds >= 13.0) return 100;
    return 100;
  }
  
  // Regular salary bins (Talha's method - exact match from unified_matchup_generator.py)
  if (0.01 <= odds && odds <= 0.79) return 2600;
  if (0.8 <= odds && odds <= 0.99) return 2500;
  if (1.0 <= odds && odds <= 1.19) return 2400;
  if (1.2 <= odds && odds <= 1.39) return 2300;
  if (1.4 <= odds && odds <= 1.59) return 2200;
  if (1.6 <= odds && odds <= 1.79) return 2100;
  if (1.8 <= odds && odds <= 1.99) return 2000;
  if (2.0 <= odds && odds <= 2.49) return 1900;
  if (2.5 <= odds && odds <= 2.99) return 1700;
  if (3.0 <= odds && odds <= 3.49) return 1600;
  if (3.5 <= odds && odds <= 3.99) return 1500;
  if (4.0 <= odds && odds <= 4.49) return 1400;
  if (4.5 <= odds && odds <= 5.99) return 1300;
  if (6.0 <= odds && odds <= 7.99) return 1200;
  if (8.0 <= odds && odds <= 9.99) return 1000;
  if (10.0 <= odds && odds <= 11.99) return 900;
  if (12.0 <= odds && odds <= 14.99) return 800;
  if (15.0 <= odds && odds <= 19.99) return 700;
  if (20.0 <= odds && odds <= 29.99) return 600;
  if (30.0 <= odds && odds <= 49.99) return 400;
  if (odds >= 50.0) return 200;
  return 200;
}

