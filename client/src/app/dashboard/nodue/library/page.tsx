'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi, userApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle2, Library, Plus, Search } from 'lucide-react';

type QueueItem = {
    id: number;
    studentId: number;
    student: { name: string; studentProfile?: { rollNumber?: string } };
    libraryRecord: { id: number; hasDues: boolean; fineAmount: number | string; status: string; remarks?: string | null } | null;
};

export default function LibraryNoDuePage() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [showDueForm, setShowDueForm] = useState(false);
    const [dueForm, setDueForm] = useState({ studentId: '', fineAmount: '', remarks: '' });
    const { data: queue = [], isLoading } = useQuery<QueueItem[]>({
        queryKey: ['nodue', 'library', 'queue'],
        queryFn: nodueApi.getLibraryQueue,
    });
    const { data: libraryDues = [] } = useQuery({
        queryKey: ['nodue', 'dues', 'library'],
        queryFn: nodueApi.getLibraryDues,
    });
    const { data: studentData } = useQuery({
        queryKey: ['library-student-options'],
        queryFn: () => userApi.getAll({ role: 'STUDENT', take: 200 }),
        enabled: showDueForm,
    });
    const students = studentData?.users || [];
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['nodue', 'library', 'queue'] });
        queryClient.invalidateQueries({ queryKey: ['nodue', 'dues', 'library'] });
    };
    const approve = useMutation({
        mutationFn: nodueApi.approveLibraryClearance,
        onSuccess: () => { toast.success('Library clearance approved'); refresh(); },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Could not approve library clearance'),
    });
    const updateDue = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => nodueApi.updateLibraryDue(id, data),
        onSuccess: () => { toast.success('Library due updated'); refresh(); },
        onError: () => toast.error('Failed to update library due'),
    });
    const createDue = useMutation({
        mutationFn: nodueApi.createLibraryDue,
        onSuccess: () => { toast.success('Library due recorded'); setShowDueForm(false); setDueForm({ studentId: '', fineAmount: '', remarks: '' }); refresh(); },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to record library due'),
    });
    const filteredQueue = useMemo(() => queue.filter(item =>
        item.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.student?.studentProfile?.rollNumber?.toLowerCase().includes(search.toLowerCase())
    ), [queue, search]);

    return <DashboardShell allowedRoles={['LIBRARIAN', 'SUPER_ADMIN']} portalName="No-Due Portal" basePath="/dashboard/nodue">
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800"><Library className="h-6 w-6 text-amber-600"/>Library Clearance</h1><p className="mt-1 text-sm text-slate-500">Review every student routed here after all assigned teachers clear their subjects.</p></div>
                <div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input aria-label="Search library queue" placeholder="Search name or roll number" value={search} onChange={e => setSearch(e.target.value)} className="w-64 rounded-lg border py-2 pl-9 pr-3 text-sm"/></div><Button onClick={() => setShowDueForm(value => !value)}><Plus className="mr-1 h-4 w-4"/>Record Library Due</Button></div>
            </div>
            {showDueForm && <Card className="p-5"><h2 className="mb-4 font-semibold">Record an outstanding library balance</h2><form className="grid gap-3 md:grid-cols-4" onSubmit={e => { e.preventDefault(); createDue.mutate({ studentId: Number(dueForm.studentId), fineAmount: Number(dueForm.fineAmount), remarks: dueForm.remarks || undefined }); }}>
                <label className="text-sm">Student<select required value={dueForm.studentId} onChange={e => setDueForm({ ...dueForm, studentId: e.target.value })} className="mt-1 w-full rounded-lg border bg-white p-2"><option value="">Choose student</option>{students.map((student: any) => <option key={student.id} value={student.id}>{student.name}{student.studentProfile?.rollNumber ? ` · ${student.studentProfile.rollNumber}` : ''}</option>)}</select></label>
                <label className="text-sm">Fine amount (₹)<input type="number" min="0" step="0.01" required value={dueForm.fineAmount} onChange={e => setDueForm({ ...dueForm, fineAmount: e.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
                <label className="text-sm">Details<input maxLength={500} value={dueForm.remarks} onChange={e => setDueForm({ ...dueForm, remarks: e.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="Unreturned book, damage, etc."/></label>
                <div className="flex items-end gap-2"><Button type="submit" isLoading={createDue.isPending}>Save due</Button><Button type="button" variant="ghost" onClick={() => setShowDueForm(false)}>Cancel</Button></div>
            </form></Card>}

            <Card className="overflow-hidden"><div className="border-b bg-slate-50 p-4"><h2 className="font-semibold">Awaiting Library Review <Badge variant="neutral" className="ml-2">{filteredQueue.length}</Badge></h2><p className="mt-1 text-xs text-slate-500">Each student needs an explicit Librarian approval. An unresolved library balance blocks approval.</p></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-4">Student</th><th className="p-4">Roll number</th><th className="p-4">Library account</th><th className="p-4">Balance</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y">
                {isLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading requests…</td></tr> : filteredQueue.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No students are currently awaiting library review.</td></tr> : filteredQueue.map(item => {
                    const record = item.libraryRecord;
                    const hasUnresolvedDue = !!record?.hasDues && record.status !== 'COMPLETED';
                    const approved = record?.status === 'COMPLETED' && record?.remarks === 'Library clearance approved';
                    return <tr key={item.id}><td className="p-4 font-medium">{item.student?.name}</td><td className="p-4 text-sm text-slate-600">{item.student?.studentProfile?.rollNumber || '—'}</td><td className="p-4"><Badge variant={hasUnresolvedDue ? 'error' : approved ? 'success' : 'neutral'}>{hasUnresolvedDue ? 'Outstanding due' : approved ? 'Approved' : record?.status === 'COMPLETED' ? 'Balance settled' : 'No due recorded'}</Badge>{record?.remarks && !approved && <p className="mt-1 text-xs text-slate-500">{record.remarks}</p>}</td><td className="p-4 text-sm">{hasUnresolvedDue ? `₹${record?.fineAmount}` : '₹0'}</td><td className="p-4">{hasUnresolvedDue ? <Button size="sm" variant="outline" className="text-green-700" onClick={() => updateDue.mutate({ id: record!.id, data: { status: 'COMPLETED', paidAmount: Number(record!.fineAmount) } })}>Mark balance settled</Button> : approved ? <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4"/>Approved</span> : <Button size="sm" onClick={() => approve.mutate(item.studentId)} isLoading={approve.isPending}>Approve library clearance</Button>}</td></tr>;
                })}
            </tbody></table></div></Card>

            <Card className="overflow-hidden"><div className="border-b bg-slate-50 p-4"><h2 className="font-semibold">Library Due Records</h2></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-4">Student</th><th className="p-4">Roll number</th><th className="p-4">Details</th><th className="p-4">Fine</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y">{libraryDues.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-sm text-slate-500">No due records yet.</td></tr> : libraryDues.map((record: any) => <tr key={record.id}><td className="p-4">{record.student?.name}</td><td className="p-4 text-sm">{record.student?.studentProfile?.rollNumber || '—'}</td><td className="p-4 text-sm">{record.remarks || 'Library due'}</td><td className="p-4">₹{record.fineAmount}</td><td className="p-4"><Badge variant={!record.hasDues ? 'success' : 'error'}>{!record.hasDues ? 'Cleared' : 'Unresolved'}</Badge></td></tr>)}</tbody></table></div></Card>
        </div>
    </DashboardShell>;
}
