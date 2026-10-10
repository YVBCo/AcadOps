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

export default function HODNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: clearances, isLoading } = useQuery({
        queryKey: ['nodue', 'clearances', 'hod'],
        queryFn: () => nodueApi.getAllClearances({ currentStage: 'HOD_REVIEW' }),
    });

    const approveMutation = useMutation({
        mutationFn: (id: number) => nodueApi.hodApprove(id),
        onSuccess: () => {
            toast.success('Clearance approved by HOD');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'clearances', 'hod'] });
        },
        onError: () => toast.error('Failed to approve clearance')
    });

    const rejectEmptyMutation = useMutation({
        mutationFn: (id: number) => nodueApi.rejectEmptyClearance(id),
        onSuccess: () => {
            toast.success('Invalid empty clearance request rejected');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'clearances', 'hod'] });
            queryClient.invalidateQueries({ queryKey: ['nodue', 'stats'] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to reject clearance request'),
    });

    const filtered = clearances?.filter((c: any) => 
        c.student?.user?.name?.toLowerCase().includes(search.toLowerCase()) || 
        c.student?.user?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <DashboardShell
            allowedRoles={['DEPARTMENT_ADMIN', 'SUPER_ADMIN']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">HOD Approval Queue</h1>
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
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Batch</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Stage</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading clearances...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">No clearances pending HOD review.</td></tr>
                                ) : (
                                    filtered.map((clearance: any) => (
                                        <tr key={clearance.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800">{clearance.student?.user?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{clearance.student?.user?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {clearance.student?.batch?.name || '-'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="warning">{clearance.currentStage}</Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {clearance.student?.nodueEnrollmentCount === 0 ? (
                                                    <Button size="sm" variant="outline" onClick={() => rejectEmptyMutation.mutate(clearance.id)} disabled={rejectEmptyMutation.isPending}>
                                                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject empty request
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" onClick={() => approveMutation.mutate(clearance.id)} disabled={approveMutation.isPending}>
                                                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </DashboardShell>
    );
}
