'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Settings,
    User,
    Lock,
    Eye,
    EyeOff,
    Save,
    ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';

export default function SettingsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

    // Profile state
    const [name, setName] = useState(user?.name || '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMessage(null);

        try {
            await api.put(`/users/${user?.id}`, { name });
            setProfileMessage({ type: 'success', text: 'Profile updated successfully.' });
        } catch {
            setProfileMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);

        if (newPassword.length < 8) {
            setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        setPasswordLoading(true);

        try {
            await api.put('/auth/change-password', {
                currentPassword,
                newPassword,
            });
            setPasswordMessage({ type: 'success', text: 'Password changed successfully.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            setPasswordMessage({ type: 'error', text: 'Failed to change password. Check your current password.' });
        } finally {
            setPasswordLoading(false);
        }
    };

    const tabs = [
        { id: 'profile' as const, label: 'Profile', icon: User },
        { id: 'security' as const, label: 'Security', icon: Lock },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                        <Settings className="h-6 w-6 text-violet-600" />
                        Settings
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Manage your account and security preferences
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-0">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                isActive
                                    ? 'border-violet-600 text-violet-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-4">Profile Information</h2>
                    <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-md">
                        <div>
                            <label className="label" htmlFor="settings-email">Email</label>
                            <input
                                id="settings-email"
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="input bg-slate-50 text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                        </div>
                        <Input
                            label="Display Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            required
                        />

                        {profileMessage && (
                            <div
                                className={`text-sm px-4 py-2 rounded-lg ${
                                    profileMessage.type === 'success'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                                role="alert"
                            >
                                {profileMessage.text}
                            </div>
                        )}

                        <Button type="submit" isLoading={profileLoading} leftIcon={Save}>
                            Save Changes
                        </Button>
                    </form>
                </Card>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-neutral-900 mb-4">Change Password</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                        <div className="relative">
                            <Input
                                label="Current Password"
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                            >
                                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        <div className="relative">
                            <Input
                                label="New Password"
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password (min 8 characters)"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        <Input
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            required
                        />

                        {passwordMessage && (
                            <div
                                className={`text-sm px-4 py-2 rounded-lg ${
                                    passwordMessage.type === 'success'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                                role="alert"
                            >
                                {passwordMessage.text}
                            </div>
                        )}

                        <Button type="submit" isLoading={passwordLoading} leftIcon={Lock}>
                            Change Password
                        </Button>
                    </form>
                </Card>
            )}
        </div>
    );
}
