'use client';

import { useQuery } from '@tanstack/react-query';
import {
    BookOpen,
    Users,
    FileText,
    ClipboardCheck,
    CheckCircle,
    Clock,
    AlertCircle,
    ArrowRight,
    GraduationCap,
    Award,
    RefreshCw
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/card';
import Link from 'next/link';
import { courseApi, clerkApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { PermanentUsnAssignment } from '@/components/coe/PermanentUsnAssignment';
import { SemesterMarksReview } from '@/components/coe/SemesterMarksReview';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

interface Course {
    id: number;
    isLocked?: boolean;
}

interface Clerk {
    id: number;
    isActive: boolean;
}

export default function COEDashboardPage() {
    const { user } = useAuthStore();

    // Fetch courses
    const { data: rawCourses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['courses'],
        queryFn: () => courseApi.getAll(),
    });
    const courses: Course[] = Array.isArray(rawCourses) ? rawCourses : [];

    // Fetch clerks
    const { data: rawClerks = [], isLoading: clerksLoading } = useQuery({
        queryKey: ['clerks'],
        queryFn: () => clerkApi.getAll(),
    });
    const clerks: Clerk[] = Array.isArray(rawClerks) ? rawClerks : [];

    // Calculate real stats
    const stats = {
        totalCourses: courses.length,
        lockedCourses: courses.filter(c => c.isLocked).length,
        activeClerks: clerks.filter(c => c.isActive).length,
        totalClerks: clerks.length,
        pendingSemesterMarks: 0,
        pendingApprovals: 0,
        pendingRevaluations: 0,
    };

    const isLoading = coursesLoading || clerksLoading;

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

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6 lg:p-8 text-white shadow-xl shadow-amber-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {user?.name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-amber-100 text-sm lg:text-base">
                        Controller of Examinations - Manage courses, marks, and results
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            COE
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <BookOpen className="w-4 h-4" />
                            {stats.totalCourses} Courses
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
                    title="Total Courses"
                    value={stats.totalCourses.toString()}
                    icon={BookOpen}
                    iconColor="text-amber-600"
                    iconBgColor="bg-amber-100"
                />
                <StatCard
                    title="Locked Courses"
                    value={stats.lockedCourses.toString()}
                    icon={ClipboardCheck}
                    iconColor="text-orange-600"
                    iconBgColor="bg-orange-100"
                />
                <StatCard
                    title="Active Clerks"
                    value={stats.activeClerks.toString()}
                    icon={Users}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
                <StatCard
                    title="Total Clerks"
                    value={stats.totalClerks.toString()}
                    icon={Users}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
            </div>

            {/* Quick Actions & Pending Tasks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/coe/courses" icon={BookOpen} label="Courses" subtitle="Create & lock courses" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/coe/clerks" icon={Users} label="Clerks" subtitle="Manage clerk accounts" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                <QuickActionCard href="/dashboard/coe/internal-marks" icon={FileText} label="Internal Marks" subtitle="Review internal marks" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                <QuickActionCard href="/dashboard/coe/semester-marks" icon={ClipboardCheck} label="Semester Marks" subtitle="Review semester marks" iconColor="text-blue-600" iconBgColor="bg-blue-50" />
                <QuickActionCard href="/dashboard/coe/results" icon={Award} label="Results" subtitle="Publish student results" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
                <QuickActionCard href="/dashboard/coe/revaluations" icon={RefreshCw} label="Revaluations" subtitle="Process revaluation requests" iconColor="text-rose-600" iconBgColor="bg-rose-50" />
            </QuickActionsGrid>

                {/* Pending Tasks */}
                <Card>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Pending Tasks</h3>
                    <div className="space-y-3">
                        {stats.pendingApprovals > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                                <div className="flex items-center gap-3">
                                    <Clock className="h-5 w-5 text-amber-600" />
                                    <span className="font-medium text-slate-700">Semester marks pending approval</span>
                                </div>
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">{stats.pendingApprovals}</span>
                            </div>
                        )}
                        {stats.pendingRevaluations > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="h-5 w-5 text-orange-600" />
                                    <span className="font-medium text-slate-700">Revaluations pending review</span>
                                </div>
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">{stats.pendingRevaluations}</span>
                            </div>
                        )}
                        {stats.pendingApprovals === 0 && stats.pendingRevaluations === 0 && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                                <CheckCircle className="h-5 w-5 text-emerald-600" />
                                <span className="font-medium text-emerald-700">All caught up! No pending tasks.</span>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Permanent USN Assignment */}
            <div className="mt-6">
                <PermanentUsnAssignment />
            </div>

            {/* Semester Marks Review */}
            <div className="mt-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Semester Marks Review</h2>
                <SemesterMarksReview />
            </div>
        </div>
    );
}
