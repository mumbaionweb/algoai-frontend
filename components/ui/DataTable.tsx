'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select';
  filterOptions?: { label: string; value: string }[];
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  customToolbarActions?: React.ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  loadingMessage = 'Loading records...',
  emptyMessage = 'No records found.',
  enableSearch = false,
  searchPlaceholder = 'Search all columns...',
  customToolbarActions,
  className = '',
  onRowClick,
}: DataTableProps<T>) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close filter popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null);
      }
    }
    if (activeFilterColumn) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeFilterColumn]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;

    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null; // Reset sort
    });
  };

  const handleFilterChange = (colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      if (!value || value.trim() === '') {
        delete updated[colKey];
      } else {
        updated[colKey] = value;
      }
      return updated;
    });
  };

  const clearFilter = (colKey: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[colKey];
      return updated;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setGlobalSearch('');
    setSortConfig(null);
  };

  const isFiltered = Object.keys(columnFilters).length > 0 || globalSearch.trim() !== '' || sortConfig !== null;

  // Derive unique select options for filterable select columns if not provided
  const derivedFilterOptions = useMemo(() => {
    const options: Record<string, { label: string; value: string }[]> = {};
    columns.forEach((col) => {
      if (col.filterable && col.filterType === 'select') {
        if (col.filterOptions && col.filterOptions.length > 0) {
          options[col.key] = col.filterOptions;
        } else {
          const uniqueValues = new Set<string>();
          data.forEach((row) => {
            const rawVal = col.accessor ? col.accessor(row) : (row as any)[col.key];
            if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
              uniqueValues.add(String(rawVal));
            }
          });
          options[col.key] = Array.from(uniqueValues).map((val) => ({
            label: val,
            value: val,
          }));
        }
      }
    });
    return options;
  }, [columns, data]);

  // Filter & Sort Data
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Column-specific filters
    Object.entries(columnFilters).forEach(([colKey, filterVal]) => {
      const col = columns.find((c) => c.key === colKey);
      if (!col || !filterVal) return;

      const normalizedFilter = filterVal.toLowerCase().trim();
      result = result.filter((row) => {
        const val = col.accessor ? col.accessor(row) : (row as any)[colKey];
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(normalizedFilter);
      });
    });

    // 2. Global search
    if (globalSearch.trim() !== '') {
      const query = globalSearch.toLowerCase().trim();
      result = result.filter((row) => {
        return columns.some((col) => {
          const val = col.accessor ? col.accessor(row) : (row as any)[col.key];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(query);
        });
      });
    }

    // 3. Sorting
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const col = columns.find((c) => c.key === key);

      result.sort((a, b) => {
        const valA = col?.accessor ? col.accessor(a) : (a as any)[key];
        const valB = col?.accessor ? col.accessor(b) : (b as any)[key];

        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        // Numeric or date comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, columns, columnFilters, globalSearch, sortConfig]);

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Optional Toolbar: Search, Filters Reset, Row Counters */}
      {(enableSearch || isFiltered || customToolbarActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40">
          <div className="flex items-center space-x-3 flex-1 min-w-[240px]">
            {enableSearch && (
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {globalSearch && (
                  <button
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Clear search"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {isFiltered && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-200/60 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 transition-colors"
                title="Reset all applied filters and sorting"
              >
                <ArrowPathIcon className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Showing {processedData.length} of {data.length} records
            </span>
            {customToolbarActions}
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300 border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 select-none">
            <tr>
              {columns.map((col) => {
                const isSorted = sortConfig?.key === col.key;
                const isFilteredCol = Boolean(columnFilters[col.key]);
                const isPopoverOpen = activeFilterColumn === col.key;

                const alignmentClass =
                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                    }}
                    className={`px-6 py-4 relative group ${alignmentClass} ${col.headerClassName || ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-2 ${
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                      }`}
                    >
                      {/* Header Title with Click-to-Sort */}
                      <span
                        onClick={() => col.sortable && handleSort(col.key, col.sortable)}
                        className={`inline-flex items-center gap-1.5 transition-colors ${
                          col.sortable ? 'cursor-pointer hover:text-gray-900 dark:hover:text-white' : ''
                        } ${isSorted ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
                      >
                        {col.header}

                        {/* Sort Indicator */}
                        {col.sortable && (
                          <span className="inline-flex items-center">
                            {isSorted ? (
                              sortConfig?.direction === 'asc' ? (
                                <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                              ) : (
                                <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                              )
                            ) : (
                              <ChevronUpDownIcon className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity" />
                            )}
                          </span>
                        )}
                      </span>

                      {/* Filter Icon & Trigger */}
                      {col.filterable && (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveFilterColumn((current) => (current === col.key ? null : col.key));
                            }}
                            className={`p-1 rounded transition-colors ${
                              isFilteredCol
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800'
                            }`}
                            title={`Filter by ${col.header}`}
                            aria-label={`Filter by ${col.header}`}
                          >
                            <FunnelIcon className="w-3.5 h-3.5" />
                          </button>

                          {/* Filter Popover Dropdown */}
                          {isPopoverOpen && (
                            <div
                              ref={popoverRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute z-30 mt-2 left-0 w-64 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 normal-case font-normal"
                            >
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Filter {col.header}
                                </span>
                                {isFilteredCol && (
                                  <button
                                    onClick={() => clearFilter(col.key)}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>

                              {col.filterType === 'select' ? (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  <button
                                    type="button"
                                    onClick={() => clearFilter(col.key)}
                                    className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                                      !columnFilters[col.key]
                                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-semibold'
                                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    All
                                  </button>
                                  {(derivedFilterOptions[col.key] || []).map((opt) => {
                                    const isSelected = columnFilters[col.key] === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleFilterChange(col.key, opt.value)}
                                        className={`w-full text-left px-2 py-1 text-xs rounded truncate transition-colors ${
                                          isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-semibold'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                        title={opt.label}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={columnFilters[col.key] || ''}
                                    onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                    placeholder={`Filter ${col.header}...`}
                                    className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>
                              )}

                              <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setActiveFilterColumn(null)}
                                  className="px-2.5 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : processedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p>{emptyMessage}</p>
                    {isFiltered && (
                      <button
                        onClick={clearAllFilters}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        Clear active filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              processedData.map((row, rowIndex) => {
                const rowKey = keyExtractor(row, rowIndex);
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => {
                      const alignmentClass =
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

                      return (
                        <td
                          key={col.key}
                          style={{
                            width: col.width,
                            minWidth: col.minWidth,
                          }}
                          className={`px-6 py-4 ${alignmentClass} ${col.className || ''}`}
                        >
                          {col.render
                            ? col.render(row, rowIndex)
                            : col.accessor
                            ? col.accessor(row)
                            : (row as any)[col.key] || '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
