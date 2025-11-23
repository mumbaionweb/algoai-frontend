'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import Link from 'next/link';
import {
  getAvailableMarketplaceApis,
  getMarketplaceApiStatuses,
  toggleMarketplaceApi,
  updateMarketplaceApiStatus,
  upsertMarketplaceApiStatus,
} from '@/lib/api/marketplace';
import type {
  MarketplaceApiInfo,
  MarketplaceApiStatus,
  MarketplaceApiStatusUpdate,
} from '@/types';

export default function MarketplacePage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [availableApis, setAvailableApis] = useState<MarketplaceApiInfo[]>([]);
  const [apiStatuses, setApiStatuses] = useState<Record<string, MarketplaceApiStatus>>({});

  // Form state for credentials
  const [editingApi, setEditingApi] = useState<MarketplaceApiInfo | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load data
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [apis, statuses] = await Promise.all([
        getAvailableMarketplaceApis(),
        getMarketplaceApiStatuses(),
      ]);

      setAvailableApis(apis);

      // Convert statuses array to object keyed by api_type
      const statusesMap: Record<string, MarketplaceApiStatus> = {};
      statuses.forEach((status) => {
        statusesMap[status.api_type] = status;
      });
      setApiStatuses(statusesMap);
    } catch (err: any) {
      console.error('Failed to load marketplace data:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load marketplace data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (api: MarketplaceApiInfo) => {
    try {
      setError('');
      setSuccess('');

      const currentStatus = apiStatuses[api.api_type];
      const newEnabledState = !currentStatus?.is_enabled;

      // If enabling and credentials are required, check if they exist
      if (newEnabledState && api.requires_credentials) {
        const hasCredentials =
          currentStatus?.credentials &&
          Object.keys(currentStatus.credentials).length > 0 &&
          Object.values(currentStatus.credentials).some((v) => v && v.trim() !== '');

        if (!hasCredentials) {
          setError(
            `Please add credentials for ${api.name} before enabling it. Click "Add Credentials" to configure.`
          );
          setTimeout(() => setError(''), 5000);
          return;
        }
      }

      await toggleMarketplaceApi(api.api_type, newEnabledState);

      // Reload data to get updated status
      await loadData();

      setSuccess(
        `${api.name} has been ${newEnabledState ? 'enabled' : 'disabled'} successfully.`
      );
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to toggle API:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to update API status');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleEditCredentials = (api: MarketplaceApiInfo) => {
    const currentStatus = apiStatuses[api.api_type];
    if (currentStatus?.credentials) {
      setCredentials({ ...currentStatus.credentials });
    } else {
      setCredentials({});
    }
    setEditingApi(api);
  };

  const handleSaveCredentials = async () => {
    if (!editingApi) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const currentStatus = apiStatuses[editingApi.api_type];

      if (currentStatus) {
        // Update existing
        await updateMarketplaceApiStatus(currentStatus.id, {
          credentials,
        } as MarketplaceApiStatusUpdate);
      } else {
        // Create new with credentials
        await upsertMarketplaceApiStatus({
          api_type: editingApi.api_type,
          is_enabled: false,
          credentials,
        });
      }

      await loadData();
      setEditingApi(null);
      setCredentials({});
      setSuccess('Credentials saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Failed to save credentials:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to save credentials');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingApi(null);
    setCredentials({});
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Marketplace</h1>
            <p className="text-gray-400">
              Enable and configure third-party APIs for use in backtesting and strategies.
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <p className="text-gray-400 ml-3">Loading marketplace APIs...</p>
            </div>
          ) : (
            <>
              {/* API Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {availableApis.map((api) => {
                  const status = apiStatuses[api.api_type];
                  const isEnabled = status?.is_enabled || false;

                  return (
                    <div
                      key={api.api_type}
                      className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                    >
                      {/* API Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-white mb-1">{api.name}</h3>
                          {api.description && (
                            <p className="text-sm text-gray-400">{api.description}</p>
                          )}
                        </div>
                        {api.logo_url && (
                          <img
                            src={api.logo_url}
                            alt={api.name}
                            className="w-12 h-12 rounded-lg object-contain"
                          />
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className="mb-4">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                            isEnabled
                              ? 'text-green-400 bg-green-400/10'
                              : 'text-gray-400 bg-gray-400/10'
                          }`}
                        >
                          {isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {/* Toggle Switch */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Enable for backtesting</span>
                          <button
                            onClick={() => handleToggle(api)}
                            disabled={
                              api.requires_credentials &&
                              !isEnabled &&
                              (!status?.credentials ||
                                Object.keys(status.credentials).length === 0 ||
                                !Object.values(status.credentials).some(
                                  (v) => v && v.trim() !== ''
                                ))
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              isEnabled ? 'bg-blue-600' : 'bg-gray-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            role="switch"
                            aria-checked={isEnabled}
                            title={
                              api.requires_credentials &&
                              !isEnabled &&
                              (!status?.credentials ||
                                Object.keys(status.credentials).length === 0)
                                ? 'Add credentials first to enable this API'
                                : ''
                            }
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isEnabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Credentials Button (if required) */}
                        {api.requires_credentials && (
                          <button
                            onClick={() => handleEditCredentials(api)}
                            className="w-full px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            {status?.credentials ? 'Update Credentials' : 'Add Credentials'}
                          </button>
                        )}
                      </div>

                      {/* Website Link */}
                      {api.website && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <a
                            href={api.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Visit Website →
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Empty State */}
              {availableApis.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400">No marketplace APIs available at this time.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Credentials Modal */}
      {editingApi && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-2">
              Configure {editingApi.name}
            </h2>
            <p className="text-sm text-gray-400 mb-6">{editingApi.description}</p>

            {/* Credential Fields */}
            {editingApi.credential_fields && editingApi.credential_fields.length > 0 ? (
              <div className="space-y-4 mb-6">
                {editingApi.credential_fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={credentials[field.name] || ''}
                      onChange={(e) =>
                        setCredentials({ ...credentials, [field.name]: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-sm text-gray-400">
                  This API does not require additional credentials.
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {editingApi.requires_credentials && (
                <button
                  onClick={handleSaveCredentials}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Credentials'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to Dashboard */}
      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

