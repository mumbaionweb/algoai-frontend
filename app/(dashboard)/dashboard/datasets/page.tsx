'use client';

import DashboardNavigation from '@/components/layout/DashboardNavigation';
import Link from 'next/link';

export default function DatasetsPage() {
  const datasets = [
    {
      id: 'nse_equities',
      name: 'NSE Active Equities',
      description: 'Actively traded equities data retrieved from the National Stock Exchange of India (NSE). Includes symbol, series, date of listing, paid up value, market lot, ISIN number, and face value.',
      source: 'NSE India',
      status: 'Available',
      lastUpdated: 'Updated via Job',
    },
    {
      id: 'nifty50_historical',
      name: 'NIFTY 50 Historical',
      description: '5 Years of historical data for NIFTY 50 index across multiple timeframes (1m, 5m, 1h, 1D, 1W, 1M).',
      source: 'Zerodha',
      status: 'Pending Sync',
      lastUpdated: 'Not synced yet',
    },
    {
      id: 'nse_historical',
      name: 'NSE Stocks Historical',
      description: '5 Years of historical data for NSE equities across multiple timeframes (1m, 5m, 1h, 1D, 1W, 1M).',
      source: 'Zerodha',
      status: 'Pending Sync',
      lastUpdated: 'Not synced yet',
    },
    {
      id: 'bse_historical',
      name: 'BSE Stocks Historical',
      description: '5 Years of historical data for BSE equities across multiple timeframes (1m, 5m, 1h, 1D, 1W, 1M).',
      source: 'Zerodha',
      status: 'Pending Sync',
      lastUpdated: 'Not synced yet',
    },
    {
      id: 'bigquery_cache',
      name: 'BigQuery Backtest Cache',
      description: 'Historical OHLCV data automatically cached during past user backtests. Contains diverse ticker data at various timeframes.',
      source: 'AlgoAI / BigQuery',
      status: 'Available',
      lastUpdated: 'Real-time',
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <DashboardNavigation title="Algo AI" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Datasets</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            View and manage datasets available for market analysis, backtesting, and future BI dashboards.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dataset Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Source
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{dataset.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 max-w-md truncate" title={dataset.description}>
                        {dataset.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">{dataset.source}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400">
                        {dataset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {dataset.lastUpdated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/dashboard/datasets/${dataset.id}`}>
                        <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                          View Data
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
