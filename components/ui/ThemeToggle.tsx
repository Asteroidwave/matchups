"use client";

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
        theme === 'light' 
          ? 'bg-white/90 hover:bg-white shadow-sm border border-white/20' 
          : 'bg-gray-800 hover:bg-gray-700 shadow-sm border border-gray-600'
      }`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-4.5 w-4.5 text-gray-700" />
      ) : (
        <Sun className="h-4.5 w-4.5 text-yellow-400" />
      )}
    </button>
  );
}
