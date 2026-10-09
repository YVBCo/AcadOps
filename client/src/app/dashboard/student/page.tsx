'use client';

import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card, StatCard } from '@/components/ui/card';
import {
    BookOpen,
    ClipboardList,
    Calendar,
    Award,
    TrendingUp,
    User,
    Building,
    Users,
    GraduationCap,
    Briefcase,
    FileCheck2,
} from 'lucide-react';
import Link from 'next/link';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

interface ProfileData {
    id: number;
    name: string;
    email: string;
    usn: string;
    department: { id: number; name: string; code: string } | null;
    batch: { id: number; name: string; startYear: number } | null;
    section: { id: number; name: string } | null;
    program: { id: number; name: string; code: string } | null;
    currentSemester: number;
    admissionYear: number;
}

interface CourseData {
    id: number;
    code: string;
    name: string;
    credits: number;
    semesterNumber: number;
    teacher: string;
}

interface AttendanceData {
    summary: Array<{
        courseId: number;
        courseCode: string;
        courseName: string;
        present: number;
        absent: number;
        total: number;
        percentage: number;
    }>;
}

interface InternalMarkData {
    courseId: number;
    courseCode: string;
    courseName: string;
    calculatedTotal: number;
    maxMarks: number;
    isFinalized: boolean;
}

export default function StudentDashboard() {
    // Fetch student profile
    const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
        queryKey: ['student-profile'],
        queryFn: studentDashboardApi.getProfile,
    });

    // Fetch courses
    const { data: courses = [], isLoading: coursesLoading } = useQuery<CourseData[]>({
        queryKey: ['student-courses'],
        queryFn: studentDashboardApi.getCourses,
    });

    // Fetch attendance
    const { data: attendance, isLoading: attendanceLoading } = useQuery<AttendanceData>({
        queryKey: ['student-attendance'],
        queryFn: () => studentDashboardApi.getAttendance(),
    });

    // Fetch internal marks
    const { data: internalMarks = [], isLoading: marksLoading } = useQuery<InternalMarkData[]>({
        queryKey: ['student-internal-marks'],
        queryFn: studentDashboardApi.getInternalMarks,
    });

    const isLoading = profileLoading || coursesLoading || attendanceLoading || marksLoading;

    // Calculate overall attendance percentage
    const overallAttendance = attendance?.summary && attendance.summary.length > 0
        ? Math.round(
            attendance.summary.reduce((acc, s) => acc + s.percentage, 0) / attendance.summary.length
        )
        : 0;

    // Count finalized marks
    const finalizedMarksCount = internalMarks.filter(m => m.isFinalized).length;

    // Calculate total credits
    const totalCredits = courses.reduce((acc, c) => acc + c.credits, 0);

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
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 lg:p-8 text-white shadow-xl shadow-indigo-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {profile?.name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-indigo-100 text-sm lg:text-base">
                        Semester {profile?.currentSemester} • {profile?.program?.name || 'Program'} • {profile?.department?.name || 'Department'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <User className="w-4 h-4" />
                            USN: {profile?.usn}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <Users className="w-4 h-4" />
                            Section: {profile?.section?.name || 'N/A'}
                        </span>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <GraduationCap className="w-4 h-4" />
                            Batch: {profile?.batch?.name || 'N/A'}
                        </span>
                        <Link
                            href="/dashboard/student/profile"
                            className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/30 backdrop-blur-sm rounded-full text-sm font-semibold hover:bg-white/40 transition-colors"
                        >
                            ✏️ Edit Profile
                        </Link>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Enrolled Courses"
                    value={courses.length.toString()}
                    icon={BookOpen}
                    iconColor="text-indigo-600"
                    iconBgColor="bg-indigo-100"
                />
                <StatCard
                    title="Total Credits"
                    value={totalCredits.toString()}
                    icon={TrendingUp}
                    iconColor="text-emerald-600"
                    iconBgColor="bg-emerald-100"
                />
                <StatCard
                    title="Overall Attendance"
                    value={`${overallAttendance}%`}
                    icon={Calendar}
                    iconColor="text-amber-600"
                    iconBgColor="bg-amber-100"
                />
                <StatCard
                    title="Finalized Marks"
                    value={`${finalizedMarksCount}/${courses.length}`}
                    icon={ClipboardList}
                    iconColor="text-purple-600"
                    iconBgColor="bg-purple-100"
                />
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                <QuickActionCard href="/dashboard/student/profile" icon={User} label="My Profile" subtitle="View & edit profile" iconColor="text-indigo-600" iconBgColor="bg-indigo-50" />
                <QuickActionCard href="/dashboard/student/courses" icon={BookOpen} label="Courses" subtitle="View enrolled courses" iconColor="text-blue-600" iconBgColor="bg-blue-50" />
                <QuickActionCard href="/dashboard/student/internal-marks" icon={ClipboardList} label="Internal Marks" subtitle="View assessment marks" iconColor="text-purple-600" iconBgColor="bg-purple-50" />
                <QuickActionCard href="/dashboard/student/attendance" icon={Calendar} label="Attendance" subtitle="View attendance records" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
                <QuickActionCard href="/dashboard/student/results" icon={Award} label="Results" subtitle="View published results" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
                <QuickActionCard href="/dashboard/student/history" icon={Building} label="Academic History" subtitle="Complete 4-year record" iconColor="text-rose-600" iconBgColor="bg-rose-50" />
                <QuickActionCard href="/dashboard/nodue" icon={FileCheck2} label="No-Due Portal" subtitle="Clearance & dues status" iconColor="text-orange-600" iconBgColor="bg-orange-50" />
                <QuickActionCard href="/dashboard/placement" icon={Briefcase} label="PlacePro" subtitle="Jobs & placement portal" iconColor="text-violet-600" iconBgColor="bg-violet-50" />
            </QuickActionsGrid>


            {/* Academic Profile Card */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Academic Profile</h3>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">
                        Read Only
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">USN</p>
                        <p className="font-semibold text-slate-800">{profile?.usn || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Department</p>
                        <p className="font-semibold text-slate-800">{profile?.department?.name || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Batch</p>
                        <p className="font-semibold text-slate-800">{profile?.batch?.name || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Section</p>
                        <p className="font-semibold text-slate-800">{profile?.section?.name || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Program</p>
                        <p className="font-semibold text-slate-800">{profile?.program?.name || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Current Semester</p>
                        <p className="font-semibold text-slate-800">{profile?.currentSemester || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Admission Year</p>
                        <p className="font-semibold text-slate-800">{profile?.admissionYear || '-'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p>
                        <p className="font-semibold text-slate-800 truncate">{profile?.email || '-'}</p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
