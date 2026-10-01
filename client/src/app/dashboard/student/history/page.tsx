'use client';

import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, RefreshCw, GraduationCap } from 'lucide-react';
import { clsx } from 'clsx';

interface CourseHistory {
    courseId: number;
    courseCode: string;
    courseName: string;
    credits: number;
    internalMarks: number | null;
    semesterMarks: number | null;
    totalMarks: number | null;
    status: string | null;
    hasRevaluation: boolean;
    attempts: number;
}

interface SemesterHistory {
    semesterNumber: number;
    courses: CourseHistory[];
}

interface RevaluationRecord {
    courseCode: string;
    courseName: string;
    semesterNumber: number | null;
    oldMarks: number;
    newMarks: number;
    approvedAt: string | null;
}

interface HistoryData {
    student: {
        usn: string;
        batchName: string | null;
        programName: string | null;
        admissionYear: number;
        currentSemester: number;
    };
    semesters: SemesterHistory[];
    revaluationHistory: RevaluationRecord[];
}

const statusConfig: Record<string, { color: string; bg: string }> = {
    PASS: { color: 'text-emerald-600', bg: 'bg-emerald-100' },
    MAKEUP_ELIGIBLE: { color: 'text-amber-600', bg: 'bg-amber-100' },
    FAIL: { color: 'text-red-600', bg: 'bg-red-100' },
    PENDING: { color: 'text-blue-600', bg: 'bg-blue-100' },
    WITHHELD: { color: 'text-slate-600', bg: 'bg-slate-100' },
};

export default function StudentHistoryPage() {
    const { data: history, isLoading } = useQuery<HistoryData>({
        queryKey: ['student-history'],
        queryFn: studentDashboardApi.getHistory,
    });

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
            </div>
        );
    }

    const student = history?.student;
    const semesters = history?.semesters || [];
    const revaluations = history?.revaluationHistory || [];

    // Calculate overall stats
    const totalCourses = semesters.reduce((acc, sem) => acc + sem.courses.length, 0);
    const passedCourses = semesters.reduce(
        (acc, sem) => acc + sem.courses.filter(c => c.status === 'PASS').length,
        0
    );
    const totalCredits = semesters.reduce(
        (acc, sem) => acc + sem.courses.reduce((a, c) => a + c.credits, 0),
        0
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Academic History</h1>
                <p className="text-slate-500 mt-1">Complete 4-year academic record and revaluation history</p>
            </div>

            {/* Student Info Card */}
            <Card className="bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <GraduationCap className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <p className="text-rose-100 text-sm">Student</p>
                            <p className="text-xl font-bold">{student?.usn}</p>
                            <p className="text-sm text-rose-100">{student?.programName} • {student?.batchName}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-xs text-rose-100">Courses</p>
                            <p className="text-lg font-bold">{totalCourses}</p>
                        </div>
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-xs text-rose-100">Passed</p>
                            <p className="text-lg font-bold">{passedCourses}</p>
                        </div>
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-xs text-rose-100">Credits</p>
                            <p className="text-lg font-bold">{totalCredits}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Timeline View */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 hidden sm:block" />

                {semesters.map((semester) => {
                    const semPassed = semester.courses.filter(c => c.status === 'PASS').length;
                    const semTotal = semester.courses.length;
                    const semCredits = semester.courses.reduce((a, c) => a + c.credits, 0);

                    return (
                        <div key={semester.semesterNumber} className="relative pl-0 sm:pl-12 mb-6">
                            {/* Timeline dot */}
                            <div className="hidden sm:flex absolute left-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center text-white text-sm font-bold shadow-lg shadow-indigo-500/30">
                                {semester.semesterNumber}
                            </div>

                            <Card>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                        <span className="sm:hidden w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                                            S{semester.semesterNumber}
                                        </span>
                                        Semester {semester.semesterNumber}
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Badge variant="success">{semPassed}/{semTotal} Passed</Badge>
                                        <Badge variant="neutral">{semCredits} Credits</Badge>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="text-left px-3 py-2 font-semibold text-slate-700">Course</th>
                                                <th className="text-center px-3 py-2 font-semibold text-slate-700">Cr</th>
                                                <th className="text-center px-3 py-2 font-semibold text-slate-700">Int</th>
                                                <th className="text-center px-3 py-2 font-semibold text-slate-700">Sem</th>
                                                <th className="text-center px-3 py-2 font-semibold text-slate-700">Total</th>
                                                <th className="text-center px-3 py-2 font-semibold text-slate-700">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {semester.courses.map(course => {
                                                const config = statusConfig[course.status || 'PENDING'];

                                                return (
                                                    <tr key={course.courseId} className="hover:bg-slate-50">
                                                        <td className="px-3 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-slate-800">{course.courseCode}</p>
                                                                {course.hasRevaluation && (
                                                                    <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{course.courseName}</p>
                                                        </td>
                                                        <td className="text-center px-3 py-3 text-slate-600">{course.credits}</td>
                                                        <td className="text-center px-3 py-3 text-slate-600">{course.internalMarks ?? '-'}</td>
                                                        <td className="text-center px-3 py-3 text-slate-600">{course.semesterMarks ?? '-'}</td>
                                                        <td className="text-center px-3 py-3">
                                                            <span className="font-semibold text-slate-800">
                                                                {course.totalMarks ?? '-'}
                                                            </span>
                                                        </td>
                                                        <td className="text-center px-3 py-3">
                                                            <span className={clsx(
                                                                'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                                                                config?.bg, config?.color
                                                            )}>
                                                                {course.status || 'PENDING'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    );
                })}
            </div>

            {/* Revaluation History */}
            {revaluations.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-indigo-600" />
                        Revaluation History
                    </h2>
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Course</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Semester</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Old Marks</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">New Marks</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Change</th>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Approved</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {revaluations.map((reval, idx) => {
                                        const change = reval.newMarks - reval.oldMarks;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-4">
                                                    <p className="font-semibold text-slate-800">{reval.courseCode}</p>
                                                    <p className="text-sm text-slate-500">{reval.courseName}</p>
                                                </td>
                                                <td className="text-center px-4 py-4">{reval.semesterNumber || '-'}</td>
                                                <td className="text-center px-4 py-4">
                                                    <span className="text-slate-500 line-through">{reval.oldMarks}</span>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className="font-semibold text-indigo-600">{reval.newMarks}</span>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className={clsx(
                                                        'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                                                        change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    )}>
                                                        {change > 0 ? '+' : ''}{change}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm text-slate-500">
                                                    {reval.approvedAt
                                                        ? new Date(reval.approvedAt).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })
                                                        : '-'
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {semesters.length === 0 && (
                <Card className="text-center py-12">
                    <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-700">No Academic History</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Your academic history will appear here as you progress through semesters.
                    </p>
                </Card>
            )}
        </div>
    );
}
