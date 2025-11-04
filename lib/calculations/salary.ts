/**
 * Salary calculation utilities (ported from Python scripts)
 * Matches the logic from PVP.py and unified_matchup_generator.py
 */

/**
 * Calculate salary based on decimal odds
 * Matches the salary bins from PVP.py
 */
export function calculateSalaryBasedOnOdds(
  odds: number | null | undefined,
  isAlsoEligible: boolean = false
): number {
  if (!odds || odds <= 0) return 0;
  
  // Also Eligible handling
  if (isAlsoEligible) {
    if (odds <= 0.7) return 2400;
    if (odds <= 1.1) return 2300;
    if (odds <= 1.7) return 2200;
    if (odds <= 2.4) return 2000;
    if (odds <= 3.4) return 1800;
    if (odds <= 4.4) return 1600;
    if (odds <= 5.9) return 1400;
    if (odds <= 7.9) return 1200;
    if (odds <= 10.9) return 1000;
    if (odds <= 14.9) return 800;
    if (odds <= 19.9) return 600;
    return 400;
  }
  
  // Regular salary bins
  if (0.1 <= odds && odds <= 0.7) return 2400;
  if (0.8 <= odds && odds <= 1.1) return 2300;
  if (1.2 <= odds && odds <= 1.7) return 2200;
  if (1.8 <= odds && odds <= 2.4) return 2000;
  if (2.5 <= odds && odds <= 3.4) return 1800;
  if (3.5 <= odds && odds <= 4.4) return 1600;
  if (4.5 <= odds && odds <= 5.9) return 1400;
  if (6.0 <= odds && odds <= 7.9) return 1200;
  if (8.0 <= odds && odds <= 10.9) return 1000;
  if (11.0 <= odds && odds <= 14.9) return 800;
  if (15.0 <= odds && odds <= 19.9) return 600;
  if (20.0 <= odds && odds <= 29.9) return 400;
  return 200;
}

/**
 * Calculate final salary from a list of odds
 * Uses the average odds approach from unified_matchup_generator.py
 */
export function calculateFinalSalary(oddsList: (number | null)[]): number {
  const validOdds = oddsList.filter((o): o is number => o !== null && o > 0);
  if (validOdds.length === 0) return 0;
  
  const avgOdds = validOdds.reduce((sum, o) => sum + o, 0) / validOdds.length;
  return calculateSalaryBasedOnOdds(avgOdds, false);
}

