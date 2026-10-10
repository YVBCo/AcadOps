'use client';

import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ClipboardList,
    Users,
    UserPlus,
    CheckCircle,
    Clock,
    AlertCircle,
    Building2,
    Hash,
    FileText,
    Upload,
    Settings,
    Lock,
} from 'lucide-react';
import { StatCard } from '@/components/ui/card';
import { admissionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { DepartmentAdmissionStatus } from '@/components/admin/DepartmentAdmissionStatus';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

interface DashboardStats {
    totalAdmissions: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
    totalStudents: number;
    pendingUsn: number;
}

export default function AdmissionsDashboardPage() {
    const { user } = useAuthStore();
    const deptStatusRef = useRef<HTMLDivElement>(null);

    const { data: stats, isLoading, isError, refetch } = useQuery<DashboardStats>({
        queryKey: ['admissions-stats', user?.tenantId ?? null, user?.id ?? null],
        queryFn: () => admissionsApi.getStats(),
    });

    if (isError) {
        return (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                <p className="text-lg font-semibold text-slate-700">Could not load admissions dashboard</p>
                <p className="text-sm text-slate-500">Check the connection and try again. The counters may be out of date until they load successfully.</p>
                <button onClick={() => refetch()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">Try Again</button>
            </div>
        );
    }

    if (isLoading || !stats) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-28 bg-slate-200 animate-pulse rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    const isAdmin = user?.role === 'ADMISSIONS_ADMIN';

    const handleScrollToDeptStatus = () => {
        deptStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 p-6 lg:p-8 text-white shadow-xl shadow-sky-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {user?.name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-sky-100 text-sm lg:text-base">
                        {isAdmin
                            ? 'Admissions Administrator — Manage student admissions, USN assignments, and clerks'
                            : 'Admin Clerk — Enter and submit student admission data'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <Building2 className="w-4 h-4" />
                            {isAdmin ? 'Admin' : 'Clerk'}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <ClipboardList className="w-4 h-4" />
                            {stats.totalAdmissions} Admissions
                        </span>
                        {isAdmin && stats.submitted > 0 && (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-400/30 backdrop-blur-sm rounded-full text-sm font-medium">
                                <Clock className="w-4 h-4" />
                                {stats.submitted} Pending Review
                            </span>
                        )}
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid — Uniform 4-column layout */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Admissions"
                    value={stats.totalAdmissions.toString()}
                    icon={ClipboardList}
                    iconColor="text-sky-600"
                    iconBgColor="bg-sky-100"
                    className="min-h-[110px]"
                />
                <StatCard
                    title="Pending Review"
                    value={stats.submitted.toString()}
                    icon={Clock}
                    iconColor="text-amber-600"
                    iconBgColor="bg-amber-100"
                    className="min-h-[110px]"
                />
                <StatCard
                    title="Approved"
                    value={stats.approved.toString()}
                    icon={CheckCircle}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                    className="min-h-[110px]"
                />
                <StatCard
                    title="Rejected"
                    value={stats.rejected.toString()}
                    icon={AlertCircle}
                    iconColor="text-red-600"
                    iconBgColor="bg-red-100"
                    className="min-h-[110px]"
                />
                <StatCard
                    title="Drafts"
                    value={stats.draft.toString()}
                    icon={FileText}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                    className="min-h-[110px]"
                />
                <StatCard
                    title="Total Students"
                    value={stats.totalStudents.toString()}
                    icon={Users}
                    iconColor="text-indigo-600"
                    iconBgColor="bg-indigo-100"
                    className="min-h-[110px]"
                />
                {isAdmin && (
                    <StatCard
                        title="Pending USN Requests"
                        value={stats.pendingUsn.toString()}
                        icon={Hash}
                        iconColor="text-purple-600"
                        iconBgColor="bg-purple-100"
                        className="min-h-[110px]"
                    />
                )}
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/admissions/applications" icon={ClipboardList} label="Admissions" subtitle="View all applications" iconColor="text-sky-600" iconBgColor="bg-sky-50" />
                <QuickActionCard href="/dashboard/admissions/new" icon={UserPlus} label="New Admission" subtitle="Add new student" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
                <QuickActionCard href="/dashboard/admissions/students" icon={Users} label="Students" subtitle="Enrolled student list" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                {isAdmin && (
                    <QuickActionCard href="/dashboard/admissions/students?upload=true" icon={Upload} label="Upload Students" subtitle="Bulk upload via Excel" iconColor="text-teal-600" iconBgColor="bg-teal-50" />
                )}
                {isAdmin && (
                    <QuickActionCard href="/dashboard/admissions/usn-requests" icon={Hash} label="USN Requests" subtitle="Manage USN assignments" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                )}
                <QuickActionCard href="/dashboard/admissions/edit-requests" icon={FileText} label="Edit Requests" subtitle="Review student edit requests" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                {isAdmin && (
                    <QuickActionCard href="/dashboard/admissions/clerks" icon={Users} label="Clerks" subtitle="Manage clerk accounts" iconColor="text-violet-600" iconBgColor="bg-violet-50" />
                )}
                {isAdmin && (
                    <QuickActionCard href="/dashboard/admissions/form-config" icon={Settings} label="Form Config" subtitle="Configure admission forms" iconColor="text-slate-600" iconBgColor="bg-slate-100" />
                )}
                {isAdmin && (
                    <button onClick={handleScrollToDeptStatus} className="group text-left w-full">
                        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-lg hover:shadow-neutral-200/50 transition-all duration-300 hover:-translate-y-0.5 text-center min-h-[140px]">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                <Lock className="w-7 h-7 text-rose-600" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-800 group-hover:text-neutral-900">
                                Close Admissions
                            </p>
                            <p className="text-xs text-neutral-400 mt-1 leading-tight">
                                Manage department closures
                            </p>
                        </div>
                    </button>
                )}
            </QuickActionsGrid>

            {/* Department Admission Management - Admin Only */}
            {isAdmin && (
                <div ref={deptStatusRef}>
                    <DepartmentAdmissionStatus />
                </div>
            )}
        </div>
    );
}
