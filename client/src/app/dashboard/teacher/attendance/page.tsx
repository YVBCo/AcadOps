'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    ClipboardCheck, Calendar, CheckCircle, AlertCircle, Users, Loader2,
    BookOpen, Check, X, Clock, AlertTriangle, History, Edit3, Send, Lock, Unlock, LockKeyhole
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Types
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

interface CourseAllocation {
    id: number;
    courseId: number;
    sectionId: number;
    course: { id: number; name: string; code: string };
    section: { id: number; name: string; batch: { name: string }; _count: { students: number } };
}

interface AttendanceEntry {
    usn: string;
    status: AttendanceStatus;
    isSubmitted: boolean;
}

// Status configuration
const STATUS_CONFIG = {
    PRESENT: { label: 'P', fullLabel: 'Present', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: Check },
    ABSENT: { label: 'A', fullLabel: 'Absent', color: 'text-red-700', bg: 'bg-red-100', icon: X },
    LATE: { label: 'L', fullLabel: 'Late', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    EXCUSED: { label: 'E', fullLabel: 'Excused', color: 'text-blue-700', bg: 'bg-blue-100', icon: AlertTriangle },
} as const;

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export default function TeacherAttendancePage() {
    const { user } = useAuthStore();
    const searchParams = useSearchParams();

    // Core state
    const [allocationId, setAllocationId] = useState<number | null>(
        searchParams.get('allocationId') ? parseInt(searchParams.get('allocationId')!) : null
    );
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>({});
    const [viewMode, setViewMode] = useState<'entry' | 'history'>('entry');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // History mode - selected date for viewing past attendance
    const [historyDate, setHistoryDate] = useState<string | null>(null);

    // Edit modal state for locked records
    const [editModal, setEditModal] = useState<{ id: number; name: string; usn: string; date: string; status: string } | null>(null);
    const [editReason, setEditReason] = useState('');
    const [newStatus, setNewStatus] = useState<AttendanceStatus>('PRESENT');

    // Queries
    const { data: allocations = [], isLoading: loadingAllocations } = useQuery({
        queryKey: ['teacher-allocations'],
        queryFn: teacherApi.getMyAllocations,
        enabled: !!user,
    });

    const selectedAllocation = useMemo(() =>
        (allocations as CourseAllocation[]).find(a => a.id === allocationId),
        [allocations, allocationId]
    );

    // Entry mode - fetch students for current date
    const { data: students = [], isLoading: loadingStudents, refetch: refetchStudents } = useQuery({
        queryKey: ['attendance-students', selectedAllocation?.sectionId, selectedAllocation?.courseId, date],
        queryFn: () => teacherApi.getStudentsForAttendance(
            selectedAllocation!.sectionId,
            selectedAllocation!.courseId,
            date
        ),
        enabled: !!selectedAllocation && !!date && viewMode === 'entry',
    });

    // History mode - fetch all attendance history (dates list)
    const { data: historyData, isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['attendance-history', selectedAllocation?.sectionId, selectedAllocation?.courseId],
        queryFn: () => teacherApi.getAttendanceHistory(selectedAllocation!.sectionId, selectedAllocation!.courseId),
        enabled: !!selectedAllocation && viewMode === 'history',
    });

    // History mode - fetch students for selected history date
    const { data: historyStudents = [], isLoading: loadingHistoryStudents, refetch: refetchHistoryStudents } = useQuery({
        queryKey: ['attendance-history-date', selectedAllocation?.sectionId, selectedAllocation?.courseId, historyDate],
        queryFn: () => teacherApi.getStudentsForAttendance(
            selectedAllocation!.sectionId,
            selectedAllocation!.courseId,
            historyDate!
        ),
        enabled: !!selectedAllocation && !!historyDate && viewMode === 'history',
    });

    // Initialize attendance when students load (entry mode)
    useEffect(() => {
        if (Array.isArray(students) && students.length > 0 && viewMode === 'entry') {
            const initial: Record<string, AttendanceEntry> = {};
            (students as any[]).forEach(s => {
                initial[s.usn] = {
                    usn: s.usn,
                    status: s.attendanceStatus || 'PRESENT',
                    isSubmitted: s.isSubmitted || false,
                };
            });
            setAttendance(initial);
        }
    }, [students, viewMode]);

    // Initialize attendance when history students load (history mode)
    useEffect(() => {
        if (Array.isArray(historyStudents) && historyStudents.length > 0 && viewMode === 'history') {
            const initial: Record<string, AttendanceEntry> = {};
            (historyStudents as any[]).forEach(s => {
                initial[s.usn] = {
                    usn: s.usn,
                    status: s.attendanceStatus || 'PRESENT',
                    isSubmitted: s.isSubmitted || false,
                };
            });
            setAttendance(initial);
        }
    }, [historyStudents, viewMode]);

    // Get available dates from history
    const availableDates = useMemo(() => {
        if (!historyData || !(historyData as any).dates) return [];
        return (historyData as any).dates as string[];
    }, [historyData]);

    // Get records for current history date
    const historyRecords = useMemo(() => {
        if (!historyData || !historyDate) return [];
        const data = historyData as { dates: string[]; attendance: Record<string, any[]> };
        return data.attendance[historyDate] || [];
    }, [historyData, historyDate]);

    // Check if history date attendance is locked
    const isHistoryLocked = useMemo(() => {
        return historyRecords.some((r: any) => r.isLocked);
    }, [historyRecords]);

    // Computed values
    const stats = useMemo(() => {
        const entries = Object.values(attendance);
        return {
            total: entries.length,
            present: entries.filter(e => e.status === 'PRESENT').length,
            absent: entries.filter(e => e.status === 'ABSENT').length,
            late: entries.filter(e => e.status === 'LATE').length,
            excused: entries.filter(e => e.status === 'EXCUSED').length,
            allSubmitted: entries.length > 0 && entries.every(e => e.isSubmitted),
            canSubmit: entries.length > 0 && entries.some(e => !e.isSubmitted),
        };
    }, [attendance]);

    // Actions
    const updateStatus = useCallback((usn: string, status: AttendanceStatus) => {
        setAttendance(prev => ({
            ...prev,
            [usn]: { ...prev[usn], status }
        }));
    }, []);

    const markAllAs = useCallback((status: AttendanceStatus) => {
        setAttendance(prev => {
            const updated: Record<string, AttendanceEntry> = {};
            Object.entries(prev).forEach(([usn, entry]) => {
                updated[usn] = entry.isSubmitted ? entry : { ...entry, status };
            });
            return updated;
        });
    }, []);

    const showMessage = useCallback((type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    }, []);

    // Mutations
    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAllocation) throw new Error('No allocation');
            const currentDate = viewMode === 'entry' ? date : historyDate;
            if (!currentDate) throw new Error('No date selected');

            const entries = Object.values(attendance)
                .filter(e => !e.isSubmitted)
                .map(e => ({ studentUsn: e.usn, status: e.status }));
            if (entries.length === 0) {
                // All records already saved — just lock/submit
                return teacherApi.submitAttendance(selectedAllocation.sectionId, selectedAllocation.courseId, currentDate);
            }
            return teacherApi.markAttendance(selectedAllocation.sectionId, selectedAllocation.courseId, currentDate, entries);
        },
        onSuccess: () => {
            showMessage('success', 'Attendance saved!');
            if (viewMode === 'entry') {
                refetchStudents();
            } else {
                refetchHistoryStudents();
                refetchHistory();
            }
        },
        onError: (err: any) => showMessage('error', err.response?.data?.error || err.response?.data?.message || 'Failed to save'),
    });

    // Lock mutation - submits and locks attendance
    const lockMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAllocation) throw new Error('No allocation');
            return teacherApi.submitAttendance(selectedAllocation.sectionId, selectedAllocation.courseId, date);
        },
        onSuccess: () => {
            showMessage('success', 'Attendance submitted & locked!');
            refetchStudents();
        },
        onError: (err: any) => showMessage('error', err.response?.data?.error || err.response?.data?.message || 'Failed to lock'),
    });

    const editRequestMutation = useMutation({
        mutationFn: () => {
            if (!editModal) throw new Error('No edit data');
            return teacherApi.createAttendanceEditRequest(editModal.id, newStatus, editReason);
        },
        onSuccess: () => {
            showMessage('success', 'Edit request submitted! Waiting for admin approval.');
            setEditModal(null);
            setEditReason('');
            refetchHistory();
            refetchHistoryStudents();
        },
        onError: (err: any) => showMessage('error', err.response?.data?.message || 'Failed to submit'),
    });

    // Render helpers
    const StatusButton = ({ status, current, disabled, onClick }: {
        status: AttendanceStatus; current: AttendanceStatus; disabled: boolean; onClick: () => void
    }) => {
        const cfg = STATUS_CONFIG[status];
        const isActive = current === status;
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                    ${isActive ? `${cfg.bg} ${cfg.color}` : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={cfg.fullLabel}
            >
                {cfg.label}
            </button>
        );
    };

    // Reset history date when switching modes or allocation
    useEffect(() => {
        if (viewMode === 'entry') {
            setHistoryDate(null);
        }
    }, [viewMode]);

    useEffect(() => {
        setHistoryDate(null);
    }, [allocationId]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Attendance</h1>
                    <p className="text-sm text-neutral-500">
                        {viewMode === 'entry' ? 'Mark daily attendance' : 'View & edit past attendance'}
                    </p>
                </div>
                <div className="flex gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-neutral-100 rounded-lg p-1">
                        {[{ mode: 'entry', icon: ClipboardCheck, label: 'Entry' }, { mode: 'history', icon: History, label: 'History' }].map(({ mode, icon: Icon, label }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode as 'entry' | 'history')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition
                                    ${viewMode === mode ? 'bg-white shadow text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
                            >
                                <Icon className="h-4 w-4" />{label}
                            </button>
                        ))}
                    </div>
                    {/* Save Button */}
                    {((viewMode === 'entry' && selectedAllocation && stats.canSubmit) ||
                        (viewMode === 'history' && historyDate && !isHistoryLocked && stats.canSubmit)) && (
                            <Button
                                onClick={() => submitMutation.mutate()}
                                disabled={submitMutation.isPending || lockMutation.isPending}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                <span className="ml-1.5">Save</span>
                            </Button>
                        )}
                    {/* Submit & Lock Button - Entry mode only */}
                    {viewMode === 'entry' && selectedAllocation && stats.allSubmitted && !stats.canSubmit && (
                        <Button
                            onClick={() => lockMutation.mutate()}
                            disabled={lockMutation.isPending || submitMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {lockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                            <span className="ml-1.5">Submit & Lock</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {message.text}
                </div>
            )}

            {/* Selection Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="p-3">
                    <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Course & Section</label>
                    <select
                        className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                        value={allocationId ?? ''}
                        onChange={e => setAllocationId(e.target.value ? parseInt(e.target.value) : null)}
                    >
                        <option value="">Select course...</option>
                        {(allocations as CourseAllocation[]).map(a => (
                            <option key={a.id} value={a.id}>
                                {a.course.code} - {a.course.name} | Sec {a.section.name}
                            </option>
                        ))}
                    </select>
                </Card>

                {/* Entry Mode: Date Picker */}
                {viewMode === 'entry' && (
                    <Card className="p-3">
                        <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Date</label>
                        <input
                            type="date"
                            className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                        />
                    </Card>
                )}

                {/* History Mode: Date Selector from available dates */}
                {viewMode === 'history' && selectedAllocation && (
                    <Card className="p-3">
                        <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Select Date to View</label>
                        <select
                            className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                            value={historyDate ?? ''}
                            onChange={e => setHistoryDate(e.target.value || null)}
                        >
                            <option value="">Choose a date...</option>
                            {availableDates.map((d: string) => (
                                <option key={d} value={d}>
                                    {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    </Card>
                )}
            </div>

            {/* Entry Mode Content */}
            {viewMode === 'entry' && selectedAllocation && (
                <>
                    {/* Stats Bar */}
                    <Card className="p-3 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            <div>
                                <p className="font-semibold text-sm">{selectedAllocation.course.code}</p>
                                <p className="text-xs text-neutral-500">Section {selectedAllocation.section.name} • {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-emerald-600 font-semibold">{stats.present} P</span>
                            <span className="text-red-600 font-semibold">{stats.absent} A</span>
                            <span className="text-amber-600 font-semibold">{stats.late} L</span>
                            <span className="text-blue-600 font-semibold">{stats.excused} E</span>
                            {stats.allSubmitted && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Submitted</Badge>}
                        </div>
                    </Card>

                    {/* Quick Actions */}
                    {!stats.allSubmitted && stats.total > 0 && (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => markAllAs('PRESENT')} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                <Check className="h-3.5 w-3.5 mr-1" />All Present
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => markAllAs('ABSENT')} className="text-red-600 border-red-200 hover:bg-red-50">
                                <X className="h-3.5 w-3.5 mr-1" />All Absent
                            </Button>
                        </div>
                    )}

                    {/* Attendance Table */}
                    <Card className="overflow-hidden">
                        {loadingStudents ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                        ) : stats.total === 0 ? (
                            <div className="text-center py-10">
                                <Users className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                                <p className="text-neutral-500 text-sm">No students found</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-50 border-b text-left">
                                    <tr>
                                        <th className="py-2.5 px-3 font-medium text-neutral-600 w-12">#</th>
                                        <th className="py-2.5 px-3 font-medium text-neutral-600">USN</th>
                                        <th className="py-2.5 px-3 font-medium text-neutral-600">Name</th>
                                        <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">P / A / L / E</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {(students as any[]).map((s, i) => {
                                        const entry = attendance[s.usn];
                                        if (!entry) return null;
                                        return (
                                            <tr key={s.usn} className={entry.isSubmitted ? 'bg-neutral-50' : 'hover:bg-neutral-50'}>
                                                <td className="py-2 px-3 text-neutral-400">{i + 1}</td>
                                                <td className="py-2 px-3 font-mono text-xs">{s.usn}</td>
                                                <td className="py-2 px-3">{s.name}</td>
                                                <td className="py-2 px-3">
                                                    <div className="flex justify-center gap-1.5">
                                                        {STATUSES.map(status => (
                                                            <StatusButton
                                                                key={status}
                                                                status={status}
                                                                current={entry.status}
                                                                disabled={entry.isSubmitted}
                                                                onClick={() => updateStatus(s.usn, status)}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </Card>
                </>
            )}

            {/* History Mode Content */}
            {viewMode === 'history' && selectedAllocation && (
                <>
                    {!historyDate ? (
                        /* No date selected - show dates list */
                        <Card className="overflow-hidden">
                            {loadingHistory ? (
                                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                            ) : availableDates.length === 0 ? (
                                <div className="text-center py-10">
                                    <History className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                                    <p className="text-neutral-500 text-sm">No attendance history yet</p>
                                </div>
                            ) : (
                                <div className="p-4">
                                    <p className="text-sm text-neutral-600 mb-3">Select a date to view/edit attendance:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {availableDates.map((d: string) => {
                                            const records = (historyData as any).attendance[d] || [];
                                            const isLocked = records.some((r: any) => r.isLocked);
                                            return (
                                                <button
                                                    key={d}
                                                    onClick={() => setHistoryDate(d)}
                                                    className="p-3 rounded-lg border border-neutral-200 hover:border-blue-300 hover:bg-blue-50 text-left transition"
                                                >
                                                    <p className="font-medium text-sm">{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                                                    <p className="text-xs text-neutral-500">{records.length} students</p>
                                                    <div className="mt-1">
                                                        {isLocked ? (
                                                            <Badge className="bg-neutral-100 text-neutral-600 text-xs"><Lock className="h-3 w-3 mr-0.5" />Locked</Badge>
                                                        ) : (
                                                            <Badge className="bg-emerald-50 text-emerald-600 text-xs"><Unlock className="h-3 w-3 mr-0.5" />Editable</Badge>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Card>
                    ) : (
                        /* Date selected - show attendance for that date */
                        <>
                            {/* Stats Bar for History */}
                            <Card className="p-3 flex items-center justify-between flex-wrap gap-3">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setHistoryDate(null)} className="text-blue-600 hover:text-blue-800">
                                        ← Back
                                    </button>
                                    <div>
                                        <p className="font-semibold text-sm">{selectedAllocation.course.code}</p>
                                        <p className="text-xs text-neutral-500">
                                            {new Date(historyDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-emerald-600 font-semibold">{stats.present} P</span>
                                        <span className="text-red-600 font-semibold">{stats.absent} A</span>
                                    </div>
                                    {isHistoryLocked ? (
                                        <Badge className="bg-amber-100 text-amber-700 text-xs"><Lock className="h-3 w-3 mr-0.5" />Locked - Request Edit</Badge>
                                    ) : (
                                        <Badge className="bg-emerald-100 text-emerald-700 text-xs"><Unlock className="h-3 w-3 mr-0.5" />Editable</Badge>
                                    )}
                                </div>
                            </Card>

                            {/* Attendance Table for History Date */}
                            <Card className="overflow-hidden">
                                {loadingHistoryStudents ? (
                                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                                ) : historyRecords.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Users className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                                        <p className="text-neutral-500 text-sm">No attendance records</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-neutral-50 border-b text-left">
                                            <tr>
                                                <th className="py-2.5 px-3 font-medium text-neutral-600 w-12">#</th>
                                                <th className="py-2.5 px-3 font-medium text-neutral-600">USN</th>
                                                <th className="py-2.5 px-3 font-medium text-neutral-600">Name</th>
                                                <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">
                                                    {isHistoryLocked ? 'Status' : 'P / A / L / E'}
                                                </th>
                                                {isHistoryLocked && <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">Action</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100">
                                            {historyRecords.map((r: any, i: number) => {
                                                const cfg = STATUS_CONFIG[r.status as AttendanceStatus] || STATUS_CONFIG.PRESENT;
                                                const entry = attendance[r.student?.usn];
                                                return (
                                                    <tr key={r.id} className="hover:bg-neutral-50">
                                                        <td className="py-2 px-3 text-neutral-400">{i + 1}</td>
                                                        <td className="py-2 px-3 font-mono text-xs">{r.student?.usn}</td>
                                                        <td className="py-2 px-3">{r.student?.user?.name || 'Unknown'}</td>
                                                        <td className="py-2 px-3">
                                                            {isHistoryLocked ? (
                                                                <div className="flex justify-center">
                                                                    <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>{cfg.fullLabel}</Badge>
                                                                </div>
                                                            ) : entry ? (
                                                                <div className="flex justify-center gap-1.5">
                                                                    {STATUSES.map(status => (
                                                                        <StatusButton
                                                                            key={status}
                                                                            status={status}
                                                                            current={entry.status}
                                                                            disabled={false}
                                                                            onClick={() => updateStatus(r.student?.usn, status)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-center">
                                                                    <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>{cfg.fullLabel}</Badge>
                                                                </div>
                                                            )}
                                                        </td>
                                                        {isHistoryLocked && (
                                                            <td className="py-2 px-3 text-center">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                                                    onClick={() => {
                                                                        setEditModal({
                                                                            id: r.id,
                                                                            name: r.student?.user?.name || 'Unknown',
                                                                            usn: r.student?.usn,
                                                                            date: r.date,
                                                                            status: r.status
                                                                        });
                                                                        setNewStatus(r.status);
                                                                    }}
                                                                >
                                                                    <Edit3 className="h-3 w-3 mr-1" />Request Edit
                                                                </Button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </Card>
                        </>
                    )}
                </>
            )}

            {/* No Selection */}
            {!selectedAllocation && !loadingAllocations && (
                <Card className="text-center py-10">
                    <ClipboardCheck className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                    <p className="font-medium text-neutral-700">Select a Course</p>
                    <p className="text-sm text-neutral-500">Choose a course to {viewMode === 'entry' ? 'mark attendance' : 'view history'}</p>
                </Card>
            )}

            {/* Edit Request Modal */}
            {editModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-sm p-5 bg-white">
                        <h3 className="font-semibold text-lg mb-3">Request Attendance Edit</h3>
                        <div className="mb-3 p-2.5 bg-neutral-50 rounded-lg text-sm">
                            <p className="font-medium">{editModal.name}</p>
                            <p className="text-neutral-500 text-xs font-mono">{editModal.usn}</p>
                            <p className="text-neutral-500 text-xs">{new Date(editModal.date).toLocaleDateString('en-IN')}</p>
                            <Badge className={`mt-1 ${STATUS_CONFIG[editModal.status as AttendanceStatus]?.bg} ${STATUS_CONFIG[editModal.status as AttendanceStatus]?.color} text-xs`}>
                                Current: {STATUS_CONFIG[editModal.status as AttendanceStatus]?.fullLabel}
                            </Badge>
                        </div>
                        <div className="mb-3">
                            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">New Status</label>
                            <div className="flex gap-2">
                                {STATUSES.map(status => {
                                    const cfg = STATUS_CONFIG[status];
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => setNewStatus(status)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition
                                                ${newStatus === status ? `${cfg.bg} ${cfg.color}` : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Reason for Edit *</label>
                            <textarea
                                className="w-full p-2.5 border rounded-lg text-sm resize-none"
                                rows={2}
                                value={editReason}
                                onChange={e => setEditReason(e.target.value)}
                                placeholder="Why is this change needed?"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                            <Button
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => editRequestMutation.mutate()}
                                disabled={!editReason.trim() || editRequestMutation.isPending}
                            >
                                {editRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                <span className="ml-1">Submit</span>
                            </Button>
                        </div>
                        <p className="text-xs text-neutral-500 mt-3 text-center">
                            This request will be sent to your Department Admin for approval.
                        </p>
                    </Card>
                </div>
            )}
        </div>
    );
}
