'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Calendar, AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

interface AttendanceSummary {
    courseCode: string;
    courseName: string;
    present: number;
    absent: number;
    total: number;
    percentage: number;
}

interface AttendanceRecord {
    id: number;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks: string | null;
    courseCode: string;
    courseName: string;
}

interface StudentAttendance {
    studentId: number;
    studentName: string;
    usn: string;
    summary: AttendanceSummary[];
    records: AttendanceRecord[];
}

const statusConfig = {
    PRESENT: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Present' },
    ABSENT: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Absent' },
    LATE: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Late' },
    EXCUSED: { icon: AlertTriangle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Excused' },
};

export default function ParentAttendancePage() {
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

    const { data: dashboard } = useQuery({
        queryKey: ['parent-dashboard'],
        queryFn: parentApi.getDashboard,
    });

    const students = dashboard?.students || [];
    const firstStudentId = students[0]?.id;

    const { data: attendance, isLoading } = useQuery<StudentAttendance>({
        queryKey: ['parent-attendance', firstStudentId],
        queryFn: () => parentApi.getStudentAttendance(firstStudentId),
        enabled: !!firstStudentId,
    });

    if (isLoading || !attendance) {
        return (
            <div className="space-y-4">
                <div className="h-20 bg-slate-200 animate-pulse rounded-2xl"></div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-xl"></div>
                ))}
            </div>
        );
    }

    const summary = attendance.summary || [];
    const records = attendance.records || [];
    const overallAttendance = summary.length > 0
        ? Math.round(summary.reduce((acc, s) => acc + s.percentage, 0) / summary.length)
        : 0;

    const toggleCourse = (courseCode: string) => {
        setExpandedCourse(expandedCourse === courseCode ? null : courseCode);
    };

    const getRecordsForCourse = (courseCode: string) =>
        records.filter(r => r.courseCode === courseCode);

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="!p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-6 h-6" />
                        <h2 className="text-xl font-bold">{attendance.studentName}&apos;s Attendance</h2>
                    </div>
                    <p className="text-amber-100 text-sm">USN: {attendance.usn}</p>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-2xl font-bold">{overallAttendance}%</p>
                            <p className="text-xs text-amber-100">Overall</p>
                        </div>
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-2xl font-bold">{summary.length}</p>
                            <p className="text-xs text-amber-100">Courses</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Course-wise with expandable date records */}
            <div className="space-y-3">
                {summary.map((course) => {
                    const isExpanded = expandedCourse === course.courseCode;
                    const courseRecords = getRecordsForCourse(course.courseCode);

                    return (
                        <Card key={course.courseCode} className="overflow-hidden">
                            {/* Course Summary Row - clickable */}
                            <button
                                onClick={() => toggleCourse(course.courseCode)}
                                className="w-full text-left hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-slate-800">{course.courseName}</h4>
                                        <p className="text-sm text-slate-500">{course.courseCode}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                            <span className="text-emerald-600 font-medium">
                                                ✓ {course.present} Present
                                            </span>
                                            <span className="text-red-500 font-medium">
                                                ✗ {course.absent} Absent
                                            </span>
                                            <span>/ {course.total} Total</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className={clsx(
                                                'text-2xl font-bold',
                                                course.percentage >= 75 ? 'text-emerald-600' :
                                                course.percentage >= 60 ? 'text-amber-600' : 'text-red-600'
                                            )}>
                                                {Math.round(course.percentage)}%
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
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
                                <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
                                    <div
                                        className={clsx(
                                            'h-2 rounded-full transition-all duration-500',
                                            course.percentage >= 75 ? 'bg-emerald-500' :
                                            course.percentage >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                        )}
                                        style={{ width: `${Math.min(course.percentage, 100)}%` }}
                                    ></div>
                                </div>
                            </button>

                            {/* Expanded: Date-wise Records */}
                            {isExpanded && courseRecords.length > 0 && (
                                <div className="mt-4 border-t border-slate-100 pt-4">
                                    <h5 className="text-sm font-semibold text-slate-700 mb-3 px-1">
                                        Date-wise Attendance
                                    </h5>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
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

                {summary.length === 0 && (
                    <Card className="text-center py-12">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-600 mb-2">No Attendance Records</h3>
                        <p className="text-slate-400 text-sm">Attendance data will appear once classes begin.</p>
                    </Card>
                )}
            </div>
        </div>
    );
}
