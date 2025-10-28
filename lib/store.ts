import { Round } from "@/types";

const STORAGE_KEY = "horse-racing-rounds";
const MAX_ROUNDS = 50;

export function saveRound(round: Round): void {
  const rounds = loadRounds();
  rounds.unshift(round); // Add to beginning
  
  // Keep only last MAX_ROUNDS
  const trimmed = rounds.slice(0, MAX_ROUNDS);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to save round:", error);
  }
}

export function loadRounds(): Round[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const rounds = JSON.parse(stored) as Round[];
    return rounds;
  } catch (error) {
    console.error("Failed to load rounds:", error);
    return [];
  }
}

export function clearRounds(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear rounds:", error);
  }
}

