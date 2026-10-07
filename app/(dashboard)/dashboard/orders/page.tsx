'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getStoredTransactions, deleteTransaction, bulkDeleteTransactions, updateTransaction } from '@/lib/api/transactions';

export default function OrdersPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, type: 'single' | 'bulk', id?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
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
    try {
      const { id, symbol, trade_type, trade_date_raw, quantity, price } = updatedTx;
      await updateTransaction(id, {
        symbol: symbol || '',
        trade_type: trade_type || 'buy',
        trade_date_raw: trade_date_raw || '',
        quantity: quantity || 0,
        price: price || 0
      });
      setTransactions(transactions.map(t => t.id === id ? updatedTx : t));
      setEditingTransaction(null);
    } catch (err: any) {
      console.error('Update failed:', err);
      alert('Failed to update: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTransactions(sortedTransactions.map(tx => tx.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  const handleSelectOne = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.checked) {
      setSelectedTransactions(prev => [...prev, id]);
    } else {
      setSelectedTransactions(prev => prev.filter(tId => tId !== id));
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'single', id });
  };

  const handleBulkDeleteClick = () => {
    setDeleteConfirmation({ isOpen: true, type: 'bulk' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsDeleting(true);
    
    try {
      if (deleteConfirmation.type === 'single' && deleteConfirmation.id) {
        await deleteTransaction(deleteConfirmation.id);
        setTransactions(transactions.filter(t => t.id !== deleteConfirmation.id));
        setSelectedTransactions(prev => prev.filter(tId => tId !== deleteConfirmation.id));
      } else if (deleteConfirmation.type === 'bulk') {
        await bulkDeleteTransactions(selectedTransactions);
        setTransactions(transactions.filter(t => !selectedTransactions.includes(t.id)));
        setSelectedTransactions([]);
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
      setDeleteConfirmation(null);
    }
  };

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans">
      <DashboardNavigation />
      
      {/* Delete Confirmation Modal */}
      {deleteConfirmation?.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="delete-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => !isDeleting && setDeleteConfirmation(null)}></div>
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="delete-modal-title">
                      {deleteConfirmation.type === 'bulk' ? 'Delete Transactions' : 'Delete Transaction'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {deleteConfirmation.type === 'bulk' 
                          ? `Are you sure you want to delete ${selectedTransactions.length} transactions? This action cannot be undone.`
                          : 'Are you sure you want to delete this transaction? This action cannot be undone.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50" 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button 
                  type="button" 
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50" 
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setEditingTransaction(null)}></div>
            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Transaction</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Symbol</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500" value={editingTransaction.symbol || ''} onChange={(e) => setEditingTransaction({...editingTransaction, symbol: e.target.value})} />
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
                    <input type="number" className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={editingTransaction.quantity || 0} onChange={(e) => setEditingTransaction({...editingTransaction, quantity: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price (₹)</label>
                    <input type="number" step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md p-2" value={editingTransaction.price || 0} onChange={(e) => setEditingTransaction({...editingTransaction, price: Number(e.target.value)})} />
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

        {selectedTransactions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg mb-4 flex items-center justify-between shadow-sm animate-fade-in-up">
            <span className="text-sm font-medium text-blue-800">{selectedTransactions.length} transactions selected</span>
            <button onClick={handleBulkDeleteClick} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              Delete Selected
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500 select-none">
                <tr>
                  <th className="px-4 py-4 w-24 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                        checked={sortedTransactions.length > 0 && selectedTransactions.length === sortedTransactions.length}
                        onChange={handleSelectAll} 
                      />
                      <span>Action</span>
                    </div>
                  </th>
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
                    <tr key={tx.id || idx} className={`hover:bg-gray-50 transition-colors ${selectedTransactions.includes(tx.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                            checked={selectedTransactions.includes(tx.id)}
                            onChange={(e) => handleSelectOne(e, tx.id)} 
                          />
                          <button 
                            onClick={() => setEditingTransaction(tx)}
                            className="text-gray-400 hover:text-blue-600 transition-colors inline-flex p-1 rounded-md hover:bg-blue-100"
                            title="Edit Transaction"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(tx.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors inline-flex p-1 rounded-md hover:bg-red-100"
                            title="Delete Transaction"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
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
