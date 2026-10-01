'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Calendar, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

interface AttendanceSummary {
    courseId: number;
    courseCode: string;
    courseName: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number;
}

interface AttendanceRecord {
    id: number;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks: string | null;
    courseId: number;
    courseCode: string;
    courseName: string;
}

interface AttendanceData {
    summary: AttendanceSummary[];
    records: AttendanceRecord[];
}

const statusConfig = {
    PRESENT: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Present' },
    ABSENT: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Absent' },
    LATE: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Late' },
    EXCUSED: { icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Excused' },
};

export default function StudentAttendancePage() {
    const [expandedCourse, setExpandedCourse] = useState<number | null>(null);

    const { data: attendance, isLoading } = useQuery<AttendanceData>({
        queryKey: ['student-attendance'],
        queryFn: () => studentDashboardApi.getAttendance(),
    });

    const summary = attendance?.summary || [];
    const records = attendance?.records || [];

    // Calculate overall attendance
    const overallStats = summary.reduce(
        (acc, s) => ({
            present: acc.present + s.present,
            absent: acc.absent + s.absent,
            late: acc.late + s.late,
            excused: acc.excused + s.excused,
            total: acc.total + s.total,
        }),
        { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
    );

    const overallPercentage = overallStats.total > 0
        ? Math.round(((overallStats.present + overallStats.late + overallStats.excused) / overallStats.total) * 100)
        : 0;

    const toggleCourse = (courseId: number) => {
        setExpandedCourse(expandedCourse === courseId ? null : courseId);
    };

    const getRecordsForCourse = (courseId: number) =>
        records.filter(r => r.courseId === courseId);

    if (isLoading) {
        return (
            <div className="space-y-6">
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
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
                <p className="text-slate-500 mt-1">View your attendance records by course</p>
            </div>

            {/* Overall Stats Card */}
            <Card className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-indigo-100 text-sm">Overall Attendance</p>
                        <p className="text-4xl font-bold mt-1">{overallPercentage}%</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
                            <p className="text-xs text-indigo-100">Present</p>
                            <p className="text-lg font-bold">{overallStats.present}</p>
                        </div>
                        <div className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
                            <p className="text-xs text-indigo-100">Absent</p>
                            <p className="text-lg font-bold">{overallStats.absent}</p>
                        </div>
                        <div className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
                            <p className="text-xs text-indigo-100">Late</p>
                            <p className="text-lg font-bold">{overallStats.late}</p>
                        </div>
                        <div className="px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg">
                            <p className="text-xs text-indigo-100">Total</p>
                            <p className="text-lg font-bold">{overallStats.total}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Course-wise Attendance with Expandable Dates */}
            <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Attendance by Course</h2>
                <div className="space-y-3">
                    {summary.map(course => {
                        const isExpanded = expandedCourse === course.courseId;
                        const courseRecords = getRecordsForCourse(course.courseId);

                        return (
                            <Card key={course.courseId} className="overflow-hidden">
                                {/* Course Summary - clickable */}
                                <button
                                    onClick={() => toggleCourse(course.courseId)}
                                    className="w-full text-left hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800">{course.courseName}</p>
                                            <p className="text-sm text-slate-500">{course.courseCode}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span className="text-emerald-600 font-medium">
                                                    ✓ {course.present} Present
                                                </span>
                                                <span className="text-red-500 font-medium">
                                                    ✗ {course.absent} Absent
                                                </span>
                                                {course.late > 0 && (
                                                    <span className="text-amber-600 font-medium">
                                                        ⏱ {course.late} Late
                                                    </span>
                                                )}
                                                <span>/ {course.total} Total</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className={clsx(
                                                    'text-2xl font-bold',
                                                    course.percentage >= 75 ? 'text-emerald-600' :
                                                        course.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                                                )}>
                                                    {course.percentage}%
                                                </div>
                                                <div className="flex items-center gap-1 mt-1 justify-end">
                                                    {course.percentage >= 75 ? (
                                                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                    ) : (
                                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                                    )}
                                                    <span className={clsx(
                                                        'text-xs font-medium',
                                                        course.percentage >= 75 ? 'text-emerald-600' : 'text-amber-600'
                                                    )}>
                                                        {course.percentage >= 75 ? 'Good' : 'Low'}
                                                    </span>
                                                </div>
                                            </div>
                                            {courseRecords.length > 0 && (
                                                isExpanded
                                                    ? <ChevronUp className="w-5 h-5 text-slate-400" />
                                                    : <ChevronDown className="w-5 h-5 text-slate-400" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all',
                                                course.percentage >= 75 ? 'bg-emerald-500' :
                                                    course.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                            )}
                                            style={{ width: `${course.percentage}%` }}
                                        />
                                    </div>
                                </button>

                                {/* Expanded: Date-wise Records */}
                                {isExpanded && courseRecords.length > 0 && (
                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                        <h5 className="text-sm font-semibold text-slate-700 mb-3 px-1">
                                            Date-wise Attendance
                                        </h5>
                                        <div className="space-y-2 max-h-72 overflow-y-auto">
                                            {courseRecords.map(record => {
                                                const config = statusConfig[record.status] || statusConfig.ABSENT;
                                                const StatusIcon = config.icon;

                                                return (
                                                    <div
                                                        key={record.id}
                                                        className={clsx(
                                                            'flex items-center justify-between px-3 py-2.5 rounded-lg',
                                                            config.bg
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <StatusIcon className={clsx('w-4 h-4', config.color)} />
                                                            <span className="text-sm font-medium text-slate-700">
                                                                {new Date(record.date).toLocaleDateString('en-IN', {
                                                                    weekday: 'short',
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                })}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {record.remarks && (
                                                                <span className="text-xs text-slate-500 max-w-[120px] truncate">
                                                                    {record.remarks}
                                                                </span>
                                                            )}
                                                            <span className={clsx(
                                                                'text-xs font-semibold px-2 py-0.5 rounded-full',
                                                                config.bg, config.color
                                                            )}>
                                                                {config.label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>

            {summary.length === 0 && (
                <Card className="text-center py-12">
                    <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-700">No Attendance Records</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Attendance records will appear here once marked.
                    </p>
                </Card>
            )}
        </div>
    );
}
