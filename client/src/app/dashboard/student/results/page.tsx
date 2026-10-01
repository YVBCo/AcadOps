'use client';

import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface ResultData {
    id: number;
    courseId: number;
    courseCode: string;
    courseName: string;
    credits: number;
    semesterNumber: number | null;
    internalMarks: number;
    semesterMarks: number;
    originalSemesterMarks: number | null;
    totalMarks: number;
    maxInternalMarks: number;
    maxSemesterMarks: number;
    maxTotalMarks: number;
    status: 'PASS' | 'MAKEUP_ELIGIBLE' | 'FAIL' | 'WITHHELD';
    hasRevaluation: boolean;
    publishedAt: string | null;
}

const statusConfig = {
    PASS: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100', label: 'PASS' },
    MAKEUP_ELIGIBLE: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', label: 'MAKEUP' },
    FAIL: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'FAIL' },
    WITHHELD: { icon: AlertTriangle, color: 'text-slate-600', bg: 'bg-slate-100', label: 'WITHHELD' },
};

export default function StudentResultsPage() {
    const { data: results = [], isLoading } = useQuery<ResultData[]>({
        queryKey: ['student-results'],
        queryFn: studentDashboardApi.getResults,
    });

    // Group results by semester
    const resultsBySemester = results.reduce((acc, result) => {
        const sem = result.semesterNumber || 1;
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(result);
        return acc;
    }, {} as Record<number, ResultData[]>);

    const semesters = Object.keys(resultsBySemester)
        .map(Number)
        .sort((a, b) => b - a);

    // Calculate stats
    const totalCredits = results.reduce((acc, r) => acc + r.credits, 0);
    const passedCredits = results
        .filter(r => r.status === 'PASS')
        .reduce((acc, r) => acc + r.credits, 0);
    const passCount = results.filter(r => r.status === 'PASS').length;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Results</h1>
                <p className="text-slate-500 mt-1">View your published examination results</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <p className="text-emerald-100 text-sm">Passed Courses</p>
                    <p className="text-3xl font-bold mt-1">{passCount} / {results.length}</p>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    <p className="text-indigo-100 text-sm">Credits Earned</p>
                    <p className="text-3xl font-bold mt-1">{passedCredits} / {totalCredits}</p>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <p className="text-amber-100 text-sm">Pass Percentage</p>
                    <p className="text-3xl font-bold mt-1">
                        {results.length > 0 ? Math.round((passCount / results.length) * 100) : 0}%
                    </p>
                </Card>
            </div>

            {/* Results by Semester */}
            {semesters.map(semester => (
                <div key={semester}>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                            S{semester}
                        </span>
                        Semester {semester}
                    </h2>

                    {/* Results Table */}
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Course</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Credits</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Internal</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Semester</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Total</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resultsBySemester[semester].map(result => {
                                        const config = statusConfig[result.status] || statusConfig.WITHHELD;
                                        const StatusIcon = config.icon;

                                        return (
                                            <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            <p className="font-semibold text-slate-800">{result.courseCode}</p>
                                                            <p className="text-sm text-slate-500 truncate max-w-[200px]">{result.courseName}</p>
                                                        </div>
                                                        {result.hasRevaluation && (
                                                            <Badge variant="outline" className="flex items-center gap-1">
                                                                <RefreshCw className="w-3 h-3" />
                                                                Reval
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">
                                                        {result.credits}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className="inline-flex items-center justify-center min-w-[60px] h-8 px-3 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-medium">
                                                        {result.internalMarks}/{result.maxInternalMarks}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="inline-flex items-center justify-center min-w-[60px] h-8 px-3 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium">
                                                            {result.semesterMarks}/{result.maxSemesterMarks}
                                                        </span>
                                                        {result.originalSemesterMarks !== null && (
                                                            <span className="text-xs text-slate-400 line-through">
                                                                Original: {result.originalSemesterMarks}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className={clsx(
                                                        'inline-flex items-center justify-center min-w-[70px] h-8 px-3 rounded-lg text-sm font-bold',
                                                        result.status === 'PASS'
                                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                                                            : 'bg-slate-200 text-slate-700'
                                                    )}>
                                                        {result.totalMarks}/{result.maxTotalMarks}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-4">
                                                    <span className={clsx(
                                                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                                                        config.bg, config.color
                                                    )}>
                                                        <StatusIcon className="w-4 h-4" />
                                                        {config.label}
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
            ))}

            {results.length === 0 && (
                <Card className="text-center py-12">
                    <Award className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-700">No Published Results</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Results will appear here once they are published by the COE.
                    </p>
                </Card>
            )}
        </div>
    );
}
