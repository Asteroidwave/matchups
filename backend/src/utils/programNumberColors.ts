/**
 * Standard Program Number Colors (Saddlecloth Colors)
 * These match the actual colors used on horses' saddlecloths
 */

export interface ProgramNumberColor {
  bg: string;
  text: string;
  name: string;
}

/**
 * Standard saddlecloth colors for program numbers
 * Based on actual colors from racing app (Indianapolis, Gulfstream, etc.)
 * Exact hex values from the app's implementation
 */
export const PROGRAM_NUMBER_COLORS: Record<number, ProgramNumberColor> = {
  1: { bg: 'bg-[#DC2626]', text: 'text-white', name: 'Red' }, // #DC2626 red background, white text
  2: { bg: 'bg-[#F0FFFF]', text: 'text-black', name: 'Light Blue' }, // #F0FFFF light blue background, black text
  3: { bg: 'bg-[#005CE8]', text: 'text-white', name: 'Blue' }, // #005CE8 blue background, white text
  4: { bg: 'bg-[#ECC94B]', text: 'text-black', name: 'Yellow' }, // #ECC94B yellow background, black text
  5: { bg: 'bg-[#16A34A]', text: 'text-white', name: 'Green' }, // #16A34A green background, white text
  6: { bg: 'bg-[#800080]', text: 'text-white', name: 'Purple' }, // Purple background (#800080), white text (from image)
  7: { bg: 'bg-[#F97316]', text: 'text-black', name: 'Orange' }, // Orange background (#F97316), black text (from image)
  8: { bg: 'bg-[#F9A8D4]', text: 'text-black', name: 'Pink' }, // #F9A8D4 pink background, black text
  9: { bg: 'bg-[#99F6E4]', text: 'text-black', name: 'Light Teal' }, // #99F6E4 light teal background, black text
  10: { bg: 'bg-[#800080]', text: 'text-white', name: 'Purple' }, // #800080 purple background, white text
  11: { bg: 'bg-[#000080]', text: 'text-white', name: 'Navy Blue' }, // #000080 navy blue background, white text
  12: { bg: 'bg-[#36CD30]', text: 'text-black', name: 'Bright Green' }, // #36CD30 bright green background, black text
  13: { bg: 'bg-[#8A2CE6]', text: 'text-white', name: 'Violet' }, // #8A2CE6 violet background, white text
  14: { bg: 'bg-[#817E01]', text: 'text-white', name: 'Dark Olive' }, // #817E01 dark olive background, white text
  15: { bg: 'bg-[#ABA96F]', text: 'text-black', name: 'Khaki' }, // #ABA96F khaki background, black text
  16: { bg: 'bg-[#2A557B]', text: 'text-white', name: 'Dark Blue' }, // #2A557B dark blue background, white text
};

/**
 * Get color for a program number
 * Cycles through colors if number > 15
 */
export function getProgramNumberColor(programNumber: number | null | undefined): ProgramNumberColor {
  if (!programNumber || programNumber < 1) {
    return { bg: 'bg-gray-300', text: 'text-gray-700', name: 'Gray' };
  }

  // Use standard colors for 1-15
  if (programNumber <= 15) {
    return PROGRAM_NUMBER_COLORS[programNumber];
  }

  // For numbers > 15, cycle through colors (patterns may vary by track)
  const colors = Object.values(PROGRAM_NUMBER_COLORS);
  const index = ((programNumber - 1) % colors.length);
  return colors[index];
}

/**
 * Get Tailwind classes for program number badge
 */
export function getProgramNumberBadgeClasses(programNumber: number | null | undefined): string {
  const color = getProgramNumberColor(programNumber);
  return `${color.bg} ${color.text}`;
}

