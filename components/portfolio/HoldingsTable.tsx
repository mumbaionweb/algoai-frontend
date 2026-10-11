'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Holding } from '@/types';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface HoldingsTableProps {
  holdings: Holding[];
  onRefresh: () => void;
  refreshing: boolean;
  selectedBroker?: string;
}

type SortField =
  | 'stock_name'
  | 'broker'
  | 'quantity'
  | 'average_price'
  | 'last_price'
  | 'pnl'
  | 'pnl_percentage';

type SortDirection = 'asc' | 'desc' | null;

interface FilterState {
  stock_name: string;
  broker: string; // 'all' | 'zerodha' | 'paytm_money'
  min_quantity: string;
  max_quantity: string;
  min_avg_price: string;
  max_avg_price: string;
  min_last_price: string;
  max_last_price: string;
  pnl_type: 'all' | 'profit' | 'loss';
  min_pnl: string;
  max_pnl: string;
  pnl_pct_type: 'all' | 'profit' | 'loss';
  min_pnl_pct: string;
  max_pnl_pct: string;
}

const INITIAL_FILTERS: FilterState = {
  stock_name: '',
  broker: 'all',
  min_quantity: '',
  max_quantity: '',
  min_avg_price: '',
  max_avg_price: '',
  min_last_price: '',
  max_last_price: '',
  pnl_type: 'all',
  min_pnl: '',
  max_pnl: '',
  pnl_pct_type: 'all',
  min_pnl_pct: '',
  max_pnl_pct: '',
};

