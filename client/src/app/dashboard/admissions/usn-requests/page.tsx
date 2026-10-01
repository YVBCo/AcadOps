'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Hash,
    CheckCircle,
    XCircle,
    Clock,
    User,
    FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usnRequestApi } from '@/lib/api';

interface USNRequest {
    id: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    justification?: string;
    permanentUsn?: string;
    rejectionReason?: string;
    createdAt: string;
    studentProfile?: {
        id: number;
        rollNumber: string;
        temporaryUsn?: string;
        permanentUsn?: string;
        user?: { id: number; name: string; email: string };
    };
    requestedByUser?: { id: number; name: string };
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
};

export default function USNRequestsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [reviewingId, setReviewingId] = useState<number | null>(null);
    const [usnInput, setUsnInput] = useState('');
    const [rejectReason, setRejectReason] = useState('');

    const { data, isLoading } = useQuery<{ requests: USNRequest[]; total: number }>({
        queryKey: ['usn-requests', statusFilter],
        queryFn: () => usnRequestApi.getAll({ status: statusFilter || undefined }),
    });

    const reviewMutation = useMutation({
        mutationFn: ({ id, status, permanentUsn, rejectionReason }: { id: number; status: 'APPROVED' | 'REJECTED'; permanentUsn?: string; rejectionReason?: string }) =>
            usnRequestApi.review(id, { status, permanentUsn, rejectionReason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usn-requests'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            setReviewingId(null);
            setUsnInput('');
            setRejectReason('');
        },
    });

    const requests = data?.requests || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">USN Requests</h1>
                <span className="text-sm text-slate-500">{data?.total || 0} total</span>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
                {['PENDING', 'APPROVED', 'REJECTED', ''].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${statusFilter === status
                                ? 'bg-sky-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {status || 'All'}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <Hash className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No USN requests found</p>
                    </div>
                </Card>
            ) : (
                <div className="space-y-3">
                    {requests.map(req => (
                        <Card key={req.id}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                                        <User className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">
                                            {req.studentProfile?.user?.name || 'Unknown Student'}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                            <span className="font-mono">{req.studentProfile?.temporaryUsn || req.studentProfile?.rollNumber}</span>
                                            <span>•</span>
                                            <span>Requested by {req.requestedByUser?.name}</span>
                                            <span>•</span>
                                            <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        {req.justification && (
                                            <p className="text-sm text-slate-600 mt-2 italic">&ldquo;{req.justification}&rdquo;</p>
                                        )}
                                        {req.permanentUsn && (
                                            <p className="text-sm font-mono text-emerald-600 mt-2">Assigned: {req.permanentUsn}</p>
                                        )}
                                        {req.rejectionReason && (
                                            <p className="text-sm text-red-600 mt-2">Rejected: {req.rejectionReason}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[req.status]}`}>
                                        {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                                        {req.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                                        {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                                        {req.status}
                                    </span>
                                </div>
                            </div>

                            {/* Review Controls */}
                            {req.status === 'PENDING' && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    {reviewingId === req.id ? (
                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Enter permanent USN (for approval)..."
                                                    value={usnInput}
                                                    onChange={e => setUsnInput(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                />
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-500 hover:bg-emerald-600"
                                                    onClick={() => {
                                                        if (!usnInput.trim()) { alert('Permanent USN is required'); return; }
                                                        reviewMutation.mutate({ id: req.id, status: 'APPROVED', permanentUsn: usnInput });
                                                    }}
                                                    isLoading={reviewMutation.isPending}
                                                >
                                                    Approve
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Rejection reason..."
                                                    value={rejectReason}
                                                    onChange={e => setRejectReason(e.target.value)}
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-red-600 border-red-300"
                                                    onClick={() => {
                                                        if (!rejectReason.trim()) { alert('Rejection reason is required'); return; }
                                                        reviewMutation.mutate({ id: req.id, status: 'REJECTED', rejectionReason: rejectReason });
                                                    }}
                                                    isLoading={reviewMutation.isPending}
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                            <button onClick={() => setReviewingId(null)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setReviewingId(req.id)}
                                            className="text-sm font-medium text-sky-600 hover:text-sky-700"
                                        >
                                            Review Request →
                                        </button>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
