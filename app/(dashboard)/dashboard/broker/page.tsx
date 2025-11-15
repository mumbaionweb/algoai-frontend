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
  getOAuthStatus,
  getZerodhaUserProfile,
  getTokenHealth,
} from '@/lib/api/broker';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerCredentialsUpdate,
  BrokerType,
  ZerodhaUserProfile,
  TokenHealthResponse,
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
  const [profile, setProfile] = useState<ZerodhaUserProfile | null>(null);
  const [profileCredentialsId, setProfileCredentialsId] = useState<string | null>(null);

  // Token health modal state
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [health, setHealth] = useState<TokenHealthResponse | null>(null);
  const [healthCredentialsId, setHealthCredentialsId] = useState<string | null>(null);

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
    zerodha_user_id: '',
    is_active: true,
  });

  // Handle OAuth callback from Zerodha
  useEffect(() => {
    // 🔍 DEBUG: Log ALL URL parameters to see what Zerodha/backend sent
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    
    console.log('🔍 OAuth Callback - Full URL Parameters:', {
      fullUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
      searchString: typeof window !== 'undefined' ? window.location.search : 'N/A',
      allParams: allParams,
      paramsCount: Object.keys(allParams).length,
      timestamp: new Date().toISOString(),
    });
    
    // Log each parameter individually for easy inspection
    console.log('🔍 OAuth Callback - Individual Parameters:');
    Object.entries(allParams).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
    
    // Note: The actual Zerodha response (request_token, user_id, etc.) is handled by the backend
    // and not passed to the frontend. The backend processes it and only sends us oauth=success/error.
    // To see the full Zerodha response, check the backend logs at the callback endpoint.
    console.log('ℹ️ Note: Full Zerodha response (request_token, user_id, etc.) is handled by backend.');
    console.log('ℹ️ Check backend logs at /api/zerodha/oauth/callback to see what Zerodha sent.');

    const oauthStatus = searchParams.get('oauth');
    const broker = searchParams.get('broker');
    const message = searchParams.get('message');

    if (oauthStatus === 'success' && broker === 'zerodha') {
      setSuccess('Zerodha connected successfully!');
      console.log('✅ OAuth success detected - reloading data to check status');
      // Clean up URL first
      router.replace('/dashboard/broker');
      // Reload broker data to check actual token status from backend
      // This ensures we get the accurate status from the backend
      if (isAuthenticated) {
        // Small delay to ensure backend has processed the OAuth callback
        setTimeout(() => {
          console.log('🔄 Reloading broker data after OAuth success...');
          loadData();
        }, 1000); // Increased delay to ensure backend has processed
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
      
      // Check OAuth token status from backend for each Zerodha credential
      const zerodhaCreds = creds.filter((cred) => cred.broker_type === 'zerodha');
      
      if (zerodhaCreds.length > 0) {
        console.log('🔍 Checking OAuth status for Zerodha credentials:', zerodhaCreds.map(c => ({ id: c.id, is_active: c.is_active })));
        
        const tokenStatusChecks = await Promise.allSettled(
          zerodhaCreds.map(async (cred) => {
            try {
              // Get OAuth status (now includes optional token_details)
              const status = await getOAuthStatus(cred.id);
              
              // Store full OAuth status for display (includes token_details if available)
              setOauthStatuses((prev) => ({
                ...prev,
                [cred.id]: status,
              }));
              
              console.log(`✅ OAuth status for credential ${cred.id}:`, {
                is_connected: status.is_connected,
                has_tokens: status.has_tokens,
                has_credentials: status.has_credentials,
                user_id: status.user_id,
                token_details: status.token_details || 'Not available',
              });
              
              // Validate that tokens are actually usable by trying to fetch profile
              // This catches cases where tokens exist but are expired/invalid
              let isTokenValid = status.is_connected && status.has_tokens;
              if (isTokenValid) {
                try {
                  // Try to fetch profile to validate token is actually usable
                  await getZerodhaUserProfile(cred.id);
                  console.log(`✅ Token validation successful for credential ${cred.id}`);
                } catch (profileErr: any) {
                  const errorDetail = profileErr.response?.data?.detail || '';
                  // If we get "Access token not found" or similar, token is not usable
                  if (errorDetail.includes('Access token not found') || 
                      errorDetail.includes('OAuth') ||
                      errorDetail.includes('token')) {
                    console.warn(`⚠️ Token exists but is not usable for credential ${cred.id}:`, errorDetail);
                    isTokenValid = false;
                  } else {
                    // Other errors (like 500) might be temporary, so keep the status
                    console.warn(`⚠️ Token validation failed for credential ${cred.id}, but keeping status:`, errorDetail);
                  }
                }
              }
              
              return { credId: cred.id, isConnected: isTokenValid };
            } catch (err: any) {
              console.warn(`⚠️ Failed to check OAuth status for credential ${cred.id}:`, {
                error: err,
                message: err.message,
                response: err.response?.data,
                status: err.response?.status,
              });
              // If 404 or other error, assume not connected
              return { credId: cred.id, isConnected: false };
            }
          })
        );
        
        // Update OAuth connection status based on backend check
        setOauthConnectionStatus((prev) => {
          const updated = { ...prev };
          
          // Update status based on backend OAuth checks
          tokenStatusChecks.forEach((result) => {
            if (result.status === 'fulfilled') {
              const { credId, isConnected } = result.value;
              updated[credId] = isConnected;
              console.log(`📝 Updated OAuth status for ${credId}: ${isConnected ? '✅ Connected' : '❌ Not Connected'}`);
            } else {
              // If promise was rejected, mark as not connected
              console.warn(`⚠️ OAuth status check failed for a credential`);
            }
          });
          
          // Initialize any new Zerodha credentials that weren't checked
          creds.forEach((cred) => {
            if (cred.broker_type === 'zerodha' && updated[cred.id] === undefined) {
              // Default to false for new credentials
              updated[cred.id] = false;
              console.log(`📝 Initialized OAuth status for ${cred.id}: ❌ Not Connected (default)`);
            }
          });
          
          console.log('📊 Final OAuth connection status map:', updated);
          console.log('📊 Current credentials:', creds.map(c => ({ id: c.id, broker_type: c.broker_type, is_active: c.is_active })));
          return updated;
        });
      } else {
        console.log('ℹ️ No Zerodha credentials found to check OAuth status');
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

    // Validate that zerodha_user_id is not provided for non-Zerodha brokers
    if (formData.broker_type !== 'zerodha' && formData.zerodha_user_id) {
      setError('Zerodha User ID should only be provided for Zerodha broker');
      return;
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
        
        // Include zerodha_user_id if broker type is Zerodha
        if (formData.broker_type === 'zerodha') {
          updatePayload.zerodha_user_id = formData.zerodha_user_id || null;
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
        
        // Include zerodha_user_id only for Zerodha
        if (formData.broker_type === 'zerodha') {
          newCreds.zerodha_user_id = formData.zerodha_user_id || null;
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
        zerodha_user_id: '',
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
      zerodha_user_id: cred.zerodha_user_id || '',
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
      
      // 🔍 DEBUG: Log the FULL OAuth initiation response
      console.log('✅ OAuth Initiation - Full Response:', {
        fullResponse: response,
        loginUrl: response.login_url,
        redirectUrl: response.redirect_url,
        message: response.message,
        loginUrlParsed: (() => {
          try {
            const url = new URL(response.login_url);
            return {
              origin: url.origin,
              pathname: url.pathname,
              searchParams: Object.fromEntries(url.searchParams.entries()),
              fullSearchString: url.search,
            };
          } catch (e) {
            return { error: 'Failed to parse login_url', url: response.login_url };
          }
        })(),
        redirectUrlParsed: (() => {
          try {
            const url = new URL(response.redirect_url);
            return {
              origin: url.origin,
              pathname: url.pathname,
              searchParams: Object.fromEntries(url.searchParams.entries()),
              fullSearchString: url.search,
            };
          } catch (e) {
            return { error: 'Failed to parse redirect_url', url: response.redirect_url };
          }
        })(),
        timestamp: new Date().toISOString(),
      });
      
      // 🔍 DEBUG: Extract and log session_id from redirect_url if present
      try {
        const redirectUrl = new URL(response.redirect_url);
        const sessionId = redirectUrl.searchParams.get('session_id');
        if (sessionId) {
          console.log('🔍 OAuth Initiation - Session ID from redirect_url:', sessionId);
        } else {
          console.log('⚠️ OAuth Initiation - No session_id found in redirect_url');
        }
      } catch (e) {
        console.warn('⚠️ OAuth Initiation - Could not parse redirect_url for session_id:', e);
      }
      
      // Redirect user to Zerodha login page (not popup, as per backend docs)
      // The backend will handle the callback and redirect back to our frontend
      console.log('🔍 OAuth Initiation - Redirecting to Zerodha login URL:', response.login_url);
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

  const handleRefreshToken = async (credentialsId?: string) => {
    // Use the same OAuth flow as Connect button
    // This will re-authenticate and get fresh tokens
    if (credentialsId) {
      await handleZerodhaOAuth(credentialsId);
    } else {
      // If no credentials ID provided, find the first Zerodha credential
      const zerodhaCred = credentials.find(c => c.broker_type === 'zerodha');
      if (zerodhaCred) {
        await handleZerodhaOAuth(zerodhaCred.id);
      } else {
        setError('No Zerodha credentials found. Please add credentials first.');
      }
    }
  };

  const handleViewProfile = async (credentialsId: string) => {
    try {
      setProfileLoading(true);
      setProfileError('');
      setProfile(null);
      setProfileCredentialsId(credentialsId);
      setShowProfileModal(true);

      const profileData = await getZerodhaUserProfile(credentialsId);
      setProfile(profileData);
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle specific errors
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Zerodha credentials not found')) {
          setProfileError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
          setProfileError('Please complete OAuth flow to connect your Zerodha account.');
        } else {
          setProfileError(errorDetail || 'Failed to fetch profile. Please check your Zerodha connection.');
        }
      } else if (err.response?.status === 500) {
        setProfileError('Server error. Please try again later.');
      } else {
        setProfileError(errorDetail || 'Failed to fetch profile. Please try again.');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCheckTokenHealth = async (credentialsId: string) => {
    try {
      setHealthLoading(true);
      setHealthError('');
      setHealth(null);
      setHealthCredentialsId(credentialsId);
      setShowHealthModal(true);

      const healthData = await getTokenHealth(credentialsId);
      setHealth(healthData);
    } catch (err: any) {
      console.error('Failed to check token health:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle specific errors
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Zerodha credentials not found')) {
          setHealthError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else {
          setHealthError(errorDetail || 'Failed to check token health. Please check your Zerodha connection.');
        }
      } else if (err.response?.status === 500) {
        setHealthError('Server error. Please try again later.');
      } else {
        setHealthError(errorDetail || 'Failed to check token health. Please try again.');
      }
    } finally {
      setHealthLoading(false);
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
                    onChange={(e) => {
                      const newBrokerType = e.target.value as BrokerType;
                      setFormData({
                        ...formData,
                        broker_type: newBrokerType,
                        // Clear zerodha_user_id if switching away from Zerodha
                        zerodha_user_id: newBrokerType === 'zerodha' ? formData.zerodha_user_id : '',
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

                {/* Zerodha User ID - Only show for Zerodha broker */}
                {formData.broker_type === 'zerodha' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Zerodha User ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zerodha_user_id}
                      onChange={(e) => setFormData({ ...formData, zerodha_user_id: e.target.value })}
                      required
                      placeholder="Enter your Zerodha User ID (e.g., AB1234)"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      This is your Zerodha user ID. You can find it in your Zerodha Kite Connect app settings or after completing OAuth.
                    </p>
                  </div>
                )}

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
                
                // Debug logging for status calculation
                if (cred.broker_type === 'zerodha') {
                  console.log(`🔍 Status check for credential ${cred.id}:`, {
                    credId: cred.id,
                    is_active: cred.is_active,
                    oauthStatus: oauthConnectionStatus[cred.id],
                    isOAuthConnected,
                    isFullyActive,
                    willShow: isFullyActive ? 'Active' : 'Inactive',
                  });
                }
                
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
                        {cred.broker_type === 'zerodha' && cred.zerodha_user_id && (
                          <p className="text-sm text-gray-400 mb-2">
                            Zerodha User ID: <span className="text-white font-medium">{cred.zerodha_user_id}</span>
                          </p>
                        )}
                        {/* Display token details if available from OAuth status */}
                        {cred.broker_type === 'zerodha' && oauthStatuses[cred.id]?.token_details && (
                          <div className="text-xs text-gray-500 mb-2 space-y-1">
                            <div>
                              Access Token: {oauthStatuses[cred.id].token_details!.access_token_present ? (
                                <span className="text-green-400">✓ Present ({oauthStatuses[cred.id].token_details!.access_token_length} chars)</span>
                              ) : (
                                <span className="text-red-400">✗ Missing</span>
                              )}
                            </div>
                            <div>
                              Refresh Token: {oauthStatuses[cred.id].token_details!.refresh_token_present ? (
                                <span className="text-green-400">✓ Present ({oauthStatuses[cred.id].token_details!.refresh_token_length} chars)</span>
                              ) : (
                                <span className="text-red-400">✗ Missing</span>
                              )}
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Created: {new Date(cred.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                        {cred.broker_type === 'zerodha' && (
                          <>
                            {/* Show "Connect" button only if OAuth is NOT connected */}
                            {!oauthConnectionStatus[cred.id] && (
                              <button
                                onClick={() => handleZerodhaOAuth(cred.id)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                                disabled={loading}
                                title="Connect to Zerodha using these credentials"
                              >
                                Connect
                              </button>
                            )}
                            {/* Show "Refresh Token" button only if OAuth IS connected */}
                            {oauthConnectionStatus[cred.id] && (
                              <>
                                <button
                                  onClick={() => handleRefreshToken(cred.id)}
                                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                                  disabled={loading}
                                  title="Refresh Zerodha access token"
                                >
                                  Refresh Token
                                </button>
                                <button
                                  onClick={() => handleViewProfile(cred.id)}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                                  disabled={loading}
                                  title="View Zerodha user profile"
                                >
                                  Profile
                                </button>
                                <button
                                  onClick={() => handleCheckTokenHealth(cred.id)}
                                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                                  disabled={loading}
                                  title="Check token health and diagnostics"
                                >
                                  Health
                                </button>
                              </>
                            )}
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

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Zerodha User Profile</h2>
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
                      <button
                        onClick={() => {
                          const cred = credentials.find(c => c.id === profileCredentialsId);
                          if (cred) {
                            handleZerodhaOAuth(cred.id);
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                      >
                        Connect to Zerodha
                      </button>
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
                        <p className="text-white font-medium">{profile.user_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Name</p>
                        <p className="text-white font-medium">{profile.user_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Email</p>
                        <p className="text-white font-medium">{profile.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">User Type</p>
                        <p className="text-white font-medium capitalize">{profile.user_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Broker</p>
                        <p className="text-white font-medium">{profile.broker}</p>
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
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Enabled Exchanges</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.exchanges.map((exchange) => (
                        <span
                          key={exchange}
                          className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium"
                        >
                          {exchange}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Products */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Enabled Products</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.products.map((product) => (
                        <span
                          key={product}
                          className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm font-medium"
                        >
                          {product}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Order Types */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Enabled Order Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.order_types.map((orderType) => (
                        <span
                          key={orderType}
                          className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium"
                        >
                          {orderType}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metadata */}
                  {profile.meta && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
                      <div className="space-y-2">
                        {profile.meta.demat_consent && (
                          <div>
                            <p className="text-sm text-gray-400 mb-1">Demat Consent</p>
                            <p className="text-white font-medium capitalize">{profile.meta.demat_consent}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Token Health Modal */}
      {showHealthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Token Health Diagnostics</h2>
              <button
                onClick={() => {
                  setShowHealthModal(false);
                  setHealth(null);
                  setHealthError('');
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
              {healthLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="mt-4 text-gray-400">Checking token health...</p>
                </div>
              ) : healthError ? (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                  {healthError}
                </div>
              ) : health ? (
                <div className="space-y-6">
                  {/* Overall Status */}
                  <div className={`p-4 rounded-lg border-2 ${
                    health.overall_status.includes('✅') 
                      ? 'bg-green-500/10 border-green-500' 
                      : 'bg-yellow-500/10 border-yellow-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Overall Status</h3>
                      <span className={`text-lg font-bold ${
                        health.overall_status.includes('✅') ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {health.overall_status}
                      </span>
                    </div>
                    {health.recommendation && (
                      <div className="mt-3 p-3 bg-gray-700/50 rounded border border-gray-600">
                        <p className="text-sm font-medium text-gray-300 mb-1">💡 Recommendation:</p>
                        <p className="text-sm text-gray-400">{health.recommendation}</p>
                      </div>
                    )}
                  </div>

                  {/* Health Checks */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Health Checks</h3>
                    
                    {/* Credentials Check */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">Credentials</h4>
                        <span className="text-sm">{health.checks.credentials.status}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Exists: {health.checks.credentials.exists ? 'Yes' : 'No'}
                      </p>
                    </div>

                    {/* Tokens Storage Check */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white">Tokens Storage</h4>
                        <span className="text-sm">{health.checks.tokens_storage.status}</span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Storage exists:</span>
                          <span className={health.checks.tokens_storage.exists ? 'text-green-400' : 'text-red-400'}>
                            {health.checks.tokens_storage.exists ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Access Token:</span>
                          <span className={health.checks.tokens_storage.access_token_present ? 'text-green-400' : 'text-red-400'}>
                            {health.checks.tokens_storage.access_token_present 
                              ? `Present (${health.checks.tokens_storage.access_token_length} chars)` 
                              : 'Missing'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Refresh Token:</span>
                          <span className={health.checks.tokens_storage.refresh_token_present ? 'text-green-400' : 'text-red-400'}>
                            {health.checks.tokens_storage.refresh_token_present 
                              ? `Present (${health.checks.tokens_storage.refresh_token_length} chars)` 
                              : 'Missing'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Token Validation Check */}
                    {health.checks.token_validation && (
                      <div className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white">Token Validation</h4>
                          <span className={`text-sm ${
                            health.checks.token_validation.valid ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {health.checks.token_validation.status}
                          </span>
                        </div>
                        {health.checks.token_validation.user_name && (
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">User Name:</span>
                              <span className="text-white">{health.checks.token_validation.user_name}</span>
                            </div>
                            {health.checks.token_validation.user_id && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">User ID:</span>
                                <span className="text-white">{health.checks.token_validation.user_id}</span>
                              </div>
                            )}
                            {health.checks.token_validation.is_expired && (
                              <div className="flex justify-between">
                                <span className="text-gray-400">Expired:</span>
                                <span className="text-red-400">Yes</span>
                              </div>
                            )}
                            {health.checks.token_validation.error && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs">
                                Error: {health.checks.token_validation.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Token Refresh Check */}
                    {health.checks.token_refresh && (
                      <div className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-white">Token Refresh</h4>
                          <span className={`text-sm ${
                            health.checks.token_refresh.success ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {health.checks.token_refresh.status}
                          </span>
                        </div>
                        {health.checks.token_refresh.error && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs">
                            Error: {health.checks.token_refresh.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-700">
                    Checked at: {new Date(health.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : null}
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
