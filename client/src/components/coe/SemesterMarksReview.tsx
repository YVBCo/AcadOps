'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CheckCircle, XCircle, Eye, Edit, Send, AlertCircle, FileText, Calendar,
    User, BookOpen, GraduationCap, Hash
} from 'lucide-react';
import { semesterMarksApi } from '@/lib/api';

interface Upload {
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

export function SemesterMarksReview() {
    const [selectedUpload, setSelectedUpload] = useState<number | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const queryClient = useQueryClient();

    // Fetch pending uploads
    const { data: uploads, isLoading } = useQuery<Upload[]>({
        queryKey: ['pending-marks-uploads'],
        queryFn: () => semesterMarksApi.getPendingUploads(),
        refetchInterval: 30000, // Refresh every 30s
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
            semesterMarksApi.approveUpload(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            setSelectedUpload(null);
            setReviewNotes('');
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes: string }) =>
            semesterMarksApi.rejectUpload(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            setSelectedUpload(null);
            setReviewNotes('');
        },
    });

    // Post mutation
    const postMutation = useMutation({
        mutationFn: (id: number) => semesterMarksApi.postResults(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
        },
    });

    const handleApprove = (id: number) => {
        approveMutation.mutate({ id, notes: reviewNotes });
    };

    const handleReject = (id: number) => {
        if (!reviewNotes.trim()) {
            alert('Please provide rejection notes');
            return;
        }
        rejectMutation.mutate({ id, notes: reviewNotes });
    };

    const handlePost = (id: number) => {
        if (confirm('Are you sure you want to post these results? Students will be able to view them.')) {
            postMutation.mutate(id);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING':
                return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
            case 'APPROVED':
                return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
            case 'REJECTED':
                return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
            case 'POSTED':
                return <Badge className="bg-blue-100 text-blue-800">Posted</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading pending uploads...</p>
            </div>
        );
    }

    if (!uploads || uploads.length === 0) {
        return (
            <Card className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Pending Uploads</h3>
                <p className="text-slate-500">
                    There are no semester marks uploads pending your review at this time.
                </p>
            </Card>
        );
    }

