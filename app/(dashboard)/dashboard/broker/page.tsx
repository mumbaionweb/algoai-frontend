'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import Link from 'next/link';
import { formatDate } from '@/utils/dateUtils';
import {
  getAvailableBrokers,
  getBrokerCredentials,
  createBrokerCredentials,
  updateBrokerCredentials,
  deleteBrokerCredentials,
  initiateBrokerOAuth,
  refreshBrokerToken,
  getBrokerOAuthStatus,
  getBrokerUserProfile,
  getBrokerConnectionHistory,
} from '@/lib/api/broker';
import type { BrokerHistoryResponse } from '@/lib/api/broker';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerCredentialsUpdate,
  BrokerType,
  BrokerUserProfile,
  OAuthStatus,
} from '@/types';

function BrokerPageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [availableBrokers, setAvailableBrokers] = useState<BrokerInfo[]>([]);
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  
  // Track OAuth connection status per credential ID
  // Key: credential ID, Value: true if OAuth is connected, false if not
  const [oauthConnectionStatus, setOauthConnectionStatus] = useState<Record<string, boolean>>({});

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profile, setProfile] = useState<BrokerUserProfile | null>(null);
  const [profileCredentialsId, setProfileCredentialsId] = useState<string | null>(null);

  // Token & connection audit history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyData, setHistoryData] = useState<BrokerHistoryResponse | null>(null);
  const [historyCredentialsId, setHistoryCredentialsId] = useState<string | null>(null);

  // OAuth status with token details
  const [oauthStatuses, setOauthStatuses] = useState<Record<string, OAuthStatus>>({});

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    broker_type: '' as BrokerType,
    api_key: '',
    api_secret: '',
    label: '',
    broker_user_id: '',
    zerodha_user_id: '',
    is_active: true,
  });

  // Handle OAuth callback for any broker
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const isSuccess = oauthStatus === 'success' || searchParams.get('success') === 'true';
    const isError = oauthStatus === 'error' || searchParams.get('error') !== null;
    const broker = searchParams.get('broker') || 'broker';
    const brokerName = broker === 'paytm_money' ? 'Paytm Money' : broker === 'zerodha' ? 'Zerodha' : broker;
    const message = searchParams.get('message') || searchParams.get('error');

    if (isSuccess) {
      setSuccess(`${brokerName} connected successfully!`);
      router.replace('/dashboard/broker');
      if (isAuthenticated) {
        setTimeout(() => {
          loadData();
        }, 1000);
      }
    } else if (isError) {
      const decodedMessage = message ? decodeURIComponent(message) : 'Unknown error';
      setError(`Failed to connect ${brokerName}: ${decodedMessage}`);
      router.replace('/dashboard/broker');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, isAuthenticated]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [brokers, creds] = await Promise.all([
        getAvailableBrokers(),
        getBrokerCredentials(),
      ]);
      setAvailableBrokers(brokers);
      setCredentials(creds);
      
      // Check OAuth token status from backend for all credentials
      const brokerCreds = creds.filter((cred) => cred.broker_type === 'zerodha' || cred.broker_type === 'paytm_money');
      
      if (brokerCreds.length > 0) {
        const tokenStatusChecks = await Promise.allSettled(
          brokerCreds.map(async (cred) => {
            try {
              const status = await getBrokerOAuthStatus(cred.broker_type, cred.id);
              
              setOauthStatuses((prev) => ({
                ...prev,
                [cred.id]: status,
              }));

              let isTokenValid = status.is_connected && status.has_tokens;
              if (isTokenValid) {
                try {
                  await getBrokerUserProfile(cred.broker_type, cred.id);
                } catch (profileErr: any) {
                  // Any profile fetch failure means broker token is expired or invalid
                  console.warn(`Broker token expired or invalid for [${cred.broker_type}:${cred.id}]:`, profileErr.response?.data?.detail || profileErr.message);
                  isTokenValid = false;
                }
              }
              
              return { credId: cred.id, isConnected: isTokenValid };
            } catch (err: any) {
              return { credId: cred.id, isConnected: false };
            }
          })
        );
        
        setOauthConnectionStatus((prev) => {
          const updated = { ...prev };
          tokenStatusChecks.forEach((result) => {
            if (result.status === 'fulfilled') {
              const { credId, isConnected } = result.value;
              updated[credId] = isConnected;
            }
          });
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Failed to load broker data:', err);
      setError(err.response?.data?.detail || 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate Zerodha User ID for Zerodha broker
    if (formData.broker_type === 'zerodha') {
      if (!formData.zerodha_user_id || formData.zerodha_user_id.trim() === '') {
        setError('Zerodha User ID is required for Zerodha broker');
        return;
      }
    }

    try {
      if (editingId) {
        // Update existing
        const updatePayload: BrokerCredentialsUpdate = {
          api_key: formData.api_key,
          api_secret: formData.api_secret,
          label: formData.label || null,
          is_active: formData.is_active,
        };
        
        // Include broker_user_id and zerodha_user_id
        if (formData.broker_type === 'zerodha') {
          updatePayload.zerodha_user_id = formData.zerodha_user_id || null;
          updatePayload.broker_user_id = formData.zerodha_user_id || null;
        } else if (formData.broker_user_id) {
          updatePayload.broker_user_id = formData.broker_user_id || null;
        }
        
        await updateBrokerCredentials(editingId, updatePayload);
        setSuccess('Credentials updated successfully');
      } else {
        // Create new
        const newCreds: BrokerCredentialsCreate = {
          broker_type: formData.broker_type,
          api_key: formData.api_key,
          api_secret: formData.api_secret,
          label: formData.label || null,
          is_active: formData.is_active,
        };
        
        // Include broker_user_id and zerodha_user_id
        if (formData.broker_type === 'zerodha') {
          newCreds.zerodha_user_id = formData.zerodha_user_id || null;
          newCreds.broker_user_id = formData.zerodha_user_id || null;
        } else if (formData.broker_user_id) {
          newCreds.broker_user_id = formData.broker_user_id || null;
        }
        
        await createBrokerCredentials(newCreds);
        setSuccess('Credentials added successfully');
      }

      // Reset form and reload
      setFormData({
        broker_type: '' as BrokerType,
        api_key: '',
        api_secret: '',
        label: '',
        broker_user_id: '',
        zerodha_user_id: '',
        is_active: true,
      });
      setShowAddForm(false);
      setEditingId(null);
      await loadData();
      
      // Show success message
      setSuccess('Credentials saved successfully! You can now connect to your broker account.');
    } catch (err: any) {
      console.error('Failed to save credentials:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle decryption-related errors during save
      if (err.response?.status === 500 && (errorDetail.includes('decrypt') || errorDetail.includes('encrypt'))) {
        setError('Failed to save credentials due to encryption error. Please try again or contact support.');
      } else {
        setError(errorDetail || 'Failed to save credentials');
      }
    }
  };

  const handleEdit = (cred: BrokerCredentials) => {
    setEditingId(cred.id);
    setFormData({
      broker_type: cred.broker_type,
      api_key: cred.api_key, // This will be masked, user needs to re-enter
      api_secret: '', // Secret is never shown, user needs to re-enter
      label: cred.label || '',
      broker_user_id: cred.broker_user_id || cred.zerodha_user_id || '',
      zerodha_user_id: cred.zerodha_user_id || cred.broker_user_id || '',
      is_active: cred.is_active,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) {
      return;
    }

    try {
      await deleteBrokerCredentials(id);
      setSuccess('Credentials deleted successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete credentials:', err);
      setError(err.response?.data?.detail || 'Failed to delete credentials');
    }
  };

  const handleConnect = async (cred: BrokerCredentials) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);

      const response = await initiateBrokerOAuth(cred.broker_type, cred.id);
      if (response.login_url) {
        window.location.href = response.login_url;
      } else {
        setError('Failed to get login URL from server');
      }
    } catch (err: any) {
      console.error('Failed to initiate OAuth:', err);
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to initiate broker connection';
      setError(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (cred: BrokerCredentials) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);

      const res = await refreshBrokerToken(cred.broker_type, cred.id);
      if (res?.login_url) {
        window.location.href = res.login_url;
      } else {
        setSuccess('Token refreshed successfully!');
        await loadData();
      }
    } catch (err: any) {
      console.error('Failed to refresh token:', err);
      // Fallback to full OAuth connect flow
      await handleConnect(cred);
    } finally {
      setLoading(false);
    }
  };

  // Backward compatibility alias
  const handleZerodhaOAuth = async (credentialsId?: string) => {
    const cred = credentials.find(c => c.id === credentialsId) || credentials.find(c => c.broker_type === 'zerodha');
    if (cred) {
      await handleConnect(cred);
    }
  };

  const handleViewProfile = async (credentialsId: string) => {
    try {
      const cred = credentials.find(c => c.id === credentialsId);
      if (!cred) return;
      setProfileLoading(true);
      setProfileError('');
      setProfile(null);
      setProfileCredentialsId(credentialsId);
      setShowProfileModal(true);

      const profileData = await getBrokerUserProfile(cred.broker_type, credentialsId);
      setProfile(profileData);
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to fetch user profile';
      setProfileError(errorDetail);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleViewHistory = async (credentialsId: string) => {
    try {
      const cred = credentials.find(c => c.id === credentialsId);
      if (!cred) return;
      setHistoryLoading(true);
      setHistoryError('');
      setHistoryData(null);
      setHistoryCredentialsId(credentialsId);
      setShowHistoryModal(true);

      const history = await getBrokerConnectionHistory(credentialsId);
      setHistoryData(history);
    } catch (err: any) {
      console.error('Failed to fetch broker history:', err);
      const errorDetail = err.response?.data?.detail || err.message || 'Failed to fetch connection history';
      setHistoryError(errorDetail);
    } finally {
      setHistoryLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      broker_type: '' as BrokerType,
      api_key: '',
      api_secret: '',
      label: '',
      broker_user_id: '',
      zerodha_user_id: '',
      is_active: true,
    });
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* Header */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold text-white mb-2">Broker Configuration</h2>
                <p className="text-gray-400">
                  Manage your broker connections and API credentials for trading integrations.
                </p>
              </div>
              {!showAddForm && (
                <div className="flex gap-2">
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                    title="Refresh credentials list"
                  >
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                <button
                  onClick={() => setShowAddForm(true)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  Add Broker
                </button>
                </div>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                {editingId ? 'Edit Credentials' : 'Add New Broker Credentials'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Broker Type *
                  </label>
                  <select
                    value={formData.broker_type}
                    onChange={(e) => {
                      const newBrokerType = e.target.value as BrokerType;
                      setFormData({
                        ...formData,
                        broker_type: newBrokerType,
                        broker_user_id: '',
                        zerodha_user_id: '',
                      });
                    }}
                    required
                    disabled={!!editingId}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select broker...</option>
                    {availableBrokers.map((broker) => (
                      <option key={broker.type} value={broker.type}>
                        {broker.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., My Trading Account"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key *
                  </label>
                  <input
                    type="text"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    required
                    placeholder="Enter your API key"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Secret *
                  </label>
                  <input
                    type="password"
                    value={formData.api_secret}
                    onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                    required={!editingId}
                    placeholder={editingId ? 'Leave blank to keep existing' : 'Enter your API secret'}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {editingId && (
                    <p className="mt-1 text-xs text-gray-400">
                      Leave blank to keep the existing secret. Enter new secret to update it.
                    </p>
                  )}
                </div>

                {/* Broker User ID */}
                {formData.broker_type === 'zerodha' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Zerodha User ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zerodha_user_id}
                      onChange={(e) => setFormData({ ...formData, zerodha_user_id: e.target.value, broker_user_id: e.target.value })}
                      required
                      placeholder="Enter your Zerodha User ID (e.g., AB1234)"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      This is your Zerodha user ID. You can find it in your Zerodha Kite Connect app settings or after completing OAuth.
                    </p>
                  </div>
                ) : formData.broker_type === 'paytm_money' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Paytm Money User ID <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.broker_user_id}
                      onChange={(e) => setFormData({ ...formData, broker_user_id: e.target.value })}
                      placeholder="Enter your Paytm Money User ID (optional)"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Auto-populated once you complete OAuth login, or you can enter it here.
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="ml-2 text-sm text-gray-300">
                    Active (use these credentials for trading)
                  </label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {editingId ? 'Update' : 'Add'} Credentials
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Credentials List */}
          {loading ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-4">No broker credentials configured yet.</p>
              <p className="text-sm text-gray-500">
                Click "Add Broker" to start connecting your trading account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {credentials.map((cred) => {
                const broker = availableBrokers.find((b) => b.type === cred.broker_type);
                const isConnected = oauthConnectionStatus[cred.id] === true;
                const isFullyActive = cred.is_active && isConnected;
                const brokerUserId = cred.broker_user_id || cred.zerodha_user_id || oauthStatuses[cred.id]?.user_id;
                const brokerTitle = broker?.name || (cred.broker_type === 'paytm_money' ? 'Paytm Money' : cred.broker_type === 'zerodha' ? 'Zerodha' : cred.broker_type);

                return (
                  <div
                    key={cred.id}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  >
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {brokerTitle}
                          </h3>
                          {cred.label && (
                            <span className="text-sm text-gray-400">({cred.label})</span>
                          )}
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${
                              isFullyActive
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-gray-500/10 text-gray-400'
                            }`}
                          >
                            {isFullyActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2 break-words">
                          API Key: {cred.api_key.substring(0, 8)}...
                        </p>
                        {brokerUserId && (
                          <p className="text-sm text-gray-400 mb-2">
                            {brokerTitle} User ID: <span className="text-white font-medium">{brokerUserId}</span>
                          </p>
                        )}
                        {/* Display token details if available from OAuth status */}
                        {oauthStatuses[cred.id]?.token_details && (
                          <div className="text-xs text-gray-500 mb-2">
                            Access Token: {oauthStatuses[cred.id].token_details!.access_token_present ? (
                              <span className="text-green-400">✓ Present ({oauthStatuses[cred.id].token_details!.access_token_length} chars)</span>
                            ) : (
                              <span className="text-red-400">✗ Missing</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Created: {formatDate(cred.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                        {!isConnected ? (
                          <button
                            onClick={() => handleConnect(cred)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                            disabled={loading}
                            title={`Connect to ${brokerTitle} using these credentials`}
                          >
                            Connect
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRefresh(cred)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                              disabled={loading}
                              title={`Refresh ${brokerTitle} access token`}
                            >
                              Refresh Token
                            </button>
                            <button
                              onClick={() => handleViewProfile(cred.id)}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                              disabled={loading}
                              title={`View ${brokerTitle} user profile`}
                            >
                              Profile
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleViewHistory(cred.id)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                          disabled={loading}
                          title={`View ${brokerTitle} token and connection history for auditability`}
                        >
                          History
                        </button>
                        <button
                          onClick={() => handleEdit(cred)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(cred.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Back to Dashboard */}
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                {(() => {
                  const cred = credentials.find(c => c.id === profileCredentialsId);
                  const broker = availableBrokers.find(b => b.type === cred?.broker_type);
                  return `${broker?.name || (cred?.broker_type === 'paytm_money' ? 'Paytm Money' : cred?.broker_type === 'zerodha' ? 'Zerodha' : 'Broker')} User Profile`;
                })()}
              </h2>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfile(null);
                  setProfileError('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {profileLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="mt-4 text-gray-400">Loading profile...</p>
                </div>
              ) : profileError ? (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                  {profileError}
                  {profileError.includes('OAuth') && (
                    <div className="mt-4">
                      {(() => {
                        const cred = credentials.find(c => c.id === profileCredentialsId);
                        const broker = availableBrokers.find(b => b.type === cred?.broker_type);
                        const title = broker?.name || (cred?.broker_type === 'paytm_money' ? 'Paytm Money' : 'Zerodha');
                        return cred ? (
                          <button
                            onClick={() => handleConnect(cred)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                          >
                            Connect to {title}
                          </button>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              ) : profile ? (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">User ID</p>
                        <p className="text-white font-medium">{profile.user_id || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Name</p>
                        <p className="text-white font-medium">{profile.user_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Email</p>
                        <p className="text-white font-medium">{profile.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">User Type</p>
                        <p className="text-white font-medium capitalize">{profile.user_type || 'individual'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Broker</p>
                        <p className="text-white font-medium">{profile.broker || 'N/A'}</p>
                      </div>
                      {profile.avatar_url && (
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Avatar</p>
                          <img src={profile.avatar_url} alt="Profile" className="w-16 h-16 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exchanges */}
                  {profile.exchanges && profile.exchanges.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Enabled Exchanges / Segments</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.exchanges.map((exchange: string) => (
                          <span
                            key={exchange}
                            className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium"
                          >
                            {exchange}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {profile.products && profile.products.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Enabled Products</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.products.map((product: string) => (
                          <span
                            key={product}
                            className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm font-medium"
                          >
                            {product}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order Types */}
                  {profile.order_types && profile.order_types.length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Enabled Order Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.order_types.map((orderType: string) => (
                          <span
                            key={orderType}
                            className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium"
                          >
                            {orderType}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Information / Metadata */}
                  {profile.meta && Object.keys(profile.meta).length > 0 && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
                      <div className="space-y-2">
                        {Object.entries(profile.meta).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-sm text-gray-400 mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                            <p className="text-white font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Token & Connection Audit History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center shrink-0 rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Token & Connection History</span>
                  {(() => {
                    const cred = credentials.find(c => c.id === historyCredentialsId);
                    const broker = availableBrokers.find(b => b.type === cred?.broker_type);
                    const name = broker?.name || (cred?.broker_type === 'paytm_money' ? 'Paytm Money' : cred?.broker_type === 'zerodha' ? 'Zerodha' : 'Broker');
                    return <span className="text-sm font-normal text-gray-400">({name})</span>;
                  })()}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Full audit log of connection sessions, OAuth token generation, refreshes, and access lifecycle.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => historyCredentialsId && handleViewHistory(historyCredentialsId)}
                  disabled={historyLoading}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  title="Refresh history log"
                >
                  <svg className={`w-5 h-5 ${historyLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setHistoryData(null);
                    setHistoryError('');
                  }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {historyLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="mt-4 text-sm text-gray-400">Loading audit history...</p>
                </div>
              ) : historyError ? (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {historyError}
                </div>
              ) : historyData ? (
                <>
                  {/* Summary Header Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-900/60 border border-gray-700/60 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Session Status</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${historyData.is_connected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                        <span className={`text-sm font-semibold ${historyData.is_connected ? 'text-green-400' : 'text-red-400'}`}>
                          {historyData.is_connected ? 'Active / Connected' : 'Disconnected / Expired'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-900/60 border border-gray-700/60 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Broker User ID</div>
                      <div className="mt-1 text-sm font-semibold text-white truncate">
                        {historyData.broker_user_id || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-900/60 border border-gray-700/60 rounded-lg p-3">
                      <div className="text-xs text-gray-400">Last Token Issued</div>
                      <div className="mt-1 text-sm font-medium text-gray-200">
                        {historyData.token_updated_at ? formatDate(historyData.token_updated_at) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Audit Log Entries */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                        Audit Trail ({historyData.history.length})
                      </h3>
                      <span className="text-xs text-gray-400">Chronological history</span>
                    </div>

                    {historyData.history.length === 0 ? (
                      <div className="text-center py-8 bg-gray-900/40 border border-gray-800 rounded-lg">
                        <p className="text-sm text-gray-400">No events recorded yet for this connection.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {historyData.history.map((item, idx) => {
                          const isSuccess = item.status === 'SUCCESS' || item.status === 'ACTIVE';
                          const isFailure = item.status === 'FAILED' || item.status === 'ERROR' || item.status === 'EXPIRED';

                          return (
                            <div
                              key={item.id || idx}
                              className="bg-gray-900/70 border border-gray-700/70 hover:border-gray-600 rounded-lg p-4 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 text-xs font-semibold rounded uppercase tracking-wider ${
                                      isSuccess
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                        : isFailure
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                  <h4 className="text-sm font-semibold text-white">
                                    {item.event_title || item.event_type}
                                  </h4>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {formatDate(item.timestamp)}
                                </div>
                              </div>

                              <p className="text-xs text-gray-300 mb-2 leading-relaxed">
                                {item.details}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800/80 text-[11px] text-gray-400">
                                <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">
                                  Channel: {item.channel || 'System'}
                                </span>
                                {item.event_type && (
                                  <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                                    Event: {item.event_type}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex justify-end shrink-0 rounded-b-xl">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryData(null);
                  setHistoryError('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrokerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <BrokerPageContent />
    </Suspense>
  );
}
