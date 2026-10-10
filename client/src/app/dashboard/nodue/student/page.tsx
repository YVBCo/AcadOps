'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function StudentNoDuePage() {
    const queryClient = useQueryClient();

    const { data: status, isLoading: statusLoading } = useQuery({
        queryKey: ['nodue', 'status'],
        queryFn: nodueApi.getClearanceStatus,
    });

    const { data: dues, isLoading: duesLoading } = useQuery({
        queryKey: ['nodue', 'dues', 'student'],
        queryFn: nodueApi.getStudentDues,
    });

    const applyMutation = useMutation({
        mutationFn: nodueApi.applyClearance,
        onSuccess: () => {
            toast.success('Applied for clearance successfully!');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'status'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to apply for clearance');
        }
    });

    const renderStepper = () => {
        const stages = ['STUDENT_APPLICATION', 'FACULTY_REVIEW', 'LIBRARY_REVIEW', 'DEPARTMENT_REVIEW', 'HOD_REVIEW', 'PRINCIPAL_REVIEW', 'CLEARED'];
        const currentIdx = status ? Math.max(0, stages.indexOf(status.currentStage || 'STUDENT_APPLICATION')) : 0;

        return (
            <div className="flex items-center justify-between mt-8 relative">
                <div className="absolute left-0 top-1/2 w-full h-1 bg-slate-200 -z-10 -translate-y-1/2 rounded"></div>
                {stages.map((stage, idx) => {
                    const isCompleted = idx < currentIdx || status?.currentStage === 'CLEARED';
                    const isCurrent = idx === currentIdx && status?.currentStage !== 'CLEARED';
                    return (
                        <div key={stage} className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-500 text-white ring-4 ring-blue-100' : 'bg-slate-200 text-slate-500'}`}>
                                {isCompleted ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                            </div>
                            <span className="text-xs font-medium text-slate-600 mt-2 absolute translate-y-8 max-w-[80px] text-center">{stage.replace('_', ' ')}</span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <DashboardShell
            allowedRoles={['STUDENT']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-800">My Clearance Status</h1>
                    {(!status || status.currentStage === 'STUDENT_APPLICATION' || status.currentStage === 'REJECTED') && (
                        <div className="flex flex-col items-end gap-1">
                            <Button
                                onClick={() => applyMutation.mutate()}
                                disabled={statusLoading || applyMutation.isPending || !status?.enrollments?.length}
                            >
                                {applyMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Apply for Clearance
                            </Button>
                            {!statusLoading && !status?.enrollments?.length && (
                                <p className="text-xs text-slate-500">Enroll in at least one subject before applying.</p>
                            )}
                        </div>
                    )}
                </div>

                {statusLoading ? (
                    <div className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                ) : (
                    <Card className="p-6 pb-12 overflow-hidden">
                        <h2 className="text-lg font-semibold mb-4">Clearance Pipeline</h2>
                        {renderStepper()}
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="p-6">
                        <h2 className="text-lg font-semibold mb-4">Subject Clearances</h2>
                        {statusLoading ? (
                            <div className="space-y-4">
                                {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded"></div>)}
                            </div>
                        ) : status?.enrollments?.length ? (
                            <div className="space-y-3">
                                {status.enrollments.map((e: any) => (
                                    <div key={e.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-sm">{e.subject?.course?.name}</p>
                                            <p className="text-xs text-slate-500">{e.subject?.course?.code}</p>
                                        </div>
                                        <Badge variant={e.clearanceStatus === 'CLEARED' ? 'success' : e.clearanceStatus === 'REJECTED' ? 'error' : 'warning'}>
                                            {e.clearanceStatus}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">No subject clearances found.</p>
                        )}
                    </Card>

                    <Card className="p-6">
                        <h2 className="text-lg font-semibold mb-4">Dues & Fines</h2>
                        {duesLoading ? (
                            <div className="space-y-4">
                                {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded"></div>)}
                            </div>
                        ) : dues?.length ? (
                            <div className="space-y-3">
                                {dues.map((due: any) => (
                                    <div key={due.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium">{due.description || due.dueType || 'College Dues'}</span>
                                            <span className="font-bold text-red-600">₹{due.fineAmount}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            <Badge variant={due.status === 'COMPLETED' ? 'success' : due.status === 'WAIVED' ? 'neutral' : 'error'}>
                                                {due.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 text-slate-500">
                                <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                                <p className="text-sm">No pending dues.</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </DashboardShell>
    );
}
