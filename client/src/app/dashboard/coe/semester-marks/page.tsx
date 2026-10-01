'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ClipboardCheck,
    Search,
    Upload,
    Building2,
    GraduationCap,
    BookOpen,
    FileSpreadsheet,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Eye,
    Send,
    ArrowLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api, { semesterMarksApi } from '@/lib/api';

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

interface UploadRecord {
    id: number;
    fileName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'POSTED';
    uploadedAt: string;
    batch: { name: string };
    department: { code: string; name: string };
    course: { code: string; name: string };
    uploader: { name: string };
    marks: any[];
    _count: { marks: number };
}

export default function COESemesterMarksPage() {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
    const [searchUsn, setSearchUsn] = useState('');
    const [viewingUploadId, setViewingUploadId] = useState<number | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

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

    // Fetch courses (all courses)
    const { data: courses = [] } = useQuery<Course[]>({
        queryKey: ['courses'],
        queryFn: async () => {
            const response = await api.get('/courses');
            return response.data;
        },
    });

    // Fetch pending uploads for review
    const { data: pendingUploads = [], isLoading: uploadsLoading } = useQuery<UploadRecord[]>({
        queryKey: ['pending-marks-uploads'],
        queryFn: () => semesterMarksApi.getPendingUploads(),
    });

    // Fetch upload details when viewing
    const { data: uploadDetails, isLoading: detailsLoading } = useQuery({
        queryKey: ['upload-details', viewingUploadId],
        queryFn: () => semesterMarksApi.getUploadById(viewingUploadId!),
        enabled: !!viewingUploadId,
    });

    // Upload mutation
    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!selectedBatch || !selectedDepartment || !selectedCourse) {
                throw new Error('Please select department, batch, and course');
            }
            const batch = batches.find(b => b.id === selectedBatch);
            return semesterMarksApi.uploadMarks(file, {
                batchId: selectedBatch,
                departmentId: selectedDepartment,
                semesterNumber: batch?.currentSemester || 1,
                courseId: selectedCourse,
            });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            toast.success(`Uploaded! ${data.validCount} valid entries, ${data.invalidCount} invalid.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || error.message || 'Upload failed');
        },
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: () => semesterMarksApi.approveUpload(viewingUploadId!, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            queryClient.invalidateQueries({ queryKey: ['upload-details', viewingUploadId] });
            toast.success('Marks approved!');
            setViewingUploadId(null);
            setReviewNotes('');
        },
        onError: () => toast.error('Failed to approve'),
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: () => semesterMarksApi.rejectUpload(viewingUploadId!, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            queryClient.invalidateQueries({ queryKey: ['upload-details', viewingUploadId] });
            toast.success('Marks rejected');
            setViewingUploadId(null);
            setReviewNotes('');
        },
        onError: () => toast.error('Failed to reject'),
    });

    // Post mutation
    const postMutation = useMutation({
        mutationFn: (id: number) => semesterMarksApi.postResults(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            toast.success('Results posted to students!');
        },
        onError: () => toast.error('Failed to post results'),
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadMutation.mutate(file);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800';
            case 'APPROVED': return 'bg-green-100 text-green-800';
            case 'REJECTED': return 'bg-red-100 text-red-800';
            case 'POSTED': return 'bg-blue-100 text-blue-800';
            default: return 'bg-neutral-100 text-neutral-800';
        }
    };

    // Upload Detail View
    if (viewingUploadId && uploadDetails) {
        return (
            <div className="space-y-6 animate-fade-in">
                <Button variant="outline" size="sm" onClick={() => { setViewingUploadId(null); setReviewNotes(''); }}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                </Button>

                <Card className="p-6">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-neutral-900 mb-1">{uploadDetails.fileName}</h2>
                            <div className="flex items-center gap-3 text-sm text-neutral-500">
                                <span>{uploadDetails.department?.code}</span>
                                <span>•</span>
                                <span>{uploadDetails.batch?.name}</span>
                                <span>•</span>
                                <span>{uploadDetails.course?.code} - {uploadDetails.course?.name}</span>
                            </div>
                        </div>
                        <Badge className={getStatusColor(uploadDetails.status)}>
                            {uploadDetails.status}
                        </Badge>
                    </div>

                    {/* Marks Table */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-neutral-800 mb-3">
                            Entries ({uploadDetails.marks?.length || 0})
                        </h3>
                        <div className="border rounded-lg overflow-hidden">
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-neutral-50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">USN</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Course</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">Marks</th>
                                            <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100">
                                        {(uploadDetails.marks || []).map((entry: any, idx: number) => (
                                            <tr key={entry.id} className="hover:bg-neutral-50">
                                                <td className="px-4 py-3 text-sm text-neutral-500">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-mono font-medium">{entry.studentUsn}</td>
                                                <td className="px-4 py-3 text-sm">{uploadDetails.course?.code || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    <span className={`font-semibold ${(entry.externalMarksRaw ?? entry.marks ?? 0) >= 35 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {entry.externalMarksRaw ?? entry.marks ?? '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Review Section */}
                    {uploadDetails.status === 'PENDING' && (
                        <div className="space-y-4 border-t pt-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Review Notes (optional for approval, required for rejection)
                                </label>
                                <textarea
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    rows={3}
                                    placeholder="Add notes about this upload..."
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => approveMutation.mutate()}
                                    disabled={approveMutation.isPending || rejectMutation.isPending}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" /> Approve
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!reviewNotes.trim()) {
                                            toast.error('Please provide rejection notes');
                                            return;
                                        }
                                        rejectMutation.mutate();
                                    }}
                                    disabled={approveMutation.isPending || rejectMutation.isPending}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <XCircle className="w-4 h-4 mr-2" /> Reject
                                </Button>
                            </div>
                        </div>
                    )}

                    {uploadDetails.status === 'APPROVED' && (
                        <div className="border-t pt-4">
                            <Button
                                onClick={() => postMutation.mutate(uploadDetails.id)}
                                disabled={postMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Send className="w-4 h-4 mr-2" /> Post Results to Students
                            </Button>
                        </div>
                    )}
                </Card>
            </div>
        );
    }

    // Loading detail view
    if (viewingUploadId && detailsLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <Button variant="outline" size="sm" onClick={() => setViewingUploadId(null)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Card className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Semester Marks</h1>
                <p className="text-neutral-500 mt-1">Upload, review and approve semester end marks</p>
            </div>

            {/* Upload Section */}
            <Card className="p-5 border-2 border-dashed border-amber-200 bg-amber-50/30">
                <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-amber-600" />
                    Upload Semester Results (Excel)
                </h3>
                <div className="flex flex-wrap gap-4 items-end">
                    {/* Step 1: Branch */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Step 1: Branch
                        </label>
                        <select
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[180px]"
                            value={selectedDepartment || ''}
                            onChange={(e) => {
                                setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null);
                                setSelectedBatch(null);
                                setSelectedCourse(null);
                            }}
                        >
                            <option value="">Select Branch...</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
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
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[180px] disabled:opacity-50"
                            value={selectedBatch || ''}
                            onChange={(e) => {
                                setSelectedBatch(e.target.value ? parseInt(e.target.value) : null);
                                setSelectedCourse(null);
                            }}
                            disabled={!selectedDepartment}
                        >
                            <option value="">{selectedDepartment ? 'Select Batch...' : 'Select Branch First'}</option>
                            {batches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name} (Sem {b.currentSemester})</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 3: Course */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            Step 3: Course
                        </label>
                        <select
                            className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-w-[200px] disabled:opacity-50"
                            value={selectedCourse || ''}
                            onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!selectedBatch}
                        >
                            <option value="">{selectedBatch ? 'Select Course...' : 'Select Batch First'}</option>
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 4: Upload */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            Step 4: Upload Excel
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileUpload}
                                disabled={!selectedCourse || uploadMutation.isPending}
                                className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 disabled:opacity-50"
                            />
                            {uploadMutation.isPending && (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload result info */}
                {uploadMutation.data && (
                    <div className="mt-4 p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3 text-sm">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            <span className="text-emerald-700 font-medium">{uploadMutation.data.validCount} valid entries</span>
                            {uploadMutation.data.invalidCount > 0 && (
                                <>
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    <span className="text-amber-700 font-medium">{uploadMutation.data.invalidCount} invalid/skipped</span>
                                </>
                            )}
                        </div>
                        {uploadMutation.data.errors?.length > 0 && (
                            <div className="mt-2 text-xs text-red-600">
                                {uploadMutation.data.errors.slice(0, 5).map((err: any, i: number) => (
                                    <p key={i}>• {typeof err === 'string' ? err : `${err.usn}: ${err.error}`}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Pending Uploads for Review */}
            <div>
                <h2 className="text-lg font-bold text-neutral-800 mb-4 flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-amber-600" />
                    Uploads for Review
                    {pendingUploads.length > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 ml-2">{pendingUploads.length}</Badge>
                    )}
                </h2>

                {uploadsLoading ? (
                    <Card className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
                    </Card>
                ) : pendingUploads.length === 0 ? (
                    <Card className="text-center py-12">
                        <ClipboardCheck className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-neutral-900">No pending uploads</h3>
                        <p className="text-neutral-500 mt-1">All semester marks have been reviewed</p>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {pendingUploads.map((upload) => (
                            <Card key={upload.id} className="p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
                                            <h3 className="font-semibold text-neutral-800">{upload.fileName}</h3>
                                            <Badge className={getStatusColor(upload.status)}>{upload.status}</Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-neutral-500">
                                            <span>{upload.department?.code}</span>
                                            <span>•</span>
                                            <span>{upload.batch?.name}</span>
                                            <span>•</span>
                                            <span>{upload.course?.code}</span>
                                            <span>•</span>
                                            <span>{upload._count?.marks || 0} entries</span>
                                            <span>•</span>
                                            <span>by {upload.uploader?.name}</span>
                                            <span>•</span>
                                            <span>{new Date(upload.uploadedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setViewingUploadId(upload.id)}
                                        >
                                            <Eye className="h-4 w-4 mr-1" /> Review
                                        </Button>
                                        {upload.status === 'APPROVED' && (
                                            <Button
                                                size="sm"
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                                onClick={() => postMutation.mutate(upload.id)}
                                                disabled={postMutation.isPending}
                                            >
                                                <Send className="h-4 w-4 mr-1" /> Post
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
