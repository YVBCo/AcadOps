'use client';

import { useQuery } from '@tanstack/react-query';
import {
    ClipboardCheck,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    ArrowRight,
    GraduationCap,
    FileText
} from 'lucide-react';
import Link from 'next/link';
import { Card, StatCard } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { clerkMarksApi } from '@/lib/api';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

export default function ClerkDashboardPage() {
    const { user } = useAuthStore();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['clerk-stats'],
        queryFn: clerkMarksApi.getStats,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    const semesterMarks = stats?.semesterMarks || { pending: 0, approved: 0, locked: 0, total: 0 };
    const revaluations = stats?.revaluations || { pending: 0, approved: 0, locked: 0, total: 0 };

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 lg:p-8 text-white shadow-xl shadow-amber-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome to Clerk Dashboard 👋
                    </h1>
                    <p className="text-amber-100 text-sm lg:text-base">
                        Enter and track semester marks and revaluations
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            {user?.name || 'Clerk'}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <FileText className="w-4 h-4" />
                            Marks Entry Portal
                        </span>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-red-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Semester Marks"
                    value={semesterMarks.total.toString()}
                    icon={ClipboardCheck}
                    iconColor="text-amber-600"
                    iconBgColor="bg-amber-100"
                />
                <StatCard
                    title="Pending Approval"
                    value={semesterMarks.pending.toString()}
                    icon={Clock}
                    iconColor="text-orange-600"
                    iconBgColor="bg-orange-100"
                />
                <StatCard
                    title="Revaluations"
                    value={revaluations.total.toString()}
                    icon={RefreshCw}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
                <StatCard
                    title="Approved"
                    value={(semesterMarks.approved + revaluations.approved).toString()}
                    icon={CheckCircle}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Semester Marks Card */}
                <Card>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <ClipboardCheck className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Semester Marks</h3>
                            <p className="text-sm text-slate-500">{semesterMarks.total} total entries</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 rounded-xl bg-orange-50">
                            <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-orange-600">{semesterMarks.pending}</p>
                            <p className="text-xs text-orange-700">Pending</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-emerald-50">
                            <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-emerald-600">{semesterMarks.approved}</p>
                            <p className="text-xs text-emerald-700">Approved</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-slate-100">
                            <XCircle className="h-5 w-5 text-slate-500 mx-auto mb-1" />
                            <p className="text-lg font-bold text-slate-600">{semesterMarks.locked}</p>
                            <p className="text-xs text-slate-600">Locked</p>
                        </div>
                    </div>
                </Card>

                {/* Revaluations Card */}
                <Card>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                            <RefreshCw className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">Revaluations</h3>
                            <p className="text-sm text-slate-500">{revaluations.total} total entries</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 rounded-xl bg-orange-50">
                            <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-orange-600">{revaluations.pending}</p>
                            <p className="text-xs text-orange-700">Pending</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-emerald-50">
                            <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                            <p className="text-lg font-bold text-emerald-600">{revaluations.approved}</p>
                            <p className="text-xs text-emerald-700">Approved</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-slate-100">
                            <XCircle className="h-5 w-5 text-slate-500 mx-auto mb-1" />
                            <p className="text-lg font-bold text-slate-600">{revaluations.locked}</p>
                            <p className="text-xs text-slate-600">Locked</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/clerk/semester-marks" icon={ClipboardCheck} label="Semester Marks" subtitle="Enter marks for exams" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/clerk/revaluations" icon={RefreshCw} label="Revaluations" subtitle="Submit revised marks" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                <QuickActionCard href="/dashboard/clerk/submissions" icon={FileText} label="My Submissions" subtitle="Track your entries" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
            </QuickActionsGrid>

            {/* Info Banner */}
            <Card className="bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="font-medium text-amber-900">Approval Required</h4>
                        <p className="text-sm text-amber-700 mt-1">
                            All marks entries remain in "Pending" status until approved by the Controller of Examinations (COE).
                            You cannot edit entries after they are approved.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
