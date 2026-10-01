'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    FileText,
    Save,
    Send,
    CheckCircle,
    AlertCircle,
    Calculator,
    Users,
    Loader2,
    BookOpen,
    Edit3,
    X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CourseAllocation {
    id: number;
    courseId: number;
    sectionId: number;
    semesterNumber: number;
    course: { id: number; name: string; code: string; credits: number };
    section: {
        id: number;
        name: string;
        batch: { id: number; name: string; currentSemester: number };
        _count: { students: number };
    };
}

interface Student {
    studentProfileId: number;
    userId: number;
    name: string;
    email: string;
    usn: string;
    batchId: number;
    sectionId: number;
}

interface MarksEntry {
    id?: number; // Database ID for edit requests
    usn: string;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
    calculatedTotal: number | null;
    isFinalized: boolean;
}

interface EditRequestData {
    marksId: number;
    usn: string;
    studentName: string;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
}

export default function TeacherInternalMarksPage() {
    const { user } = useAuthStore();
    const searchParams = useSearchParams();

    // URL params
    const urlAllocationId = searchParams.get('allocationId');

    // State
    const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(
        urlAllocationId ? parseInt(urlAllocationId) : null
    );
    const [marksData, setMarksData] = useState<Record<string, MarksEntry>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Edit request state
    const [editModal, setEditModal] = useState<EditRequestData | null>(null);
    const [editReason, setEditReason] = useState('');
    const [editValues, setEditValues] = useState<{
        internal1: number | null;
        internal2: number | null;
        internal3: number | null;
        assignmentMarks: number | null;
    }>({ internal1: null, internal2: null, internal3: null, assignmentMarks: null });

    // Fetch allocations
    const { data: allocations = [], isLoading: loadingAllocations } = useQuery({
        queryKey: ['teacher-allocations'],
        queryFn: teacherApi.getMyAllocations,
        enabled: !!user,
    });

    // Find selected allocation
    const selectedAllocation = useMemo(() => {
        return (allocations as CourseAllocation[]).find(a => a.id === selectedAllocationId);
    }, [allocations, selectedAllocationId]);

    // Fetch students for selected allocation
    const { data: students = [], isLoading: loadingStudents } = useQuery({
        queryKey: ['teacher-students', selectedAllocationId],
        queryFn: () => teacherApi.getStudentsForAllocation(selectedAllocationId!),
        enabled: !!selectedAllocationId,
    });

    // Fetch existing marks
    const { data: existingMarks = [], isLoading: loadingMarks, refetch: refetchMarks } = useQuery({
        queryKey: ['teacher-marks', selectedAllocation?.sectionId, selectedAllocation?.courseId],
        queryFn: () => teacherApi.getInternalMarks(selectedAllocation!.sectionId, selectedAllocation!.courseId),
        enabled: !!selectedAllocation,
    });

    // Initialize marks data
    useEffect(() => {
        if (students.length > 0) {
            const existingMarksMap = new Map(
                (existingMarks as any[]).map(m => [m.studentUsn, m])
            );

            const initial: Record<string, MarksEntry> = {};
            (students as Student[]).forEach(s => {
                const existing = existingMarksMap.get(s.usn);
                initial[s.usn] = {
                    id: existing?.id,
                    usn: s.usn,
                    internal1: existing?.internal1 ?? null,
                    internal2: existing?.internal2 ?? null,
                    internal3: existing?.internal3 ?? null,
                    assignmentMarks: existing?.assignmentMarks ?? null,
                    calculatedTotal: existing?.calculatedTotal ?? null,
                    isFinalized: existing?.isFinalized ?? false,
                };
            });
            setMarksData(initial);
        }
    }, [students, existingMarks]);

    // Calculate best-of-two + assignment total
    const calculateTotal = (entry: MarksEntry): number | null => {
        const internals = [entry.internal1, entry.internal2, entry.internal3]
            .filter(v => v !== null) as number[];

        if (internals.length < 2) return null;

        internals.sort((a, b) => b - a);
        const bestTwo = internals.slice(0, 2);
        const bestTwoSum = bestTwo.reduce((sum, v) => sum + v, 0);
        const scaledInternals = (bestTwoSum / 60) * 30;
        const scaledAssignment = ((entry.assignmentMarks ?? 0) / 20) * 20;

        return Math.round((scaledInternals + scaledAssignment) * 100) / 100;
    };

    // Update marks
    const handleMarksChange = (usn: string, field: keyof MarksEntry, value: string) => {
        let numValue = value === '' ? null : parseFloat(value);

        // Enforce max limits: IA fields max 30, assignment max 20
        if (numValue !== null) {
            if (numValue < 0) numValue = 0;
            const maxLimit = field === 'assignmentMarks' ? 20 : 30;
            if (numValue > maxLimit) numValue = maxLimit;
        }

        setMarksData(prev => {
            const updated = {
                ...prev,
                [usn]: {
                    ...prev[usn],
                    [field]: numValue,
                }
            };
            updated[usn].calculatedTotal = calculateTotal(updated[usn]);
            return updated;
        });
    };

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAllocation) throw new Error('No allocation selected');

            const entries = Object.values(marksData)
                .filter(m => !m.isFinalized)
                .map(m => ({
                    studentUsn: m.usn,
                    courseId: selectedAllocation.courseId,
                    batchId: selectedAllocation.section.batch.id,
                    sectionId: selectedAllocation.sectionId,
                    internal1: m.internal1,
                    internal2: m.internal2,
                    internal3: m.internal3,
                    assignmentMarks: m.assignmentMarks,
                }));

            return teacherApi.bulkRecordMarks(entries, selectedAllocation.semesterNumber);
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Marks saved successfully!' });
            refetchMarks();
            setTimeout(() => setMessage(null), 3000);
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save marks' });
        }
    });

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAllocation) throw new Error('No allocation selected');
            return teacherApi.submitMarks(selectedAllocation.sectionId, selectedAllocation.courseId);
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Marks submitted and locked!' });
            refetchMarks();
            setTimeout(() => setMessage(null), 3000);
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit marks' });
        }
    });

    // Edit request mutation
    const editRequestMutation = useMutation({
        mutationFn: async () => {
            if (!editModal) throw new Error('No edit data');
            return teacherApi.createMarksEditRequest(editModal.marksId, editValues, editReason);
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Edit request submitted! Waiting for admin approval.' });
            setEditModal(null);
            setEditReason('');
            setEditValues({ internal1: null, internal2: null, internal3: null, assignmentMarks: null });
            setTimeout(() => setMessage(null), 4000);
        },
        onError: (error: any) => {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit edit request' });
        }
    });

    // Open edit modal for a student
    const openEditModal = (student: Student, entry: MarksEntry) => {
        if (!entry.id) return;
        setEditModal({
            marksId: entry.id,
            usn: student.usn,
            studentName: student.name,
            internal1: entry.internal1,
            internal2: entry.internal2,
            internal3: entry.internal3,
            assignmentMarks: entry.assignmentMarks,
        });
        setEditValues({
            internal1: entry.internal1,
            internal2: entry.internal2,
            internal3: entry.internal3,
            assignmentMarks: entry.assignmentMarks,
        });
        setEditReason('');
    };

    const allFinalized = Object.values(marksData).length > 0 && Object.values(marksData).every(m => m.isFinalized);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Internal Marks Entry</h1>
                    <p className="text-neutral-500 mt-1">Enter and submit internal assessment marks</p>
                </div>
                {selectedAllocation && (
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending || submitMutation.isPending || allFinalized}
                            className="bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                        >
                            {saveMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Save Draft
                        </Button>
                        <Button
                            onClick={() => submitMutation.mutate()}
                            disabled={submitMutation.isPending || saveMutation.isPending || allFinalized}
                            className="bg-neutral-900 text-white hover:bg-neutral-800"
                        >
                            {submitMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Submit & Lock
                        </Button>
                    </div>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-5 w-5" />
                    ) : (
                        <AlertCircle className="h-5 w-5" />
                    )}
                    {message.text}
                </div>
            )}

            {/* Course Selection */}
            <Card className="p-4">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Select Course & Section</label>
                <select
                    className="w-full p-3 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                    value={selectedAllocationId ?? ''}
                    onChange={(e) => setSelectedAllocationId(e.target.value ? parseInt(e.target.value) : null)}
                >
                    <option value="">Choose a course...</option>
                    {(allocations as CourseAllocation[]).map((alloc) => (
                        <option key={alloc.id} value={alloc.id}>
                            {alloc.course.code} - {alloc.course.name} | Section {alloc.section.name} | Batch {alloc.section.batch.name}
                        </option>
                    ))}
                </select>
            </Card>

            {/* Selected Course Info */}
            {selectedAllocation && (
                <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-white shadow flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-neutral-900">
                                    {selectedAllocation.course.code} - {selectedAllocation.course.name}
                                </h3>
                                <p className="text-sm text-neutral-600">
                                    Section {selectedAllocation.section.name} • Batch {selectedAllocation.section.batch.name} • Semester {selectedAllocation.semesterNumber}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-neutral-600">
                                <Users className="h-4 w-4" />
                                <span>{students.length} students</span>
                            </div>
                            {allFinalized && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Submitted
                                </Badge>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Legend */}
            {selectedAllocation && (
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <Calculator className="h-4 w-4 text-emerald-600" />
                        <span>Total = Best 2 of 3 internals (scaled to 30) + Assignment (20) = Max 50</span>
                    </div>
                </Card>
            )}

            {/* Marks Table */}
            {selectedAllocation && (
                <Card className="overflow-hidden">
                    {loadingStudents || loadingMarks ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                            <p className="text-neutral-500">No students found in this section</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-neutral-50 border-b border-neutral-200">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">#</th>
                                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">USN</th>
                                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Name</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700">IA-1 (30)</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700">IA-2 (30)</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700">IA-3 (30)</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700">Assignment (20)</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700 bg-emerald-50">Total (50)</th>
                                        <th className="text-center py-3 px-4 font-semibold text-neutral-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {(students as Student[]).map((student, index) => {
                                        const entry = marksData[student.usn] || {
                                            usn: student.usn,
                                            internal1: null,
                                            internal2: null,
                                            internal3: null,
                                            assignmentMarks: null,
                                            calculatedTotal: null,
                                            isFinalized: false,
                                        };

                                        return (
                                            <tr key={student.usn} className={entry.isFinalized ? 'bg-neutral-50' : 'hover:bg-neutral-50'}>
                                                <td className="py-3 px-4 text-neutral-500">{index + 1}</td>
                                                <td className="py-3 px-4 font-mono text-sm">{student.usn}</td>
                                                <td className="py-3 px-4">{student.name}</td>
                                                <td className="py-2 px-4 text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="30"
                                                        className="w-20 text-center mx-auto"
                                                        value={entry.internal1 ?? ''}
                                                        onChange={(e) => handleMarksChange(student.usn, 'internal1', e.target.value)}
                                                        disabled={entry.isFinalized}
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="30"
                                                        className="w-20 text-center mx-auto"
                                                        value={entry.internal2 ?? ''}
                                                        onChange={(e) => handleMarksChange(student.usn, 'internal2', e.target.value)}
                                                        disabled={entry.isFinalized}
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="30"
                                                        className="w-20 text-center mx-auto"
                                                        value={entry.internal3 ?? ''}
                                                        onChange={(e) => handleMarksChange(student.usn, 'internal3', e.target.value)}
                                                        disabled={entry.isFinalized}
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="20"
                                                        className="w-20 text-center mx-auto"
                                                        value={entry.assignmentMarks ?? ''}
                                                        onChange={(e) => handleMarksChange(student.usn, 'assignmentMarks', e.target.value)}
                                                        disabled={entry.isFinalized}
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-center bg-emerald-50 font-bold text-emerald-700">
                                                    {entry.calculatedTotal !== null ? entry.calculatedTotal.toFixed(1) : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {entry.isFinalized ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Locked
                                                            </Badge>
                                                            {entry.id && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                                                    onClick={() => openEditModal(student, entry)}
                                                                >
                                                                    <Edit3 className="h-3 w-3 mr-1" />
                                                                    Request Edit
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                                                            Pending
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* No selection message */}
            {!selectedAllocation && !loadingAllocations && (
                <Card className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Select a Course</h3>
                    <p className="text-neutral-500">Choose a course from the dropdown above to enter internal marks</p>
                </Card>
            )}

            {/* Edit Request Modal */}
            {editModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md p-6 bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-neutral-900">Request Marks Edit</h3>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditModal(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="mb-4 p-3 bg-neutral-50 rounded-lg">
                            <p className="text-sm text-neutral-500">Student</p>
                            <p className="font-medium">{editModal.studentName}</p>
                            <p className="text-sm text-neutral-500 font-mono">{editModal.usn}</p>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-medium text-neutral-700 mb-2">Current → New Values</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-neutral-500">IA1 (0-30)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={editValues.internal1 ?? ''}
                                        onChange={(e) => setEditValues(v => ({ ...v, internal1: e.target.value ? parseFloat(e.target.value) : null }))}
                                        placeholder={String(editModal.internal1 ?? '-')}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-500">IA2 (0-30)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={editValues.internal2 ?? ''}
                                        onChange={(e) => setEditValues(v => ({ ...v, internal2: e.target.value ? parseFloat(e.target.value) : null }))}
                                        placeholder={String(editModal.internal2 ?? '-')}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-500">IA3 (0-30)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={editValues.internal3 ?? ''}
                                        onChange={(e) => setEditValues(v => ({ ...v, internal3: e.target.value ? parseFloat(e.target.value) : null }))}
                                        placeholder={String(editModal.internal3 ?? '-')}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-500">Assignment (0-20)</label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="20"
                                        value={editValues.assignmentMarks ?? ''}
                                        onChange={(e) => setEditValues(v => ({ ...v, assignmentMarks: e.target.value ? parseFloat(e.target.value) : null }))}
                                        placeholder={String(editModal.assignmentMarks ?? '-')}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-medium text-neutral-700 mb-2 block">Reason for Edit *</label>
                            <textarea
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                rows={3}
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                placeholder="Explain why you need to change these marks..."
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setEditModal(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => editRequestMutation.mutate()}
                                disabled={!editReason.trim() || editRequestMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {editRequestMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4 mr-2" />
                                )}
                                Submit Request
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

