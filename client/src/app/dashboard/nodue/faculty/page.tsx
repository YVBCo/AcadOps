'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardShell from '@/components/layout/DashboardShell';
import { nodueApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

export default function FacultyNoDuePage() {
    const [search, setSearch] = useState('');
    const { data: enrollments = [], isLoading } = useQuery({
        queryKey: ['nodue', 'enrollments', 'mystudents'],
        queryFn: nodueApi.getMyStudents,
    });
    const filtered = enrollments.filter((record: any) =>
        record.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        record.student?.studentProfile?.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        record.subject?.course?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return <DashboardShell allowedRoles={['TEACHER', 'SUPER_ADMIN']} portalName="No-Due Portal" basePath="/dashboard/nodue">
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800">Attendance Clearance Status</h1><p className="mt-1 text-sm text-slate-500">Finalized attendance updates each subject automatically. No separate teacher approval is needed.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students or subjects" className="rounded-lg border py-2 pl-9 pr-3 text-sm"/></div></div>
            <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-4">Student</th><th className="p-4">Roll number</th><th className="p-4">Subject</th><th className="p-4">Attendance</th><th className="p-4">Minimum</th><th className="p-4">Fine</th><th className="p-4">No-Due subject state</th></tr></thead><tbody className="divide-y">{isLoading ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading subject assessments…</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No subject assessments found. Attendance is added here after a teacher submits a class record.</td></tr> : filtered.map((record: any) => {
                const completed = record.isFacultyCleared || record.status === 'COMPLETED';
                return <tr key={record.id}><td className="p-4 font-medium">{record.student?.name}</td><td className="p-4 text-sm">{record.student?.studentProfile?.rollNumber || '—'}</td><td className="p-4 text-sm">{record.subject?.course?.name} ({record.subject?.course?.code})</td><td className="p-4">{record.attendancePct == null ? 'Awaiting attendance' : `${record.attendancePct}%`}</td><td className="p-4">{record.subject?.noDueMinimumAttendancePct}%</td><td className="p-4">{Number(record.attendanceFee) > 0 ? `₹${record.attendanceFee}${record.attendanceFeeVerified ? ' · paid' : ' · due'}` : '—'}</td><td className="p-4"><Badge variant={completed ? 'success' : record.attendancePct == null ? 'neutral' : 'warning'}>{completed ? 'Automatically cleared' : record.attendancePct == null ? 'Awaiting submission' : 'Below minimum'}</Badge>{!completed && record.remarks && <p className="mt-1 max-w-xs text-xs text-slate-500">{record.remarks}</p>}</td></tr>;
            })}</tbody></table></div></Card>
        </div>
    </DashboardShell>;
}
