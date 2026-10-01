'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, CheckCircle, XCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { admissionsApi } from '@/lib/api';

interface AdminClerk {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: string;
}

export default function ClerksPage() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [newClerkPassword, setNewClerkPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { data: rawClerkData, isLoading } = useQuery({
        queryKey: ['admin-clerks'],
        queryFn: () => admissionsApi.getClerks(),
    });
    const clerks: AdminClerk[] = Array.isArray(rawClerkData) ? rawClerkData : (rawClerkData?.clerks ?? []);

    const createMutation = useMutation({
        mutationFn: (data: { name: string; email: string }) => admissionsApi.createClerk(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['admin-clerks'] });
            setNewClerkPassword(result.password);
            setName('');
            setEmail('');
            setError('');
        },
        onError: (err: any) => {
            setError(err.response?.data?.error || 'Failed to create clerk');
        },
    });

    const handleCreate = () => {
        if (!name.trim() || !email.trim()) {
            setError('Name and email are required');
            return;
        }
        setError('');
        createMutation.mutate({ name, email });
    };

    const activeClerks = clerks.filter(c => c.isActive).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Admin Clerks</h1>
                <Button onClick={() => { setShowForm(!showForm); setNewClerkPassword(''); }} leftIcon={UserPlus}>
                    {showForm ? 'Cancel' : 'New Clerk'}
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard title="Total Clerks" value={clerks.length.toString()} icon={Users} iconColor="text-sky-600" iconBgColor="bg-sky-100" />
                <StatCard title="Active Clerks" value={activeClerks.toString()} icon={CheckCircle} iconColor="text-emerald-600" iconBgColor="bg-emerald-100" />
            </div>

            {/* Create Form */}
            {showForm && (
                <Card>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Create Admin Clerk</h3>
                    {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 mb-4">{error}</div>}

                    {newClerkPassword ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <span className="font-semibold text-emerald-800">Clerk created successfully!</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-700">Password:</span>
                                <code className="px-2 py-1 bg-white border rounded text-sm font-mono">
                                    {showPassword ? newClerkPassword : '••••••••••'}
                                </code>
                                <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:bg-emerald-100 rounded">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => navigator.clipboard.writeText(newClerkPassword)}
                                    className="p-1 hover:bg-emerald-100 rounded"
                                    title="Copy password"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-emerald-700">Share these credentials securely. The clerk should change their password after first login.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} placeholder="Clerk's full name" />
                            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="clerk@college.edu" />
                            <div className="md:col-span-2">
                                <Button onClick={handleCreate} isLoading={createMutation.isPending}>
                                    Create Clerk
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Clerk List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : clerks.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No clerks yet</p>
                        <p className="text-sm text-slate-400 mt-1">Create your first admin clerk to get started</p>
                    </div>
                </Card>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clerks.map(clerk => (
                                <tr key={clerk.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{clerk.name}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{clerk.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${clerk.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {clerk.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {clerk.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(clerk.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
