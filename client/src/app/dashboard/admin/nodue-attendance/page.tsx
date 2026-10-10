'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AlertTriangle, BookOpen, Plus, Trash2 } from 'lucide-react';

type Subject = { id: number; section: string | null; noDueMinimumAttendancePct: number | string; course: { name: string; code: string; department: { id: number; name: string; code: string } }; semester: { name: string; status: string } };
type Category = { id: number; categoryName: string; departmentId?: number | null; department?: { name: string } | null; minPct: number | string; maxPct: number | string; fineAmount: number | string; isFirstYear: boolean };

export default function NoDueAttendanceSettingsPage() {
    const cache = useQueryClient();
    const [search, setSearch] = useState('');
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [form, setForm] = useState({ categoryName: '', minPct: '', maxPct: '', fineAmount: '', departmentId: '', isFirstYear: false });
    const subjectsQuery = useQuery<Subject[]>({ queryKey: ['nodue', 'attendance-subjects'], queryFn: nodueApi.getAttendanceSubjects });
    const categoriesQuery = useQuery<Category[]>({ queryKey: ['nodue', 'attendance-categories'], queryFn: nodueApi.getCategories });
    const subjects = subjectsQuery.data || [];
    const categories = categoriesQuery.data || [];
    const departments = Array.from(new Map(subjects.map(subject => [subject.course.department.id, subject.course.department])).values());
    const saveMinimum = useMutation({
        mutationFn: ({ id, value }: { id: number; value: number }) => nodueApi.updateSubjectAttendanceMinimum(id, value),
        onSuccess: (_, vars) => { toast.success('Subject minimum attendance saved'); setDrafts(current => { const next = { ...current }; delete next[vars.id]; return next; }); cache.invalidateQueries({ queryKey: ['nodue', 'attendance-subjects'] }); },
        onError: () => toast.error('Could not save the minimum attendance'),
    });
    const addCategory = useMutation({
        mutationFn: nodueApi.createCategory,
        onSuccess: () => { toast.success('Fine category added'); setForm({ categoryName: '', minPct: '', maxPct: '', fineAmount: '', departmentId: '', isFirstYear: false }); cache.invalidateQueries({ queryKey: ['nodue', 'attendance-categories'] }); },
        onError: (error: any) => toast.error(error.response?.data?.error || 'Could not add fine category'),
    });
    const deleteCategory = useMutation({
        mutationFn: nodueApi.deleteCategory,
        onSuccess: () => { toast.success('Fine category removed'); cache.invalidateQueries({ queryKey: ['nodue', 'attendance-categories'] }); },
        onError: () => toast.error('Could not remove fine category'),
    });
    const filtered = subjects.filter(s => `${s.course.name} ${s.course.code} ${s.course.department.name} ${s.section || ''} ${s.semester.name}`.toLowerCase().includes(search.toLowerCase()));

    return <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-slate-900">No-Due Attendance Rules</h1><p className="mt-1 text-slate-600">Set each subject’s required attendance and configure the shared fine bands used when attendance falls below that minimum.</p></div>
        <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">Subject minimum attendance</h2><p className="text-sm text-slate-500">A teacher submission updates the student’s cumulative percentage for that subject. At or above the minimum, it is automatically cleared.</p></div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subjects" className="rounded-lg border px-3 py-2 text-sm"/></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Subject / Course</th><th className="p-3">Department</th><th className="p-3">Term / Section</th><th className="p-3">Minimum %</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{subjectsQuery.isLoading ? <tr><td colSpan={5} className="p-8 text-center">Loading subjects…</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No subjects found. Create courses, sections and a semester first.</td></tr> : filtered.map(subject => <tr key={subject.id}><td className="p-3"><div className="flex items-center gap-2 font-medium"><BookOpen className="h-4 w-4 text-indigo-500"/>{subject.course.name}</div><div className="pl-6 text-xs text-slate-500">{subject.course.code}</div></td><td className="p-3 text-sm">{subject.course.department.name}</td><td className="p-3 text-sm">{subject.semester.name} · {subject.section || 'All sections'}</td><td className="p-3"><div className="flex items-center gap-1"><input type="number" min="0" max="100" step="0.01" aria-label={`Minimum attendance for ${subject.course.name}`} value={drafts[subject.id] ?? String(subject.noDueMinimumAttendancePct)} onChange={e => setDrafts(current => ({ ...current, [subject.id]: e.target.value }))} className="w-24 rounded-md border px-2 py-1.5"/><span>%</span></div></td><td className="p-3"><Button size="sm" variant="outline" disabled={drafts[subject.id] === undefined || !Number.isFinite(Number(drafts[subject.id])) || Number(drafts[subject.id]) < 0 || Number(drafts[subject.id]) > 100} isLoading={saveMinimum.isPending} onClick={() => saveMinimum.mutate({ id: subject.id, value: Number(drafts[subject.id]) })}>Save</Button></td></tr>)}</tbody></table></div></Card>

        <Card className="p-5"><h2 className="font-semibold">Fine bands for low attendance</h2><p className="mb-4 mt-1 text-sm text-slate-500">Fine bands apply to every subject, unless scoped to a department. Lower bounds are inclusive; upper bounds are exclusive, except that 100% is included.</p><form className="grid gap-3 md:grid-cols-6" onSubmit={e => { e.preventDefault(); addCategory.mutate({ categoryName: form.categoryName, minPct: Number(form.minPct), maxPct: Number(form.maxPct), fineAmount: Number(form.fineAmount), departmentId: form.departmentId ? Number(form.departmentId) : undefined, isFirstYear: form.isFirstYear }); }}>
            <label className="text-sm">Category name<input required maxLength={80} value={form.categoryName} onChange={e => setForm({ ...form, categoryName: e.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="Below minimum"/></label>
            <label className="text-sm">From %<input type="number" min="0" max="100" step="0.01" required value={form.minPct} onChange={e => setForm({ ...form, minPct: e.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
            <label className="text-sm">To %<input type="number" min="0" max="100" step="0.01" required value={form.maxPct} onChange={e => setForm({ ...form, maxPct: e.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
            <label className="text-sm">Fine (₹)<input type="number" min="0" step="0.01" required value={form.fineAmount} onChange={e => setForm({ ...form, fineAmount: e.target.value })} className="mt-1 w-full rounded-lg border p-2"/></label>
            <label className="text-sm">Applies to<select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="mt-1 w-full rounded-lg border bg-white p-2"><option value="">All departments</option>{departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
            <div className="flex flex-col justify-between gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFirstYear} onChange={e => setForm({ ...form, isFirstYear: e.target.checked })}/> First year only</label><Button type="submit" leftIcon={Plus} isLoading={addCategory.isPending}>Add band</Button></div>
        </form>
        <div className="mt-5 overflow-x-auto"><table className="w-full"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-3">Band</th><th className="p-3">Attendance range</th><th className="p-3">Fine</th><th className="p-3">Scope</th><th className="p-3">Year</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{categoriesQuery.isLoading ? <tr><td colSpan={6} className="p-5 text-center">Loading fine bands…</td></tr> : categories.length === 0 ? <tr><td colSpan={6} className="p-5 text-center text-sm text-slate-500">No fine bands configured. Under-minimum attendance will be recorded for review without a fine amount.</td></tr> : categories.map(category => <tr key={category.id}><td className="p-3 font-medium">{category.categoryName}</td><td className="p-3">{category.minPct}%–{category.maxPct}%</td><td className="p-3">₹{category.fineAmount}</td><td className="p-3"><Badge variant="neutral">{category.department?.name || 'All departments'}</Badge></td><td className="p-3">{category.isFirstYear ? 'First year' : 'All years'}</td><td className="p-3"><Button aria-label={`Delete ${category.categoryName}`} size="sm" variant="ghost" className="text-red-600" leftIcon={Trash2} onClick={() => deleteCategory.mutate(category.id)}>Remove</Button></td></tr>)}</tbody></table></div>
        </Card>
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="h-5 w-5 shrink-0"/><p><strong>Attendance rule:</strong> “Present” and “Late” count as attended; “Absent” counts against the percentage; “Excused” is excluded from the denominator. Under-minimum attendance creates a pending subject clearance and applies the matching fine band. Paying a fine does not raise the attendance percentage.</p></div>
    </div>;
}
