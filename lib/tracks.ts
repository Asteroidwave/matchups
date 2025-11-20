/**
 * Track codes and names mapping
 * Used for autocomplete and display
 */

export interface TrackInfo {
  code: string;
  name: string;
  state?: string;
  surface?: string;
}

export const TRACKS: TrackInfo[] = [
  // Major Tracks (from Equibase Featured)
  { code: 'AQU', name: 'Aqueduct', state: 'NY', surface: 'Dirt' },
  { code: 'BEL', name: 'Belmont At The Big A', state: 'NY', surface: 'Dirt/Turf' },
  { code: 'BAQ', name: 'Belmont Park', state: 'NY', surface: 'Dirt/Turf' },
  { code: 'CD', name: 'Churchill Downs', state: 'KY', surface: 'Dirt/Turf' },
  { code: 'DMR', name: 'Del Mar', state: 'CA', surface: 'Dirt/Turf' },
  { code: 'GP', name: 'Gulfstream Park', state: 'FL', surface: 'Dirt/Turf' },
  { code: 'LRL', name: 'Laurel Park', state: 'MD', surface: 'Dirt/Turf' },
  { code: 'WO', name: 'Woodbine', state: 'ON', surface: 'Dirt/Turf' },
  
  // Additional Tracks (from Equibase All Tracks)
  { code: 'ARP', name: 'Arapahoe', state: 'CO', surface: 'Dirt' },
  { code: 'CAM', name: 'Camarero', state: 'PR', surface: 'Dirt' },
  { code: 'CEN', name: 'Century Downs', state: 'AB', surface: 'Dirt' },
  { code: 'CT', name: 'Charles Town', state: 'WV', surface: 'Dirt' },
  { code: 'CHS', name: 'Charleston', state: 'SC', surface: 'Dirt' },
  { code: 'DED', name: 'Delta Downs', state: 'LA', surface: 'Dirt' },
  { code: 'EVD', name: 'Evangeline', state: 'LA', surface: 'Dirt' },
  { code: 'FP', name: 'Fairmount Park', state: 'IL', surface: 'Dirt' },
  { code: 'FL', name: 'Finger Lakes', state: 'NY', surface: 'Dirt' },
  { code: 'HAW', name: 'Hawthorne', state: 'IL', surface: 'Dirt/Turf' },
  { code: 'IND', name: 'Horseshoe Indianapolis', state: 'IN', surface: 'Dirt/Turf' },
  { code: 'LS', name: 'Lone Star', state: 'TX', surface: 'Dirt/Turf' },
  { code: 'LA', name: 'Los Alamitos Quarter Horse', state: 'CA', surface: 'Dirt' },
  { code: 'MVR', name: 'Mahoning Valley Race Course', state: 'OH', surface: 'Dirt' },
  { code: 'MON', name: 'Montpelier', state: 'VT', surface: 'Dirt' },
  { code: 'MNR', name: 'Mountaineer', state: 'WV', surface: 'Dirt' },
  { code: 'PRX', name: 'Parx Racing', state: 'PA', surface: 'Dirt/Turf' },
  { code: 'PEN', name: 'Penn National', state: 'PA', surface: 'Dirt' },
  { code: 'PHC', name: 'Pennsylvania Hunt Cup', state: 'PA', surface: 'Turf' },
  { code: 'RP', name: 'Remington Park', state: 'OK', surface: 'Dirt' },
  { code: 'TUP', name: 'Turf Paradise', state: 'AZ', surface: 'Turf' },
  { code: 'WRD', name: 'Will Rogers', state: 'OK', surface: 'Dirt' },
  { code: 'ZIA', name: 'Zia Park', state: 'NM', surface: 'Dirt' },
  
  // Additional Popular Tracks
  { code: 'OP', name: 'Oaklawn Park', state: 'AR', surface: 'Dirt' },
  { code: 'SA', name: 'Santa Anita', state: 'CA', surface: 'Dirt/Turf' },
  { code: 'TAM', name: 'Tampa Bay Downs', state: 'FL', surface: 'Dirt/Turf' },
  { code: 'KEE', name: 'Keeneland', state: 'KY', surface: 'Turf' },
  { code: 'SAR', name: 'Saratoga', state: 'NY', surface: 'Dirt/Turf' },
  { code: 'PIM', name: 'Pimlico', state: 'MD', surface: 'Dirt/Turf' },
  { code: 'AP', name: 'Arlington Park', state: 'IL', surface: 'Dirt/Turf' },
];

/**
 * Get track by code
 */
export function getTrackByCode(code: string): TrackInfo | undefined {
  return TRACKS.find(t => t.code.toUpperCase() === code.toUpperCase());
}

/**
 * Get track by name (fuzzy search)
 */
export function getTrackByName(name: string): TrackInfo | undefined {
  const normalized = name.toLowerCase().trim();
  return TRACKS.find(t => 
    t.name.toLowerCase() === normalized ||
    t.name.toLowerCase().includes(normalized) ||
    normalized.includes(t.name.toLowerCase())
  );
}

/**
 * Search tracks by name or code
 */
export function searchTracks(query: string): TrackInfo[] {
  if (!query) return TRACKS;
  
  const normalized = query.toLowerCase().trim();
  return TRACKS.filter(t => 
    t.code.toLowerCase().includes(normalized) ||
    t.name.toLowerCase().includes(normalized) ||
    (t.state && t.state.toLowerCase().includes(normalized))
  );
}

/**
 * Get track name for display
 */
export function getTrackDisplayName(code: string): string {
  const track = getTrackByCode(code);
  return track ? `${track.name} (${track.code})` : code;
}

