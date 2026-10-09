'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Plus, Edit } from 'lucide-react';

export default function AccountsNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: dues, isLoading } = useQuery({
        queryKey: ['nodue', 'dues', 'all'],
        queryFn: nodueApi.getAllDues,
    });

    const updateDueMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => nodueApi.updateDue(id, data),
        onSuccess: () => {
            toast.success('Due updated successfully');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'dues', 'all'] });
        },
        onError: () => toast.error('Failed to update due')
    });

    const handleUpdateStatus = (due: any, status: string) => {
        updateDueMutation.mutate({ id: due.id, data: { status, ...(status === 'COMPLETED' ? { paidAmount: Number(due.fineAmount) } : {}) } });
    };

    const handleAddDue = async () => {
        const studentId = Number(prompt('Student user ID:'));
        if (!Number.isInteger(studentId) || studentId <= 0) return;
        const dueType = prompt('Due type (e.g. COLLEGE_FEE):', 'COLLEGE_FEE');
        if (!dueType?.trim()) return;
        const amount = Number(prompt('Amount due:'));
        if (!Number.isFinite(amount) || amount < 0) return;
        const description = prompt('Description (optional):') || undefined;
        try {
            await nodueApi.createDue({ studentId, dueType: dueType.trim(), fineAmount: amount, description });
            toast.success('Due added successfully');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'dues', 'all'] });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to add due');
        }
    };

    const filtered = dues?.filter((d: any) => 
        d.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.student?.studentProfile?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <DashboardShell
            allowedRoles={['ACCOUNTS_STAFF', 'CLERK', 'SUPER_ADMIN']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Accounts & Dues Management</h1>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
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
                        <Button onClick={handleAddDue}><Plus className="w-4 h-4 mr-1" /> Add Due</Button>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Student</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Roll No</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Category</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Amount</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading dues...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No dues found.</td></tr>
                                ) : (
                                    filtered.map((due: any) => (
                                        <tr key={due.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800">{due.student?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{due.student?.studentProfile?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {due.description || due.dueType || 'General Due'}
                                            </td>
                                            <td className="py-3 px-4 font-semibold">₹{due.fineAmount}</td>
                                            <td className="py-3 px-4">
                                                <Badge variant={due.status === 'COMPLETED' ? 'success' : due.status === 'WAIVED' ? 'neutral' : 'error'}>
                                                    {due.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {due.status === 'PENDING' && (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200" onClick={() => handleUpdateStatus(due, 'COMPLETED')}>Mark Paid</Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-slate-600 border-slate-200" onClick={() => handleUpdateStatus(due, 'WAIVED')}>Waive</Button>
                                                    </div>
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
