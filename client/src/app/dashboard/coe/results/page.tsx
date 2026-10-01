'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    FileText,
    Search,
    Filter,
    CheckCircle,
    Send,
    Building2,
    GraduationCap,
    BookOpen,
    Zap,
    AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Result {
    id: number;
    studentUsn: string;
    internalMarks: number;
    semesterMarks: number;
    totalMarks: number;
    status: string;
    isPublished: boolean;
    department: { id: number; name: string; code: string };
    batch: { id: number; name: string; currentSemester: number };
    course: { id: number; name: string; code: string };
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

interface Course {
    id: number;
    name: string;
    code: string;
}

type StatusFilter = 'ALL' | 'PASS' | 'FAIL' | 'MAKEUP_ELIGIBLE';

export default function ResultsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [publishFilter, setPublishFilter] = useState<'ALL' | 'PUBLISHED' | 'UNPUBLISHED'>('ALL');
    const [searchUsn, setSearchUsn] = useState('');

    // For Generate Results
    const [genDept, setGenDept] = useState<number | null>(null);
    const [genBatch, setGenBatch] = useState<number | null>(null);
    const [genCourse, setGenCourse] = useState<number | null>(null);

    // Fetch departments
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: async () => (await api.get('/departments')).data,
    });

    // Fetch batches
    const { data: batches = [] } = useQuery<Batch[]>({
        queryKey: ['batches'],
        queryFn: async () => (await api.get('/batches')).data,
    });

    // Fetch courses
    const { data: courses = [] } = useQuery<Course[]>({
        queryKey: ['courses'],
        queryFn: async () => (await api.get('/courses')).data,
    });

    // Fetch results
    const { data: results = [], isLoading } = useQuery<Result[]>({
        queryKey: ['coe-results', statusFilter, publishFilter],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (publishFilter !== 'ALL') params.isPublished = publishFilter === 'PUBLISHED' ? 'true' : 'false';
            const response = await api.get('/results', { params });
            return response.data;
        },
    });

    // Generate results mutation
    const generateMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/results/generate', {
                departmentId: genDept,
                batchId: genBatch,
                courseId: genCourse,
            });
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['coe-results'] });
            let msg = `Generated ${data.generated} results.`;
            if (data.skipped > 0) msg += ` ${data.skipped} skipped.`;
            if (data.missingInternal?.length > 0) msg += ` Missing internal marks: ${data.missingInternal.join(', ')}`;
            if (data.missingSemester?.length > 0) msg += ` Missing semester marks: ${data.missingSemester.join(', ')}`;
            toast.success(msg, { duration: 8000 });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to generate results');
        },
    });

    // Publish mutation
    const publishMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.put(`/results/${id}/publish`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coe-results'] });
            toast.success('Result published successfully');
        },
        onError: () => toast.error('Failed to publish result'),
    });

    // Bulk publish mutation
    const bulkPublishMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/results/publish-batch', {});
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['coe-results'] });
            toast.success(`Published ${data.count} results`);
        },
        onError: () => toast.error('Failed to bulk publish'),
    });

    const filteredResults = searchUsn
        ? results.filter((r) => r.studentUsn.toLowerCase().includes(searchUsn.toLowerCase()))
        : results;

    const getStatusBadge = (status: string) => {
        const config: Record<string, { className: string; label: string }> = {
            PASS: { className: 'bg-emerald-100 text-emerald-700', label: 'Pass' },
            FAIL: { className: 'bg-red-100 text-red-700', label: 'Fail' },
            MAKEUP_ELIGIBLE: { className: 'bg-amber-100 text-amber-700', label: 'Makeup' },
        };
        const { className, label } = config[status] || { className: 'bg-neutral-100', label: status };
        return <Badge className={className}>{label}</Badge>;
    };

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const publishedCount = results.filter(r => r.isPublished).length;
    const unpublishedCount = results.filter(r => !r.isPublished).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Results Management</h1>
                <p className="text-neutral-500 mt-1">Generate, review and publish student results</p>
            </div>

            {/* Generate Results Section */}
            <Card className="p-5 border-2 border-dashed border-amber-200 bg-amber-50/30">
                <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-600" />
                    Generate Results (Internal + Semester Marks)
                </h3>
                <p className="text-sm text-neutral-500 mb-4">
                    Combines internal marks (from department admins) and semester marks (from Excel uploads) to generate final results.
                </p>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" /> Branch
                        </label>
                        <select
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 min-w-[180px]"
                            value={genDept || ''}
                            onChange={(e) => { setGenDept(e.target.value ? parseInt(e.target.value) : null); setGenBatch(null); setGenCourse(null); }}
                        >
                            <option value="">Select Branch...</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5" /> Batch
                        </label>
                        <select
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 min-w-[180px] disabled:opacity-50"
                            value={genBatch || ''}
                            onChange={(e) => { setGenBatch(e.target.value ? parseInt(e.target.value) : null); setGenCourse(null); }}
                            disabled={!genDept}
                        >
                            <option value="">{genDept ? 'Select Batch...' : 'Select Branch First'}</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name} (Sem {b.currentSemester})</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" /> Course
                        </label>
                        <select
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 min-w-[200px] disabled:opacity-50"
                            value={genCourse || ''}
                            onChange={(e) => setGenCourse(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!genBatch}
                        >
                            <option value="">{genBatch ? 'Select Course...' : 'Select Batch First'}</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                        </select>
                    </div>
                    <Button
                        onClick={() => generateMutation.mutate()}
                        disabled={!genDept || !genBatch || !genCourse || generateMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {generateMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                            <Zap className="h-4 w-4 mr-2" />
                        )}
                        Generate Results
                    </Button>
                </div>

                {/* Generation warnings */}
                {generateMutation.data && (generateMutation.data.missingInternal?.length > 0 || generateMutation.data.missingSemester?.length > 0) && (
                    <div className="mt-4 space-y-2">
                        {generateMutation.data.missingInternal?.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-medium text-amber-800">Missing Internal Marks ({generateMutation.data.missingInternal.length} USNs)</p>
                                        <p className="text-amber-600 mt-1 font-mono text-xs">{generateMutation.data.missingInternal.join(', ')}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {generateMutation.data.missingSemester?.length > 0 && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <p className="font-medium text-red-800">Missing Semester Marks ({generateMutation.data.missingSemester.length} USNs)</p>
                                        <p className="text-red-600 mt-1 font-mono text-xs">{generateMutation.data.missingSemester.join(', ')}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{results.length}</p>
                    <p className="text-sm text-neutral-500">Total Results</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{passCount}</p>
                    <p className="text-sm text-neutral-500">Passed</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{failCount}</p>
                    <p className="text-sm text-neutral-500">Failed</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{publishedCount}</p>
                    <p className="text-sm text-neutral-500">Published</p>
                </Card>
                <Card className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{unpublishedCount}</p>
                    <p className="text-sm text-neutral-500">Unpublished</p>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-neutral-400" />
                        <div className="flex gap-2">
                            {(['ALL', 'PASS', 'FAIL', 'MAKEUP_ELIGIBLE'] as StatusFilter[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${statusFilter === status
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                >
                                    {status === 'MAKEUP_ELIGIBLE' ? 'Makeup' : status}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {(['ALL', 'PUBLISHED', 'UNPUBLISHED'] as const).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setPublishFilter(filter)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${publishFilter === filter
                                    ? 'bg-teal-100 text-teal-700'
                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 max-w-sm">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search by USN..."
                                value={searchUsn}
                                onChange={(e) => setSearchUsn(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    {unpublishedCount > 0 && (
                        <Button
                            onClick={() => {
                                if (confirm(`Publish all ${unpublishedCount} unpublished results?`)) {
                                    bulkPublishMutation.mutate();
                                }
                            }}
                            disabled={bulkPublishMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                        >
                            <Send className="h-4 w-4 mr-1" /> Publish All ({unpublishedCount})
                        </Button>
                    )}
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <Card className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                </Card>
            ) : filteredResults.length === 0 ? (
                <Card className="text-center py-12">
                    <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No results found</h3>
                    <p className="text-neutral-500 mt-1">
                        Generate results using the panel above by selecting branch, batch, and course
                    </p>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                        <p className="text-sm font-medium text-neutral-600">
                            Showing {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
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
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Internal</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Semester</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Total</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Status</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Published</th>
                                    <th className="text-center px-6 py-3 text-xs font-semibold text-neutral-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredResults.map((result) => (
                                    <tr key={result.id} className="hover:bg-neutral-50">
                                        <td className="px-6 py-3">
                                            <Badge variant="outline">{result.department?.code || 'N/A'}</Badge>
                                        </td>
                                        <td className="px-6 py-3 text-sm">{result.batch?.name || 'N/A'}</td>
                                        <td className="px-6 py-3">
                                            <p className="font-medium text-sm">{result.course?.code || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-sm">{result.studentUsn}</td>
                                        <td className="px-6 py-3 text-center text-sm">{result.internalMarks}/50</td>
                                        <td className="px-6 py-3 text-center text-sm">{result.semesterMarks}/50</td>
                                        <td className="px-6 py-3 text-center">
                                            <span className={`font-bold ${result.totalMarks >= 40 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {result.totalMarks}/100
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-center">{getStatusBadge(result.status)}</td>
                                        <td className="px-6 py-3 text-center">
                                            {result.isPublished ? (
                                                <Badge className="bg-blue-100 text-blue-700">Published</Badge>
                                            ) : (
                                                <Badge className="bg-neutral-100 text-neutral-500">Draft</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {!result.isPublished ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-blue-600 hover:bg-blue-50"
                                                    onClick={() => publishMutation.mutate(result.id)}
                                                    disabled={publishMutation.isPending}
                                                >
                                                    <Send className="h-4 w-4 mr-1" /> Publish
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-neutral-400">-</span>
                                            )}
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
