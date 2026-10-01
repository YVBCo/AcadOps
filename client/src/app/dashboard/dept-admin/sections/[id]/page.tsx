'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
    ArrowLeft,
    Users,
    UserPlus,
    UserMinus,
    Layers,
    Lock,
    Unlock,
    AlertCircle,
    Check,
    X,
    Search,
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
    batch: { id: number; name: string };
    _count: { students: number };
}

interface Student {
    id: number;
    name: string;
    email: string;
    studentProfile: {
        id: number;
        rollNumber: string;
        usn: string;
        program?: { name: string; code: string };
    };
}

export default function SectionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const sectionId = params.id as string;

    const [section, setSection] = useState<Section | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Assign modal state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (sectionId) {
            fetchData();
        }
    }, [sectionId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch section details
            const sectionsRes = await api.get(`/dept-admin/sections`);
            const foundSection = sectionsRes.data.find((s: Section) => s.id === parseInt(sectionId));

            if (!foundSection) {
                setError('Section not found');
                return;
            }

            setSection(foundSection);

            // Fetch students in this section
            const studentsRes = await api.get(`/dept-admin/students?sectionId=${sectionId}`);
            setStudents(studentsRes.data.users || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load section data');
        } finally {
            setLoading(false);
        }
    };

    const openAssignModal = async () => {
        if (!section) return;
        if (section.isLocked) {
            toast.error('Cannot modify a locked section');
            return;
        }

        setSelectedStudents([]);
        setShowAssignModal(true);

        try {
            setLoadingStudents(true);
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
        if (!section || selectedStudents.length === 0) return;

        try {
            setAssigning(true);
            await api.post(`/dept-admin/sections/${section.id}/assign-students`, {
                studentProfileIds: selectedStudents,
            });
            toast.success(`${selectedStudents.length} students assigned to Section ${section.name}`);
            closeAssignModal();
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to assign students');
        } finally {
            setAssigning(false);
        }
    };

    const handleRemoveStudent = async (studentProfileId: number) => {
        if (!section) return;
        if (section.isLocked) {
            toast.error('Cannot modify a locked section');
            return;
        }

        if (!confirm('Are you sure you want to remove this student from the section?')) return;

        try {
            await api.post(`/dept-admin/sections/${section.id}/remove-student`, {
                studentProfileId,
            });
            toast.success('Student removed from section');
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to remove student');
        }
    };

    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentProfile?.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.studentProfile?.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    if (error || !section) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-700">{error || 'Section not found'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.push('/dashboard/dept-admin/sections')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Sections
                </Button>
            </div>

            {/* Section Info Card */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-100">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-xl bg-emerald-50">
                            <Layers className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-neutral-900">Section {section.name}</h1>
                            <p className="text-neutral-500">{section.department?.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">Batch {section.batch?.name}</Badge>
                                <Badge variant="outline">
                                    <Users className="h-3 w-3 mr-1" />
                                    {students.length} students
                                </Badge>
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
                        </div>
                    </div>
                    {!section.isLocked && (
                        <Button onClick={openAssignModal} className="bg-emerald-600 hover:bg-emerald-700">
                            <UserPlus className="h-4 w-4 mr-2" />
                            Assign Students
                        </Button>
                    )}
                </div>
            </div>

            {/* Students List */}
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                <div className="p-4 border-b border-neutral-100">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search students..."
                            className="pl-10"
                        />
                    </div>
                </div>

                {filteredStudents.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-neutral-900 mb-2">No students in this section</h3>
                        <p className="text-neutral-500 mb-4">
                            {section.isLocked
                                ? 'This section is locked and cannot be modified'
                                : 'Click "Assign Students" to add students to this section'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                        Student
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                        USN / Roll Number
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                        Program
                                    </th>
                                    {!section.isLocked && (
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-semibold">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-neutral-900">{student.name}</p>
                                                    <p className="text-sm text-neutral-500">{student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm text-neutral-900">
                                                {student.studentProfile?.usn || student.studentProfile?.rollNumber || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-neutral-600">
                                                {student.studentProfile?.program?.code || 'N/A'}
                                            </span>
                                        </td>
                                        {!section.isLocked && (
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveStudent(student.studentProfile.id)}
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assign Students Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900">
                                    Assign Students to Section {section.name}
                                </h2>
                                <p className="text-sm text-neutral-500">
                                    Batch {section.batch?.name} • Select students to assign
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
