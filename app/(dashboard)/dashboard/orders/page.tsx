'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getStoredTransactions } from '@/lib/api/transactions';

export default function OrdersPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  
  // Sort and filter state
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadTransactions();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getStoredTransactions();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    return type?.toLowerCase() === 'buy' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-orange-600 bg-orange-50 border-orange-200';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split(' ')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return (
       <svg className="w-3 h-3 ml-1 text-gray-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
    );
    if (sortConfig.direction === 'asc') return (
       <svg className="w-3 h-3 ml-1 text-blue-600 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
    );
    return (
       <svg className="w-3 h-3 ml-1 text-blue-600 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
    );
  };

  // Filter and sort logic
  const filteredTransactions = transactions.filter(tx => 
    tx.symbol?.toLowerCase().includes(filterText.toLowerCase()) || 
    tx.trade_type?.toLowerCase().includes(filterText.toLowerCase()) ||
    tx.order_id?.toLowerCase().includes(filterText.toLowerCase())
  );

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aVal: any = '';
    let bVal: any = '';
    
    switch (sortConfig.key) {
      case 'date':
        // Standardize sorting by parsing YYYY-MM-DD correctly
        aVal = new Date(a.trade_date_raw?.split(' ')[0] || 0).getTime();
        bVal = new Date(b.trade_date_raw?.split(' ')[0] || 0).getTime();
        break;
      case 'symbol':
        aVal = a.symbol || '';
        bVal = b.symbol || '';
        break;
      case 'type':
        aVal = a.trade_type || '';
        bVal = b.trade_type || '';
        break;
      case 'qty':
        aVal = a.quantity || 0;
        bVal = b.quantity || 0;
        break;
      case 'price':
        aVal = a.price || 0;
        bVal = b.price || 0;
        break;
      case 'value':
        aVal = (a.quantity || 0) * (a.price || 0);
        bVal = (b.quantity || 0) * (b.price || 0);
        break;
      case 'broker':
        aVal = a.broker_id || a.broker || 'Default';
        bVal = b.broker_id || b.broker || 'Default';
        break;
      case 'order_id':
        aVal = a.order_id || '';
        bVal = b.order_id || '';
        break;
    }
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSaveEdit = async (updatedTx: any) => {
    // Optimistic update in UI
    setTransactions(transactions.map(t => t.id === updatedTx.id ? updatedTx : t));
    setEditingTransaction(null);
    alert("Transaction update functionality will be fully saved to database once API is implemented.");
  };

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans">
      <DashboardNavigation />
      
      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setEditingTransaction(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Transaction</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Symbol</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" value={editingTransaction.symbol} onChange={(e) => setEditingTransaction({...editingTransaction, symbol: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={editingTransaction.trade_type} onChange={(e) => setEditingTransaction({...editingTransaction, trade_type: e.target.value})}>
                      <option value="buy">BUY</option>
                      <option value="sell">SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={formatDate(editingTransaction.trade_date_raw)} onChange={(e) => setEditingTransaction({...editingTransaction, trade_date_raw: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input type="number" className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={editingTransaction.quantity} onChange={(e) => setEditingTransaction({...editingTransaction, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price (₹)</label>
                    <input type="number" step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={editingTransaction.price} onChange={(e) => setEditingTransaction({...editingTransaction, price: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm" onClick={() => handleSaveEdit(editingTransaction)}>
                  Save Changes
                </button>
                <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" onClick={() => setEditingTransaction(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Transactions History</h1>
            <p className="text-gray-600">Overview of all your executed trades and historical transactions.</p>
          </div>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
             </div>
             <input
               type="text"
               className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
               placeholder="Filter symbol, type, order ID..."
               value={filterText}
               onChange={(e) => setFilterText(e.target.value)}
             />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500 select-none">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">Action</th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('date')}>
                    Date {getSortIcon('date')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('symbol')}>
                    Symbol {getSortIcon('symbol')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('type')}>
                    Type {getSortIcon('type')}
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('qty')}>
                    Qty {getSortIcon('qty')}
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('price')}>
                    Price {getSortIcon('price')}
                  </th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => requestSort('value')}>
                    Total Value {getSortIcon('value')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('broker')}>
                    Broker / Profile {getSortIcon('broker')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('order_id')}>
                    Order ID {getSortIcon('order_id')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <p>Loading transactions...</p>
                    </td>
                  </tr>
                ) : sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                      {filterText ? 'No matching transactions found.' : 'No historical transactions found. Upload a tradebook from the Stocks page to get started.'}
                    </td>
                  </tr>
                ) : (
                  sortedTransactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => setEditingTransaction(tx)}
                          className="text-gray-400 hover:text-blue-600 transition-colors inline-flex p-1 rounded-md hover:bg-blue-50"
                          title="Edit Transaction"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.trade_date_raw)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{tx.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 border rounded text-xs font-semibold uppercase ${getTransactionColor(tx.trade_type)}`}>
                          {tx.trade_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{tx.quantity}</td>
                      <td className="px-6 py-4 text-right text-gray-900">₹{tx.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">₹{(tx.quantity * tx.price)?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 capitalize text-gray-500">
                        {tx.broker_id || tx.broker || 'Default'} <span className="text-gray-300 mx-1">|</span> {tx.profile_id || 'Default'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">{tx.order_id || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && transactions.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 text-sm text-gray-500 border-t border-gray-200 flex justify-between items-center">
              <span>Showing {sortedTransactions.length} of {transactions.length} historical transactions</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
