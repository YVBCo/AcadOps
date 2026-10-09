'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { teacherApi, chatApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    BookOpen,
    Users,
    Layers,
    FileText,
    ClipboardCheck,
    ArrowRight,
    GraduationCap,
    User,
    MessageSquare,
    Calendar,
    FileCheck2,
} from 'lucide-react';
import { Card, StatCard } from '@/components/ui/card';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

interface CourseAllocation {
    id: number;
    courseId: number;
    sectionId: number;
    semesterNumber: number;
    course: { id: number; name: string; code: string; credits: number };
    section: {
        id: number;
        name: string;
        batch: { id: number; name: string; currentSemester: number };
        _count: { students: number };
    };
}

export default function TeacherDashboard() {
    const { user } = useAuthStore();

    // Fetch allocations
    const { data: allocations = [], isLoading } = useQuery({
        queryKey: ['teacher-allocations'],
        queryFn: teacherApi.getMyAllocations,
        enabled: !!user,
    });

    // Fetch unread chat count
    const { data: chatData } = useQuery({
        queryKey: ['chat-unread'],
        queryFn: chatApi.getUnreadCount,
        enabled: !!user,
        refetchInterval: 30000,
    });

    // Calculate stats
    const stats = useMemo(() => {
        const allocs = allocations as CourseAllocation[];
        const uniqueCourses = new Set(allocs.map(a => a.courseId)).size;
        const uniqueSections = new Set(allocs.map(a => a.sectionId)).size;
        const totalStudents = allocs.reduce((sum, a) => sum + (a.section._count?.students || 0), 0);

        return {
            courses: uniqueCourses,
            sections: uniqueSections,
            students: totalStudents,
            allocations: allocs.length,
        };
    }, [allocations]);

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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500 p-6 lg:p-8 text-white shadow-xl shadow-teal-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {user?.name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-teal-100 text-sm lg:text-base">
                        You have {stats.allocations} course {stats.allocations === 1 ? 'allocation' : 'allocations'} this semester
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <User className="w-4 h-4" />
                            {user?.email}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            Teacher
                        </span>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-green-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="My Courses"
                    value={stats.courses.toString()}
                    icon={BookOpen}
                    iconColor="text-teal-600"
                    iconBgColor="bg-teal-100"
                />
                <StatCard
                    title="Sections"
                    value={stats.sections.toString()}
                    icon={Layers}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
                <StatCard
                    title="Total Students"
                    value={stats.students.toString()}
                    icon={Users}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                />
                <StatCard
                    title="Allocations"
                    value={stats.allocations.toString()}
                    icon={FileText}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
            </div>

            {/* Quick Actions Grid */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/teacher/courses" icon={BookOpen} label="My Courses" subtitle="View course allocations" iconColor="text-teal-600" iconBgColor="bg-teal-50" />
                <QuickActionCard href="/dashboard/teacher/internal-marks" icon={FileText} label="Internal Marks" subtitle="Record IA marks" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                <QuickActionCard href="/dashboard/teacher/attendance" icon={ClipboardCheck} label="Attendance" subtitle="Mark daily attendance" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
                <QuickActionCard href="/dashboard/teacher/mentorship" icon={Users} label="Mentorship" subtitle="Manage mentee students" iconColor="text-violet-600" iconBgColor="bg-violet-50" />
                <QuickActionCard href="/dashboard/teacher/courses" icon={Layers} label="My Subjects" subtitle="View assigned subjects" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/teacher/timetable" icon={Calendar} label="My Timetable" subtitle="View weekly schedule" iconColor="text-fuchsia-600" iconBgColor="bg-fuchsia-50" />
                <QuickActionCard href="/dashboard/nodue/faculty" icon={FileCheck2} label="No-Due Review" subtitle="Clear student subjects" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
            </QuickActionsGrid>

            {/* Parent Chat — Featured Card */}
            <Link href="/dashboard/teacher/chat" className="block">
                <Card className="group relative overflow-hidden border-2 border-blue-100 hover:border-blue-300 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/50 cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50 group-hover:opacity-80 transition-opacity" />
                    <div className="relative flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                            <MessageSquare className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Parent Chat</h3>
                            <p className="text-sm text-slate-500">Communicate with parents of your mentee students</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {(chatData?.unreadCount ?? 0) > 0 && (
                                <span className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse shadow-lg shadow-red-500/30">
                                    {chatData.unreadCount} unread
                                </span>
                            )}
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                    </div>
                </Card>
            </Link>

            {/* My Course Allocations */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">My Course Allocations</h3>
                    <Link href="/dashboard/teacher/courses" className="text-teal-600 hover:text-teal-700 text-sm font-medium flex items-center gap-1">
                        View All <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                {(allocations as CourseAllocation[]).length === 0 ? (
                    <div className="text-center py-12">
                        <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-2">No Course Allocations</h3>
                        <p className="text-slate-500">You haven't been allocated any courses yet. Contact your Department Admin.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(allocations as CourseAllocation[]).slice(0, 6).map((alloc) => (
                            <div key={alloc.id} className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="h-5 w-5 text-teal-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-slate-800 truncate">
                                            {alloc.course.code}
                                        </h4>
                                        <p className="text-sm text-slate-600 truncate">{alloc.course.name}</p>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
                                                Section {alloc.section.name}
                                            </span>
                                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                {alloc.section._count?.students || 0} students
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
