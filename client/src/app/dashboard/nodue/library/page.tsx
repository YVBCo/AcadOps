'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Plus } from 'lucide-react';

export default function LibraryNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: libraryDues, isLoading } = useQuery({
        queryKey: ['nodue', 'dues', 'library'],
        queryFn: nodueApi.getLibraryDues,
    });

    const updateLibraryDueMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => nodueApi.updateLibraryDue(id, data),
        onSuccess: () => {
            toast.success('Library due updated successfully');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'dues', 'library'] });
        },
        onError: () => toast.error('Failed to update library due')
    });

    const handleClear = (id: number) => {
        updateLibraryDueMutation.mutate({ id, data: { hasDues: false, fineAmount: 0 } });
    };

    const filtered = libraryDues?.filter((d: any) => 
        d.student?.user?.name?.toLowerCase().includes(search.toLowerCase()) || 
        d.student?.user?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <DashboardShell
            allowedRoles={['LIBRARIAN', 'SUPER_ADMIN']}
            portalName="No-Due Portal"
            basePath="/dashboard/nodue"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Library Dues Management</h1>
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
                        <Button><Plus className="w-4 h-4 mr-1" /> Add Record</Button>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Student</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Roll No</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Books Held</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Fine Amount</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading library records...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No library records found.</td></tr>
                                ) : (
                                    filtered.map((record: any) => (
                                        <tr key={record.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-800">{record.student?.user?.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{record.student?.user?.rollNumber || '-'}</td>
                                            <td className="py-3 px-4 text-sm text-slate-600">{record.booksHeld || 0}</td>
                                            <td className="py-3 px-4 font-semibold text-red-600">
                                                {record.fineAmount > 0 ? `₹${record.fineAmount}` : '-'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant={!record.hasDues ? 'success' : 'error'}>
                                                    {!record.hasDues ? 'Cleared' : 'Has Dues'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4">
                                                {record.hasDues && (
                                                    <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleClear(record.id)}>
                                                        Mark Cleared
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
