'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    RefreshCw,
    Search,
    Filter,
    CheckCircle,
    XCircle,
    Clock,
    Check,
    X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Revaluation {
    id: number;
    oldMarks: number;
    newMarks: number;
    status: string;
    enteredAt: string;
    result: {
        studentUsn: string;
        totalMarks: number;
        department: { name: string; code: string };
        batch: { name: string };
        course: { name: string; code: string };
    };
    enteredByUser: { name: string };
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'LOCKED';

export default function COERevaluationsPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
    const [searchUsn, setSearchUsn] = useState('');

    // Fetch revaluations
    const { data: revaluations = [], isLoading } = useQuery({
        queryKey: ['coe-revaluations', statusFilter],
        queryFn: async () => {
            const response = await api.get('/revaluations', {
                params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
            });
            return response.data;
        },
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.put(`/revaluations/${id}/approve`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coe-revaluations'] });
            toast.success('Revaluation approved - result will be updated');
        },
        onError: () => {
            toast.error('Failed to approve revaluation');
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.put(`/revaluations/${id}/reject`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coe-revaluations'] });
            toast.success('Revaluation rejected');
        },
        onError: () => {
            toast.error('Failed to reject revaluation');
        },
    });

    const filteredRevaluations = searchUsn
        ? revaluations.filter((r: Revaluation) =>
            r.result.studentUsn.toLowerCase().includes(searchUsn.toLowerCase())
        )
        : revaluations;

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

    const pendingCount = revaluations.filter((r: Revaluation) => r.status === 'PENDING').length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Revaluation Requests</h1>
                    <p className="text-neutral-500 mt-1">Review and approve revaluation requests from clerks</p>
                </div>
                {pendingCount > 0 && (
                    <Badge variant="warning" className="px-3 py-1">
                        {pendingCount} Pending
                    </Badge>
                )}
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-neutral-400" />
                        <div className="flex gap-2">
                            {(['ALL', 'PENDING', 'APPROVED', 'LOCKED'] as StatusFilter[]).map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${statusFilter === status
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
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
                </div>
            </Card>

            {/* Content */}
            {isLoading ? (
                <Card className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </Card>
            ) : filteredRevaluations.length === 0 ? (
                <Card className="text-center py-12">
                    <RefreshCw className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No revaluation requests</h3>
                    <p className="text-neutral-500 mt-1">
                        {statusFilter !== 'ALL'
                            ? `No ${statusFilter.toLowerCase()} revaluations found`
                            : 'No revaluation requests have been submitted yet'}
                    </p>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-neutral-50">
                                <tr>
                                    <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Department</th>
                                    <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Course</th>
                                    <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">USN</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Old Marks</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">New Marks</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Difference</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Status</th>
                                    <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Submitted</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredRevaluations.map((reval: Revaluation) => {
                                    const diff = reval.newMarks - reval.oldMarks;
                                    return (
                                        <tr key={reval.id} className="hover:bg-neutral-50">
                                            <td className="px-6 py-3">
                                                <Badge variant="outline">{reval.result.department?.code || 'N/A'}</Badge>
                                            </td>
                                            <td className="px-6 py-3">
                                                <p className="font-medium">{reval.result.course?.code || 'N/A'}</p>
                                            </td>
                                            <td className="px-6 py-3 font-mono text-sm">{reval.result.studentUsn}</td>
                                            <td className="px-6 py-3 text-center">{reval.oldMarks}/50</td>
                                            <td className="px-6 py-3 text-center font-semibold text-purple-600">{reval.newMarks}/50</td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-neutral-500'}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center">{getStatusBadge(reval.status)}</td>
                                            <td className="px-6 py-3 text-sm text-neutral-500">{formatDate(reval.enteredAt)}</td>
                                            <td className="px-6 py-3 text-center">
                                                {reval.status === 'PENDING' ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-green-600 hover:bg-green-50"
                                                            onClick={() => approveMutation.mutate(reval.id)}
                                                            disabled={approveMutation.isPending}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-600 hover:bg-red-50"
                                                            onClick={() => rejectMutation.mutate(reval.id)}
                                                            disabled={rejectMutation.isPending}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-neutral-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Info Box */}
            <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-purple-900">Revaluation Note</h4>
                        <p className="text-sm text-purple-700 mt-1">
                            Approving a revaluation will update the student's semester marks and recalculate their result status.
                            Original marks are preserved in the system for audit purposes.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