export default function HoldingsTable({
  holdings,
  onRefresh,
  refreshing,
  selectedBroker = 'all',
}: HoldingsTableProps) {
  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filters state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Close filter popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setOpenFilterCol(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortField(null);
      setSortDirection(null);
    }
  };

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.stock_name !== '' ||
      filters.broker !== 'all' ||
      filters.min_quantity !== '' ||
      filters.max_quantity !== '' ||
      filters.min_avg_price !== '' ||
      filters.max_avg_price !== '' ||
      filters.min_last_price !== '' ||
      filters.max_last_price !== '' ||
      filters.pnl_type !== 'all' ||
      filters.min_pnl !== '' ||
      filters.max_pnl !== '' ||
      filters.pnl_pct_type !== 'all' ||
      filters.min_pnl_pct !== '' ||
      filters.max_pnl_pct !== ''
    );
  }, [filters]);

  const clearAllFilters = () => {
    setFilters(INITIAL_FILTERS);
    setOpenFilterCol(null);
    setPage(1);
  };

  // Filter and Sort Data
  const processedHoldings = useMemo(() => {
    let result = [...holdings];

    // 1. Filter by Stock Name or Symbol
    if (filters.stock_name.trim()) {
      const q = filters.stock_name.toLowerCase().trim();
      result = result.filter(
        (h) =>
          (h.stock_name && h.stock_name.toLowerCase().includes(q)) ||
          h.tradingsymbol.toLowerCase().includes(q)
      );
    }

    // 2. Filter by Broker
    if (filters.broker !== 'all') {
      result = result.filter((h) => {
        const b = (h.broker || '').toLowerCase();
        if (filters.broker === 'zerodha') return b.includes('zerodha');
        if (filters.broker === 'paytm_money') return b.includes('paytm');
        return true;
      });
    }

    // 3. Filter Quantity
    if (filters.min_quantity !== '') {
      const min = parseFloat(filters.min_quantity);
      if (!isNaN(min)) result = result.filter((h) => h.quantity >= min);
    }
    if (filters.max_quantity !== '') {
      const max = parseFloat(filters.max_quantity);
      if (!isNaN(max)) result = result.filter((h) => h.quantity <= max);
    }

    // 4. Filter Avg Price
    if (filters.min_avg_price !== '') {
      const min = parseFloat(filters.min_avg_price);
      if (!isNaN(min)) result = result.filter((h) => h.average_price >= min);
    }
    if (filters.max_avg_price !== '') {
      const max = parseFloat(filters.max_avg_price);
      if (!isNaN(max)) result = result.filter((h) => h.average_price <= max);
    }

    // 5. Filter Last Price
    if (filters.min_last_price !== '') {
      const min = parseFloat(filters.min_last_price);
      if (!isNaN(min)) result = result.filter((h) => h.last_price >= min);
    }
    if (filters.max_last_price !== '') {
      const max = parseFloat(filters.max_last_price);
      if (!isNaN(max)) result = result.filter((h) => h.last_price <= max);
    }

    // 6. Filter P&L Amount
    if (filters.pnl_type === 'profit') {
      result = result.filter((h) => h.pnl >= 0);
    } else if (filters.pnl_type === 'loss') {
      result = result.filter((h) => h.pnl < 0);
    }
    if (filters.min_pnl !== '') {
      const min = parseFloat(filters.min_pnl);
      if (!isNaN(min)) result = result.filter((h) => h.pnl >= min);
    }
    if (filters.max_pnl !== '') {
      const max = parseFloat(filters.max_pnl);
      if (!isNaN(max)) result = result.filter((h) => h.pnl <= max);
    }

    // 7. Filter P&L %
    if (filters.pnl_pct_type === 'profit') {
      result = result.filter((h) => h.pnl_percentage >= 0);
    } else if (filters.pnl_pct_type === 'loss') {
      result = result.filter((h) => h.pnl_percentage < 0);
    }
    if (filters.min_pnl_pct !== '') {
      const min = parseFloat(filters.min_pnl_pct);
      if (!isNaN(min)) result = result.filter((h) => h.pnl_percentage >= min);
    }
    if (filters.max_pnl_pct !== '') {
      const max = parseFloat(filters.max_pnl_pct);
      if (!isNaN(max)) result = result.filter((h) => h.pnl_percentage <= max);
    }

    // Sort
    if (sortField && sortDirection) {
      result.sort((a, b) => {
        let aVal: any = a[sortField];
        let bVal: any = b[sortField];

        if (sortField === 'stock_name') {
          aVal = (a.stock_name || a.tradingsymbol).toLowerCase();
          bVal = (b.stock_name || b.tradingsymbol).toLowerCase();
        } else if (sortField === 'broker') {
          aVal = (a.broker || '').toLowerCase();
          bVal = (b.broker || '').toLowerCase();
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [holdings, filters, sortField, sortDirection]);

  // Paginated Data
  const totalPages =
    pageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(processedHoldings.length / pageSize));

  const paginatedHoldings = useMemo(() => {
    if (pageSize === 'all') return processedHoldings;
    const start = (page - 1) * pageSize;
    return processedHoldings.slice(start, start + pageSize);
  }, [processedHoldings, page, pageSize]);

  // Render Broker Icon Badge
  const renderBrokerIcon = (broker?: string) => {
    const b = (broker || '').toLowerCase();
    const isZerodha = b.includes('zerodha');
    const isPaytm = b.includes('paytm');

    if (isZerodha) {
      return (
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30 shadow-sm"
          title="Zerodha"
        >
          {/* Zerodha Kite stylized emblem */}
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 11.5l9 9.5 9-9.5L12 2zm0 4.2l5.5 5.8-5.5 5.8-5.5-5.8 5.5-5.8z" />
          </svg>
        </div>
      );
    }

    if (isPaytm) {
      return (
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#002e6e]/20 text-[#00baf2] border border-[#00baf2]/35 shadow-sm"
          title="Paytm Money"
        >
          {/* Paytm Money PM stylized emblem */}
          <span className="font-black text-[10px] tracking-tighter leading-none">
            PM
          </span>
        </div>
      );
    }

    return (
      <span className="text-xs text-gray-400" title={broker || 'Unknown'}>
        {broker || '-'}
      </span>
    );
  };

  // Render Sort Header Indicator
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400/60" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-400 font-bold" />
    );
  };

  // Toggle Column Filter Popover
  const toggleFilter = (colKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFilterCol(openFilterCol === colKey ? null : colKey);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/60 shadow-lg">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white tracking-wide">
            Holdings
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {processedHoldings.length}
            {processedHoldings.length !== holdings.length
              ? ` of ${holdings.length}`
              : ''}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium flex items-center gap-1 ml-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Search & Refresh Controls */}
        <div className="flex items-center gap-3">
          {/* Global Stock Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stock or symbol..."
              value={filters.stock_name}
              onChange={(e) => {
                setFilters({ ...filters, stock_name: e.target.value });
                setPage(1);
              }}
              className="pl-9 pr-8 py-1.5 text-xs bg-gray-700 hover:bg-gray-650 text-white placeholder-gray-400 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
            />
            {filters.stock_name && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, stock_name: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="px-3.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Refresh Holdings"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      {processedHoldings.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p className="text-base mb-2">No holdings match your filters.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700/80 bg-gray-750/50 text-[11px] font-bold text-gray-300 uppercase tracking-wider select-none">
                {/* 1. Stock Name (First Column) */}
                <th className="py-3 px-4 relative">
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('stock_name')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Stock Name</span>
                      {renderSortIndicator('stock_name')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('stock_name', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.stock_name ? 'text-blue-400' : 'text-gray-400'
                      }`}
                      title="Filter Stock Name"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Stock Name Filter Popover */}
                  {openFilterCol === 'stock_name' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute left-4 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Filter Stock Name</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Search company or symbol..."
                        value={filters.stock_name}
                        onChange={(e) => {
                          setFilters({ ...filters, stock_name: e.target.value });
                          setPage(1);
                        }}
                        className="w-full px-2.5 py-1.5 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500 mb-2"
                        autoFocus
                      />
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setFilters({ ...filters, stock_name: '' })}
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 2. Broker Icon Column */}
                <th className="py-3 px-3 text-center w-20 relative">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('broker')}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <span>Broker</span>
                      {renderSortIndicator('broker')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('broker', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.broker !== 'all' ? 'text-blue-400' : 'text-gray-400'
                      }`}
                      title="Filter Broker"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Broker Filter Popover */}
                  {openFilterCol === 'broker' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute left-1 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Filter Broker</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1.5 mb-2">
                        {[
                          { id: 'all', label: 'All Brokers' },
                          { id: 'zerodha', label: 'Zerodha' },
                          { id: 'paytm_money', label: 'Paytm Money' },
                        ].map((b) => (
                          <label
                            key={b.id}
                            className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white"
                          >
                            <input
                              type="radio"
                              name="broker_filter"
                              checked={filters.broker === b.id}
                              onChange={() => {
                                setFilters({ ...filters, broker: b.id });
                                setPage(1);
                              }}
                              className="text-blue-600 focus:ring-0"
                            />
                            <span>{b.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 3. Quantity */}
                <th className="py-3 px-4 text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('quantity')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Quantity</span>
                      {renderSortIndicator('quantity')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('quantity', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.min_quantity || filters.max_quantity
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      title="Filter Quantity"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Quantity Filter Popover */}
                  {openFilterCol === 'quantity' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Quantity Range</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={filters.min_quantity}
                          onChange={(e) => {
                            setFilters({ ...filters, min_quantity: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={filters.max_quantity}
                          onChange={(e) => {
                            setFilters({ ...filters, max_quantity: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              min_quantity: '',
                              max_quantity: '',
                            })
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 4. Avg Price */}
                <th className="py-3 px-4 text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('average_price')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Avg Price</span>
                      {renderSortIndicator('average_price')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('avg_price', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.min_avg_price || filters.max_avg_price
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      title="Filter Avg Price"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Avg Price Popover */}
                  {openFilterCol === 'avg_price' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Avg Price Range (₹)</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="Min ₹"
                          value={filters.min_avg_price}
                          onChange={(e) => {
                            setFilters({ ...filters, min_avg_price: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Max ₹"
                          value={filters.max_avg_price}
                          onChange={(e) => {
                            setFilters({ ...filters, max_avg_price: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              min_avg_price: '',
                              max_avg_price: '',
                            })
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 5. Last Price */}
                <th className="py-3 px-4 text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('last_price')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>Last Price</span>
                      {renderSortIndicator('last_price')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('last_price', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.min_last_price || filters.max_last_price
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      title="Filter Last Price"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Last Price Popover */}
                  {openFilterCol === 'last_price' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Last Price Range (₹)</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="Min ₹"
                          value={filters.min_last_price}
                          onChange={(e) => {
                            setFilters({ ...filters, min_last_price: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Max ₹"
                          value={filters.max_last_price}
                          onChange={(e) => {
                            setFilters({ ...filters, max_last_price: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              min_last_price: '',
                              max_last_price: '',
                            })
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 6. P&L Amt (Broken into Separate Column) */}
                <th className="py-3 px-4 text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('pnl')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>P&L Amt</span>
                      {renderSortIndicator('pnl')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('pnl', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.pnl_type !== 'all' ||
                        filters.min_pnl ||
                        filters.max_pnl
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      title="Filter P&L Amt"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* P&L Amt Popover */}
                  {openFilterCol === 'pnl' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute right-0 top-full mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Filter P&L Amount</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {(['all', 'profit', 'loss'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setFilters({ ...filters, pnl_type: t });
                              setPage(1);
                            }}
                            className={`flex-1 py-1 text-[10px] font-bold rounded uppercase ${
                              filters.pnl_type === t
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="Min ₹"
                          value={filters.min_pnl}
                          onChange={(e) => {
                            setFilters({ ...filters, min_pnl: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Max ₹"
                          value={filters.max_pnl}
                          onChange={(e) => {
                            setFilters({ ...filters, max_pnl: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              pnl_type: 'all',
                              min_pnl: '',
                              max_pnl: '',
                            })
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>

                {/* 7. P&L % (Broken into Separate Column) */}
                <th className="py-3 px-4 text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('pnl_percentage')}
                      className="flex items-center gap-1.5 hover:text-white transition-colors"
                    >
                      <span>P&L %</span>
                      {renderSortIndicator('pnl_percentage')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleFilter('pnl_pct', e)}
                      className={`p-1 rounded hover:bg-gray-700 ${
                        filters.pnl_pct_type !== 'all' ||
                        filters.min_pnl_pct ||
                        filters.max_pnl_pct
                          ? 'text-blue-400'
                          : 'text-gray-400'
                      }`}
                      title="Filter P&L %"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                  {/* P&L % Popover */}
                  {openFilterCol === 'pnl_pct' && (
                    <div
                      ref={filterPopoverRef}
                      className="absolute right-0 top-full mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-2xl z-50 text-xs normal-case text-left"
                    >
                      <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Filter P&L %</span>
                        <button
                          onClick={() => setOpenFilterCol(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {(['all', 'profit', 'loss'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              setFilters({ ...filters, pnl_pct_type: t });
                              setPage(1);
                            }}
                            className={`flex-1 py-1 text-[10px] font-bold rounded uppercase ${
                              filters.pnl_pct_type === t
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          placeholder="Min %"
                          value={filters.min_pnl_pct}
                          onChange={(e) => {
                            setFilters({ ...filters, min_pnl_pct: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Max %"
                          value={filters.max_pnl_pct}
                          onChange={(e) => {
                            setFilters({ ...filters, max_pnl_pct: e.target.value });
                            setPage(1);
                          }}
                          className="px-2 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() =>
                            setFilters({
                              ...filters,
                              pnl_pct_type: 'all',
                              min_pnl_pct: '',
                              max_pnl_pct: '',
                            })
                          }
                          className="text-gray-400 hover:text-white"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenFilterCol(null)}
                          className="text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60 text-sm">
              {paginatedHoldings.map((holding, idx) => {
                const isProfit = holding.pnl >= 0;
                const displayName = holding.stock_name || holding.tradingsymbol;

                return (
                  <tr
                    key={`${holding.tradingsymbol}-${holding.broker || ''}-${idx}`}
                    className="hover:bg-gray-700/40 transition-colors"
                  >
                    {/* 1. Stock Name (Company Name + Symbol Badge) */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white tracking-tight line-clamp-1">
                          {displayName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-700/80 text-gray-300 border border-gray-600/50">
                            {holding.tradingsymbol}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 2. Broker Icon */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex justify-center">
                        {renderBrokerIcon(holding.broker)}
                      </div>
                    </td>

                    {/* 3. Quantity */}
                    <td className="py-3 px-4 text-right font-medium text-white">
                      {holding.quantity}
                    </td>

                    {/* 4. Avg Price */}
                    <td className="py-3 px-4 text-right text-gray-200 font-mono">
                      ₹
                      {holding.average_price.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* 5. Last Price */}
                    <td className="py-3 px-4 text-right text-white font-mono font-medium">
                      ₹
                      {holding.last_price.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* 6. P&L Amt */}
                    <td
                      className={`py-3 px-4 text-right font-mono font-semibold ${
                        isProfit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfit ? '+' : ''}₹
                      {holding.pnl.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* 7. P&L % */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          isProfit
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                        }`}
                      >
                        {isProfit ? '+' : ''}
                        {holding.pnl_percentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {processedHoldings.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-gray-700/60 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val =
                  e.target.value === 'all'
                    ? 'all'
                    : parseInt(e.target.value, 10);
                setPageSize(val);
                setPage(1);
              }}
              className="bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All ({processedHoldings.length})</option>
            </select>
            <span className="text-gray-400 ml-2">
              Showing{' '}
              {pageSize === 'all'
                ? `all ${processedHoldings.length}`
                : `${(page - 1) * pageSize + 1} - ${Math.min(
                    page * pageSize,
                    processedHoldings.length
                  )} of ${processedHoldings.length}`}{' '}
              holdings
            </span>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-gray-300 font-medium">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
