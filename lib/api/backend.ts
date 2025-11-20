/**
 * Backend API client
 * Handles communication with the backend server
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/**
 * Get entries for a track and date
 */
export async function getTrackEntries(track: string, date: string): Promise<any[]> {
  const url = `${BACKEND_URL}/api/tracks/${track}/entries?date=${date}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch entries for ${track} on ${date}: ${errorText}`);
  }
  
  const data = await response.json();
  // Backend returns {track, date, records} not {entries}
  return data.records || [];
}

/**
 * Get results for a track and date
 */
export async function getTrackResults(track: string, date: string): Promise<any[]> {
  const url = `${BACKEND_URL}/api/tracks/${track}/results?date=${date}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch results for ${track} on ${date}: ${errorText}`);
  }
  
  const data = await response.json();
  return data.results || [];
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

