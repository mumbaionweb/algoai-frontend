'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Link from 'next/link';
import {
  getAvailableBrokers,
  getBrokerCredentials,
  createBrokerCredentials,
  updateBrokerCredentials,
  deleteBrokerCredentials,
  initiateZerodhaOAuth,
} from '@/lib/api/broker';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerType,
} from '@/types';

export default function BrokerPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [availableBrokers, setAvailableBrokers] = useState<BrokerInfo[]>([]);
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      loadData();
    }
  }, [isAuthenticated, router]);

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
    } catch (err: any) {
      console.error('Failed to save credentials:', err);
      setError(err.response?.data?.detail || 'Failed to save credentials');
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
      const response = await initiateZerodhaOAuth(credentialsId);
      // Open OAuth URL in new window
      window.open(response.login_url, '_blank', 'width=600,height=700');
      setSuccess('OAuth flow initiated. Please complete authentication in the popup window.');
    } catch (err: any) {
      console.error('Failed to initiate OAuth:', err);
      setError(err.response?.data?.detail || 'Failed to initiate OAuth flow');
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
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">Broker Configuration</h2>
                <p className="text-gray-400">
                  Manage your broker connections and API credentials for trading integrations.
                </p>
              </div>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Add Broker
                </button>
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
                return (
                  <div
                    key={cred.id}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {broker?.name || cred.broker_type}
                          </h3>
                          {cred.label && (
                            <span className="text-sm text-gray-400">({cred.label})</span>
                          )}
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              cred.is_active
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-gray-500/10 text-gray-400'
                            }`}
                          >
                            {cred.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                          API Key: {cred.api_key.substring(0, 8)}...
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(cred.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {cred.broker_type === 'zerodha' && (
                          <button
                            onClick={() => handleZerodhaOAuth(cred.id)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                          >
                            OAuth
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(cred)}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(cred.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
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
              href="/dashboard"
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