    if (selectedUpload) {
        return (
            <UploadDetails
                uploadId={selectedUpload}
                onBack={() => {
                    setSelectedUpload(null);
                    setReviewNotes('');
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Semester Marks Review</h2>
                <div className="text-sm text-slate-500">
                    {uploads.length} upload{uploads.length !== 1 ? 's' : ''} pending
                </div>
            </div>

            {uploads.map((upload) => (
                <Card key={upload.id} className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-4">
                                <FileText className="w-6 h-6 text-amber-600" />
                                <div>
                                    <h3 className="font-semibold text-slate-800">{upload.fileName}</h3>
                                    <p className="text-sm text-slate-500">
                                        Uploaded {new Date(upload.uploadedAt).toLocaleString()}
                                    </p>
                                </div>
                                {getStatusBadge(upload.status)}
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <GraduationCap className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-slate-500">Batch</div>
                                        <div className="font-medium text-slate-800">{upload.batch.name}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <BookOpen className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-slate-500">Department</div>
                                        <div className="font-medium text-slate-800">{upload.department.code}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-slate-500">Course</div>
                                        <div className="font-medium text-slate-800">{upload.course.code}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Hash className="w-4 h-4 text-slate-400" />
                                    <div>
                                        <div className="text-slate-500">Entries</div>
                                        <div className="font-medium text-slate-800">{upload._count.marks}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <User className="w-4 h-4" />
                                Uploaded by: {upload.uploader.name}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 ml-4">
                            <Button
                                onClick={() => setSelectedUpload(upload.id)}
                                variant="outline"
                                size="sm"
                                className="whitespace-nowrap"
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                Review
                            </Button>

                            {upload.status === 'APPROVED' && (
                                <Button
                                    onClick={() => handlePost(upload.id)}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                                    disabled={postMutation.isPending}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Post Results
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

// Upload Details Component
function UploadDetails({ uploadId, onBack }: { uploadId: number; onBack: () => void }) {
    const [reviewNotes, setReviewNotes] = useState('');
    const [editingEntry, setEditingEntry] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const queryClient = useQueryClient();

    const { data: upload, isLoading } = useQuery({
        queryKey: ['upload-details', uploadId],
        queryFn: () => semesterMarksApi.getUploadById(uploadId),
    });

    const approveMutation = useMutation({
        mutationFn: () => semesterMarksApi.approveUpload(uploadId, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            queryClient.invalidateQueries({ queryKey: ['upload-details', uploadId] });
            onBack();
        },
    });

    const rejectMutation = useMutation({
        mutationFn: () => semesterMarksApi.rejectUpload(uploadId, reviewNotes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-marks-uploads'] });
            queryClient.invalidateQueries({ queryKey: ['upload-details', uploadId] });
            onBack();
        },
    });

    const editMutation = useMutation({
        mutationFn: ({ entryId, marks }: { entryId: number; marks: number }) =>
            semesterMarksApi.editMarksEntry(entryId, marks),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['upload-details', uploadId] });
            setEditingEntry(null);
            setEditValue('');
        },
    });

    const handleEdit = (entryId: number, currentMarks: number) => {
        setEditingEntry(entryId);
        setEditValue(currentMarks.toString());
    };

    const handleSaveEdit = (entryId: number) => {
        const marks = parseFloat(editValue);
        if (isNaN(marks) || marks < 0 || marks > 100) {
            alert('Please enter valid marks between 0 and 100');
            return;
        }
        editMutation.mutate({ entryId, marks });
    };

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600">Loading upload details...</p>
            </div>
        );
    }

    if (!upload) {
        return <div>Upload not found</div>;
    }

    return (
        <div className="space-y-6">
            <Button onClick={onBack} variant="outline" size="sm">
                ← Back to List
            </Button>

            <Card className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{upload.fileName}</h2>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>Batch {upload.batch.name}</span>
                            <span>•</span>
                            <span>{upload.department.code}</span>
                            <span>•</span>
                            <span>{upload.course.code}</span>
                        </div>
                    </div>
                    <Badge className={
                        upload.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            upload.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                upload.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                    'bg-blue-100 text-blue-800'
                    }>
                        {upload.status}
                    </Badge>
                </div>

                {/* Marks Table */}
                <div className="mb-6">
                    <h3 className="font-semibold text-slate-800 mb-3">Uploaded Marks ({upload.marks.length})</h3>
                    <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">#</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">USN</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Marks (/100)</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">Converted (/50)</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {upload.marks.map((entry: any, idx: number) => (
                                        <tr key={entry.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-600">{idx + 1}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-slate-800">{entry.studentUsn}</td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                {editingEntry === entry.id ? (
                                                    <input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="w-20 px-2 py-1 border rounded text-right"
                                                        min="0"
                                                        max="100"
                                                        step="0.5"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-slate-800">{entry.externalMarksRaw}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600">
                                                {entry.externalMarks}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {upload.status === 'PENDING' && (
                                                    editingEntry === entry.id ? (
                                                        <div className="flex justify-center gap-2">
                                                            <button
                                                                onClick={() => handleSaveEdit(entry.id)}
                                                                className="text-green-600 hover:text-green-700 text-sm"
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingEntry(null)}
                                                                className="text-slate-600 hover:text-slate-700 text-sm"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEdit(entry.id, entry.externalMarksRaw)}
                                                            className="text-amber-600 hover:text-amber-700"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Review Section */}
                {upload.status === 'PENDING' && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Review Notes (optional for approval, required for rejection)
                            </label>
                            <textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                rows={3}
                                placeholder="Add any notes about this upload..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => approveMutation.mutate()}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                            </Button>
                            <Button
                                onClick={() => {
                                    if (!reviewNotes.trim()) {
                                        alert('Please provide rejection notes');
                                        return;
                                    }
                                    rejectMutation.mutate();
                                }}
                                disabled={approveMutation.isPending || rejectMutation.isPending}
                                variant="danger"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
