'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    FileText,
    ChevronDown,
    AlertCircle,
    Check,
    Edit2,
    Save,
    Send,
    Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface InternalMark {
    id: number;
    studentUsn: string;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
    calculatedTotal: number | null;
    isFinalized: boolean;
}

interface Section {
    id: number;
    name: string;
    program: { name: string };
    batch: { id: number; name: string };
}

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
}

interface Course {
    id: number;
    name: string;
    code: string;
}

export default function InternalMarksPage() {
    const [marks, setMarks] = useState<InternalMark[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<number | undefined>();
    const [selectedSection, setSelectedSection] = useState<number | undefined>();
    const [selectedCourse, setSelectedCourse] = useState<number | undefined>();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editReason, setEditReason] = useState('');
    const [editValues, setEditValues] = useState<Partial<InternalMark>>({});

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        if (selectedSection && selectedCourse) {
            fetchMarks();
        }
    }, [selectedSection, selectedCourse]);

    const fetchFilters = async () => {
        try {
            const [sectionsRes, coursesRes, batchesRes] = await Promise.all([
                api.get('/dept-admin/sections'),
                api.get('/dept-admin/courses'),
                api.get('/batches'),
            ]);
            setSections(sectionsRes.data);
            setCourses(coursesRes.data);
            setBatches(batchesRes.data);
        } catch (err) {
            console.error('Failed to load filters', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMarks = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/dept-admin/internal-marks/${selectedSection}/${selectedCourse}`);
            setMarks(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load marks');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (mark: InternalMark) => {
        setEditingId(mark.id);
        setEditValues({
            internal1: mark.internal1,
            internal2: mark.internal2,
            internal3: mark.internal3,
            assignmentMarks: mark.assignmentMarks,
        });
        setEditReason('');
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editReason.trim()) {
            setError('Edit reason is required');
            return;
        }

        try {
            await api.put(`/dept-admin/internal-marks/${editingId}`, {
                ...editValues,
                reason: editReason,
            });
            setSuccess('Marks updated successfully');
            setEditingId(null);
            setEditReason('');
            fetchMarks();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update marks');
        }
    };

    const handleFinalize = async () => {
        if (!selectedSection || !selectedCourse) return;

        try {
            await api.post('/dept-admin/internal-marks/finalize', {
                sectionId: selectedSection,
                courseId: selectedCourse,
            });
            setSuccess('Marks finalized successfully');
            fetchMarks();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to finalize marks');
        }
    };

    const handleSubmitToCOE = async () => {
        if (!selectedBatch || !selectedCourse) {
            setError('Please select a batch and course');
            return;
        }

        try {
            await api.post('/dept-admin/internal-marks/submit-to-coe', {
                batchId: selectedBatch,
                courseId: selectedCourse,
            });
            setSuccess('Marks submitted to COE successfully');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit to COE');
        }
    };

    const hasUnfinalizedMarks = marks.some(m => !m.isFinalized);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Internal Marks</h1>
                    <p className="text-neutral-500">View, edit, and finalize internal assessment marks</p>
                </div>
                {selectedSection && selectedCourse && (
                    <div className="flex gap-2">
                        {hasUnfinalizedMarks && (
                            <Button onClick={handleFinalize} variant="outline">
                                <Lock className="h-4 w-4 mr-2" />
                                Finalize Marks
                            </Button>
                        )}
                        <Button onClick={handleSubmitToCOE} className="bg-emerald-600 hover:bg-emerald-700">
                            <Send className="h-4 w-4 mr-2" />
                            Submit to COE
                        </Button>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <Check className="h-5 w-5 text-emerald-500" />
                    <span className="text-emerald-700">{success}</span>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-neutral-100">
                {/* Batch Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-neutral-700">Batch:</label>
                    <select
                        value={selectedBatch || ''}
                        onChange={(e) => {
                            setSelectedBatch(e.target.value ? parseInt(e.target.value) : undefined);
                            setSelectedSection(undefined); // Reset section when batch changes
                            setSelectedCourse(undefined);  // Reset course when batch changes
                        }}
                        className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">Select Batch</option>
                        {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                Batch {batch.name} (Sem {batch.currentSemester})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Section Filter - filtered by batch */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-neutral-700">Section:</label>
                    <select
                        value={selectedSection || ''}
                        onChange={(e) => {
                            setSelectedSection(e.target.value ? parseInt(e.target.value) : undefined);
                            setSelectedCourse(undefined); // Reset course when section changes
                        }}
                        disabled={!selectedBatch}
                        className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
                    >
                        <option value="">{selectedBatch ? 'Select Section' : 'Select Batch First'}</option>
                        {sections
                            .filter(s => s.batch?.id === selectedBatch)
                            .map((section) => (
                                <option key={section.id} value={section.id}>
                                    Section {section.name} - {section.program?.name || 'No Program'}
                                </option>
                            ))
                        }
                    </select>
                </div>

                {/* Course Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-neutral-700">Course:</label>
                    <select
                        value={selectedCourse || ''}
                        onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!selectedSection}
                        className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
                    >
                        <option value="">{selectedSection ? 'Select Course' : 'Select Section First'}</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.code} - {course.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Marks Table */}
            {selectedSection && selectedCourse && (
                <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase">USN</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">IA-1</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">IA-2</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">IA-3</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Assignment</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Total (50)</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {marks.map((mark) => (
                                    <tr key={mark.id} className="hover:bg-neutral-50">
                                        <td className="px-6 py-4 font-mono text-sm">{mark.studentUsn}</td>

                                        {editingId === mark.id ? (
                                            <>
                                                <td className="px-6 py-4 text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-16 text-center"
                                                        value={editValues.internal1 ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, internal1: e.target.value ? parseInt(e.target.value) : null })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-16 text-center"
                                                        value={editValues.internal2 ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, internal2: e.target.value ? parseInt(e.target.value) : null })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-16 text-center"
                                                        value={editValues.internal3 ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, internal3: e.target.value ? parseInt(e.target.value) : null })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Input
                                                        type="number"
                                                        className="w-16 text-center"
                                                        value={editValues.assignmentMarks ?? ''}
                                                        onChange={(e) => setEditValues({ ...editValues, assignmentMarks: e.target.value ? parseInt(e.target.value) : null })}
                                                    />
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 text-center">{mark.internal1 ?? '-'}</td>
                                                <td className="px-6 py-4 text-center">{mark.internal2 ?? '-'}</td>
                                                <td className="px-6 py-4 text-center">{mark.internal3 ?? '-'}</td>
                                                <td className="px-6 py-4 text-center">{mark.assignmentMarks ?? '-'}</td>
                                            </>
                                        )}

                                        <td className="px-6 py-4 text-center font-bold text-emerald-600">
                                            {mark.calculatedTotal?.toFixed(1) ?? '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {mark.isFinalized ? (
                                                <Badge className="bg-emerald-100 text-emerald-700">Finalized</Badge>
                                            ) : (
                                                <Badge variant="outline">Pending</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {editingId === mark.id ? (
                                                <div className="flex flex-col gap-2">
                                                    <Input
                                                        placeholder="Edit reason (required)"
                                                        value={editReason}
                                                        onChange={(e) => setEditReason(e.target.value)}
                                                        className="text-xs"
                                                    />
                                                    <div className="flex gap-1">
                                                        <Button size="sm" onClick={handleSaveEdit} className="bg-emerald-600">
                                                            <Save className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                                            ×
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                !mark.isFinalized && (
                                                    <Button size="sm" variant="outline" onClick={() => handleEdit(mark)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {marks.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                            <h3 className="text-lg font-medium text-neutral-900 mb-2">No marks found</h3>
                            <p className="text-neutral-500">Marks haven't been entered for this section/course yet</p>
                        </div>
                    )}
                </div>
            )}

            {!selectedSection || !selectedCourse && (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                    <FileText className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Select Section and Course</h3>
                    <p className="text-neutral-500">Choose a section and course to view internal marks</p>
                </div>
            )}
        </div>
    );
}
