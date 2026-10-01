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

    const handleUpdateStatus = (id: number, status: string) => {
        updateDueMutation.mutate({ id, data: { status } });
    };

    const filtered = dues?.filter((d: any) => 
        d.student?.user?.name?.toLowerCase().includes(search.toLowerCase()) || 
        d.student?.user?.rollNumber?.toLowerCase().includes(search.toLowerCase())
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
                        <Button><Plus className="w-4 h-4 mr-1" /> Add Due</Button>
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
                                                <div className="font-medium text-slate-800">{due.student?.user?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{due.student?.user?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">
                                                {due.feeCategory?.name || 'General Due'}
                                            </td>
                                            <td className="py-3 px-4 font-semibold">₹{due.amount}</td>
                                            <td className="py-3 px-4">
                                                <Badge variant={due.status === 'PAID' ? 'success' : due.status === 'WAIVED' ? 'neutral' : 'error'}>
                                                    {due.status}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {due.status === 'UNPAID' && (
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200" onClick={() => handleUpdateStatus(due.id, 'PAID')}>Mark Paid</Button>
                                                        <Button size="sm" variant="outline" className="h-8 text-slate-600 border-slate-200" onClick={() => handleUpdateStatus(due.id, 'WAIVED')}>Waive</Button>
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
