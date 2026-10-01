'use client';

import { useQuery } from '@tanstack/react-query';
import { parentApi, chatApi } from '@/lib/api';
import { Card, StatCard } from '@/components/ui/card';
import {
    GraduationCap,
    Calendar,
    ClipboardList,
    MessageCircle,
    Users,
    BookOpen,
    ArrowRight,
    MessageSquare,
    FileText
} from 'lucide-react';
import Link from 'next/link';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

interface StudentInfo {
    id: number;
    name: string;
    usn: string;
    department: string;
    semester: number;
    batch: string;
    section: string;
    program: string;
    mentorName: string | null;
}

interface DashboardData {
    parentName: string;
    students: StudentInfo[];
}

export default function ParentDashboard() {
    const { data: dashboard, isLoading } = useQuery<DashboardData>({
        queryKey: ['parent-dashboard'],
        queryFn: parentApi.getDashboard,
    });

    const { data: unread } = useQuery({
        queryKey: ['chat-unread'],
        queryFn: chatApi.getUnreadCount,
        refetchInterval: 30000, // Poll every 30 seconds
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

    const students = dashboard?.students || [];
    const unreadCount = unread?.unreadCount || 0;

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 lg:p-8 text-white shadow-xl shadow-emerald-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome, {dashboard?.parentName?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-emerald-100 text-sm lg:text-base">
                        Monitor your child&apos;s academic progress and communicate with mentors
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <Users className="w-4 h-4" />
                            {students.length} Student{students.length !== 1 ? 's' : ''} Linked
                        </span>
                        {unreadCount > 0 && (
                            <Link
                                href="/dashboard/parent/chat"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/30 backdrop-blur-sm rounded-full text-sm font-semibold hover:bg-white/40 transition-colors"
                            >
                                <MessageCircle className="w-4 h-4" />
                                {unreadCount} Unread Message{unreadCount !== 1 ? 's' : ''}
                            </Link>
                        )}
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-teal-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Students"
                    value={students.length.toString()}
                    icon={GraduationCap}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
                <StatCard
                    title="Unread Messages"
                    value={unreadCount.toString()}
                    icon={MessageCircle}
                    iconColor="text-blue-600"
                    iconBgColor="bg-blue-100"
                />
                <Link href="/dashboard/parent/attendance">
                    <StatCard
                        title="Attendance"
                        value="View"
                        icon={Calendar}
                        iconColor="text-amber-600"
                        iconBgColor="bg-amber-100"
                    />
                </Link>
                <Link href="/dashboard/parent/marks">
                    <StatCard
                        title="Marks"
                        value="View"
                        icon={ClipboardList}
                        iconColor="text-purple-600"
                        iconBgColor="bg-purple-100"
                    />
                </Link>
            </div>

            {/* Quick Actions Grid */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/parent/chat" icon={MessageSquare} label="Messages" subtitle="Chat with mentors" iconColor="text-blue-600" iconBgColor="bg-blue-50" />
                <QuickActionCard href="/dashboard/parent/attendance" icon={Calendar} label="Attendance" subtitle="View attendance records" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/parent/marks" icon={FileText} label="Internal Marks" subtitle="View assessment marks" iconColor="text-purple-600" iconBgColor="bg-purple-50" />
            </QuickActionsGrid>

            {/* Password Change Info */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                    <p className="text-sm font-medium text-blue-800">Need to change your password?</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                        Please contact your child&apos;s assigned mentor to update your login password. Mentors can update it for you through their dashboard.
                    </p>
                </div>
            </div>

            {/* Students List */}
            <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Students</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {students.map((student) => (
                        <Card key={student.id} className="group hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-bold text-lg">
                                    {student.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                                        {student.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{student.usn}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                                            <BookOpen className="w-3 h-3" />
                                            {student.department}
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full">
                                            Sem {student.semester}
                                        </span>
                                        {student.section && (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                                                Sec {student.section}
                                            </span>
                                        )}
                                    </div>
                                    {student.mentorName && (
                                        <p className="text-xs text-slate-400 mt-2">
                                            Mentor: <span className="text-slate-600 font-medium">{student.mentorName}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                                <Link
                                    href={`/dashboard/parent/chat?student=${student.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Chat with Mentor
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
                                <Link
                                    href="/dashboard/parent/attendance"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    Attendance
                                </Link>
                                <Link
                                    href="/dashboard/parent/marks"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    Marks
                                </Link>
                            </div>
                        </Card>
                    ))}

                    {students.length === 0 && (
                        <Card className="col-span-full text-center py-12">
                            <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">No Students Linked</h3>
                            <p className="text-slate-400 text-sm">
                                Your account will be linked to students when they are admitted.
                            </p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
