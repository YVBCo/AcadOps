'use client';

import { useQuery } from '@tanstack/react-query';
import { mentorApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import {
    Users,
    GraduationCap,
    CheckCircle,
    Clock,
    AlertCircle,
    ArrowRight,
    UserCheck,
    BookOpen,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface MentorProfile {
    isMentor: boolean;
    teacher: {
        id: number;
        designation: string;
        user: { name: string; email: string };
    };
    activeAssignments: number;
    totalStudents: number;
    assignments: Array<{
        id: number;
        semesterNumber: number;
        academicYear: string;
        studentCount: number;
        assignedAt: string;
    }>;
}

interface Student {
    usn: string;
    name: string;
    email: string;
    currentSemester: number;
    section?: { name: string };
    batch?: { name: string };
}

export default function MentorshipPage() {
    const { user } = useAuthStore();

    // Check mentor status
    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['mentor-status'],
        queryFn: () => mentorApi.getStatus(),
    });

    // Get mentor profile if user is a mentor
    const { data: profile, isLoading: profileLoading } = useQuery<MentorProfile>({
        queryKey: ['mentor-profile'],
        queryFn: () => mentorApi.getProfile(),
        enabled: status?.isMentor,
    });

    // Get assigned students
    const { data: students, isLoading: studentsLoading } = useQuery<Student[]>({
        queryKey: ['mentor-students'],
        queryFn: () => mentorApi.getStudents(),
        enabled: status?.isMentor,
    });

    const isLoading = statusLoading || profileLoading || studentsLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading mentorship data...</p>
                </div>
            </div>
        );
    }

    // Not a mentor
    if (!status?.isMentor) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                    <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Not Assigned as Mentor</h2>
                <p className="text-slate-600 max-w-md">
                    You have not been assigned as a mentor for any students yet.
                    Please contact your Department Admin for mentor assignment.
                </p>
            </div>
        );
    }

    const studentList = students || [];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Mentorship Dashboard</h1>
                    <p className="text-slate-600">Manage and monitor your assigned students</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Students</p>
                            <p className="text-2xl font-bold text-slate-800">{profile?.totalStudents || 0}</p>
                            <p className="text-xs text-slate-400">Active assignments this semester</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <UserCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Active Assignments</p>
                            <p className="text-2xl font-bold text-slate-800">{profile?.activeAssignments || 0}</p>
                            <p className="text-xs text-slate-400">Mentor-student pairs</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Current Semester</p>
                            <p className="text-2xl font-bold text-slate-800">{profile?.assignments?.[0]?.semesterNumber || '-'}</p>
                            <p className="text-xs text-slate-400">{profile?.assignments?.[0]?.academicYear || 'N/A'}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/teacher/mentorship/approvals" className="block">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Clock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">Pending Approvals</h3>
                                    <p className="text-sm text-slate-500">Review internal marks submissions</p>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
                        </div>
                    </Link>
                </Card>

                <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/teacher/mentorship/students" className="block">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800">View All Students</h3>
                                    <p className="text-sm text-slate-500">See complete student list with details</p>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-colors" />
                        </div>
                    </Link>
                </Card>
            </div>

            {/* Student List Preview */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-slate-800">Assigned Students</h2>
                    <Link
                        href="/dashboard/teacher/mentorship/students"
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                        View All <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {studentList.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No students assigned yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {studentList.slice(0, 5).map((student) => (
                            <Link
                                key={student.usn}
                                href={`/dashboard/teacher/mentorship/student/${student.usn}`}
                                className="flex items-center justify-between py-4 hover:bg-slate-50 -mx-4 px-4 rounded-lg transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                                        {student.name?.charAt(0).toUpperCase() || 'S'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{student.name}</p>
                                        <p className="text-sm text-slate-500">{student.usn}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-slate-700">Sem {student.currentSemester}</p>
                                        <p className="text-xs text-slate-500">
                                            {student.section?.name || 'No section'} • {student.batch?.name || ''}
                                        </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {studentList.length > 5 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                        <Link
                            href="/dashboard/teacher/mentorship/students"
                            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                            + {studentList.length - 5} more students
                        </Link>
                    </div>
                )}
            </Card>
        </div>
    );
}
