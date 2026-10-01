'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { batchApi } from '@/lib/api';
import { Plus, Users, Calendar, ArrowRight, BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
    _count?: {
        students: number;
    };
}

export default function BatchesPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', startYear: new Date().getFullYear() });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const data = await batchApi.getAll();
            setBatches(data);
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (creating) return;
        setCreateError('');
        setCreating(true);
        try {
            await batchApi.create(formData);
            setShowCreateModal(false);
            setFormData({ name: '', startYear: new Date().getFullYear() });
            fetchBatches();
        } catch (error: unknown) {
            const axiosErr = error as { response?: { data?: { error?: string } } };
            const message = axiosErr?.response?.data?.error || 'Failed to create batch';
            setCreateError(message);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return (
        <div className="p-8 flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-display text-neutral-900">Batch Management</h1>
                    <p className="text-neutral-500 mt-1">
                        Track and manage student cohorts from admission to graduation.
                    </p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    leftIcon={Plus}
                >
                    Create Batch
                </Button>
            </div>

            {/* Batch Grid */}
            {batches.length === 0 ? (
                <Card className="text-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
                    <div className="h-16 w-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="h-8 w-8 text-neutral-300" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-900">No batches found</h3>
                    <p className="text-neutral-500 mt-1">Create a new batch to get started.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {batches.map((batch) => (
                        <div key={batch.id} onClick={() => router.push(`/dashboard/admin/batches/${batch.id}`)} className="cursor-pointer group relative h-full">
                            {/* Glowing Background Effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 to-accent-600 rounded-2xl opacity-20 blur group-hover:opacity-40 transition duration-500"></div>

                            <div className="relative h-full bg-white rounded-2xl p-6 shadow-xl border border-white/20 flex flex-col justify-between overflow-hidden">
                                {/* Decorative Circle */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full -mr-8 -mt-8"></div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-bold text-xl shadow-inner border border-primary-100">
                                            {batch.name.substring(0, 2)}
                                        </div>
                                        <Badge variant="success" className="shadow-sm">Active</Badge>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-1">Batch</h3>
                                        <div className="text-3xl font-bold text-neutral-900 font-display">
                                            {batch.name}
                                        </div>
                                        <div className="flex items-center gap-2 text-primary-600 text-sm mt-1 font-medium">
                                            <Calendar className="w-4 h-4" />
                                            <span>Started {batch.startYear}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-neutral-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-neutral-600">
                                            <Users className="w-4 h-4" />
                                            <span className="font-semibold">{batch._count?.students || 0}</span> Students
                                        </div>
                                        <div className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded text-xs font-semibold">
                                            Sem {batch.currentSemester}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in p-6">
                        <h2 className="text-xl font-bold mb-4">Create New Batch</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            {createError && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                    {createError}
                                </div>
                            )}
                            <Input
                                label="Batch Name (Year)"
                                value={formData.name}
                                onChange={(e) => {
                                    setCreateError('');
                                    setFormData({ ...formData, name: e.target.value });
                                }}
                                placeholder="e.g., 2024"
                                maxLength={4}
                                required
                            />
                            <Input
                                label="Start Year"
                                type="number"
                                value={formData.startYear}
                                onChange={(e) => {
                                    setCreateError('');
                                    const parsed = parseInt(e.target.value, 10);
                                    setFormData({ ...formData, startYear: isNaN(parsed) ? 0 : parsed });
                                }}
                                min={2000}
                                max={2100}
                                required
                            />
                            <div className="flex gap-3 pt-4">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Batch'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
