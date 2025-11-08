'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Link from 'next/link';
import {
  getAvailableBrokers,
  getBrokerCredentials,
  createBrokerCredentials,
  updateBrokerCredentials,
  deleteBrokerCredentials,
  initiateZerodhaOAuth,
  refreshZerodhaToken,
} from '@/lib/api/broker';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerType,
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

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    broker_type: '' as BrokerType,
    api_key: '',
    api_secret: '',
    label: '',
    is_active: true,
  });

  // Handle OAuth callback from Zerodha
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const broker = searchParams.get('broker');
    const message = searchParams.get('message');

    if (oauthStatus === 'success' && broker === 'zerodha') {
      setSuccess('Zerodha connected successfully!');
      // Mark OAuth as connected for all Zerodha credentials
      // (We don't know which specific credential was used, so mark all Zerodha ones)
      setOauthConnectionStatus((prev) => {
        const updated = { ...prev };
        credentials
          .filter((cred) => cred.broker_type === 'zerodha')
          .forEach((cred) => {
            updated[cred.id] = true;
          });
        return updated;
      });
      // Clean up URL
      router.replace('/dashboard/broker');
      // Reload broker data to show updated status
      if (isAuthenticated) {
        loadData();
      }
    } else if (oauthStatus === 'error') {
      // Mark OAuth as not connected for all Zerodha credentials when error occurs
      setOauthConnectionStatus((prev) => {
        const updated = { ...prev };
        credentials
          .filter((cred) => cred.broker_type === 'zerodha')
          .forEach((cred) => {
            updated[cred.id] = false;
          });
        return updated;
      });
      const decodedMessage = message ? decodeURIComponent(message) : 'Unknown error';
      
      // Handle decryption failure from OAuth callback
      if (decodedMessage.includes('decrypt') || decodedMessage.includes('re-add')) {
        setError('Your credentials need to be re-added due to a security update. Please update your API keys.');
        // Clean up URL
        router.replace('/dashboard/broker');
        // Optionally show a prompt to update credentials after a delay
        setTimeout(() => {
          if (credentials.length > 0) {
            // Show message to update credentials
            setError('Please update your Zerodha API credentials to continue.');
          }
        }, 2000);
      } 
      // Handle backend errors (Python errors, missing imports, etc.)
      else if (decodedMessage.includes('hashlib') || 
               decodedMessage.includes('cannot access local variable') ||
               decodedMessage.includes('NameError') ||
               decodedMessage.includes('ImportError') ||
               decodedMessage.includes('AttributeError')) {
        setError('Backend error during OAuth connection. This is a server-side issue. Please contact support or try again later. The backend team needs to fix this error.');
        console.error('🔴 Backend OAuth Error:', decodedMessage);
        // Clean up URL
        router.replace('/dashboard/broker');
      } 
      // Handle other errors
      else {
        setError(`Failed to connect Zerodha: ${decodedMessage}`);
        // Clean up URL
        router.replace('/dashboard/broker');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, isAuthenticated, credentials]);

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
      
      // Initialize OAuth connection status - assume not connected unless we have evidence
      // Only set to true if we already have it marked as connected (from previous success)
      setOauthConnectionStatus((prev) => {
        const updated = { ...prev };
        // Keep existing connection status, but initialize new credentials as not connected
        creds.forEach((cred) => {
          if (cred.broker_type === 'zerodha' && updated[cred.id] === undefined) {
            updated[cred.id] = false; // Default to not connected
          }
        });
        return updated;
      });
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

    try {
      if (editingId) {
        // Update existing
        await updateBrokerCredentials(editingId, {
          api_key: formData.api_key,
          api_secret: formData.api_secret,
          label: formData.label || null,
          is_active: formData.is_active,
        });
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
        await createBrokerCredentials(newCreds);
        setSuccess('Credentials added successfully');
      }

      // Reset form and reload
      setFormData({
        broker_type: '' as BrokerType,
        api_key: '',
        api_secret: '',
        label: '',
        is_active: true,
      });
      setShowAddForm(false);
      setEditingId(null);
      await loadData();
      
      // Show success message
      setSuccess('Credentials saved successfully! You can now connect to Zerodha.');
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

  const handleZerodhaOAuth = async (credentialsId?: string) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      
      // Debug: Check if token is available
      const token = localStorage.getItem('firebase_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      // Debug: Verify credentials exist before calling OAuth
      if (credentialsId) {
        const credExists = credentials.find(c => c.id === credentialsId);
        if (!credExists) {
          throw new Error(`Credentials with ID ${credentialsId} not found. Please refresh the page.`);
        }
        console.log('🔍 Initiating OAuth with credentials:', {
          credentialsId,
          brokerType: credExists.broker_type,
          isActive: credExists.is_active,
          hasToken: !!token,
        });
      }
      
      console.log('🔍 Calling initiateZerodhaOAuth:', {
        credentialsId,
        hasToken: !!token,
        tokenPreview: token.substring(0, 20) + '...',
      });
      
      const response = await initiateZerodhaOAuth(credentialsId);
      
      console.log('✅ OAuth initiated successfully:', response);
      
      // Redirect user to Zerodha login page (not popup, as per backend docs)
      // The backend will handle the callback and redirect back to our frontend
      window.location.href = response.login_url;
      
    } catch (err: any) {
      console.error('❌ Failed to initiate OAuth:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config,
      });
      
      setLoading(false);
      
      const errorDetail = err.response?.data?.detail || '';
      const status = err.response?.status;
      
      // Handle decryption failure (500 error with decrypt message)
      if (status === 500 && (errorDetail.includes('decrypt') || errorDetail.includes('re-add'))) {
        setError('Your credentials need to be re-added due to a security update. Please update your API keys.');
        // Optionally redirect to edit the credentials
        setTimeout(() => {
          const cred = credentials.find(c => c.id === credentialsId);
          if (cred) {
            handleEdit(cred);
          }
        }, 2000);
        return;
      }
      
      // Handle 404 - credentials not found
      if (status === 404) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('not found')) {
          setError(`${errorDetail} The credentials list may be out of sync. Refreshing...`);
          // Refresh credentials list to sync with backend
          setTimeout(() => {
            loadData();
          }, 1000);
        } else if (errorDetail.includes('No Zerodha credentials')) {
          setError('No Zerodha credentials found. Please add your Zerodha API credentials first.');
        } else {
          setError(errorDetail || 'Zerodha credentials not found. Please check if the credentials ID is correct.');
        }
        return;
      }
      
      // Handle 403 - credentials don't belong to user
      if (status === 403) {
        if (errorDetail.includes('do not belong') || errorDetail.includes('not belong')) {
          setError('Security warning: These credentials do not belong to your account. Please contact support if this is unexpected.');
        } else {
          setError(errorDetail || 'Access denied. You do not have permission to use these credentials.');
        }
        return;
      }
      
      // Handle 400 - credentials inactive
      if (status === 400) {
        if (errorDetail.includes('inactive')) {
          setError('These credentials are inactive. Please activate them first.');
          // Optionally redirect to edit the credentials
          setTimeout(() => {
            const cred = credentials.find(c => c.id === credentialsId);
            if (cred) {
              handleEdit(cred);
            }
          }, 2000);
        } else {
          setError(errorDetail || 'Invalid request. Please check your credentials.');
        }
        return;
      }
      
      // Handle 401 - authentication failed
      if (status === 401) {
        setError('Authentication failed. Your session may have expired. Please log in again.');
        return;
      }
      
      // Handle other errors
      if (err.message) {
        setError(err.message);
      } else {
        setError(errorDetail || 'Failed to initiate OAuth flow. Please try again.');
      }
    }
  };

  const handleRefreshToken = async () => {
    try {
      setError('');
      setSuccess('');
      await refreshZerodhaToken();
      setSuccess('Zerodha token refreshed successfully');
      // Mark OAuth as connected after successful token refresh
      setOauthConnectionStatus((prev) => {
        const updated = { ...prev };
        credentials
          .filter((cred) => cred.broker_type === 'zerodha')
          .forEach((cred) => {
            updated[cred.id] = true;
          });
        return updated;
      });
      await loadData();
    } catch (err: any) {
      console.error('Failed to refresh token:', err);
      // Mark OAuth as not connected if refresh fails
      setOauthConnectionStatus((prev) => {
        const updated = { ...prev };
        credentials
          .filter((cred) => cred.broker_type === 'zerodha')
          .forEach((cred) => {
            updated[cred.id] = false;
          });
        return updated;
      });
      if (err.response?.status === 404) {
        setError('No tokens found. Please complete OAuth first.');
      } else {
        setError(err.response?.data?.detail || 'Failed to refresh token');
      }
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
      <DashboardHeader title="Broker Settings" backButton />

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
                    onChange={(e) =>
                      setFormData({ ...formData, broker_type: e.target.value as BrokerType })
                    }
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
                    placeholder="e.g., My Zerodha Account"
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
                // For Zerodha, check both is_active AND OAuth connection status
                // For other brokers, just check is_active
                const isOAuthConnected = cred.broker_type === 'zerodha' 
                  ? oauthConnectionStatus[cred.id] === true 
                  : true; // Non-Zerodha brokers don't need OAuth
                const isFullyActive = cred.is_active && isOAuthConnected;
                
                return (
                  <div
                    key={cred.id}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  >
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {broker?.name || cred.broker_type}
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
                        <p className="text-xs text-gray-500">
                          Created: {new Date(cred.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                        {cred.broker_type === 'zerodha' && (
                          <>
                            <button
                              onClick={() => handleZerodhaOAuth(cred.id)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                              disabled={loading}
                              title="Connect to Zerodha using these credentials"
                            >
                              Connect
                            </button>
                            <button
                              onClick={handleRefreshToken}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                              disabled={loading}
                            >
                              Refresh Token
                            </button>
                          </>
                        )}
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
