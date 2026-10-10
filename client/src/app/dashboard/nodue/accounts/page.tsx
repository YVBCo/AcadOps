'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi, studentApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Plus } from 'lucide-react';

export default function AccountsNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [showAddDue, setShowAddDue] = useState(false);
    const [studentId, setStudentId] = useState('');
    const [dueType, setDueType] = useState('COLLEGE_FEE');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

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

    const { data: studentResponse, isLoading: studentsLoading } = useQuery({
        queryKey: ['nodue', 'students', 'due-form'],
        queryFn: () => studentApi.getStudents({ take: 500 }),
        enabled: showAddDue,
    });

    const createDueMutation = useMutation({
        mutationFn: (data: { studentId: number; dueType: string; fineAmount: number; description?: string }) => nodueApi.createDue(data),
        onSuccess: () => {
            toast.success('Due added successfully');
            setShowAddDue(false);
            setStudentId('');
            setDueType('COLLEGE_FEE');
            setAmount('');
            setDescription('');
            queryClient.invalidateQueries({ queryKey: ['nodue', 'dues', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['nodue', 'stats'] });
        },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to add due'),
    });

    const handleUpdateStatus = (due: any, status: string) => {
        updateDueMutation.mutate({ id: due.id, data: { status, ...(status === 'COMPLETED' ? { paidAmount: Number(due.fineAmount) } : {}) } });
    };

    const handleAddDue = () => {
        const parsedAmount = Number(amount);
        if (!studentId) {
            toast.error('Select a student');
            return;
        }
        if (!dueType.trim()) {
            toast.error('Enter a due category');
            return;
        }
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
            toast.error('Enter a valid non-negative amount');
            return;
        }
        createDueMutation.mutate({
            studentId: Number(studentId),
            dueType: dueType.trim(),
            fineAmount: parsedAmount,
            description: description.trim() || undefined,
        });
    };

    const students = studentResponse?.users || [];

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
                        <Button onClick={() => setShowAddDue(true)}><Plus className="w-4 h-4 mr-1" /> Add Due</Button>
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
                {showAddDue && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-due-title">
                        <Card className="w-full max-w-lg space-y-4 p-6">
                            <div>
                                <h2 id="add-due-title" className="text-lg font-semibold text-slate-800">Add student due</h2>
                                <p className="mt-1 text-sm text-slate-600">Record an outstanding college due for a student.</p>
                            </div>
                            <label className="block text-sm font-medium text-slate-700" htmlFor="due-student">Student</label>
                            <select id="due-student" value={studentId} onChange={event => setStudentId(event.target.value)} disabled={studentsLoading} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm">
                                <option value="">{studentsLoading ? 'Loading students…' : 'Select a student'}</option>
                                {students.map((student: any) => (
                                    <option key={student.id} value={student.id}>
                                        {student.name} — {student.studentProfile?.rollNumber || student.email}
                                    </option>
                                ))}
                            </select>
                            {!studentsLoading && students.length === 0 && <p className="text-sm text-red-600">No students found in this tenant.</p>}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="due-type">Category</label>
                                    <input id="due-type" value={dueType} onChange={event => setDueType(event.target.value)} maxLength={80} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="due-amount">Amount (₹)</label>
                                    <input id="due-amount" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="due-description">Description (optional)</label>
                                <textarea id="due-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="For example: QA test due; remove after verification" />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowAddDue(false)}>Cancel</Button>
                                <Button onClick={handleAddDue} disabled={createDueMutation.isPending || studentsLoading || students.length === 0}>
                                    {createDueMutation.isPending ? 'Saving…' : 'Add Due'}
                                </Button>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
