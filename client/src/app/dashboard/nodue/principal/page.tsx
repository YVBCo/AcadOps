'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Search } from 'lucide-react';
import { useState } from 'react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { nodueApi } from '@/lib/api';
import { toast } from 'sonner';

export default function PrincipalNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const { data: clearances = [], isLoading } = useQuery({
        queryKey: ['nodue', 'clearances', 'principal'],
        queryFn: () => nodueApi.getAllClearances({ currentStage: 'PRINCIPAL_REVIEW' }),
    });
    const approveMutation = useMutation({
        mutationFn: (id: number) => nodueApi.principalApprove(id),
        onSuccess: () => {
            toast.success('Clearance approved');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'clearances', 'principal'] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to approve clearance'),
    });
    const filtered = clearances.filter((clearance: any) =>
        clearance.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        clearance.student?.studentProfile?.rollNumber?.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <DashboardShell allowedRoles={['PRINCIPAL', 'SUPER_ADMIN']} portalName="No-Due Portal" basePath="/dashboard/nodue">
            <div className="space-y-6">
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Principal Approval Queue</h1>
                        <p className="text-slate-500">Review clearances approved by the department.</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search students…" className="w-full rounded-lg border py-2 pl-9 pr-4 text-sm" />
                    </div>
                </div>
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-4">Student</th><th className="p-4">Roll number</th><th className="p-4">Stage</th><th className="p-4">Action</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading clearances…</td></tr>
                                    : filtered.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-500">No clearances awaiting approval.</td></tr>
                                        : filtered.map((clearance: any) => <tr key={clearance.id}>
                                            <td className="p-4 font-medium text-slate-800">{clearance.student?.name || 'Student'}</td>
                                            <td className="p-4 text-sm text-slate-600">{clearance.student?.studentProfile?.rollNumber || '—'}</td>
                                            <td className="p-4"><Badge variant="warning">{clearance.currentStage}</Badge></td>
                                            <td className="p-4"><Button size="sm" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(clearance.id)}><CheckCircle className="mr-1 h-4 w-4" />Approve</Button></td>
                                        </tr>)}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </DashboardShell>
    );
}
