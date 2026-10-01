'use client';

import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { ClipboardList, Award, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

interface MarkEntry {
    courseCode: string;
    courseName: string;
    calculatedTotal: number;
    maxMarks: number;
    isFinalized: boolean;
    percentage: number;
}

interface StudentMarks {
    studentId: number;
    studentName: string;
    usn: string;
    marks: MarkEntry[];
}

export default function ParentMarksPage() {
    const { data: dashboard } = useQuery({
        queryKey: ['parent-dashboard'],
        queryFn: parentApi.getDashboard,
    });

    const students = dashboard?.students || [];
    const firstStudentId = students[0]?.id;

    const { data: marksData, isLoading } = useQuery<StudentMarks>({
        queryKey: ['parent-marks', firstStudentId],
        queryFn: () => parentApi.getStudentMarks(firstStudentId),
        enabled: !!firstStudentId,
    });

    if (isLoading || !marksData) {
        return (
            <div className="space-y-4">
                <div className="h-20 bg-slate-200 animate-pulse rounded-2xl"></div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-xl"></div>
                ))}
            </div>
        );
    }

    const marks = marksData.marks || [];
    const finalized = marks.filter(m => m.isFinalized);
    const avgPercentage = finalized.length > 0
        ? Math.round(finalized.reduce((acc, m) => acc + m.percentage, 0) / finalized.length)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="!p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
                    <div className="flex items-center gap-3 mb-2">
                        <ClipboardList className="w-6 h-6" />
                        <h2 className="text-xl font-bold">{marksData.studentName}&apos;s Marks</h2>
                    </div>
                    <p className="text-purple-100 text-sm">USN: {marksData.usn}</p>
                    <div className="mt-4 flex items-center gap-4">
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-2xl font-bold">{avgPercentage}%</p>
                            <p className="text-xs text-purple-100">Average</p>
                        </div>
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl">
                            <p className="text-2xl font-bold">{finalized.length}/{marks.length}</p>
                            <p className="text-xs text-purple-100">Finalized</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Marks List */}
            <div className="space-y-3">
                {marks.map((entry) => (
                    <Card key={entry.courseCode} className="hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-slate-800">{entry.courseName}</h4>
                                    {entry.isFinalized ? (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                                            Finalized
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                                            Pending
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">{entry.courseCode}</p>
                            </div>
                            <div className="text-right">
                                <div className="flex items-baseline gap-1">
                                    <span className={clsx(
                                        'text-2xl font-bold',
                                        entry.percentage >= 60 ? 'text-emerald-600' :
                                        entry.percentage >= 40 ? 'text-amber-600' : 'text-red-600'
                                    )}>
                                        {entry.calculatedTotal}
                                    </span>
                                    <span className="text-sm text-slate-400">/ {entry.maxMarks}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 justify-end">
                                    {entry.percentage >= 60 ? (
                                        <Award className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                        <TrendingUp className="w-4 h-4 text-amber-500" />
                                    )}
                                    <span className={clsx(
                                        'text-xs font-medium',
                                        entry.percentage >= 60 ? 'text-emerald-600' : 'text-amber-600'
                                    )}>
                                        {Math.round(entry.percentage)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
                            <div
                                className={clsx(
                                    'h-2 rounded-full transition-all duration-500',
                                    entry.percentage >= 60 ? 'bg-emerald-500' :
                                    entry.percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                )}
                                style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                            ></div>
                        </div>
                    </Card>
                ))}

                {marks.length === 0 && (
                    <Card className="text-center py-12">
                        <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-600 mb-2">No Marks Available</h3>
                        <p className="text-slate-400 text-sm">Internal marks will appear once they are uploaded by teachers.</p>
                    </Card>
                )}
            </div>
        </div>
    );
}
