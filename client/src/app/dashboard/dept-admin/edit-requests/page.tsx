'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
    FileEdit,
    User,
    Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EditRequest {
    id: number;
    type: 'MARKS' | 'ATTENDANCE';
    entityType: string;
    entityId: number;
    oldValue: any;
    newValue: any;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    requester: { name: string; email: string };
    reviewer: { name: string } | null;
}

// Dept Admin API for edit requests
const deptAdminApi = {
    getEditRequests: async (status?: string) => {
        const response = await api.get('/dept-admin/edit-requests', { params: { status } });
        return response.data;
    },
    approveRequest: async (id: number, reviewNote?: string) => {
        const response = await api.post(`/dept-admin/edit-requests/${id}/approve`, { reviewNote });
        return response.data;
    },
    rejectRequest: async (id: number, reviewNote: string) => {
        const response = await api.post(`/dept-admin/edit-requests/${id}/reject`, { reviewNote });
        return response.data;
    },
};

export default function EditRequestsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');
    const [selectedRequest, setSelectedRequest] = useState<EditRequest | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const { data: requests = [], isLoading, refetch } = useQuery({
        queryKey: ['edit-requests', statusFilter],
        queryFn: () => deptAdminApi.getEditRequests(statusFilter),
    });

    const approveMutation = useMutation({
        mutationFn: (id: number) => deptAdminApi.approveRequest(id, reviewNote),
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Edit request approved and changes applied!' });
            setSelectedRequest(null);
            setReviewNote('');
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
            refetch();
            setTimeout(() => setMessage(null), 3000);
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to approve request' });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: (id: number) => deptAdminApi.rejectRequest(id, reviewNote),
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Edit request rejected.' });
            setSelectedRequest(null);
            setReviewNote('');
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
            refetch();
            setTimeout(() => setMessage(null), 3000);
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to reject request' });
        }
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderValueChange = (oldVal: any, newVal: any, type: string) => {
        if (type === 'MARKS') {
            return (
                <div className="text-sm space-y-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-neutral-400 text-xs">Current Values</p>
                            <p>IA1: {oldVal.internal1 ?? '-'} | IA2: {oldVal.internal2 ?? '-'} | IA3: {oldVal.internal3 ?? '-'}</p>
                            <p>Assignment: {oldVal.assignmentMarks ?? '-'}</p>
                        </div>
                        <div>
                            <p className="text-neutral-400 text-xs">Requested Values</p>
                            <p>IA1: {newVal.internal1 ?? '-'} | IA2: {newVal.internal2 ?? '-'} | IA3: {newVal.internal3 ?? '-'}</p>
                            <p>Assignment: {newVal.assignmentMarks ?? '-'}</p>
                        </div>
                    </div>
                </div>
            );
        } else {
            return (
                <div className="text-sm">
                    <span className="text-neutral-500">{oldVal.status}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{newVal.status}</span>
                </div>
            );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Edit Requests</h1>
                    <p className="text-neutral-500 mt-1">Review and approve teacher edit requests for locked data</p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    {message.text}
                </div>
            )}

            {/* Status Filter */}
            <div className="flex gap-2">
                {['PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                    <Button
                        key={status}
                        variant={statusFilter === status ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                    >
                        {status === 'PENDING' && <Clock className="h-4 w-4 mr-1" />}
                        {status === 'APPROVED' && <CheckCircle className="h-4 w-4 mr-1" />}
                        {status === 'REJECTED' && <XCircle className="h-4 w-4 mr-1" />}
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                    </Button>
                ))}
            </div>

            {/* Requests List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                </div>
            ) : (requests as EditRequest[]).length === 0 ? (
                <Card className="text-center py-12">
                    <FileEdit className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No {statusFilter.toLowerCase()} requests</h3>
                    <p className="text-neutral-500">
                        {statusFilter === 'PENDING'
                            ? 'All edit requests have been processed'
                            : `No ${statusFilter.toLowerCase()} requests found`}
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {(requests as EditRequest[]).map((request) => (
                        <Card key={request.id} className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge className={
                                            request.type === 'MARKS'
                                                ? 'bg-blue-100 text-blue-700 border-0'
                                                : 'bg-purple-100 text-purple-700 border-0'
                                        }>
                                            {request.type}
                                        </Badge>
                                        <Badge className={
                                            request.status === 'PENDING'
                                                ? 'bg-amber-100 text-amber-700 border-0'
                                                : request.status === 'APPROVED'
                                                    ? 'bg-emerald-100 text-emerald-700 border-0'
                                                    : 'bg-red-100 text-red-700 border-0'
                                        }>
                                            {request.status}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-neutral-500 mb-3">
                                        <span className="flex items-center gap-1">
                                            <User className="h-4 w-4" />
                                            {request.requester.name}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            {formatDate(request.createdAt)}
                                        </span>
                                    </div>

                                    <div className="mb-3 p-3 bg-neutral-50 rounded-lg">
                                        {renderValueChange(request.oldValue, request.newValue, request.type)}
                                    </div>

                                    <div className="mb-3">
                                        <p className="text-sm text-neutral-500">Reason:</p>
                                        <p className="text-sm text-neutral-700">{request.reason || 'No reason provided'}</p>
                                    </div>

                                    {request.reviewNote && (
                                        <div className="mb-3 p-2 bg-neutral-100 rounded">
                                            <p className="text-xs text-neutral-500">Review Note:</p>
                                            <p className="text-sm">{request.reviewNote}</p>
                                        </div>
                                    )}
                                </div>

                                {request.status === 'PENDING' && (
                                    <div className="flex flex-col gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => setSelectedRequest(request)}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Review
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg p-6 bg-white">
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Review Edit Request</h3>

                        <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                            <p className="text-sm text-neutral-500">Requested by</p>
                            <p className="font-medium">{selectedRequest.requester.name}</p>
                            <p className="text-sm text-neutral-500">{selectedRequest.requester.email}</p>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-medium text-neutral-700 mb-2">Changes</p>
                            <div className="p-3 bg-neutral-50 rounded-lg">
                                {renderValueChange(selectedRequest.oldValue, selectedRequest.newValue, selectedRequest.type)}
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-medium text-neutral-700 mb-1">Teacher&apos;s Reason</p>
                            <p className="text-sm text-neutral-600 p-2 bg-amber-50 rounded">{selectedRequest.reason}</p>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-medium text-neutral-700 mb-2 block">
                                Review Note {rejectMutation.isPending || approveMutation.isPending ? '' : '(required for rejection)'}
                            </label>
                            <textarea
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                rows={2}
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                placeholder="Add a note..."
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedRequest(null);
                                    setReviewNote('');
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                                onClick={() => rejectMutation.mutate(selectedRequest.id)}
                                disabled={!reviewNote.trim() || rejectMutation.isPending}
                            >
                                {rejectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <XCircle className="h-4 w-4 mr-1" />
                                )}
                                Reject
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => approveMutation.mutate(selectedRequest.id)}
                                disabled={approveMutation.isPending}
                            >
                                {approveMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                )}
                                Approve
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
