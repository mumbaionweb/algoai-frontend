'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBrokerCredentials } from '@/lib/api/broker';
import { uploadTransactionsCSV } from '@/lib/api/transactions';
import type { BrokerCredentials } from '@/types';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface ImportTradebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function ImportTradebookModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportTradebookModalProps) {
  const [selectedBroker, setSelectedBroker] = useState<'zerodha' | 'paytm_money' | 'other'>('paytm_money');
  const [brokerUserId, setBrokerUserId] = useState<string>('');
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch connected broker credentials on mount to help user select active user IDs
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    (async () => {
      try {
        const creds = await getBrokerCredentials(undefined, false).catch(() => []);
        if (isMounted) {
          setCredentials(creds || []);
          // Auto-select initial user id for selected broker if available
          const matchingCred = (creds || []).find(
            (c) => c.broker_type === selectedBroker || (selectedBroker === 'paytm_money' && c.broker_type === 'paytm_money')
          );
          if (matchingCred) {
            setBrokerUserId(matchingCred.broker_user_id || matchingCred.zerodha_user_id || '');
          }
        }
      } catch {
        // Soft fail
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedBroker]);

  // When broker radio changes, try to auto-populate corresponding credential user_id
  const handleBrokerChange = (broker: 'zerodha' | 'paytm_money' | 'other') => {
    setSelectedBroker(broker);
    setError(null);
    const matching = credentials.find((c) => {
      if (broker === 'zerodha') return c.broker_type === 'zerodha';
      if (broker === 'paytm_money') return c.broker_type === 'paytm_money';
      return false;
    });
    if (matching) {
      setBrokerUserId(matching.broker_user_id || matching.zerodha_user_id || '');
    } else {
      setBrokerUserId('');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setError(null);
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.xlsx') && !fname.endsWith('.xls') && !fname.endsWith('.csv')) {
      setError('Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a tradebook file to upload.');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const brokerName =
        selectedBroker === 'paytm_money'
          ? 'Paytm Money'
          : selectedBroker === 'zerodha'
          ? 'Zerodha'
          : 'Other';

      const res = await uploadTransactionsCSV(
        selectedFile,
        'default',
        selectedBroker,
        brokerName,
        brokerUserId.trim() || undefined
      );

      const msg = res.message || 'Tradebook successfully imported!';
      onSuccess(msg);
      handleClose();
    } catch (err: any) {
      console.error('Tradebook upload failed:', err);
      setError(err.message || 'Failed to import tradebook. Please verify file columns and format.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-750 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <ArrowUpTrayIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                Import Tradebook
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Import historical trade transactions across your brokers
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Broker Selector Cards */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              1. Select Broker
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Paytm Money Card */}
              <button
                type="button"
                onClick={() => handleBrokerChange('paytm_money')}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  selectedBroker === 'paytm_money'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#002e6e]/20 text-[#00baf2] border border-[#00baf2]/35 flex items-center justify-center font-black text-xs shrink-0">
                  PM
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    Paytm Money
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    Excel Tradebook
                  </div>
                </div>
              </button>

              {/* Zerodha Card */}
              <button
                type="button"
                onClick={() => handleBrokerChange('zerodha')}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  selectedBroker === 'zerodha'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L3 11.5l9 9.5 9-9.5L12 2zm0 4.2l5.5 5.8-5.5 5.8-5.5-5.8 5.5-5.8z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    Zerodha
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    CSV / Excel Console
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Broker User ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                2. Broker User ID / UCC
              </label>
              {credentials.length > 0 && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  Select from connected credentials below
                </span>
              )}
            </div>

            {/* Quick picker pills if connected credentials exist */}
            {credentials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {credentials
                  .filter((c) =>
                    selectedBroker === 'paytm_money'
                      ? c.broker_type === 'paytm_money'
                      : selectedBroker === 'zerodha'
                      ? c.broker_type === 'zerodha'
                      : true
                  )
                  .map((c) => {
                    const uId = c.broker_user_id || c.zerodha_user_id || '';
                    if (!uId) return null;
                    const isSelected = brokerUserId === uId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setBrokerUserId(uId)}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          isSelected
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40 font-semibold'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {uId} {c.label ? `(${c.label})` : ''}
                      </button>
                    );
                  })}
              </div>
            )}

            <input
              type="text"
              value={brokerUserId}
              onChange={(e) => setBrokerUserId(e.target.value)}
              placeholder={
                selectedBroker === 'paytm_money'
                  ? 'e.g. HE215811 (Paytm Money UCC)'
                  : 'e.g. YA0070 (Zerodha User ID)'
              }
              className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
              {selectedBroker === 'paytm_money'
                ? 'For Paytm Money, this is your UCC (found in Row 1 / Cell B1 of the Excel tradebook). If left blank, it will be automatically extracted from the file.'
                : 'Account ID used to tag the imported transactions.'}
            </p>
          </div>

          {/* File Dropzone */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              3. Upload Tradebook File
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileInput}
              className="hidden"
            />

            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50/40 dark:bg-gray-800/40'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-2.5">
                  <DocumentArrowUpIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  Click to select or drag and drop tradebook file
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-750/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-profit-subtle text-profit flex items-center justify-center shrink-0">
                    <CheckCircleIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                <span>Import Trades</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
