'use client';

import { useQuery } from '@tanstack/react-query';
import {
    FileText,
    Search,
    Filter,
    Building2,
    GraduationCap,
    BookOpen,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

interface InternalMarksSubmission {
    id: number;
    studentUsn: string;
    marks: number;
    submittedAt: string;
    department: { id: number; name: string; code: string };
    batch: { id: number; name: string; currentSemester: number };
    course: { id: number; name: string; code: string };
    teacher: { name: string };
}

interface Department {
    id: number;
    name: string;
    code: string;
}

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
}

export default function InternalMarksPage() {
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [searchUsn, setSearchUsn] = useState('');

    // Fetch departments
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: async () => {
            const response = await api.get('/departments');
            return response.data;
        },
    });

    // Fetch batches
    const { data: batches = [] } = useQuery<Batch[]>({
        queryKey: ['batches'],
        queryFn: async () => {
            const response = await api.get('/batches');
            return response.data;
        },
    });

    // Fetch internal marks with filters — requires department selection
    const { data: submissions = [], isLoading } = useQuery<InternalMarksSubmission[]>({
        queryKey: ['coe-internal-marks', selectedDepartment, selectedBatch],
        queryFn: async () => {
            const params: any = {};
            if (selectedDepartment) params.departmentId = selectedDepartment;
            if (selectedBatch) params.batchId = selectedBatch;
            const response = await api.get('/coe/internal-marks', { params });
            return response.data;
        },
        enabled: !!selectedDepartment,
    });

    const filteredSubmissions = searchUsn
        ? submissions.filter((s) =>
            s.studentUsn.toLowerCase().includes(searchUsn.toLowerCase())
        )
        : submissions;

    // Group by course for summary
    const courseGroups = filteredSubmissions.reduce((acc, s) => {
        const key = `${s.course?.code || 'Unknown'}`;
        if (!acc[key]) {
            acc[key] = { course: s.course, count: 0, avgMarks: 0, totalMarks: 0 };
        }
        acc[key].count += 1;
        acc[key].totalMarks += s.marks;
        acc[key].avgMarks = Math.round(acc[key].totalMarks / acc[key].count * 10) / 10;
        return acc;
    }, {} as Record<string, { course: any; count: number; avgMarks: number; totalMarks: number }>);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Internal Marks</h1>
                <p className="text-neutral-500 mt-1">View internal assessment marks submitted by department admins</p>
            </div>

            {/* Filters - Step by step: Department → Batch */}
            <Card className="p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Step 1: Department */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Step 1: Branch
                        </label>
                        <select
                            className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[200px]"
                            value={selectedDepartment || ''}
                            onChange={(e) => {
                                setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null);
                                setSelectedBatch(null); // reset batch when department changes
                            }}
                        >
                            <option value="">Select Branch...</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Batch */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5" />
                            Step 2: Batch
                        </label>
                        <select
                            className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[200px] disabled:opacity-50"
                            value={selectedBatch || ''}
                            onChange={(e) => setSelectedBatch(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!selectedDepartment}
                        >
                            <option value="">{selectedDepartment ? 'All Batches' : 'Select Branch First'}</option>
                            {batches.map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                    {batch.name} (Sem {batch.currentSemester})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div className="flex flex-col gap-1.5 flex-1 max-w-xs">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Search className="h-3.5 w-3.5" />
                            Search USN
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search by USN..."
                                value={searchUsn}
                                onChange={(e) => setSearchUsn(e.target.value)}
                                className="pl-10"
                                disabled={!selectedDepartment}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Not Selected State */}
            {!selectedDepartment && (
                <Card className="text-center py-16">
                    <Building2 className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Select a Branch</h3>
                    <p className="text-neutral-500">Choose a department/branch to view submitted internal marks</p>
                </Card>
            )}

            {/* Loading */}
            {selectedDepartment && isLoading && (
                <Card className="flex items-center justify-center h-48">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                        <p className="text-sm text-neutral-500">Loading marks...</p>
                    </div>
                </Card>
            )}

            {/* Course Summary Cards */}
            {selectedDepartment && !isLoading && Object.keys(courseGroups).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.values(courseGroups).map((group) => (
                        <Card key={group.course?.code} className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-neutral-800 text-sm">{group.course?.code || 'N/A'}</p>
                                    <p className="text-xs text-neutral-500 truncate max-w-[120px]">{group.course?.name || ''}</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{group.count} students</Badge>
                                        <span className="text-xs text-amber-600 font-medium">avg: {group.avgMarks}/50</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Marks Table */}
            {selectedDepartment && !isLoading && filteredSubmissions.length === 0 && (
                <Card className="text-center py-12">
                    <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No internal marks found</h3>
                    <p className="text-neutral-500 mt-1">
                        {searchUsn
                            ? 'No matching records for the search query'
                            : 'No internal marks have been submitted for this selection'
                        }
                    </p>
                </Card>
            )}

            {selectedDepartment && !isLoading && filteredSubmissions.length > 0 && (
                <Card className="overflow-hidden">
                    <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                        <p className="text-sm font-medium text-neutral-600">
                            Showing {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-neutral-50">
                                <tr>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Department</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Batch</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Course</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">USN</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Marks</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Submitted By</th>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredSubmissions.map((submission) => (
                                    <tr key={submission.id} className="hover:bg-neutral-50">
                                        <td className="px-6 py-3">
                                            <Badge variant="outline">{submission.department?.code || 'N/A'}</Badge>
                                        </td>
                                        <td className="px-6 py-3 text-sm">
                                            {submission.batch?.name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="font-medium text-sm">{submission.course?.code || 'N/A'}</p>
                                            <p className="text-xs text-neutral-500">{submission.course?.name || ''}</p>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-sm">{submission.studentUsn}</td>
                                        <td className="px-6 py-3 text-center">
                                            <span className={`font-semibold ${submission.marks >= 25 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {submission.marks}/50
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{submission.teacher?.name || 'N/A'}</td>
                                        <td className="px-6 py-3 text-sm text-neutral-500">
                                            {submission.submittedAt ? formatDate(submission.submittedAt) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
