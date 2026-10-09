'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import { Card, StatCard } from '@/components/ui/card';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';
import {
    Users,
    Layers,
    BookOpen,
    UserCog,
    FileText,
    ClipboardCheck,
    Calendar,
    Clock,
    ArrowRight,
    AlertCircle,
    GraduationCap,
    Building,
    Settings,
    UserCheck,
    BarChart3,
    ScrollText,
    MessageSquare,
    Briefcase,
    FileCheck2,
} from 'lucide-react';

interface DashboardStats {
    totalStudents: number;
    totalSections: number;
    totalTeachers: number;
    totalCourses: number;
    pendingMarks: number;
    recentActivity: Array<{
        id: number;
        action: string;
        timestamp: string;
        actor?: { name: string };
    }>;
}

export default function DeptAdminDashboard() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalStudents: 0,
        totalSections: 0,
        totalTeachers: 0,
        totalCourses: 0,
        pendingMarks: 0,
        recentActivity: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch data in parallel
            const [studentsRes, sectionsRes, teachersRes, coursesRes, auditRes] = await Promise.all([
                api.get('/dept-admin/students?take=1').catch(() => ({ data: { total: 0 } })),
                api.get('/dept-admin/sections').catch(() => ({ data: [] })),
                api.get('/dept-admin/teachers').catch(() => ({ data: [] })),
                api.get('/dept-admin/courses').catch(() => ({ data: [] })),
                api.get('/dept-admin/audit-logs?take=5').catch(() => ({ data: { logs: [] } })),
            ]);

            setStats({
                totalStudents: studentsRes.data.total || 0,
                totalSections: Array.isArray(sectionsRes.data) ? sectionsRes.data.length : 0,
                totalTeachers: Array.isArray(teachersRes.data) ? teachersRes.data.length : 0,
                totalCourses: Array.isArray(coursesRes.data) ? coursesRes.data.length : 0,
                pendingMarks: 0,
                recentActivity: auditRes.data.logs || [],
            });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 p-6 lg:p-8 text-white shadow-xl shadow-teal-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {user?.name?.split(' ')[0] || 'Department Admin'}! 👋
                    </h1>
                    <p className="text-teal-100 text-sm lg:text-base">
                        Manage your department's academic operations from this central hub.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <Building className="w-4 h-4" />
                            Department Admin
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            Academic Ops
                        </span>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-green-400/20 rounded-full blur-2xl"></div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Students"
                    value={stats.totalStudents.toString()}
                    icon={Users}
                    iconColor="text-teal-600"
                    iconBgColor="bg-teal-100"
                />
                <StatCard
                    title="Sections"
                    value={stats.totalSections.toString()}
                    icon={Layers}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
                <StatCard
                    title="Teachers"
                    value={stats.totalTeachers.toString()}
                    icon={UserCog}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                />
                <StatCard
                    title="Courses"
                    value={stats.totalCourses.toString()}
                    icon={BookOpen}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/dept-admin/students" icon={Users} label="Students" subtitle="Manage student records" iconColor="text-blue-600" iconBgColor="bg-blue-50" />
                <QuickActionCard href="/dashboard/dept-admin/sections" icon={Layers} label="Sections" subtitle="Create & manage sections" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
                <QuickActionCard href="/dashboard/dept-admin/courses" icon={BookOpen} label="Courses" subtitle="Manage course catalog" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/dept-admin/allocations" icon={Settings} label="Allocations" subtitle="Course-teacher assignments" iconColor="text-purple-600" iconBgColor="bg-purple-50" />
                <QuickActionCard href="/dashboard/dept-admin/teachers" icon={UserCog} label="Teachers" subtitle="Faculty management" iconColor="text-cyan-600" iconBgColor="bg-cyan-50" />
                <QuickActionCard href="/dashboard/dept-admin/mentors" icon={UserCheck} label="Mentors" subtitle="Mentor assignments" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                <QuickActionCard href="/dashboard/dept-admin/mentor-tracking" icon={BarChart3} label="Mentor Tracking" subtitle="Track mentor interactions" iconColor="text-teal-600" iconBgColor="bg-teal-50" />
                <QuickActionCard href="/dashboard/dept-admin/internal-marks" icon={FileText} label="Internal Marks" subtitle="View & manage marks" iconColor="text-rose-600" iconBgColor="bg-rose-50" />
                <QuickActionCard href="/dashboard/dept-admin/attendance" icon={ClipboardCheck} label="Attendance" subtitle="View attendance records" iconColor="text-green-600" iconBgColor="bg-green-50" />
                <QuickActionCard href="/dashboard/dept-admin/chat" icon={MessageSquare} label="Escalated Chats" subtitle="Manage parent escalations" iconColor="text-blue-600" iconBgColor="bg-blue-50" />
                <QuickActionCard href="/dashboard/dept-admin/edit-requests" icon={FileText} label="Edit Requests" subtitle="Review student edits" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                <QuickActionCard href="/dashboard/dept-admin/assessment-config" icon={Settings} label="Assessment Config" subtitle="Configure assessments" iconColor="text-slate-600" iconBgColor="bg-slate-100" />
                <QuickActionCard href="/dashboard/dept-admin/timetable" icon={Calendar} label="Timetable" subtitle="Upload timetable" iconColor="text-violet-600" iconBgColor="bg-violet-50" />
                <QuickActionCard href="/dashboard/dept-admin/timetable/generator" icon={Settings} label="Timetable Generator" subtitle="Auto-generate timetables" iconColor="text-fuchsia-600" iconBgColor="bg-fuchsia-50" />
                <QuickActionCard href="/dashboard/dept-admin/timetable/substitutions" icon={UserCog} label="Substitutions" subtitle="Manage teacher subs" iconColor="text-pink-600" iconBgColor="bg-pink-50" />
                <QuickActionCard href="/dashboard/dept-admin/calendar" icon={Calendar} label="Academic Calendar" subtitle="Holidays & overrides" iconColor="text-red-600" iconBgColor="bg-red-50" />
                <QuickActionCard href="/dashboard/dept-admin/classrooms" icon={Building} label="Classrooms" subtitle="Room management" iconColor="text-sky-600" iconBgColor="bg-sky-50" />
                <QuickActionCard href="/dashboard/dept-admin/audit-logs" icon={ScrollText} label="Audit Logs" subtitle="View activity trail" iconColor="text-neutral-600" iconBgColor="bg-neutral-100" />
                <QuickActionCard href="/dashboard/nodue/hod" icon={FileCheck2} label="No-Due Approvals" subtitle="HOD clearance approvals" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                <QuickActionCard href="/dashboard/placement" icon={Briefcase} label="PlacePro" subtitle="Placement & recruitment" iconColor="text-violet-600" iconBgColor="bg-violet-50" />
            </QuickActionsGrid>

            {/* Recent Activity */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Recent Activity</h3>
                    <Link href="/dashboard/dept-admin/audit-logs" className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1">
                        View All <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
                {stats.recentActivity.length > 0 ? (
                    <div className="space-y-3">
                        {stats.recentActivity.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                                <Clock className="h-4 w-4 text-slate-400 mt-1" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                        {activity.action.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {activity.actor?.name || 'System'} • {new Date(activity.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Clock className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-500">No recent activity</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
