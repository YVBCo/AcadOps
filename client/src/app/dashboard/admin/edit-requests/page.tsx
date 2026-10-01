'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { editRequestApi } from '@/lib/api';
import { Card, StatCard } from '@/components/ui/card';
import {
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    User,
    FileText,
    Calendar,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Filter
} from 'lucide-react';

interface EditRequest {
    id: number;
    type: 'ATTENDANCE' | 'MARKS';
    requesterId: number;
    subjectId: number;
    entityType: string;
    entityId: number;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    reason?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reviewerId?: number;
    reviewNote?: string;
    createdAt: string;
    reviewedAt?: string;
    requester?: {
        id: number;
        name: string;
        email: string;
    };
    reviewer?: {
        id: number;
        name: string;
    };
}

export default function EditRequestsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [actioningId, setActioningId] = useState<number | null>(null);

    // Fetch edit requests
    const { data, isLoading, error } = useQuery({
        queryKey: ['edit-requests', statusFilter, typeFilter],
        queryFn: () => editRequestApi.getAll({
            status: statusFilter || undefined,
            type: typeFilter || undefined
        }),
    });

    // Fetch pending count
    const { data: pendingCount } = useQuery({
        queryKey: ['edit-requests-pending-count'],
        queryFn: () => editRequestApi.getPendingCount(),
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note?: string }) =>
            editRequestApi.approve(id, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
            queryClient.invalidateQueries({ queryKey: ['edit-requests-pending-count'] });
            setActioningId(null);
            setReviewNote('');
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note?: string }) =>
            editRequestApi.reject(id, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
            queryClient.invalidateQueries({ queryKey: ['edit-requests-pending-count'] });
            setActioningId(null);
            setReviewNote('');
        },
    });

    const requests: EditRequest[] = data?.requests || [];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING': return <Clock className="h-4 w-4 text-amber-500" />;
            case 'APPROVED': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'REJECTED': return <XCircle className="h-4 w-4 text-red-500" />;
            default: return null;
        }
    };

    const getStatusBadge = (status: string) => {
        const classes = {
            PENDING: 'bg-amber-100 text-amber-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-700',
        }[status] || 'bg-neutral-100 text-neutral-700';

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${classes}`}>
                {getStatusIcon(status)}
                {status}
            </span>
        );
    };

    const getTypeBadge = (type: string) => {
        const isAttendance = type === 'ATTENDANCE';
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${isAttendance
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
                }`}>
                {type}
            </span>
        );
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderValueChange = (oldValue: Record<string, unknown>, newValue: Record<string, unknown>) => {
        return (
            <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-xs font-medium text-red-600 mb-1">Old Value</div>
                    <pre className="text-xs text-neutral-700 overflow-auto">
                        {JSON.stringify(oldValue, null, 2)}
                    </pre>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-xs font-medium text-green-600 mb-1">New Value</div>
                    <pre className="text-xs text-neutral-700 overflow-auto">
                        {JSON.stringify(newValue, null, 2)}
                    </pre>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="p-6">
                <div className="flex items-center gap-3 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Failed to load edit requests</span>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                    Edit Requests
                </h1>
                <p className="text-neutral-600 mt-1">
                    Review and manage teacher edit requests for attendance and marks
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Pending Requests"
                    value={pendingCount?.count || 0}
                    icon={Clock}
                    iconColor="text-amber-600"
                    iconBgColor="bg-amber-100"
                />
                <StatCard
                    title="Total Requests"
                    value={data?.total || 0}
                    icon={FileText}
                    iconColor="text-blue-600"
                    iconBgColor="bg-blue-100"
                />
                <StatCard
                    title="Approved"
                    value={requests.filter(r => r.status === 'APPROVED').length}
                    icon={CheckCircle}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                />
                <StatCard
                    title="Rejected"
                    value={requests.filter(r => r.status === 'REJECTED').length}
                    icon={XCircle}
                    iconColor="text-red-600"
                    iconBgColor="bg-red-100"
                />
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-neutral-500" />
                        <span className="text-sm font-medium text-neutral-700">Filters:</span>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Status</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="">All Types</option>
                            <option value="ATTENDANCE">Attendance</option>
                            <option value="MARKS">Marks</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Requests List */}
            {requests.length === 0 ? (
                <Card className="p-8 text-center">
                    <Clock className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">
                        No Edit Requests
                    </h3>
                    <p className="text-neutral-600">
                        {statusFilter === 'PENDING'
                            ? 'There are no pending edit requests at this time.'
                            : 'No edit requests match your filter criteria.'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => (
                        <Card key={request.id} className="overflow-hidden">
                            {/* Request Header */}
                            <div
                                className="p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                                onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                {getTypeBadge(request.type)}
                                                {getStatusBadge(request.status)}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 text-sm text-neutral-600">
                                                <User className="h-4 w-4" />
                                                <span>{request.requester?.name || 'Unknown'}</span>
                                                <span className="text-neutral-400">•</span>
                                                <Calendar className="h-4 w-4" />
                                                <span>{formatDate(request.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {request.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActioningId(request.id);
                                                    }}
                                                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-1"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        rejectMutation.mutate({ id: request.id });
                                                    }}
                                                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1"
                                                >
                                                    <X className="h-4 w-4" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {expandedId === request.id ? (
                                            <ChevronUp className="h-5 w-5 text-neutral-400" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-neutral-400" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedId === request.id && (
                                <div className="px-4 pb-4 border-t border-neutral-200">
                                    <div className="mt-4 space-y-4">
                                        {/* Reason */}
                                        {request.reason && (
                                            <div>
                                                <div className="text-xs font-medium text-neutral-500 mb-1">
                                                    Reason for Edit
                                                </div>
                                                <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-lg">
                                                    {request.reason}
                                                </p>
                                            </div>
                                        )}

                                        {/* Value Changes */}
                                        <div>
                                            <div className="text-xs font-medium text-neutral-500 mb-1">
                                                Requested Changes
                                            </div>
                                            {renderValueChange(request.oldValue, request.newValue)}
                                        </div>

                                        {/* Review Info */}
                                        {request.reviewedAt && (
                                            <div className="pt-4 border-t border-neutral-200">
                                                <div className="text-xs font-medium text-neutral-500 mb-2">
                                                    Review Details
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="text-neutral-600">
                                                        Reviewed by: <strong>{request.reviewer?.name || 'Unknown'}</strong>
                                                    </span>
                                                    <span className="text-neutral-600">
                                                        on {formatDate(request.reviewedAt)}
                                                    </span>
                                                </div>
                                                {request.reviewNote && (
                                                    <p className="mt-2 text-sm text-neutral-700 bg-neutral-50 p-3 rounded-lg">
                                                        {request.reviewNote}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Approval Modal */}
                            {actioningId === request.id && (
                                <div className="px-4 pb-4 border-t border-neutral-200 bg-green-50">
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                                            Add a note (optional)
                                        </label>
                                        <textarea
                                            value={reviewNote}
                                            onChange={(e) => setReviewNote(e.target.value)}
                                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-green-500"
                                            rows={2}
                                            placeholder="Enter any notes for this approval..."
                                        />
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => approveMutation.mutate({ id: request.id, note: reviewNote })}
                                                disabled={approveMutation.isPending}
                                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                                            >
                                                {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setActioningId(null);
                                                    setReviewNote('');
                                                }}
                                                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-200 hover:bg-neutral-300 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
