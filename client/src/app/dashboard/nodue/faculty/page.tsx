'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, CheckCircle, XCircle } from 'lucide-react';

function getClearanceStatus(enrollment: { clearanceStatus?: string; status?: string }) {
    const status = enrollment.clearanceStatus ?? enrollment.status;
    if (status === 'COMPLETED') return 'CLEARED';
    if (status === 'WAIVED') return 'REJECTED';
    return status ?? 'UNKNOWN';
}

export default function FacultyNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [review, setReview] = useState<{ id: number; action: 'clear' | 'reject' } | null>(null);
    const [remarks, setRemarks] = useState('');

    const { data: students, isLoading } = useQuery({
        queryKey: ['nodue', 'enrollments', 'mystudents'],
        queryFn: nodueApi.getMyStudents,
    });

    const clearMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number; remarks: string }) => nodueApi.clearEnrollment(id, { remarks }),
        onSuccess: () => {
            toast.success('Student cleared successfully');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'enrollments', 'mystudents'] });
        },
        onError: () => toast.error('Failed to clear student')
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, remarks }: { id: number; remarks: string }) => nodueApi.rejectEnrollment(id, { remarks }),
        onSuccess: () => {
            toast.success('Student rejected');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'enrollments', 'mystudents'] });
        },
        onError: () => toast.error('Failed to reject student')
    });

    const openReview = (id: number, action: 'clear' | 'reject') => {
        setRemarks('');
        setReview({ id, action });
    };

    const submitReview = () => {
        if (!review) return;
        if (review.action === 'reject' && !remarks.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        const mutation = review.action === 'clear' ? clearMutation : rejectMutation;
        mutation.mutate({ id: review.id, remarks: remarks.trim() }, {
            onSuccess: () => {
                setReview(null);
                setRemarks('');
            },
        });
    };

    const filtered = students?.filter((s: any) => 
        s.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.student?.studentProfile?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <DashboardShell
            allowedRoles={['TEACHER', 'SUPER_ADMIN']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Faculty Clearance Review</h1>
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm"
                        />
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Student</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Roll No</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Subject</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading students...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">No students found requiring review.</td></tr>
                                ) : (
                                    filtered.map((enrollment: any) => {
                                        const clearanceStatus = getClearanceStatus(enrollment);
                                        return (
                                        <tr key={enrollment.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800">{enrollment.student?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{enrollment.student?.studentProfile?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {enrollment.subject?.course?.name} ({enrollment.subject?.course?.code})
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant={clearanceStatus === 'CLEARED' ? 'success' : clearanceStatus === 'REJECTED' ? 'error' : 'warning'}>
                                                    {clearanceStatus}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {clearanceStatus === 'PENDING' && (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => openReview(enrollment.id, 'clear')}>
                                                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Clear
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => openReview(enrollment.id, 'reject')}>
                                                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                )}
                                                {clearanceStatus !== 'PENDING' && (
                                                    <span className="text-xs text-slate-500">{enrollment.clearanceRemarks || 'No remarks'}</span>
                                                )}
                                            </td>
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
                {review && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
                        <Card className="w-full max-w-md space-y-4 p-6">
                            <div>
                                <h2 id="review-title" className="text-lg font-semibold text-slate-800">
                                    {review.action === 'clear' ? 'Clear subject requirement' : 'Reject subject requirement'}
                                </h2>
                                <p className="mt-1 text-sm text-slate-600">
                                    {review.action === 'clear' ? 'Confirm that this student has completed this subject requirement.' : 'Provide a reason so the student knows why this requirement was rejected.'}
                                </p>
                            </div>
                            <label className="block text-sm font-medium text-slate-700" htmlFor="review-remarks">
                                Remarks {review.action === 'reject' ? '(required)' : '(optional)'}
                            </label>
                            <textarea
                                id="review-remarks"
                                value={remarks}
                                onChange={(event) => setRemarks(event.target.value)}
                                rows={3}
                                className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                                placeholder={review.action === 'reject' ? 'Reason for rejection' : 'Optional note'}
                            />
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setReview(null)}>Cancel</Button>
                                <Button
                                    onClick={submitReview}
                                    disabled={clearMutation.isPending || rejectMutation.isPending}
                                    className={review.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
                                >
                                    {clearMutation.isPending || rejectMutation.isPending ? 'Saving…' : review.action === 'clear' ? 'Confirm Clear' : 'Confirm Reject'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
