'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { StatCard, Card } from '@/components/ui/card';
import {
    Activity,
    Users,
    CheckCircle2,
    Clock,
    BookOpen,
    GraduationCap,
    Wallet,
    Library
} from 'lucide-react';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

export default function NoDueDashboard() {
    const { user } = useAuthStore();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['nodue', 'stats'],
        queryFn: nodueApi.getClearanceStats,
        enabled: !!user && ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL'].includes(user.role),
    });

    return (
        <DashboardShell
            allowedRoles={['STUDENT', 'TEACHER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'ACCOUNTS_STAFF', 'PRINCIPAL', 'CLERK', 'FIRST_YEAR_COORDINATOR']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-700 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
                    <div className="absolute inset-0 bg-grid-white/10"></div>
                    <div className="relative">
                        <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                            No-Due Clearance Portal
                        </h1>
                        <p className="text-blue-100 text-sm lg:text-base">
                            Manage your academic and financial clearances.
                        </p>
                    </div>
                </div>

                {['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL'].includes(user?.role || '') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Clearances"
                            value={isLoading ? '...' : stats?.total || 0}
                            icon={Users}
                            iconColor="text-blue-600"
                            iconBgColor="bg-blue-100"
                        />
                        <StatCard
                            title="Fully Cleared"
                            value={isLoading ? '...' : stats?.cleared || 0}
                            icon={CheckCircle2}
                            iconColor="text-green-600"
                            iconBgColor="bg-green-100"
                        />
                        <StatCard
                            title="Pending HOD"
                            value={isLoading ? '...' : stats?.pendingHod || 0}
                            icon={Clock}
                            iconColor="text-orange-600"
                            iconBgColor="bg-orange-100"
                        />
                        <StatCard
                            title="Pending Principal"
                            value={isLoading ? '...' : stats?.pendingPrincipal || 0}
                            icon={Activity}
                            iconColor="text-purple-600"
                            iconBgColor="bg-purple-100"
                        />
                    </div>
                )}

                <QuickActionsGrid>
                    {user?.role === 'STUDENT' && (
                        <QuickActionCard
                            href="/dashboard/nodue/student"
                            icon={GraduationCap}
                            label="My Clearance"
                            subtitle="View and apply for clearance"
                            iconColor="text-blue-600"
                            iconBgColor="bg-blue-50"
                        />
                    )}
                    {(user?.role === 'TEACHER' || user?.role === 'SUPER_ADMIN') && (
                        <QuickActionCard
                            href="/dashboard/nodue/faculty"
                            icon={BookOpen}
                            label="Faculty Review"
                            subtitle="Review subject clearances"
                            iconColor="text-indigo-600"
                            iconBgColor="bg-indigo-50"
                        />
                    )}
                    {(user?.role === 'DEPARTMENT_ADMIN' || user?.role === 'SUPER_ADMIN') && (
                        <QuickActionCard
                            href="/dashboard/nodue/hod"
                            icon={Users}
                            label="HOD Approval"
                            subtitle="Approve student clearances"
                            iconColor="text-violet-600"
                            iconBgColor="bg-violet-50"
                        />
                    )}
                    {(user?.role === 'ACCOUNTS_STAFF' || user?.role === 'CLERK' || user?.role === 'SUPER_ADMIN') && (
                        <QuickActionCard
                            href="/dashboard/nodue/accounts"
                            icon={Wallet}
                            label="Accounts Management"
                            subtitle="Manage college dues and payments"
                            iconColor="text-emerald-600"
                            iconBgColor="bg-emerald-50"
                        />
                    )}
                    {(user?.role === 'LIBRARIAN' || user?.role === 'SUPER_ADMIN') && (
                        <QuickActionCard
                            href="/dashboard/nodue/library"
                            icon={Library}
                            label="Library Dues"
                            subtitle="Manage library dues and returns"
                            iconColor="text-amber-600"
                            iconBgColor="bg-amber-50"
                        />
                    )}
                </QuickActionsGrid>
            </div>
        </DashboardShell>
    );
}
