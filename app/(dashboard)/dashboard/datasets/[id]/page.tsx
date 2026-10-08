'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getDatasetData, getBigqueryCacheRawData } from '@/lib/api/datasets';

export default function DatasetViewPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data modal state
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchData(params.id as string);
    }
  }, [params.id]);

  const fetchData = async (datasetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDatasetData(datasetId);
      setData(res.data || []);
      setDatasetInfo({
        name: res.name || 'Dataset',
        count: res.count || 0
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dataset data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRawData = async (row: any) => {
    setSelectedGroup(row);
    setRawLoading(true);
    setRawError(null);
    try {
      const res = await getBigqueryCacheRawData(row.symbol, row.exchange, row.interval);
      setRawData(res.data || []);
    } catch (err: any) {
      setRawError(err.message || 'Failed to load raw data points');
    } finally {
      setRawLoading(false);
    }
  };
  
  const closeRawModal = () => {
    setSelectedGroup(null);
    setRawData([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <DashboardNavigation title="Algo AI" />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-center items-center h-[60vh]">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <span className="ml-3 text-gray-500 dark:text-gray-400">Loading dataset...</span>
        </main>
      </div>
    );
  }

  // Extract keys for table headers based on the first data row
  const headers = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'id') : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <DashboardNavigation title="Algo AI" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button 
                onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {datasetInfo?.name || 'Dataset View'}
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Showing top {data.length} records.
            </p>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-6 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No data found in this dataset.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    {headers.map((header) => (
                      <th 
                        key={header} 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {header.replace(/_/g, ' ')}
                      </th>
                    ))}
                    {params.id === 'bigquery_cache' && (
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {data.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      {headers.map((header) => (
                        <td key={`${index}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                          {row[header] !== null && row[header] !== undefined ? String(row[header]) : '-'}
                        </td>
                      ))}
                      {params.id === 'bigquery_cache' && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => fetchRawData(row)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            View Data
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Raw Data Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={closeRawModal}></div>

            {/* Modal panel */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full border border-gray-200 dark:border-gray-700">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                      Data Points: {selectedGroup.symbol} ({selectedGroup.exchange}) - {selectedGroup.interval}
                    </h3>
                    
                    <div className="mt-4">
                      {rawLoading ? (
                        <div className="py-12 flex justify-center">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                        </div>
                      ) : rawError ? (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md text-red-600 dark:text-red-400 text-sm border-l-4 border-red-500">
                          {rawError}
                        </div>
                      ) : rawData.length === 0 ? (
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-8 text-center border border-gray-200 dark:border-gray-700">
                          <p className="text-gray-500 dark:text-gray-400">No raw data points found.</p>
                        </div>
                      ) : (
                        <div className="overflow-y-auto max-h-[60vh] border border-gray-200 dark:border-gray-700 rounded-md">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
                              <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Time</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Open</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">High</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Low</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Close</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Volume</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {rawData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                    {row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">{row.open?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">{row.high?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">{row.low?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">{row.close?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-300">{row.volume?.toLocaleString() || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
                <button 
                  type="button" 
                  onClick={closeRawModal}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
