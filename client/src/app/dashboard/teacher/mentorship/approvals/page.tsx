'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorApi } from '@/lib/api';
import { CheckCircle, XCircle, Clock, ArrowLeft, BookOpen, User, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

interface PendingMark {
    id: number;
    studentUsn: string;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
    calculatedTotal: number | null;
    mentorApprovalStatus: string;
    course: { id: number; name: string; code: string };
    batch: { id: number; name: string };
    section: { id: number; name: string };
}

export default function ApprovalsPage() {
    const queryClient = useQueryClient();
    const [selectedMarks, setSelectedMarks] = useState<number[]>([]);
    const [rejectModal, setRejectModal] = useState<{ open: boolean; marksId: number | null }>({ open: false, marksId: null });
    const [rejectReason, setRejectReason] = useState('');

    // Fetch pending approvals
    const { data: pendingMarks, isLoading, error } = useQuery<PendingMark[]>({
        queryKey: ['mentor-pending-approvals'],
        queryFn: () => mentorApi.getPendingApprovals(),
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: (marksIds: number[]) => mentorApi.approveMarks(marksIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-pending-approvals'] });
            setSelectedMarks([]);
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: ({ marksId, reason }: { marksId: number; reason: string }) =>
            mentorApi.rejectMarks(marksId, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-pending-approvals'] });
            setRejectModal({ open: false, marksId: null });
            setRejectReason('');
        },
    });

    const handleSelectAll = () => {
        if (selectedMarks.length === (pendingMarks?.length || 0)) {
            setSelectedMarks([]);
        } else {
            setSelectedMarks(pendingMarks?.map(m => m.id) || []);
        }
    };

    const handleApproveSelected = () => {
        if (selectedMarks.length > 0) {
            approveMutation.mutate(selectedMarks);
        }
    };

    const handleRejectClick = (marksId: number) => {
        setRejectModal({ open: true, marksId });
        setRejectReason('');
    };

    const handleConfirmReject = () => {
        if (rejectModal.marksId && rejectReason.trim().length >= 10) {
            rejectMutation.mutate({ marksId: rejectModal.marksId, reason: rejectReason });
        }
    };

    // Group marks by course
    const marksByCourse = (pendingMarks || []).reduce((acc, mark) => {
        const key = mark.course.id;
        if (!acc[key]) {
            acc[key] = {
                course: mark.course,
                section: mark.section,
                batch: mark.batch,
                marks: [],
            };
        }
        acc[key].marks.push(mark);
        return acc;
    }, {} as Record<number, { course: PendingMark['course']; section: PendingMark['section']; batch: PendingMark['batch']; marks: PendingMark[] }>);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading pending approvals...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-300" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">Error Loading Approvals</h3>
                <p className="text-slate-500">{(error as Error).message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/teacher/mentorship"
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Pending Approvals</h1>
                    <p className="text-slate-600">Review and approve internal marks submitted by teachers</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Pending</p>
                            <p className="text-xl font-bold text-slate-800">{pendingMarks?.length || 0}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Selected</p>
                            <p className="text-xl font-bold text-slate-800">{selectedMarks.length}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Courses</p>
                            <p className="text-xl font-bold text-slate-800">{Object.keys(marksByCourse).length}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Bulk Actions */}
            {(pendingMarks?.length || 0) > 0 && (
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedMarks.length === pendingMarks?.length && pendingMarks.length > 0}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                                />
                                <span className="text-sm text-slate-600">Select All</span>
                            </label>
                            <span className="text-sm text-slate-400">
                                {selectedMarks.length} of {pendingMarks?.length} selected
                            </span>
                        </div>
                        <button
                            onClick={handleApproveSelected}
                            disabled={selectedMarks.length === 0 || approveMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/30"
                        >
                            <CheckCircle className="w-4 h-4" />
                            {approveMutation.isPending ? 'Approving...' : `Approve Selected (${selectedMarks.length})`}
                        </button>
                    </div>
                </Card>
            )}

            {/* Marks by Course */}
            {Object.keys(marksByCourse).length === 0 ? (
                <div className="text-center py-16">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">All Caught Up!</h3>
                    <p className="text-slate-500">No pending approvals at this time.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.values(marksByCourse).map(({ course, section, batch, marks }) => (
                        <Card key={course.id} className="overflow-hidden">
                            <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{course.name}</h3>
                                        <p className="text-sm text-slate-500">
                                            {course.code} • {section.name} • Batch {batch.name}
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                                        {marks.length} pending
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="w-12 px-4 py-3 text-left"></th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Student USN</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">IA-1</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">IA-2</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">IA-3</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Assignment</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Total</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {marks.map(mark => (
                                            <tr key={mark.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMarks.includes(mark.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedMarks([...selectedMarks, mark.id]);
                                                            } else {
                                                                setSelectedMarks(selectedMarks.filter(id => id !== mark.id));
                                                            }
                                                        }}
                                                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium text-slate-800">{mark.studentUsn}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-600">{mark.internal1 ?? '-'}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">{mark.internal2 ?? '-'}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">{mark.internal3 ?? '-'}</td>
                                                <td className="px-4 py-3 text-center text-slate-600">{mark.assignmentMarks ?? '-'}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-teal-600">{mark.calculatedTotal ?? '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => approveMutation.mutate([mark.id])}
                                                            disabled={approveMutation.isPending}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectClick(mark.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">Reject Marks</h2>
                            <p className="text-sm text-slate-500">Provide a reason for rejecting these marks.</p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Enter reason (minimum 10 characters)..."
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                {rejectReason.length}/10 characters minimum
                            </p>
                        </div>
                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setRejectModal({ open: false, marksId: null })}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReject}
                                disabled={rejectReason.trim().length < 10 || rejectMutation.isPending}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                            >
                                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
