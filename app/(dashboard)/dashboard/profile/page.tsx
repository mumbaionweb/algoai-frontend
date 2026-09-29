'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, ThemeType } from '@/store/themeStore';
import { useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import Link from 'next/link';
import { formatDate } from '@/utils/dateUtils';
import {
  updateProfile,
  sendEmailChangeOtp,
  verifyEmailChange,
  changePassword,
} from '@/lib/api/profile';

// ============================================================
// Types & Constants
// ============================================================

type ActivePanel = null | 'name' | 'email' | 'phone' | 'password';

const THEMES: { key: ThemeType; label: string; dot: string }[] = [
  { key: 'dark', label: 'Dark', dot: '#1f2937' },
  { key: 'light', label: 'Light', dot: '#f9fafb' },
  { key: 'solarized-light', label: 'Solarized', dot: '#fdf6e3' },
];

// ============================================================
// Toast notification
// ============================================================

function Toast({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border backdrop-blur-sm ${
        type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}>
        <span className="text-base">{type === 'success' ? '✓' : '✕'}</span>
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100 transition text-lg leading-none">&times;</button>
      </div>
    </div>
  );
}

// ============================================================
// Inline Change Panel wrapper
// ============================================================

function ChangePanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="mt-4 p-5 bg-gray-900/60 rounded-xl border border-gray-700/50 animate-slide-down backdrop-blur-sm">
      {children}
    </div>
  );
}

// ============================================================
// Profile Page
// ============================================================

