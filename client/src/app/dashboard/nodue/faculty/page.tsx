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

export default function FacultyNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

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

    const handleClear = (id: number) => {
        const remarks = prompt('Any remarks? (optional)');
        clearMutation.mutate({ id, remarks: remarks || '' });
    };

    const handleReject = (id: number) => {
        const remarks = prompt('Reason for rejection:');
        if (remarks) {
            rejectMutation.mutate({ id, remarks });
        }
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
                                    filtered.map((enrollment: any) => (
                                        <tr key={enrollment.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800">{enrollment.student?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{enrollment.student?.studentProfile?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {enrollment.subject?.course?.name} ({enrollment.subject?.course?.code})
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant={enrollment.clearanceStatus === 'CLEARED' ? 'success' : enrollment.clearanceStatus === 'REJECTED' ? 'error' : 'warning'}>
                                                    {enrollment.clearanceStatus}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {enrollment.clearanceStatus === 'PENDING' && (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleClear(enrollment.id)}>
                                                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Clear
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(enrollment.id)}>
                                                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                                        </Button>
                                                    </div>
                                                )}
                                                {enrollment.clearanceStatus !== 'PENDING' && (
                                                    <span className="text-xs text-slate-500">{enrollment.clearanceRemarks || 'No remarks'}</span>
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
