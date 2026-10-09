'use client';

import DashboardNavigation from '@/components/layout/DashboardNavigation';
import Link from 'next/link';
import { useState } from 'react';
import { ChartBarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const categories = [
  { id: 'index', name: 'Index' },
  { id: 'equity_historical', name: 'Equity Historical Data' },
];

const mockEquities = [
  {
    symbol: 'JIOFIN',
    name: 'Jio Financial Services Ltd',
    description: 'Financial services company operating in India, providing various financial solutions.',
    logo: 'J', 
    intervals: ['Minute', '5Minute', '15Minute', '60Minute', 'Day'],
  },
  {
    symbol: 'LTF',
    name: 'L&T Finance Holdings Ltd',
    description: 'Non-banking financial company offering a diverse range of financial products and services.',
    logo: 'L',
    intervals: ['Minute', '15Minute', 'Day'],
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Limited',
    description: 'Multinational conglomerate company, with businesses in energy, petrochemicals, natural gas, retail, and telecommunications.',
    logo: 'R',
    intervals: ['Minute', '5Minute', '15Minute', '60Minute', 'Day'],
  }
];

export default function DatasetsPage() {
  const [activeCategory, setActiveCategory] = useState('index');

  const indexDatasets = [
    {
      id: 'nse_equities',
      name: 'NSE Active Equities',
      description: 'Actively traded equities data retrieved from the National Stock Exchange of India (NSE). Includes symbol, series, date of listing, paid up value, market lot, ISIN number, and face value.',
      source: 'NSE India',
      status: 'Available',
      lastUpdated: 'Updated via Job',
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <DashboardNavigation title="Algo AI" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Datasets</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            View and manage datasets available for market analysis, backtesting, and future BI dashboards.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex justify-between items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                    activeCategory === category.id
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 mb-2'
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  {activeCategory === category.id && (
                    <span>▶</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Pane */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 min-h-[500px]">
              
              {activeCategory === 'index' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Index
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {indexDatasets.map((dataset) => (
                      <div key={dataset.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-3">
                            <DocumentTextIcon className="h-6 w-6 text-blue-500" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{dataset.name}</h3>
                          </div>
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400">
                            {dataset.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-3">
                          {dataset.description}
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>Source: {dataset.source}</span>
                          <Link href={`/dashboard/datasets/${dataset.id}`}>
                            <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                              View Dataset &rarr;
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'equity_historical' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                    Equity Historical Data
                  </h2>
                  <div className="space-y-6">
                    {mockEquities.map((equity) => (
                      <div key={equity.symbol} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/50">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                          <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-xl border border-blue-200 dark:border-blue-800">
                              {equity.logo}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {equity.symbol} 
                                <span className="text-xs font-normal px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">EQ</span>
                              </h3>
                              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{equity.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{equity.description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="p-5">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Available Datasets</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {equity.intervals.map((interval) => (
                              <Link key={interval} href={`/dashboard/datasets/bigquery_cache?symbol=${equity.symbol}&interval=${interval.toLowerCase()}`}>
                                <div className="flex flex-col items-center justify-center py-3 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-700 dark:hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all group">
                                  <ChartBarIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-700 dark:group-hover:text-blue-500 mb-1" />
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-500">{interval}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
