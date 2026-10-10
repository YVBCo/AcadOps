'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Library, Mail, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { userApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

type Librarian = { id: number; name: string; email: string; isActive: boolean; createdAt: string };

export default function LibrarianManagementPage() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Librarian | null>(null);
    const [form, setForm] = useState({ name: '', email: '' });
    const { data, isLoading } = useQuery({
        queryKey: ['librarians'],
        queryFn: async () => (await userApi.getAll({ role: 'LIBRARIAN' })).users || [],
    });
    const librarians: Librarian[] = data || [];

    const create = useMutation({
        mutationFn: userApi.createLibrarian,
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ['librarians'] });
            setForm({ name: '', email: '' });
            setOpen(false);
            toast.success(result.message || 'Librarian account created; credentials emailed.');
        },
        onError: (error: any) => toast.error(getApiErrorMessage(error, 'Could not create Librarian account')),
    });
    const activation = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => userApi.toggleActivation(id, isActive),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['librarians'] }); toast.success('Librarian status updated'); },
        onError: (error: any) => toast.error(getApiErrorMessage(error, 'Could not update status')),
    });
    const remove = useMutation({
        mutationFn: userApi.delete,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['librarians'] }); setDeleteTarget(null); toast.success('Librarian account deleted'); },
        onError: (error: any) => toast.error(getApiErrorMessage(error, 'Could not delete account')),
    });

    return <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-neutral-900">Librarian Management</h1><p className="mt-1 text-neutral-500">Create library accounts and manage No-Due access.</p></div>
            <Button leftIcon={Plus} onClick={() => setOpen(true)}>Create Librarian</Button>
        </div>
        {isLoading ? <Card className="p-8 text-center text-neutral-500">Loading Librarians…</Card> : librarians.length === 0 ?
            <Card className="p-10 text-center"><Library className="mx-auto mb-3 h-10 w-10 text-neutral-400"/><h2 className="font-semibold">No Librarian accounts yet</h2><p className="my-2 text-sm text-neutral-500">Create an account to assign someone to library clearance reviews.</p><Button className="mt-3" leftIcon={Plus} onClick={() => setOpen(true)}>Create Librarian</Button></Card> :
            <div className="grid gap-4">{librarians.map(person => <Card key={person.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><Library/></div><div><h2 className="font-semibold">{person.name}</h2><p className="flex items-center gap-2 text-sm text-neutral-500"><Mail className="h-4 w-4"/>{person.email}</p><p className="mt-1 text-xs text-neutral-400">Created {new Date(person.createdAt).toLocaleDateString()}</p></div></div>
                <div className="flex items-center gap-3"><Badge variant={person.isActive ? 'success' : 'error'}>{person.isActive ? 'Active' : 'Inactive'}</Badge><Button variant="outline" onClick={() => activation.mutate({ id: person.id, isActive: !person.isActive })} isLoading={activation.isPending} leftIcon={person.isActive ? PowerOff : Power}>{person.isActive ? 'Deactivate' : 'Activate'}</Button><Button variant="ghost" className="text-red-600" leftIcon={Trash2} onClick={() => setDeleteTarget(person)}>Delete</Button></div>
            </Card>)}</div>}
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Account security:</strong> the system generates a secure password and emails it to the Librarian. The Librarian signs in at the institution login and reviews every student clearance routed to Library Review.</Card>
        {open && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}/><Card className="relative w-full max-w-md p-6"><h2 className="mb-5 text-lg font-semibold">Create Librarian Account</h2><form className="space-y-4" onSubmit={e => { e.preventDefault(); create.mutate(form); }}><Input label="Full name" required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><Input label="Email address" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/><p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><Mail className="mr-2 inline h-4 w-4"/>A password is generated and sent to this address.</p><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" isLoading={create.isPending}>Create account</Button></div></form></Card></div>}
        {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)}/><Card className="relative w-full max-w-md p-6"><h2 className="text-lg font-semibold">Delete Librarian account?</h2><p className="my-4 text-sm text-neutral-600">This permanently removes {deleteTarget.name}&apos;s account.</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="bg-red-600 hover:bg-red-700" onClick={() => remove.mutate(deleteTarget.id)} isLoading={remove.isPending}>Delete</Button></div></Card></div>}
    </div>;
}
