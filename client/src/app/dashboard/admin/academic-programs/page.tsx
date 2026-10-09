'use client';

import { useState } from 'react';
import { type AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { departmentApi, programApi } from '@/lib/api';

interface Department { id: number; name: string; code: string }
interface Program {
    id: number;
    name: string;
    code: string;
    durationYears: number;
    departments?: Department[];
    _count?: { courses: number; students: number };
}

export default function AcademicProgramsPage() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', departmentId: '', durationYears: '4' });
    const { data: programs = [], isLoading } = useQuery<Program[]>({
        queryKey: ['programs'], queryFn: () => programApi.getAll(),
    });
    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'], queryFn: departmentApi.getAll,
    });
    const createProgram = useMutation({
        mutationFn: () => programApi.create({
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            departmentIds: [Number(form.departmentId)],
            durationYears: Number(form.durationYears),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['programs'] });
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            setForm({ name: '', code: '', departmentId: '', durationYears: '4' });
            setOpen(false);
            toast.success('Academic program created');
        },
        onError: (error: unknown) => {
            const message = (error as AxiosError<{ error?: string }>)?.response?.data?.error;
            toast.error(message || 'Could not create the program');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Academic Programs</h1>
                    <p className="mt-1 text-neutral-500">Create a degree program and link it to its department. Programs enable section and teacher allocation.</p>
                </div>
                <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Program</Button>
            </div>

            {open && (
                <Card className="max-w-2xl border-primary-200">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Create Academic Program</h2>
                        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-2 hover:bg-neutral-100"><X className="h-4 w-4" /></button>
                    </div>
                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); createProgram.mutate(); }}>
                        <Input label="Program Name" placeholder="e.g. Bachelor of Engineering" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={1} maxLength={200} />
                        <Input label="Program Code" placeholder="e.g. BE-CSE" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required minLength={1} maxLength={20} />
                        <div>
                            <label className="label" htmlFor="program-department">Department</label>
                            <select id="program-department" className="input" value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} required>
                                <option value="">Select department</option>
                                {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>)}
                            </select>
                        </div>
                        <Input label="Duration (years)" type="number" min={1} max={8} value={form.durationYears} onChange={e => setForm({ ...form, durationYears: e.target.value })} required />
                        <div className="flex justify-end gap-3 sm:col-span-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" isLoading={createProgram.isPending} disabled={!departments.length}>Create Program</Button>
                        </div>
                    </form>
                    {!departments.length && <p className="mt-3 text-sm text-amber-700">Create a department before adding a program.</p>}
                </Card>
            )}

            <Card className="overflow-hidden p-0">
                {isLoading ? <p className="p-6 text-neutral-500">Loading programs…</p> : programs.length === 0 ? (
                    <div className="py-14 text-center">
                        <BookOpen className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
                        <h2 className="font-semibold text-neutral-900">No academic programs yet</h2>
                        <p className="mt-1 text-sm text-neutral-500">Add a program before assigning programs to batches or allocating teachers.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500"><tr><th className="px-5 py-3">Program</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Courses / Students</th></tr></thead>
                            <tbody className="divide-y divide-neutral-100">{programs.map(program => <tr key={program.id}>
                                <td className="px-5 py-4 font-medium text-neutral-900">{program.name}</td>
                                <td className="px-5 py-4">{program.code}</td>
                                <td className="px-5 py-4">{program.departments?.map(dept => dept.name).join(', ') || 'No department linked'}</td>
                                <td className="px-5 py-4">{program.durationYears} years</td>
                                <td className="px-5 py-4">{program._count?.courses ?? 0} / {program._count?.students ?? 0}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
