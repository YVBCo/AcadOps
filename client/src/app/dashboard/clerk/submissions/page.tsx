'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileText,
    Clock,
    CheckCircle,
    XCircle,
    Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { clerkMarksApi } from '@/lib/api';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'LOCKED';
type TabView = 'semester' | 'revaluation';

interface SemesterMarksSubmission {
    id: number;
    studentUsn: string;
    marks: number;
    status: string;
    enteredAt: string;
    department: { name: string; code: string };
    batch: { name: string };
    course: { name: string; code: string };
}

interface RevaluationSubmission {
    id: number;
    oldMarks: number;
    newMarks: number;
    status: string;
    enteredAt: string;
    result: {
        studentUsn: string;
        department: { name: string; code: string };
        batch: { name: string };
        course: { name: string; code: string };
    };
}

export default function SubmissionsPage() {
    const [tab, setTab] = useState<TabView>('semester');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

    // Fetch semester marks submissions
    const { data: semesterMarks = [], isLoading: loadingSemester } = useQuery({
        queryKey: ['clerk-semester-marks', statusFilter],
        queryFn: () => clerkMarksApi.getSemesterMarks(statusFilter !== 'ALL' ? { status: statusFilter } : undefined),
        enabled: tab === 'semester',
    });

    // Fetch revaluations
    const { data: revaluations = [], isLoading: loadingRevaluations } = useQuery({
        queryKey: ['clerk-revaluations', statusFilter],
        queryFn: () => clerkMarksApi.getRevaluations(statusFilter !== 'ALL' ? statusFilter : undefined),
        enabled: tab === 'revaluation',
    });

    const getStatusBadge = (status: string) => {
        const config: Record<string, { variant: 'warning' | 'success' | 'neutral'; icon: typeof Clock }> = {
            PENDING: { variant: 'warning', icon: Clock },
            APPROVED: { variant: 'success', icon: CheckCircle },
            LOCKED: { variant: 'neutral', icon: XCircle },
        };
        const { variant, icon: Icon } = config[status] || { variant: 'neutral', icon: Clock };
        return (
            <Badge variant={variant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {status}
            </Badge>
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isLoading = tab === 'semester' ? loadingSemester : loadingRevaluations;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">My Submissions</h1>
                <p className="text-neutral-500 mt-1">Track the status of your marks entries</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl w-fit">
                <button
                    onClick={() => setTab('semester')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === 'semester'
                            ? 'bg-white shadow-sm text-neutral-900'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                >
                    Semester Marks
                </button>
                <button
                    onClick={() => setTab('revaluation')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === 'revaluation'
                            ? 'bg-white shadow-sm text-neutral-900'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                >
                    Revaluations
                </button>
            </div>

            {/* Filter */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <Filter className="h-5 w-5 text-neutral-400" />
                    <div className="flex gap-2">
                        {(['ALL', 'PENDING', 'APPROVED', 'LOCKED'] as StatusFilter[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${statusFilter === status
                                        ? 'bg-teal-100 text-teal-700'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <Card className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
                </Card>
            ) : tab === 'semester' ? (
                semesterMarks.length === 0 ? (
                    <Card className="text-center py-12">
                        <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-neutral-900">No semester marks submissions</h3>
                        <p className="text-neutral-500 mt-1">
                            {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} submissions found` : 'You have not submitted any semester marks yet'}
                        </p>
                    </Card>
                ) : (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-neutral-50">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Course</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">USN</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Marks</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Status</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Submitted At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {semesterMarks.map((submission: SemesterMarksSubmission) => (
                                        <tr key={submission.id} className="hover:bg-neutral-50">
                                            <td className="px-6 py-3">
                                                <div>
                                                    <p className="font-medium">{submission.course.code}</p>
                                                    <p className="text-sm text-neutral-500">{submission.department.code} - {submission.batch.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 font-mono text-sm">{submission.studentUsn}</td>
                                            <td className="px-6 py-3 text-center font-semibold">{submission.marks}/50</td>
                                            <td className="px-6 py-3 text-center">{getStatusBadge(submission.status)}</td>
                                            <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(submission.enteredAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )
            ) : (
                revaluations.length === 0 ? (
                    <Card className="text-center py-12">
                        <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-neutral-900">No revaluation submissions</h3>
                        <p className="text-neutral-500 mt-1">
                            {statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} revaluations found` : 'You have not submitted any revaluations yet'}
                        </p>
                    </Card>
                ) : (
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-neutral-50">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Course</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">USN</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Old Marks</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">New Marks</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Status</th>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Submitted At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {revaluations.map((reval: RevaluationSubmission) => (
                                        <tr key={reval.id} className="hover:bg-neutral-50">
                                            <td className="px-6 py-3">
                                                <div>
                                                    <p className="font-medium">{reval.result.course.code}</p>
                                                    <p className="text-sm text-neutral-500">{reval.result.department.code} - {reval.result.batch.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 font-mono text-sm">{reval.result.studentUsn}</td>
                                            <td className="px-6 py-3 text-center">{reval.oldMarks}/50</td>
                                            <td className="px-6 py-3 text-center font-semibold text-purple-600">{reval.newMarks}/50</td>
                                            <td className="px-6 py-3 text-center">{getStatusBadge(reval.status)}</td>
                                            <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(reval.enteredAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )
            )}
        </div>
    );
}
