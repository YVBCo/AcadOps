'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    BookOpen,
    Users,
    AlertCircle,
    Check,
    X,
    UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// API returns User objects with teacherProfile nested
interface Teacher {
    id: number;
    name: string;
    email: string;
    teacherProfile?: {
        id: number;
        employeeId: string;
        designation: string | null;
    };
}

interface CourseAllocation {
    id: number;
    semesterNumber: number;
    course: {
        id: number;
        name: string;
        code: string;
    };
    section: {
        id: number;
        name: string;
        batch?: { name: string };
    };
    teacher: {
        id: number;
        user: { name: string };
    } | null;
}

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
}

interface Section {
    id: number;
    name: string;
    program: { name: string };
    batch: { id: number; name: string };
}

export default function AllocationsPage() {
    const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Filters
    const [selectedBatch, setSelectedBatch] = useState<number | undefined>();
    const [selectedSection, setSelectedSection] = useState<number | undefined>();

    // Assignment modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState<CourseAllocation | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<number>(0);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedSection) {
            fetchAllocations();
        }
    }, [selectedSection]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [teachersRes, batchesRes, sectionsRes] = await Promise.all([
                api.get('/dept-admin/teachers'),
                api.get('/batches'),
                api.get('/dept-admin/sections'),
            ]);
            setTeachers(teachersRes.data);
            setBatches(batchesRes.data);
            setSections(sectionsRes.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllocations = async () => {
        if (!selectedSection) return;

        try {
            setLoading(true);
            const res = await api.get(`/dept-admin/sections/${selectedSection}/allocations`);
            setAllocations(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load allocations');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTeacher = async () => {
        if (!selectedAllocation || !selectedTeacher) {
            setError('Please select a teacher');
            return;
        }

        try {
            setAssigning(true);
            await api.post(`/dept-admin/allocations/${selectedAllocation.id}/assign-teacher`, {
                teacherId: selectedTeacher,
            });
            setSuccess(`Teacher assigned successfully to ${selectedAllocation.course.name}`);
            setShowAssignModal(false);
            setSelectedAllocation(null);
            setSelectedTeacher(0);
            fetchAllocations();

            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to assign teacher');
        } finally {
            setAssigning(false);
        }
    };

    const openAssignModal = (allocation: CourseAllocation) => {
        setSelectedAllocation(allocation);
        setSelectedTeacher(allocation.teacher?.id || 0);
        setShowAssignModal(true);
    };

    const filteredSections = selectedBatch
        ? sections.filter(s => s.batch?.id === selectedBatch)
        : sections;

    if (loading && allocations.length === 0 && batches.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Course Allocations</h1>
                    <p className="text-neutral-500">
                        View course allocations and assign teachers to courses
                    </p>
                </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-4">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="h-4 w-4 text-red-500" />
                    </button>
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
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
                            setSelectedSection(undefined);
                            setAllocations([]);
                        }}
                        className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="">Select Batch</option>
                        {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                Batch {batch.name} (Sem {batch.currentSemester})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Section Filter */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-neutral-700">Section:</label>
                    <select
                        value={selectedSection || ''}
                        onChange={(e) => setSelectedSection(e.target.value ? parseInt(e.target.value) : undefined)}
                        disabled={!selectedBatch}
                        className="appearance-none bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                        <option value="">{selectedBatch ? 'Select Section' : 'Select Batch First'}</option>
                        {filteredSections.map((section) => (
                            <option key={section.id} value={section.id}>
                                Section {section.name} - {section.program?.name || 'No Program'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Allocations Table */}
            {selectedSection && (
                <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                    <div className="p-4 border-b border-neutral-100">
                        <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-emerald-600" />
                            Allocated Courses
                        </h3>
                    </div>

                    {allocations.length === 0 ? (
                        <div className="text-center py-12">
                            <BookOpen className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                            <h3 className="text-lg font-medium text-neutral-900 mb-2">No courses allocated</h3>
                            <p className="text-neutral-500">
                                No courses have been allocated to this section yet.
                                <br />
                                Go to Courses page to allocate courses.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-neutral-50 border-b border-neutral-100">
                                        <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-600">Course</th>
                                        <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-600">Code</th>
                                        <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-600">Semester</th>
                                        <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-600">Teacher</th>
                                        <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations.map((allocation) => (
                                        <tr key={allocation.id} className="border-b border-neutral-50 hover:bg-neutral-50">
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-neutral-900">{allocation.course.name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline">{allocation.course.code}</Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-neutral-600">Semester {allocation.semesterNumber}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {allocation.teacher ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                            <span className="text-emerald-700 font-medium text-sm">
                                                                {allocation.teacher.user.name.charAt(0)}
                                                            </span>
                                                        </div>
                                                        <span className="text-neutral-900">{allocation.teacher.user.name}</span>
                                                    </div>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-700">Not Assigned</Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Button
                                                    size="sm"
                                                    onClick={() => openAssignModal(allocation)}
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    <UserPlus className="h-4 w-4 mr-1" />
                                                    {allocation.teacher ? 'Change' : 'Assign'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!selectedSection && (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                    <Users className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">Select a Section</h3>
                    <p className="text-neutral-500">
                        Choose a batch and section to view course allocations and assign teachers
                    </p>
                </div>
            )}

            {/* Assign Teacher Modal */}
            {showAssignModal && selectedAllocation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-neutral-900 mb-2">Assign Teacher</h2>
                        <p className="text-neutral-500 mb-4">
                            Assign a teacher to <strong>{selectedAllocation.course.name}</strong> for <strong>Section {sections.find(s => s.id === selectedSection)?.name}</strong>
                        </p>

                        <div className="space-y-4">
                            {/* Course Info */}
                            <div className="bg-neutral-50 rounded-lg p-3">
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <p className="text-neutral-500">Course</p>
                                        <p className="font-medium text-neutral-900">{selectedAllocation.course.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Code</p>
                                        <p className="font-medium text-neutral-900">{selectedAllocation.course.code}</p>
                                    </div>
                                    <div>
                                        <p className="text-neutral-500">Section</p>
                                        <p className="font-medium text-neutral-900">Section {sections.find(s => s.id === selectedSection)?.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Teacher Selection */}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Select Teacher *
                                </label>
                                <select
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(parseInt(e.target.value))}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                                >
                                    <option value={0}>Select Teacher</option>
                                    {teachers
                                        .filter((teacher) => teacher.teacherProfile)
                                        .map((teacher) => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.name} ({teacher.teacherProfile?.employeeId})
                                                {teacher.teacherProfile?.designation && ` - ${teacher.teacherProfile.designation}`}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Current assignment info */}
                            {selectedAllocation.teacher && (
                                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                                    <strong>Currently assigned:</strong> {selectedAllocation.teacher.user?.name || 'Unknown'}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setSelectedAllocation(null);
                                    setSelectedTeacher(0);
                                }}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssignTeacher}
                                disabled={assigning || !selectedTeacher}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {assigning ? 'Assigning...' : 'Assign Teacher'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
