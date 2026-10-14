'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
  CalendarIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'datetime' | 'number';
  filterOptions?: { label: string; value: string }[];
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: 'left' | 'center' | 'right';
  resizable?: boolean;
  reorderable?: boolean;
  hideable?: boolean;
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
  enableColumnResizing?: boolean;
  enableColumnReordering?: boolean;
  enableColumnVisibility?: boolean;
  storageKey?: string;
  customToolbarActions?: React.ReactNode;
  className?: string;
  tableClassName?: string;
  maxHeight?: string;
  onRowClick?: (row: T) => void;

  // Pagination & Server-side props
  enablePagination?: boolean;
  serverSide?: boolean;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalRecords?: number;
  totalMatching?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onServerSearch?: (searchQuery: string) => void;
  onServerFilter?: (filters: Record<string, any>) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface DateFilterState {
  from?: string;
  to?: string;
  preset?: string;
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
  enableColumnResizing = true,
  enableColumnReordering = true,
  enableColumnVisibility = true,
  storageKey,
  customToolbarActions,
  className = '',
  tableClassName = '',
  maxHeight,
  onRowClick,
  enablePagination = false,
  serverSide = false,
  page = 1,
  pageSize = 50,
  totalPages,
  totalRecords,
  totalMatching,
  pageSizeOptions = [50, 100, 250, 500],
  onPageChange,
  onPageSizeChange,
  onServerSearch,
  onServerFilter,
}: DataTableProps<T>) {
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [showColumnVisibilityPopover, setShowColumnVisibilityPopover] = useState(false);

  // Client-side pagination state
  const [clientPage, setClientPage] = useState<number>(1);
  const [clientPageSize, setClientPageSize] = useState<number>(pageSize);

  const activePage = serverSide ? page : clientPage;
  const activePageSize = serverSide ? pageSize : clientPageSize;

  // Column Ordering & Widths & Visibility with LocalStorage Persistence
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  // Drag-and-drop state
  const [draggingColKey, setDraggingColKey] = useState<string | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null);

  // Refs for floating popovers
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const colVisibilityRef = useRef<HTMLDivElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  // Load persistent view from localStorage if storageKey is provided
  useEffect(() => {
    setIsClientLoaded(true);
    if (!storageKey || typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(`algoai_table_view_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columnOrder && Array.isArray(parsed.columnOrder)) {
          // Verify that all saved column keys still exist in current columns
          const validKeys = new Set(columns.map((c) => c.key));
          const filteredSaved = parsed.columnOrder.filter((k: string) => validKeys.has(k));
          // Append any newly added columns
          columns.forEach((c) => {
            if (!filteredSaved.includes(c.key)) {
              filteredSaved.push(c.key);
            }
          });
          setColumnOrder(filteredSaved);
        }
        if (parsed.columnWidths && typeof parsed.columnWidths === 'object') {
          setColumnWidths(parsed.columnWidths);
        }
        if (parsed.hiddenColumns && Array.isArray(parsed.hiddenColumns)) {
          setHiddenColumns(new Set(parsed.hiddenColumns));
        }
      }
    } catch (e) {
      // Silently ignore corrupted storage
    }
  }, [storageKey, columns]);

  // Save persistent view to localStorage
  const saveViewState = useCallback(
    (newOrder?: string[], newWidths?: Record<string, number>, newHidden?: Set<string>) => {
      if (!storageKey || typeof window === 'undefined') return;
      try {
        const payload = {
          columnOrder: newOrder || columnOrder,
          columnWidths: newWidths || columnWidths,
          hiddenColumns: Array.from(newHidden || hiddenColumns),
        };
        localStorage.setItem(`algoai_table_view_${storageKey}`, JSON.stringify(payload));
      } catch (e) {
        // Ignore quota errors
      }
    },
    [storageKey, columnOrder, columnWidths, hiddenColumns]
  );

  const resetTableView = () => {
    const defaultOrder = columns.map((c) => c.key);
    setColumnOrder(defaultOrder);
    setColumnWidths({});
    setHiddenColumns(new Set());
    if (storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(`algoai_table_view_${storageKey}`);
    }
  };

  // Close filter popovers on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setActiveFilterColumn(null);
      }
      if (
        colVisibilityRef.current &&
        !colVisibilityRef.current.contains(event.target as Node)
      ) {
        setShowColumnVisibilityPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Column Resizing via Mouse Drag
  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const initialWidth =
      columnWidths[colKey] ||
      (e.currentTarget.parentElement?.getBoundingClientRect().width ?? 150);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(60, initialWidth + deltaX);
      setColumnWidths((prev) => {
        const updated = { ...prev, [colKey]: newWidth };
        return updated;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setColumnWidths((latest) => {
        saveViewState(undefined, latest, undefined);
        return latest;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Drag and drop column reordering
  const handleDragStart = (key: string, e: React.DragEvent) => {
    setDraggingColKey(key);
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (key: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColKey !== key) {
      setDragOverColKey(key);
    }
  };

  const handleDrop = (targetKey: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingColKey || draggingColKey === targetKey) {
      setDraggingColKey(null);
      setDragOverColKey(null);
      return;
    }

    const newOrder = [...columnOrder];
    const fromIndex = newOrder.indexOf(draggingColKey);
    const toIndex = newOrder.indexOf(targetKey);

    if (fromIndex !== -1 && toIndex !== -1) {
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggingColKey);
      setColumnOrder(newOrder);
      saveViewState(newOrder, undefined, undefined);
    }

    setDraggingColKey(null);
    setDragOverColKey(null);
  };

  // Toggle Column Visibility
  const toggleColumnVisibility = (colKey: string) => {
    setHiddenColumns((prev) => {
      const updated = new Set(prev);
      if (updated.has(colKey)) {
        updated.delete(colKey);
      } else {
        // Keep at least one column visible
        if (orderedColumns.length - updated.size > 1) {
          updated.add(colKey);
        }
      }
      saveViewState(undefined, undefined, updated);
      return updated;
    });
  };

  // Handle Sort
  const handleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;

    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  // Handle Filters
  const handleFilterChange = (colKey: string, value: any) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      if (value === undefined || value === null || value === '') {
        delete updated[colKey];
      } else {
        updated[colKey] = value;
      }
      if (serverSide) {
        onServerFilter?.(updated);
      } else {
        setClientPage(1);
      }
      return updated;
    });
  };

  const clearFilter = (colKey: string) => {
    setColumnFilters((prev) => {
      const updated = { ...prev };
      delete updated[colKey];
      if (serverSide) {
        onServerFilter?.(updated);
      } else {
        setClientPage(1);
      }
      return updated;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setGlobalSearch('');
    setSortConfig(null);
    if (serverSide) {
      onServerFilter?.({});
      onServerSearch?.('');
    } else {
      setClientPage(1);
    }
  };

  const isFiltered =
    Object.keys(columnFilters).length > 0 ||
    globalSearch.trim() !== '' ||
    sortConfig !== null;

  // Active Ordered Columns based on user order & visibility
  const orderedColumns = useMemo(() => {
    const colMap = new Map(columns.map((c) => [c.key, c]));
    const result: ColumnDef<T>[] = [];

    columnOrder.forEach((key) => {
      const col = colMap.get(key);
      if (col && !hiddenColumns.has(key)) {
        result.push(col);
      }
    });

    // Fallback for any columns not in columnOrder
    columns.forEach((col) => {
      if (!columnOrder.includes(col.key) && !hiddenColumns.has(col.key)) {
        result.push(col);
      }
    });

    return result;
  }, [columns, columnOrder, hiddenColumns]);

  // Derived options for select filters
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

  // Data Filtering & Sorting Logic
  const processedData = useMemo(() => {
    if (serverSide) {
      return data;
    }
    let result = [...data];

    // 1. Column-specific filters
    Object.entries(columnFilters).forEach(([colKey, filterVal]) => {
      const col = columns.find((c) => c.key === colKey);
      if (!col || filterVal === undefined || filterVal === null) return;

      // Date / Datetime Range Filter
      if (col.filterType === 'date' || col.filterType === 'datetime') {
        const { from, to } = (filterVal as DateFilterState) || {};
        if (!from && !to) return;

        const fromTime = from ? new Date(from).getTime() : -Infinity;
        // If 'to' is only date (e.g. YYYY-MM-DD), set to end of day
        let toTime = Infinity;
        if (to) {
          const toDateObj = new Date(to);
          if (to.length === 10) {
            toDateObj.setHours(23, 59, 59, 999);
          }
          toTime = toDateObj.getTime();
        }

        result = result.filter((row) => {
          const raw = col.accessor ? col.accessor(row) : (row as any)[colKey];
          if (!raw) return false;
          const rowTime = new Date(raw).getTime();
          if (Number.isNaN(rowTime)) return false;
          return rowTime >= fromTime && rowTime <= toTime;
        });
        return;
      }

      // Numeric Min/Max Filter
      if (col.filterType === 'number') {
        const { min, max } = filterVal || {};
        if (min !== undefined && min !== '') {
          result = result.filter((row) => {
            const val = col.accessor ? col.accessor(row) : (row as any)[colKey];
            return Number(val) >= Number(min);
          });
        }
        if (max !== undefined && max !== '') {
          result = result.filter((row) => {
            const val = col.accessor ? col.accessor(row) : (row as any)[colKey];
            return Number(val) <= Number(max);
          });
        }
        return;
      }

      // Text / Select Filter
      const normalizedFilter = String(filterVal).toLowerCase().trim();
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
        return orderedColumns.some((col) => {
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

        // Date comparison
        if (col?.filterType === 'date' || col?.filterType === 'datetime') {
          const timeA = new Date(valA).getTime();
          const timeB = new Date(valB).getTime();
          if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
            return direction === 'asc' ? timeA - timeB : timeB - timeA;
          }
        }

        // Numeric comparison
        if (typeof valA === 'number' && typeof valB === 'number') {
          return direction === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        return direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [serverSide, data, columns, orderedColumns, columnFilters, globalSearch, sortConfig]);

  const activeTotalPages = serverSide
    ? (totalPages ?? Math.max(1, Math.ceil((totalMatching ?? data.length) / activePageSize)))
    : Math.max(1, Math.ceil(processedData.length / activePageSize));

  const displayedData = useMemo(() => {
    if (!enablePagination || serverSide) {
      return processedData;
    }
    const start = (activePage - 1) * activePageSize;
    return processedData.slice(start, start + activePageSize);
  }, [enablePagination, serverSide, processedData, activePage, activePageSize]);

  // Date Filter Quick Presets
  const applyDatePreset = (colKey: string, preset: string) => {
    const now = new Date();
    let from = '';
    let to = '';

    const formatDateInput = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      from = formatDateInput(now);
      to = formatDateInput(now);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      from = formatDateInput(yest);
      to = formatDateInput(yest);
    } else if (preset === '7days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 7);
      from = formatDateInput(past);
      to = formatDateInput(now);
    } else if (preset === '30days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 30);
      from = formatDateInput(past);
      to = formatDateInput(now);
    } else if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      from = formatDateInput(startOfMonth);
      to = formatDateInput(now);
    }

    handleFilterChange(colKey, { from, to, preset });
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Table Toolbar */}
      {(enableSearch || isFiltered || enableColumnVisibility || customToolbarActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40">
          <div className="flex items-center space-x-3 flex-1 min-w-[240px]">
            {enableSearch && (
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGlobalSearch(val);
                    if (serverSide) {
                      onServerSearch?.(val);
                    } else {
                      setClientPage(1);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {globalSearch && (
                  <button
                    onClick={() => {
                      setGlobalSearch('');
                      if (serverSide) {
                        onServerSearch?.('');
                      } else {
                        setClientPage(1);
                      }
                    }}
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
              {serverSide ? (
                <>
                  Showing{' '}
                  {totalMatching === 0
                    ? 0
                    : `${(activePage - 1) * activePageSize + 1}–${Math.min(
                        activePage * activePageSize,
                        totalMatching ?? totalRecords ?? data.length
                      )}`}{' '}
                  of {totalMatching ?? totalRecords ?? data.length} records
                  {totalMatching !== undefined &&
                    totalRecords !== undefined &&
                    totalMatching !== totalRecords && (
                      <span className="text-blue-500 dark:text-blue-400 ml-1">
                        (filtered from {totalRecords} total)
                      </span>
                    )}
                </>
              ) : enablePagination ? (
                <>
                  Showing{' '}
                  {processedData.length === 0
                    ? 0
                    : `${(activePage - 1) * activePageSize + 1}–${Math.min(
                        activePage * activePageSize,
                        processedData.length
                      )}`}{' '}
                  of {processedData.length} records
                  {isFiltered && (
                    <span className="text-blue-500 dark:text-blue-400 ml-1">
                      (filtered from {data.length} total)
                    </span>
                  )}
                </>
              ) : (
                <>
                  Showing {processedData.length} of {data.length} records
                </>
              )}
            </span>

            {/* Column Visibility Menu */}
            {enableColumnVisibility && (
              <div className="relative inline-block text-left" ref={colVisibilityRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnVisibilityPopover((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    hiddenColumns.size > 0
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  title="Customize Column Visibility"
                >
                  <AdjustmentsHorizontalIcon className="w-4 h-4" />
                  <span>Columns</span>
                  {hiddenColumns.size > 0 && (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {columns.length - hiddenColumns.size}
                    </span>
                  )}
                </button>

                {showColumnVisibilityPopover && (
                  <div className="absolute right-0 z-40 mt-2 w-56 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Toggle Columns
                      </span>
                      <button
                        onClick={resetTableView}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                        title="Reset column order, widths and visibility"
                      >
                        Reset View
                      </button>
                    </div>

                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {columns.map((col) => {
                        const isVisible = !hiddenColumns.has(col.key);
                        const isNonHideable = col.hideable === false;
                        return (
                          <label
                            key={col.key}
                            className={`flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 cursor-pointer ${
                              isNonHideable ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          >
                            <span className="truncate pr-2 text-gray-700 dark:text-gray-300">
                              {col.header}
                            </span>
                            <input
                              type="checkbox"
                              checked={isVisible}
                              disabled={isNonHideable}
                              onChange={() => toggleColumnVisibility(col.key)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {customToolbarActions}
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div
        ref={tableContainerRef}
        style={{ maxHeight }}
        className={`overflow-x-auto w-full ${maxHeight ? 'overflow-y-auto' : ''}`}
      >
        <table className={`w-full text-left text-sm text-gray-600 dark:text-gray-300 border-collapse ${tableClassName}`}>
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 select-none sticky top-0 z-20">
            <tr>
              {orderedColumns.map((col) => {
                const isSorted = sortConfig?.key === col.key;
                const isFilteredCol = Boolean(columnFilters[col.key]);
                const isPopoverOpen = activeFilterColumn === col.key;

                const alignmentClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';

                const computedWidth =
                  columnWidths[col.key] !== undefined
                    ? `${columnWidths[col.key]}px`
                    : col.width;

                const isDropTarget = dragOverColKey === col.key;

                return (
                  <th
                    key={col.key}
                    draggable={enableColumnReordering && col.reorderable !== false}
                    onDragStart={(e) => handleDragStart(col.key, e)}
                    onDragOver={(e) => handleDragOver(col.key, e)}
                    onDrop={(e) => handleDrop(col.key, e)}
                    style={{
                      width: computedWidth,
                      minWidth: col.minWidth,
                      maxWidth: col.maxWidth,
                    }}
                    className={`px-6 py-4 relative group ${alignmentClass} ${
                      isDropTarget ? 'border-l-2 border-l-blue-500 bg-blue-50/20' : ''
                    } ${col.headerClassName || ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-2 ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      {/* Header Title with Click-to-Sort */}
                      <span
                        onClick={() => col.sortable && handleSort(col.key, col.sortable)}
                        className={`inline-flex items-center gap-1.5 transition-colors ${
                          col.sortable
                            ? 'cursor-pointer hover:text-gray-900 dark:hover:text-white'
                            : ''
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
                              setActiveFilterColumn((current) =>
                                current === col.key ? null : col.key
                              );
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
                              ref={filterPopoverRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute z-30 mt-2 left-0 w-72 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 normal-case font-normal animate-in fade-in zoom-in-95 duration-100"
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

                              {/* Intelligent Date / Datetime Range Filter */}
                              {col.filterType === 'date' || col.filterType === 'datetime' ? (
                                <div className="space-y-3">
                                  {/* Quick Preset Buttons */}
                                  <div className="flex flex-wrap gap-1.5 pb-1">
                                    {[
                                      { id: 'today', label: 'Today' },
                                      { id: 'yesterday', label: 'Yesterday' },
                                      { id: '7days', label: 'Last 7 Days' },
                                      { id: '30days', label: 'Last 30 Days' },
                                    ].map((preset) => (
                                      <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => applyDatePreset(col.key, preset.id)}
                                        className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                                          columnFilters[col.key]?.preset === preset.id
                                            ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                            : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Custom Date Range Inputs */}
                                  <div className="space-y-2">
                                    <div>
                                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        From Date:
                                      </label>
                                      <input
                                        type="date"
                                        value={columnFilters[col.key]?.from || ''}
                                        onChange={(e) =>
                                          handleFilterChange(col.key, {
                                            ...(columnFilters[col.key] || {}),
                                            from: e.target.value,
                                            preset: 'custom',
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        To Date:
                                      </label>
                                      <input
                                        type="date"
                                        value={columnFilters[col.key]?.to || ''}
                                        onChange={(e) =>
                                          handleFilterChange(col.key, {
                                            ...(columnFilters[col.key] || {}),
                                            to: e.target.value,
                                            preset: 'custom',
                                          })
                                        }
                                        className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : col.filterType === 'select' ? (
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
                              ) : col.filterType === 'number' ? (
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                                      Min:
                                    </label>
                                    <input
                                      type="number"
                                      value={columnFilters[col.key]?.min ?? ''}
                                      onChange={(e) =>
                                        handleFilterChange(col.key, {
                                          ...(columnFilters[col.key] || {}),
                                          min: e.target.value,
                                        })
                                      }
                                      className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                      placeholder="Minimum value"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                                      Max:
                                    </label>
                                    <input
                                      type="number"
                                      value={columnFilters[col.key]?.max ?? ''}
                                      onChange={(e) =>
                                        handleFilterChange(col.key, {
                                          ...(columnFilters[col.key] || {}),
                                          max: e.target.value,
                                        })
                                      }
                                      className="w-full px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                      placeholder="Maximum value"
                                    />
                                  </div>
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

                    {/* Interactive Column Resize Handle */}
                    {enableColumnResizing && col.resizable !== false && (
                      <div
                        onMouseDown={(e) => handleResizeStart(col.key, e)}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50 group-hover:bg-gray-300 dark:group-hover:bg-gray-700 select-none z-10 transition-colors"
                        title="Drag to resize column width"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={orderedColumns.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span>{loadingMessage}</span>
                  </div>
                </td>
              </tr>
            ) : displayedData.length === 0 ? (
              <tr>
                <td
                  colSpan={orderedColumns.length}
                  className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                >
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
              displayedData.map((row, rowIndex) => {
                const rowKey = keyExtractor(row, rowIndex);
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {orderedColumns.map((col) => {
                      const alignmentClass =
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';

                      const computedWidth =
                        columnWidths[col.key] !== undefined
                          ? `${columnWidths[col.key]}px`
                          : col.width;

                      return (
                        <td
                          key={col.key}
                          style={{
                            width: computedWidth,
                            minWidth: col.minWidth,
                            maxWidth: col.maxWidth,
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

      {/* Pagination Bar */}
      {enablePagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 dark:text-gray-400">Rows per page:</span>
              <select
                value={activePageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  if (serverSide) {
                    onPageSizeChange?.(newSize);
                  } else {
                    setClientPageSize(newSize);
                    setClientPage(1);
                  }
                }}
                className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Page <span className="font-bold text-gray-900 dark:text-white">{activePage}</span> of{' '}
              <span className="font-bold text-gray-900 dark:text-white">{activeTotalPages}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => {
                const nextP = Math.max(1, activePage - 1);
                if (serverSide) onPageChange?.(nextP);
                else setClientPage(nextP);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              Previous
            </button>

            {/* Quick page jump pills */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, activeTotalPages) }, (_, idx) => {
                let pNum: number;
                if (activeTotalPages <= 5) {
                  pNum = idx + 1;
                } else if (activePage <= 3) {
                  pNum = idx + 1;
                } else if (activePage >= activeTotalPages - 2) {
                  pNum = activeTotalPages - 4 + idx;
                } else {
                  pNum = activePage - 2 + idx;
                }
                const isCurrent = pNum === activePage;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => {
                      if (serverSide) onPageChange?.(pNum);
                      else setClientPage(pNum);
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={activePage >= activeTotalPages}
              onClick={() => {
                const nextP = Math.min(activeTotalPages, activePage + 1);
                if (serverSide) onPageChange?.(nextP);
                else setClientPage(nextP);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
