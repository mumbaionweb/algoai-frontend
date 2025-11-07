'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Get user initials for avatar
  const getInitials = () => {
    if (user.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardHeader title="Profile" backButton />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Profile Header */}
          <div className="bg-gray-800 rounded-lg p-8 mb-6">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="flex items-center justify-center w-24 h-24 rounded-full bg-blue-600 text-white text-3xl font-semibold">
                {getInitials()}
              </div>

              {/* User Info */}
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {user.name || 'User'}
                </h2>
                <p className="text-gray-400">{user.email}</p>
                {user.is_active && (
                  <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold text-green-400 bg-green-400/10 rounded-full">
                    Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-gray-800 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-white mb-6">Profile Information</h3>

            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Full Name
                </label>
                <div className="px-4 py-3 bg-gray-700 rounded-lg text-white">
                  {user.name || 'Not set'}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Email Address
                </label>
                <div className="px-4 py-3 bg-gray-700 rounded-lg text-white">
                  {user.email}
                </div>
              </div>

              {/* User ID */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  User ID
                </label>
                <div className="px-4 py-3 bg-gray-700 rounded-lg text-white font-mono text-sm">
                  {user.id}
                </div>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Account Status
                </label>
                <div className="px-4 py-3 bg-gray-700 rounded-lg">
                  <span
                    className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                      user.is_active
                        ? 'text-green-400 bg-green-400/10'
                        : 'text-red-400 bg-red-400/10'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Timestamps */}
              {user.created_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Member Since
                  </label>
                  <div className="px-4 py-3 bg-gray-700 rounded-lg text-white">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              )}

              {user.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Last Updated
                  </label>
                  <div className="px-4 py-3 bg-gray-700 rounded-lg text-white">
                    {new Date(user.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-700 flex gap-4">
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Edit Profile
              </button>
              <button className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                Change Password
              </button>
            </div>
          </div>

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

