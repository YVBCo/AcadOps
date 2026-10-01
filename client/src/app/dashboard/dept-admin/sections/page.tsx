'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    Users,
    Plus,
    Search,
    Layers,
    Lock,
    Unlock,
    ChevronDown,
    AlertCircle,
    UserPlus,
    X,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Section {
    id: number;
    name: string;
    isLocked: boolean;
    department: { id: number; name: string; code: string };
    batch: { id: number; name: string; startYear: number };
    _count: { students: number };
}

interface Batch {
    id: number;
    name: string;
    startYear: number;
}

interface Student {
    id: number;
    name: string;
    email: string;
    studentProfile: {
        id: number;
        rollNumber: string;
        usn: string;
    };
}

export default function SectionsPage() {
    const { user } = useAuthStore();
    const [sections, setSections] = useState<Section[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<number | undefined>();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSection, setNewSection] = useState({ name: '', batchId: 0 });
    const [creating, setCreating] = useState(false);

    // Assign modal state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningSection, setAssigningSection] = useState<Section | null>(null);
    const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        fetchData();
    }, [selectedBatch]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [sectionsRes, batchesRes] = await Promise.all([
                api.get(`/dept-admin/sections${selectedBatch ? `?batchId=${selectedBatch}` : ''}`),
                api.get('/batches'),
            ]);

            setSections(sectionsRes.data);
            setBatches(batchesRes.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load sections');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSection = async () => {
        if (!newSection.name || !newSection.batchId) {
            setError('Section name and batch are required');
            return;
        }

        try {
            setCreating(true);
            await api.post('/dept-admin/sections', newSection);
            setShowCreateModal(false);
            setNewSection({ name: '', batchId: 0 });
            toast.success('Section created successfully');
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create section');
        } finally {
            setCreating(false);
        }
    };

    const handleLockSection = async (sectionId: number) => {
        try {
            await api.post(`/dept-admin/sections/${sectionId}/lock`);
            toast.success('Section locked');
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to lock section');
        }
    };

    // Open assign modal and fetch unassigned students
    const openAssignModal = async (section: Section) => {
        if (section.isLocked) {
            toast.error('Cannot modify a locked section');
            return;
        }
        setAssigningSection(section);
        setSelectedStudents([]);
        setShowAssignModal(true);

        try {
            setLoadingStudents(true);
            // Fetch unassigned students for this batch and department
            const res = await api.get(`/dept-admin/students?batchId=${section.batch.id}&unassignedOnly=true`);
            setUnassignedStudents(res.data.users || []);
        } catch (err: any) {
            toast.error('Failed to load students');
            setUnassignedStudents([]);
        } finally {
            setLoadingStudents(false);
        }
    };

    const closeAssignModal = () => {
        setShowAssignModal(false);
        setAssigningSection(null);
        setSelectedStudents([]);
        setUnassignedStudents([]);
    };

    const toggleStudentSelection = (profileId: number) => {
        setSelectedStudents(prev =>
            prev.includes(profileId)
                ? prev.filter(id => id !== profileId)
                : [...prev, profileId]
        );
    };

    const handleAssignStudents = async () => {
        if (!assigningSection || selectedStudents.length === 0) return;

        try {
            setAssigning(true);
            await api.post(`/dept-admin/sections/${assigningSection.id}/assign-students`, {
                studentProfileIds: selectedStudents,
            });
            toast.success(`${selectedStudents.length} students assigned to Section ${assigningSection.name}`);
            closeAssignModal();
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to assign students');
        } finally {
            setAssigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Sections</h1>
                    <p className="text-neutral-500">Manage sections and assign students</p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Section
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <select
                        value={selectedBatch || ''}
                        onChange={(e) => setSelectedBatch(e.target.value ? parseInt(e.target.value) : undefined)}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">All Batches</option>
                        {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                {batch.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>
            </div>

            {/* Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => (
                    <div
                        key={section.id}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-100 hover:shadow-xl transition-shadow"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-emerald-50">
                                    <Layers className="h-6 w-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-neutral-900">Section {section.name}</h3>
                                    <p className="text-sm text-neutral-500">{section.department?.name || 'Department'}</p>
                                </div>
                            </div>
                            {section.isLocked ? (
                                <Badge className="bg-neutral-100 text-neutral-600">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Locked
                                </Badge>
                            ) : (
                                <Badge className="bg-emerald-100 text-emerald-700">
                                    <Unlock className="h-3 w-3 mr-1" />
                                    Active
                                </Badge>
                            )}
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-neutral-500">Batch</span>
                                <span className="font-medium text-neutral-900">{section.batch?.name || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-neutral-500">Students</span>
                                <span className="font-medium text-neutral-900">{section._count.students}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.location.href = `/dashboard/dept-admin/sections/${section.id}`}
                            >
                                <Users className="h-4 w-4 mr-1" />
                                View
                            </Button>
                            {!section.isLocked && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openAssignModal(section)}
                                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleLockSection(section.id)}
                                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    >
                                        <Lock className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {sections.length === 0 && (
                <div className="text-center py-12">
                    <Layers className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No sections found</h3>
                    <p className="text-neutral-500">Create a new section to get started</p>
                </div>
            )}

            {/* Create Section Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-neutral-900 mb-4">Create New Section</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Section Name
                                </label>
                                <Input
                                    value={newSection.name}
                                    onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                                    placeholder="e.g., A, B, C"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Batch
                                </label>
                                <select
                                    value={newSection.batchId}
                                    onChange={(e) => setNewSection({ ...newSection, batchId: parseInt(e.target.value) })}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value={0}>Select Batch</option>
                                    {batches.map((batch) => (
                                        <option key={batch.id} value={batch.id}>
                                            {batch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateSection}
                                disabled={creating}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {creating ? 'Creating...' : 'Create Section'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Students Modal */}
            {showAssignModal && assigningSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900">
                                    Assign Students to Section {assigningSection.name}
                                </h2>
                                <p className="text-sm text-neutral-500">
                                    Batch {assigningSection.batch?.name} • Select students to assign
                                </p>
                            </div>
                            <button onClick={closeAssignModal} className="p-2 hover:bg-neutral-100 rounded-lg">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {loadingStudents ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                                </div>
                            ) : unassignedStudents.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No unassigned students</h3>
                                    <p className="text-neutral-500">
                                        All students in this batch are already assigned to sections
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-sm text-neutral-500">
                                            {unassignedStudents.length} unassigned students available
                                        </p>
                                        <Badge variant="outline">
                                            {selectedStudents.length} selected
                                        </Badge>
                                    </div>
                                    {unassignedStudents.map((student) => (
                                        <div
                                            key={student.id}
                                            onClick={() => toggleStudentSelection(student.studentProfile.id)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStudents.includes(student.studentProfile.id)
                                                    ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300'
                                                    : 'bg-white border-neutral-200 hover:bg-neutral-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-semibold">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-neutral-900">{student.name}</p>
                                                        <p className="text-sm text-neutral-500">
                                                            {student.studentProfile?.usn || student.studentProfile?.rollNumber} • {student.email}
                                                        </p>
                                                    </div>
                                                </div>
                                                {selectedStudents.includes(student.studentProfile.id) && (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                                                        <Check className="h-4 w-4 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-between items-center">
                            <Button variant="outline" onClick={closeAssignModal}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssignStudents}
                                disabled={selectedStudents.length === 0 || assigning}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {assigning ? 'Assigning...' : `Assign ${selectedStudents.length} Students`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
