'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
    Briefcase,
    Building2,
    Users,
    TrendingUp,
    FileText,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { StatCard, Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';
import DashboardShell from '@/components/layout/DashboardShell';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

export default function PlacementDashboard() {
    const { user } = useAuthStore();
    const isStudent = user?.role === 'STUDENT';
    const isCompany = user?.role === 'PLACEMENT_COMPANY';
    const isAdmin = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL'].includes(user?.role || '');

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['placement-stats'],
        queryFn: () => placementApi.getStats(),
        enabled: isAdmin,
    });

    const { data: activeDrives = [], isLoading: drivesLoading } = useQuery({
        queryKey: ['active-drives'],
        queryFn: () => placementApi.getDrives({ status: 'ACTIVE' }),
    });

    const isLoading = (isAdmin && statsLoading) || drivesLoading;

    return (
        <DashboardShell 
            allowedRoles={['STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL', 'PLACEMENT_COMPANY']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="space-y-6">
                {/* Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-700 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
                    <div className="absolute inset-0 bg-grid-white/10"></div>
                    <div className="relative">
                        <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                            Welcome to Placement Portal 🚀
                        </h1>
                        <p className="text-blue-100 text-sm lg:text-base">
                            {isStudent 
                                ? "Manage your profile, apply for jobs, and track your applications." 
                                : isCompany
                                    ? "Manage your company profile, job postings, and candidate applications."
                                    : "Manage campus drives, student applications, and placement analytics."}
                        </p>
                    </div>
                </div>

                {/* Stats grid for Admins */}
                {isAdmin && stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Companies"
                            value={stats.totalCompanies?.toString() || '0'}
                            icon={Building2}
                            iconColor="text-blue-600"
                            iconBgColor="bg-blue-100"
                        />
                        <StatCard
                            title="Active Drives"
                            value={stats.activeDrives?.toString() || '0'}
                            icon={Calendar}
                            iconColor="text-indigo-600"
                            iconBgColor="bg-indigo-100"
                        />
                        <StatCard
                            title="Placed Students"
                            value={stats.placedStudents?.toString() || '0'}
                            icon={Users}
                            iconColor="text-green-600"
                            iconBgColor="bg-green-100"
                        />
                        <StatCard
                            title="Avg. CTC"
                            value={stats.avgCtc ? `₹${stats.avgCtc}L` : 'N/A'}
                            icon={TrendingUp}
                            iconColor="text-purple-600"
                            iconBgColor="bg-purple-100"
                        />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Active Drives */}
                    <Card className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Active Placement Drives</h3>
                            <Link href="/dashboard/placement/drives" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                                View All
                            </Link>
                        </div>
                        {isLoading ? (
                            <div className="animate-pulse space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>)}
                            </div>
                        ) : activeDrives.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">No active drives currently.</div>
                        ) : (
                            <div className="space-y-3">
                                {activeDrives.slice(0, 5).map((drive: any) => (
                                    <div key={drive.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                {drive.company?.name?.charAt(0) || 'C'}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-slate-800">{drive.title || drive.company?.name || 'Company Name'}</h4>
                                                <p className="text-sm text-slate-500">{drive.driveDate ? new Date(drive.driveDate).toLocaleDateString() : 'Date not set'} · {drive.company?.name || 'Company'}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* Quick Actions */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-800">Quick Links</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <Link href="/dashboard/placement/jobs" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <Briefcase className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors">Job Openings</h4>
                                    <p className="text-xs text-slate-500">View and apply for jobs</p>
                                </div>
                            </Link>

                            <Link href="/dashboard/placement/applications" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all group">
                                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">Applications</h4>
                                    <p className="text-xs text-slate-500">Track your applications</p>
                                </div>
                            </Link>

                            {isStudent && (
                                <Link href="/dashboard/placement/profile" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group">
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-slate-800 group-hover:text-emerald-600 transition-colors">My Profile</h4>
                                        <p className="text-xs text-slate-500">Update CV and details</p>
                                    </div>
                                </Link>
                            )}

                            {isCompany && (
                                <Link href="/dashboard/placement/company" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all group">
                                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-slate-800 group-hover:text-emerald-600 transition-colors">Company Profile</h4>
                                        <p className="text-xs text-slate-500">Set up your company details</p>
                                    </div>
                                </Link>
                            )}

                            {isAdmin && (
                                <Link href="/dashboard/placement/analytics" className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all group">
                                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-slate-800 group-hover:text-purple-600 transition-colors">Analytics</h4>
                                        <p className="text-xs text-slate-500">Placement statistics</p>
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