export default function ProfilePage() {
  const { user, isAuthenticated, isInitialized, updateUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const router = useRouter();

  // Which change panel is open (only one at a time)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Profile edit state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auth guard
  useEffect(() => {
    if (isInitialized && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isInitialized, router]);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone_number || '');
    }
  }, [user]);

  // ---- Panel helpers ----
  const openPanel = (panel: ActivePanel) => {
    // Reset all states when switching panels
    setActivePanel(panel);
    setEmailStep('input');
    setNewEmail('');
    setEmailOtp('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone_number || '');
    }
  };

  const closePanel = () => openPanel(null);

  // ---- Handlers ----
  const handleSaveName = useCallback(async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: editName.trim() });
      updateUser({ name: editName.trim() });
      closePanel();
      setToast({ type: 'success', message: 'Name updated successfully.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update name.' });
    } finally {
      setSaving(false);
    }
  }, [editName, updateUser]);

  const handleSavePhone = useCallback(async () => {
    setSaving(true);
    try {
      await updateProfile({ phone_number: editPhone.trim() });
      updateUser({ phone_number: editPhone.trim() });
      closePanel();
      setToast({ type: 'success', message: 'Phone number updated successfully.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update phone number.' });
    } finally {
      setSaving(false);
    }
  }, [editPhone, updateUser]);

  const handleSendOtp = useCallback(async () => {
    if (!newEmail.trim() || newEmail === user?.email) return;
    setSaving(true);
    try {
      await sendEmailChangeOtp({ new_email: newEmail.trim() });
      setEmailStep('otp');
      setToast({ type: 'success', message: `OTP sent to your registered email.` });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to send OTP.' });
    } finally {
      setSaving(false);
    }
  }, [newEmail, user?.email]);

  const handleVerifyOtp = useCallback(async () => {
    if (!emailOtp.trim() || emailOtp.length < 4) return;
    setSaving(true);
    try {
      await verifyEmailChange({ new_email: newEmail.trim(), otp: emailOtp.trim() });
      updateUser({ email: newEmail.trim() });
      closePanel();
      setToast({ type: 'success', message: 'Email address updated successfully.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Invalid OTP.' });
    } finally {
      setSaving(false);
    }
  }, [emailOtp, newEmail, updateUser]);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setToast({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setToast({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    setSaving(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      closePanel();
      setToast({ type: 'success', message: 'Password changed successfully.' });
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to change password.' });
    } finally {
      setSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  // ---- Helpers ----
  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || '?';
  };

  // ---- Guards ----
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <main className="container mx-auto px-4 py-10">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ===== Profile Header Card ===== */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/80 rounded-2xl p-8 border border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20 shrink-0">
                {getInitials()}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{user.name || 'User'}</h1>
                <p className="text-gray-400 text-sm mt-0.5 truncate">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  {user.is_active && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-full border border-emerald-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  )}
                  {user.created_at && (
                    <span className="text-xs text-gray-500">Member since {formatDate(user.created_at)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Profile Details Card ===== */}
          <div className="bg-gray-800/80 rounded-2xl border border-gray-700/50 shadow-lg overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-700/50">
              <h2 className="text-lg font-semibold text-white">Profile Details</h2>
            </div>

            {/* --- Full Name --- */}
            <ProfileRow
              label="Full Name"
              value={user.name || 'Not set'}
              isEmpty={!user.name}
              actionLabel={activePanel === 'name' ? 'Cancel' : 'Change'}
              onAction={() => activePanel === 'name' ? closePanel() : openPanel('name')}
            >
              <ChangePanel open={activePanel === 'name'}>
                <label className="block text-xs font-medium text-gray-400 mb-2">New Name</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving || !editName.trim()}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-blue-600"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </ChangePanel>
            </ProfileRow>

            {/* --- Email --- */}
            <ProfileRow
              label="Email Address"
              value={user.email}
              actionLabel={activePanel === 'email' ? 'Cancel' : 'Change'}
              onAction={() => activePanel === 'email' ? closePanel() : openPanel('email')}
            >
              <ChangePanel open={activePanel === 'email'}>
                {emailStep === 'input' ? (
                  <>
                    <label className="block text-xs font-medium text-gray-400 mb-2">New Email Address</label>
                    <div className="flex gap-3">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email"
                        className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                        autoFocus
                      />
                      <button
                        onClick={handleSendOtp}
                        disabled={saving || !newEmail.trim() || newEmail === user.email}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-40 disabled:hover:bg-blue-600"
                      >
                        {saving ? 'Sending…' : 'Send OTP'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">A verification code will be sent to your current email.</p>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Enter Verification Code</label>
                    <p className="text-xs text-gray-500 mb-3">
                      Sent to <span className="text-gray-300">{user.email}</span>
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        maxLength={6}
                        className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors font-mono tracking-[0.3em] text-center placeholder:tracking-normal placeholder:text-gray-600 placeholder:font-sans"
                        autoFocus
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={saving || emailOtp.length < 4}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-40 disabled:hover:bg-blue-600"
                      >
                        {saving ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => { setEmailStep('input'); setEmailOtp(''); }} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        ← Change email
                      </button>
                      <span className="text-gray-600">·</span>
                      <button onClick={handleSendOtp} disabled={saving} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        Resend code
                      </button>
                    </div>
                  </>
                )}
              </ChangePanel>
            </ProfileRow>

            {/* --- Phone Number --- */}
            <ProfileRow
              label="Phone Number"
              value={user.phone_number || 'Not set'}
              isEmpty={!user.phone_number}
              actionLabel={activePanel === 'phone' ? 'Cancel' : (user.phone_number ? 'Change' : 'Add')}
              onAction={() => activePanel === 'phone' ? closePanel() : openPanel('phone')}
            >
              <ChangePanel open={activePanel === 'phone'}>
                <label className="block text-xs font-medium text-gray-400 mb-2">Phone Number</label>
                <div className="flex gap-3">
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                    autoFocus
                  />
                  <button
                    onClick={handleSavePhone}
                    disabled={saving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-blue-600"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </ChangePanel>
            </ProfileRow>

            {/* --- Password --- */}
            <ProfileRow
              label="Password"
              value="••••••••••"
              actionLabel={activePanel === 'password' ? 'Cancel' : 'Change'}
              onAction={() => activePanel === 'password' ? closePanel() : openPanel('password')}
              isLast={false}
            >
              <ChangePanel open={activePanel === 'password'}>
                <div className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-4 py-2.5 pr-11 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                      >
                        {showCurrentPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full px-4 py-2.5 pr-11 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 transition-colors placeholder:text-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                      >
                        {showNewPw ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  {/* Confirm */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`w-full px-4 py-2.5 bg-gray-900 border rounded-lg text-white text-sm outline-none transition-colors placeholder:text-gray-600 ${
                        confirmPassword && newPassword !== confirmPassword
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-gray-600 focus:border-blue-500'
                      }`}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-400 mt-1.5">Passwords do not match</p>
                    )}
                  </div>
                  {/* Submit */}
                  <button
                    onClick={handleChangePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-blue-600"
                  >
                    {saving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </ChangePanel>
            </ProfileRow>

            {/* --- Theme --- */}
            <div className="px-8 py-5 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">Appearance</span>
                </div>
                <div className="flex items-center bg-gray-900/60 rounded-lg p-1 border border-gray-700/50">
                  {THEMES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTheme(t.key)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        theme === t.key
                          ? 'bg-blue-600 !text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-gray-400/50 shrink-0"
                        style={{ background: t.dot }}
                      />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* --- User ID --- */}
            <div className="px-8 py-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">User ID</span>
                <span className="text-sm text-gray-500 font-mono">{user.id}</span>
              </div>
            </div>
          </div>

          {/* ===== Back ===== */}
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}

// ============================================================
// ProfileRow — a single read-only row with a Change action
// ============================================================

function ProfileRow({
  label,
  value,
  isEmpty,
  actionLabel,
  onAction,
  isLast = false,
  children,
}: {
  label: string;
  value: string;
  isEmpty?: boolean;
  actionLabel: string;
  onAction: () => void;
  isLast?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`px-8 py-5 ${!isLast ? 'border-b border-gray-700/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-sm text-gray-400">{label}</span>
          <p className={`text-sm mt-0.5 truncate ${isEmpty ? 'text-gray-600 italic' : 'text-white'}`}>
            {value}
          </p>
        </div>
        <button
          onClick={onAction}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium shrink-0 ml-4"
        >
          {actionLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
