'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    ClipboardCheck, Calendar, AlertCircle, Check, Edit2, Lock, Unlock,
    Loader2, Users, X, Clock, AlertTriangle, ChevronLeft, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// Types
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUS_CONFIG = {
    PRESENT: { label: 'P', fullLabel: 'Present', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: Check },
    ABSENT: { label: 'A', fullLabel: 'Absent', color: 'text-red-700', bg: 'bg-red-100', icon: X },
    LATE: { label: 'L', fullLabel: 'Late', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    EXCUSED: { label: 'E', fullLabel: 'Excused', color: 'text-blue-700', bg: 'bg-blue-100', icon: AlertTriangle },
} as const;

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

export default function DeptAdminAttendancePage() {
    const queryClient = useQueryClient();

    // State
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Edit modal state
    const [editModal, setEditModal] = useState<{ id: number; name: string; usn: string; status: string } | null>(null);
    const [editReason, setEditReason] = useState('');
    const [newStatus, setNewStatus] = useState<AttendanceStatus>('PRESENT');

    // Fetch batches
    const { data: batches = [] } = useQuery({
        queryKey: ['batches'],
        queryFn: async () => {
            const res = await api.get('/batches');
            return res.data;
        },
    });

    // Fetch sections for selected batch
    const { data: sections = [] } = useQuery({
        queryKey: ['dept-sections', selectedBatchId],
        queryFn: async () => {
            const res = await api.get('/dept-admin/sections', { params: { batchId: selectedBatchId } });
            return res.data;
        },
        enabled: !!selectedBatchId,
    });

    // Find selected section
    const selectedSection = useMemo(() =>
        (sections as any[]).find(s => s.id === selectedSectionId),
        [sections, selectedSectionId]
    );

    // Get available courses from section allocations
    const availableCourses = useMemo(() => {
        if (!selectedSection?.courseAllocations) return [];
        return selectedSection.courseAllocations.map((a: any) => ({
            id: a.courseId,
            allocationId: a.id,
            name: a.course.name,
            code: a.course.code,
        }));
    }, [selectedSection]);

    // Fetch attendance data
    const { data: attendanceData, isLoading: loadingAttendance, refetch: refetchAttendance } = useQuery({
        queryKey: ['dept-attendance', selectedSectionId, selectedCourseId, selectedDate],
        queryFn: async () => {
            const params = selectedDate ? { date: selectedDate } : {};
            const res = await api.get(`/dept-admin/attendance/${selectedSectionId}/${selectedCourseId}`, { params });
            return res.data;
        },
        enabled: !!selectedSectionId && !!selectedCourseId,
    });

    // Available dates
    const availableDates = useMemo(() => attendanceData?.dates || [], [attendanceData]);

    // Attendance records for current view
    const attendanceRecords = useMemo(() => attendanceData?.attendance || [], [attendanceData]);

    // Check if any record is locked
    const isLocked = useMemo(() =>
        attendanceRecords.some((r: any) => r.isLocked),
        [attendanceRecords]
    );

    // Stats
    const stats = useMemo(() => {
        return {
            total: attendanceRecords.length,
            present: attendanceRecords.filter((r: any) => r.status === 'PRESENT').length,
            absent: attendanceRecords.filter((r: any) => r.status === 'ABSENT').length,
            late: attendanceRecords.filter((r: any) => r.status === 'LATE').length,
            excused: attendanceRecords.filter((r: any) => r.status === 'EXCUSED').length,
        };
    }, [attendanceRecords]);

    const showMessage = useCallback((type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    }, []);

    // Edit mutation
    const editMutation = useMutation({
        mutationFn: async () => {
            if (!editModal || !editReason.trim()) throw new Error('Reason required');
            return api.put(`/dept-admin/attendance/${editModal.id}`, {
                status: newStatus,
                reason: editReason,
            });
        },
        onSuccess: () => {
            showMessage('success', 'Attendance updated successfully!');
            setEditModal(null);
            setEditReason('');
            refetchAttendance();
        },
        onError: (err: any) => {
            showMessage('error', err.response?.data?.error || 'Failed to update');
        },
    });

    // Lock mutation
    const lockMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDate || !selectedCourseId) throw new Error('No date selected');
            // Get the subject ID from first record
            const subjectId = attendanceRecords[0]?.subjectId;
            if (!subjectId) throw new Error('No subject found');
            return api.post('/dept-admin/attendance/lock', { subjectId, date: selectedDate });
        },
        onSuccess: () => {
            showMessage('success', 'Attendance locked!');
            refetchAttendance();
        },
        onError: (err: any) => {
            showMessage('error', err.response?.data?.error || 'Failed to lock');
        },
    });

    // Reset cascading selections
    const handleBatchChange = (batchId: number | null) => {
        setSelectedBatchId(batchId);
        setSelectedSectionId(null);
        setSelectedCourseId(null);
        setSelectedDate(null);
    };

    const handleSectionChange = (sectionId: number | null) => {
        setSelectedSectionId(sectionId);
        setSelectedCourseId(null);
        setSelectedDate(null);
    };

    const handleCourseChange = (courseId: number | null) => {
        setSelectedCourseId(courseId);
        setSelectedDate(null);
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Attendance Oversight</h1>
                <p className="text-neutral-500 text-sm">View, edit and lock attendance records with audit trail</p>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {message.text}
                </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Batch */}
                <Card className="p-3">
                    <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Batch</label>
                    <select
                        className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                        value={selectedBatchId ?? ''}
                        onChange={e => handleBatchChange(e.target.value ? parseInt(e.target.value) : null)}
                    >
                        <option value="">Select batch...</option>
                        {(batches as any[]).map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </Card>

                {/* Section */}
                <Card className="p-3">
                    <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Section</label>
                    <select
                        className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                        value={selectedSectionId ?? ''}
                        onChange={e => handleSectionChange(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={!selectedBatchId}
                    >
                        <option value="">Select section...</option>
                        {(sections as any[]).map(s => (
                            <option key={s.id} value={s.id}>Section {s.name}</option>
                        ))}
                    </select>
                </Card>

                {/* Course */}
                <Card className="p-3">
                    <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Course</label>
                    <select
                        className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                        value={selectedCourseId ?? ''}
                        onChange={e => handleCourseChange(e.target.value ? parseInt(e.target.value) : null)}
                        disabled={!selectedSectionId}
                    >
                        <option value="">Select course...</option>
                        {availableCourses.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                        ))}
                    </select>
                </Card>

                {/* Date */}
                <Card className="p-3">
                    <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Date</label>
                    <select
                        className="w-full p-2.5 border border-neutral-200 rounded-lg bg-white text-sm"
                        value={selectedDate ?? ''}
                        onChange={e => setSelectedDate(e.target.value || null)}
                        disabled={!selectedCourseId || availableDates.length === 0}
                    >
                        <option value="">All dates</option>
                        {availableDates.map((d: string) => (
                            <option key={d} value={d}>
                                {new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </option>
                        ))}
                    </select>
                </Card>
            </div>

            {/* Stats & Actions */}
            {selectedCourseId && attendanceRecords.length > 0 && (
                <Card className="p-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-neutral-500">Total: <strong>{stats.total}</strong></span>
                        <span className="text-emerald-600 font-semibold">{stats.present} P</span>
                        <span className="text-red-600 font-semibold">{stats.absent} A</span>
                        <span className="text-amber-600 font-semibold">{stats.late} L</span>
                        <span className="text-blue-600 font-semibold">{stats.excused} E</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isLocked ? (
                            <Badge className="bg-neutral-100 text-neutral-600"><Lock className="h-3 w-3 mr-1" /> Locked</Badge>
                        ) : selectedDate && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => lockMutation.mutate()}
                                disabled={lockMutation.isPending}
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                            >
                                {lockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                                <span className="ml-1">Lock Date</span>
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            {/* Attendance Table */}
            {selectedCourseId ? (
                <Card className="overflow-hidden">
                    {loadingAttendance ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600# " />
                        </div>
                    ) : attendanceRecords.length === 0 ? (
                        <div className="text-center py-10">
                            <ClipboardCheck className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                            <p className="text-neutral-500 text-sm">No attendance records found</p>
                            <p className="text-neutral-400 text-xs">Teachers need to mark attendance first</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-neutral-50 border-b text-left">
                                <tr>
                                    <th className="py-2.5 px-3 font-medium text-neutral-600 w-12">#</th>
                                    {!selectedDate && <th className="py-2.5 px-3 font-medium text-neutral-600">Date</th>}
                                    <th className="py-2.5 px-3 font-medium text-neutral-600">USN</th>
                                    <th className="py-2.5 px-3 font-medium text-neutral-600">Name</th>
                                    <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">Status</th>
                                    <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">Locked</th>
                                    <th className="py-2.5 px-3 font-medium text-neutral-600 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {attendanceRecords.map((r: any, i: number) => {
                                    const cfg = STATUS_CONFIG[r.status as AttendanceStatus] || STATUS_CONFIG.PRESENT;
                                    return (
                                        <tr key={r.id} className="hover:bg-neutral-50">
                                            <td className="py-2 px-3 text-neutral-400">{i + 1}</td>
                                            {!selectedDate && (
                                                <td className="py-2 px-3 text-xs">
                                                    {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                </td>
                                            )}
                                            <td className="py-2 px-3 font-mono text-xs">{r.student?.usn}</td>
                                            <td className="py-2 px-3">{r.student?.user?.name || 'Unknown'}</td>
                                            <td className="py-2 px-3 text-center">
                                                <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>{cfg.fullLabel}</Badge>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                {r.isLocked ? (
                                                    <Lock className="h-4 w-4 text-neutral-400 mx-auto" />
                                                ) : (
                                                    <Unlock className="h-4 w-4 text-emerald-500 mx-auto" />
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setEditModal({
                                                            id: r.id,
                                                            name: r.student?.user?.name || 'Unknown',
                                                            usn: r.student?.usn || '',
                                                            status: r.status,
                                                        });
                                                        setNewStatus(r.status);
                                                    }}
                                                >
                                                    <Edit2 className="h-3 w-3 mr-1" />Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </Card>
            ) : (
                <Card className="text-center py-10">
                    <ClipboardCheck className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
                    <p className="font-medium text-neutral-700">Select Filters</p>
                    <p className="text-sm text-neutral-500">Choose batch, section and course to view attendance</p>
                </Card>
            )}

            {/* Edit Modal */}
            {editModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-sm p-5 bg-white">
                        <h3 className="font-semibold text-lg mb-3">Edit Attendance</h3>
                        <div className="mb-3 p-2.5 bg-neutral-50 rounded-lg text-sm">
                            <p className="font-medium">{editModal.name}</p>
                            <p className="text-neutral-500 text-xs font-mono">{editModal.usn}</p>
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
                                placeholder="e.g., Medical certificate provided"
                            />
                            <p className="text-xs text-neutral-400 mt-1">This will be logged for audit purposes</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setEditModal(null); setEditReason(''); }}>
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => editMutation.mutate()}
                                disabled={!editReason.trim() || editMutation.isPending}
                            >
                                {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                <span className="ml-1">Save</span>
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
