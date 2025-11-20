"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface RoundFiltersProps {
  statusFilter: 'all' | 'won' | 'lost' | 'live' | 'pending';
  sortBy: 'status' | 'amount' | 'time' | 'potential';
  searchQuery: string;
  onStatusFilterChange: (filter: 'all' | 'won' | 'lost' | 'live' | 'pending') => void;
  onSortChange: (sort: 'status' | 'amount' | 'time' | 'potential') => void;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function RoundFilters({
  statusFilter,
  sortBy,
  searchQuery,
  onStatusFilterChange,
  onSortChange,
  onSearchChange,
  totalCount,
  filteredCount,
}: RoundFiltersProps) {
  return (
    <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Status Filter Tabs (Changed from dropdown to tabs) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onStatusFilterChange('live')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'live'
              ? 'bg-yellow-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Live
        </button>
        <button
          onClick={() => onStatusFilterChange('won')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'won'
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Won
        </button>
        <button
          onClick={() => onStatusFilterChange('lost')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'lost'
              ? 'bg-red-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Lost
        </button>
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All Rounds
        </button>
      </div>
      
      {/* Search */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by connection name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Count */}
      <div className="text-sm text-gray-600">
        Showing <span className="font-semibold">{filteredCount}</span> of <span className="font-semibold">{totalCount}</span>
      </div>
    </div>
  );
}

