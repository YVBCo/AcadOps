'use client';

import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface InternalMarkData {
    courseId: number;
    courseCode: string;
    courseName: string;
    credits: number;
    semesterNumber: number | null;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
    bestOfN: number[];
    internalsConsidered: number;
    calculatedTotal: number | null;
    maxMarks: number;
    isFinalized: boolean;
}

export default function StudentInternalMarksPage() {
    const { data: marks = [], isLoading } = useQuery<InternalMarkData[]>({
        queryKey: ['student-internal-marks'],
        queryFn: studentDashboardApi.getInternalMarks,
    });

    // Group marks by semester
    const marksBySemester = marks.reduce((acc, mark) => {
        const sem = mark.semesterNumber || 1;
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(mark);
        return acc;
    }, {} as Record<number, InternalMarkData[]>);

    const semesters = Object.keys(marksBySemester)
        .map(Number)
        .sort((a, b) => b - a);

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Internal Marks</h1>
                    <p className="text-slate-500 mt-1">View your internal assessment marks (finalized only)</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full">
                        <CheckCircle className="w-4 h-4" />
                        Finalized
                    </span>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-medium">Important</p>
                    <p className="text-sm mt-0.5">
                        Only finalized marks are displayed. Marks become visible after teacher submission and department admin finalization.
                    </p>
                </div>
            </div>

            {/* Marks by Semester */}
            {semesters.map(semester => (
                <div key={semester}>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">
                            S{semester}
                        </span>
                        Semester {semester}
                    </h2>

                    {/* Marks Table */}
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Course</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Int. 1</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Int. 2</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Int. 3</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Assignment</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Best {marksBySemester[semester][0]?.internalsConsidered || 2}</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Total</th>
                                        <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {marksBySemester[semester].map(mark => (
                                        <tr key={mark.courseId} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div>
                                                    <p className="font-semibold text-slate-800">{mark.courseCode}</p>
                                                    <p className="text-sm text-slate-500 truncate max-w-[200px]">{mark.courseName}</p>
                                                </div>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-medium ${mark.internal1 !== null
                                                    ? 'bg-slate-100 text-slate-700'
                                                    : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {mark.internal1 ?? '-'}
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-medium ${mark.internal2 !== null
                                                    ? 'bg-slate-100 text-slate-700'
                                                    : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {mark.internal2 ?? '-'}
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-medium ${mark.internal3 !== null
                                                    ? 'bg-slate-100 text-slate-700'
                                                    : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {mark.internal3 ?? '-'}
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg text-sm font-medium ${mark.assignmentMarks !== null
                                                    ? 'bg-indigo-100 text-indigo-700'
                                                    : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                    {mark.assignmentMarks ?? '-'}
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <div className="flex items-center justify-center gap-1">
                                                    {mark.bestOfN.map((val, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="inline-flex items-center justify-center w-10 h-8 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700"
                                                        >
                                                            {val}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <span className="inline-flex items-center justify-center min-w-[70px] h-8 px-3 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm">
                                                    {mark.calculatedTotal !== null ? `${mark.calculatedTotal}/${mark.maxMarks}` : '-'}
                                                </span>
                                            </td>
                                            <td className="text-center px-4 py-4">
                                                <Badge variant={mark.isFinalized ? 'success' : 'neutral'}>
                                                    {mark.isFinalized ? 'Finalized' : 'Pending'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            ))}

            {marks.length === 0 && (
                <Card className="text-center py-12">
                    <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-700">No Finalized Marks Yet</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Internal marks will appear here once they are finalized by your department.
                    </p>
                </Card>
            )}
        </div>
    );
}
