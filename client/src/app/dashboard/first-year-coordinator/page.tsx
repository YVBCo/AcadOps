'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Card, StatCard } from '@/components/ui/card';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';
import {
    Users,
    Layers3,
    BookOpen,
    ArrowRight,
    AlertCircle,
    GraduationCap,
    School,
    ChevronRight
} from 'lucide-react';

interface AllocationSummary {
    batch: {
        id: number;
        name: string;
        currentSemester: number;
    };
    allocatedCount: number;
    unallocatedCount: number;
    allocations: any[];
    unallocatedDepartments: any[];
}

export default function FirstYearCoordinatorDashboard() {
    const [summary, setSummary] = useState<AllocationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/first-year-coordinator/summary');
            setSummary(response.data.data || []);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const totalAllocated = summary.reduce((sum, s) => sum + s.allocatedCount, 0);
    const totalUnallocated = summary.reduce((sum, s) => sum + s.unallocatedCount, 0);
    const totalBatches = summary.length;

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-indigo-200 animate-pulse rounded-2xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-indigo-200 animate-pulse rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 p-6 lg:p-8 text-white shadow-xl shadow-indigo-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        First Year Coordinator Dashboard 🎓
                    </h1>
                    <p className="text-indigo-100 text-sm lg:text-base">
                        Manage cycle allocations for first year students across Physics and Chemistry departments.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <School className="w-4 h-4" />
                            First Year Coordinator
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            Cycle Management
                        </span>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Active Batches"
                    value={totalBatches.toString()}
                    icon={Layers3}
                    iconColor="text-indigo-600"
                    iconBgColor="bg-indigo-100"
                />
                <StatCard
                    title="Allocated Departments"
                    value={totalAllocated.toString()}
                    icon={BookOpen}
                    iconColor="text-purple-600"
                    iconBgColor="bg-purple-100"
                />
                <StatCard
                    title="Pending Allocation"
                    value={totalUnallocated.toString()}
                    icon={AlertCircle}
                    iconColor="text-orange-600"
                    iconBgColor="bg-orange-100"
                />
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/first-year-coordinator/students" icon={Users} label="Students" subtitle="View first year students" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                <QuickActionCard href="/dashboard/first-year-coordinator/cycle-allocation" icon={Layers3} label="Cycle Allocation" subtitle="Assign Physics/Chemistry" iconColor="text-purple-600" iconBgColor="bg-purple-50" />
            </QuickActionsGrid>

            {/* Batch-wise Allocation Status */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Allocation Status by Batch</h3>
                    <Link
                        href="/dashboard/first-year-coordinator/cycle-allocation"
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                    >
                        Manage All <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                {summary.length > 0 ? (
                    <div className="space-y-3">
                        {summary.map((item) => (
                            <div
                                key={item.batch.id}
                                className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50 border border-indigo-100"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-slate-800">Batch {item.batch.name}</h4>
                                    <span className="text-sm text-slate-600">Semester {item.batch.currentSemester}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-slate-600">Allocated: <strong>{item.allocatedCount}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span className="text-slate-600">Pending: <strong>{item.unallocatedCount}</strong></span>
                                    </div>
                                </div>
                                {item.unallocatedCount > 0 && (
                                    <div className="mt-2 pt-2 border-t border-indigo-200">
                                        <p className="text-xs text-orange-600 font-medium">
                                            ⚠️ {item.unallocatedCount} departments need cycle allocation
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Layers3 className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500">No active batches with first year students</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
