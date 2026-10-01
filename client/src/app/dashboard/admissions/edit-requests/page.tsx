'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admissionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Clock,
    CheckCircle,
    XCircle,
    User,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

export default function EditRequestsPage() {
    const { user: currentUser } = useAuthStore();
    const isAdmin = currentUser?.role === 'ADMISSIONS_ADMIN';
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState('PENDING');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

    const { data: rawEditData, isLoading } = useQuery({
        queryKey: ['edit-requests', filter],
        queryFn: () => admissionsApi.getEditRequests(filter),
    });
    const requests = Array.isArray(rawEditData) ? rawEditData : (rawEditData?.requests ?? []);

    const approveMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note?: string }) =>
            admissionsApi.approveEditRequest(id, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, note }: { id: number; note?: string }) =>
            admissionsApi.rejectEditRequest(id, note),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
        },
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    };

    const renderChanges = (changes: any) => {
        const fields = [
            { key: 'name', label: 'Name' },
            { key: 'mobileNumber', label: 'Mobile' },
            { key: 'dateOfBirth', label: 'Date of Birth' },
            { key: 'gender', label: 'Gender' },
            { key: 'bloodGroup', label: 'Blood Group' },
            { key: 'category', label: 'Category' },
        ];

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    {fields.map(f => changes[f.key] ? (
                        <div key={f.key} className="bg-slate-50 rounded-lg p-3">
                            <span className="text-xs font-medium text-slate-500 uppercase">{f.label}</span>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">{changes[f.key]}</p>
                        </div>
                    ) : null)}
                </div>
                {changes.permanentAddress && (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <span className="text-xs font-medium text-slate-500 uppercase">Permanent Address</span>
                        <p className="text-sm text-slate-800 mt-0.5">
                            {changes.permanentAddress.address}, {changes.permanentAddress.state} - {changes.permanentAddress.pin}
                        </p>
                    </div>
                )}
                {changes.fatherDetails && (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <span className="text-xs font-medium text-slate-500 uppercase">Father</span>
                        <p className="text-sm text-slate-800 mt-0.5">
                            {changes.fatherDetails.name} | {changes.fatherDetails.mobile} | {changes.fatherDetails.occupation}
                        </p>
                    </div>
                )}
                {changes.motherDetails && (
                    <div className="bg-slate-50 rounded-lg p-3">
                        <span className="text-xs font-medium text-slate-500 uppercase">Mother</span>
                        <p className="text-sm text-slate-800 mt-0.5">
                            {changes.motherDetails.name} | {changes.motherDetails.mobile} | {changes.motherDetails.occupation}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Student Edit Requests</h1>
                <div className="flex gap-2">
                    {['PENDING', 'APPROVED', 'REJECTED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === status
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {requests.length === 0 ? (
                <Card className="p-12 text-center">
                    <Clock className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No {filter.toLowerCase()} edit requests</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((req: any) => (
                        <Card key={req.id} className="overflow-hidden">
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                                        {req.studentProfile?.user?.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {req.studentProfile?.user?.name || 'Unknown Student'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Requested by <span className="text-slate-700 font-medium">{req.requester?.name}</span> · {formatDate(req.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant={req.status === 'PENDING' ? 'warning' : req.status === 'APPROVED' ? 'success' : 'error'}
                                    >
                                        {req.status}
                                    </Badge>
                                    {expandedId === req.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                </div>
                            </div>

                            {expandedId === req.id && (
                                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                                    {req.reason && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                            <p className="text-sm text-amber-800">
                                                <span className="font-semibold">Reason:</span> {req.reason}
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-2">Proposed Changes</h4>
                                        {renderChanges(req.proposedChanges)}
                                    </div>

                                    {req.status === 'PENDING' && isAdmin && (
                                        <div className="space-y-3 pt-2">
                                            <Input
                                                placeholder="Add a review note (optional)"
                                                value={reviewNotes[req.id] || ''}
                                                onChange={(e) => setReviewNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                            />
                                            <div className="flex gap-3 justify-end">
                                                <Button
                                                    variant="secondary"
                                                    leftIcon={XCircle}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        rejectMutation.mutate({ id: req.id, note: reviewNotes[req.id] });
                                                    }}
                                                    isLoading={rejectMutation.isPending}
                                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    leftIcon={CheckCircle}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        approveMutation.mutate({ id: req.id, note: reviewNotes[req.id] });
                                                    }}
                                                    isLoading={approveMutation.isPending}
                                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg"
                                                >
                                                    Approve & Apply
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {req.reviewer && (
                                        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                                            Reviewed by <span className="font-semibold">{req.reviewer.name}</span> on {formatDate(req.reviewedAt)}
                                            {req.reviewNote && <p className="mt-1 text-slate-500">Note: {req.reviewNote}</p>}
                                        </div>
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
