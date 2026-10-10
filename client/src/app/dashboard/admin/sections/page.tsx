'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Layers,
    Users,
    Trash2,
    Lock,
    Unlock,
    UserPlus,
    X,
    Check,
    Eye,
    UserMinus,
    BookOpen,
    GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { sectionApi, batchApi, studentApi, courseAllocationApi, courseApi, departmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

interface Section {
    id: number;
    name: string;
    departmentId: number;
    batchId: number;
    isLocked: boolean;
    createdAt: string;
    department?: { id: number; name: string; code: string };
    batch?: { id: number; startYear: number; endYear: number };
    _count?: { students: number };
}

interface Batch {
    id: number;
    startYear: number;
    endYear: number;
    currentSemester: number;
}

interface Student {
    id: number;
    name: string;
    email: string;
    studentProfile: {
        id: number;
        rollNumber: string;
    };
}

interface Course {
    id: number;
    name: string;
    code: string;
    credits: number;
    isLocked: boolean;
}

interface CourseAllocation {
    id: number;
    courseId: number;
    sectionId: number;
    semesterNumber: number;
    teacherId: number | null;
    course: Course;
    section: Section;
    teacher?: { id: number; user: { id: number; name: string } };
}

interface Teacher {
    id: number;
    userId: number;
    employeeId: string;
    designation?: string;
    user: { id: number; name: string; email: string };
}

export default function SectionsPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isCoursesModalOpen, setIsCoursesModalOpen] = useState(false);
    const [selectedSection, setSelectedSection] = useState<Section | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [studentsToRemove, setStudentsToRemove] = useState<number[]>([]);
    const [newSectionName, setNewSectionName] = useState('');

    const departmentId = isSuperAdmin ? selectedDepartment ?? undefined : user?.departmentId;

    // Fetch batches and departments in the active tenant.
    const { data: batches = [] } = useQuery({
        queryKey: ['batches', user?.tenantId, user?.id],
        queryFn: () => batchApi.getAll(),
    });
    const { data: departments = [] } = useQuery({
        queryKey: ['section-departments', user?.tenantId, user?.id],
        queryFn: () => departmentApi.getAll(),
        enabled: isSuperAdmin,
    });

    // Fetch sections
    const { data: sections = [], isLoading: sectionsLoading } = useQuery({
        queryKey: ['sections', user?.tenantId, user?.id, departmentId, selectedBatch],
        queryFn: () => sectionApi.getAll(departmentId || undefined, selectedBatch || undefined),
        enabled: !!departmentId,
    });

    // Fetch unassigned students for assignment
    const { data: unassignedStudents = [] } = useQuery({
        queryKey: ['students', 'unassigned', user?.tenantId, user?.id, departmentId, selectedBatch],
        queryFn: () => studentApi.getStudents({
            departmentId: departmentId || undefined,
            batchId: selectedBatch || undefined,
            unassignedOnly: true,
            take: 200,
        }),
        select: (data) => data.users || [],
        enabled: isAssignModalOpen && !!departmentId && !!selectedBatch,
    });

    // Fetch students in selected section for viewing
    const { data: sectionStudents = [], isLoading: sectionStudentsLoading } = useQuery({
        queryKey: ['sectionStudents', user?.tenantId, user?.id, selectedSection?.id],
        queryFn: () => sectionApi.getStudents(selectedSection!.id),
        enabled: isViewModalOpen && !!selectedSection,
    });

    // Fetch current semester from selected batch
    const selectedBatchData = batches.find((b: Batch) => b.id === selectedBatch);
    const currentSemester = selectedBatchData?.currentSemester || 1;

    // Fetch course allocations for batch
    const { data: allocationsData, isLoading: allocationsLoading } = useQuery({
        queryKey: ['courseAllocations', user?.tenantId, user?.id, selectedBatch, currentSemester],
        queryFn: () => courseAllocationApi.getByBatch(selectedBatch!, currentSemester),
        enabled: isCoursesModalOpen && !!selectedBatch,
    });

    // Fetch available locked courses for the department
    const { data: availableCourses = [] } = useQuery({
        queryKey: ['courses', 'locked', user?.tenantId, user?.id, departmentId],
        queryFn: () => courseApi.getAll({ departmentId: departmentId! }),
        select: (data) => data.filter((c: Course) => c.isLocked),
        enabled: isCoursesModalOpen && !!departmentId,
    });

    // Fetch teachers in department
    const { data: teachers = [] } = useQuery({
        queryKey: ['teachers', user?.tenantId, user?.id, departmentId],
        queryFn: async () => {
            const response = await fetch(`/api/dept-admin/teachers`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            return response.json();
        },
        enabled: isCoursesModalOpen && !!departmentId,
    });

    // Allocate course to batch mutation
    const allocateCourseMutation = useMutation({
        mutationFn: (data: { courseId: number; batchId: number; semesterNumber: number }) =>
            courseAllocationApi.allocateToBatch(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['courseAllocations'] });
            toast.success(`${result.courseName} allocated to ${result.sectionCount} sections`);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to allocate course');
        },
    });

    // Assign teacher mutation
    const assignTeacherMutation = useMutation({
        mutationFn: ({ allocationId, teacherId }: { allocationId: number; teacherId: number }) =>
            courseAllocationApi.assignTeacher(allocationId, teacherId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courseAllocations'] });
            toast.success('Teacher assigned successfully');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to assign teacher');
        },
    });

    // Create section mutation
    const createMutation = useMutation({
        mutationFn: (data: { name: string; departmentId: number; batchId: number }) => sectionApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            setNewSectionName('');
            toast.success('Section created successfully');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to create section');
        },
    });

    // Delete section mutation
    const deleteMutation = useMutation({
        mutationFn: sectionApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            toast.success('Section deleted');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to delete section');
        },
    });

    // Toggle lock mutation
    const lockMutation = useMutation({
        mutationFn: sectionApi.toggleLock,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            toast.success('Section lock status updated');
        },
    });

    // Assign students mutation
    const assignMutation = useMutation({
        mutationFn: ({ sectionId, studentProfileIds }: { sectionId: number; studentProfileIds: number[] }) =>
            sectionApi.assignStudents(sectionId, studentProfileIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            setIsAssignModalOpen(false);
            setSelectedStudents([]);
            toast.success('Students assigned successfully');
        },
    });

    // Remove students from section mutation
    const removeMutation = useMutation({
        mutationFn: (studentProfileIds: number[]) =>
            sectionApi.removeStudents(studentProfileIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sections'] });
            queryClient.invalidateQueries({ queryKey: ['sectionStudents'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            setStudentsToRemove([]);
            toast.success('Students removed from section');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to remove students');
        },
    });

    const handleCreateSection = () => {
        if (selectedBatch && departmentId && newSectionName.trim()) {
            createMutation.mutate({
                name: newSectionName.trim().toUpperCase(),
                departmentId,
                batchId: selectedBatch,
            });
        }
    };

    const handleDeleteSection = (section: Section) => {
        if (section.isLocked) {
            toast.error('Cannot delete a locked section');
            return;
        }
        if (confirm('Are you sure? This will unassign all students from this section.')) {
            deleteMutation.mutate(section.id);
        }
    };

    const handleOpenAssignModal = (section: Section) => {
        if (section.isLocked) {
            toast.error('Cannot modify a locked section');
            return;
        }
        setSelectedSection(section);
        setSelectedStudents([]);
        setIsAssignModalOpen(true);
    };

    const handleOpenViewModal = (section: Section) => {
        setSelectedSection(section);
        setStudentsToRemove([]);
        setIsViewModalOpen(true);
    };

    const handleRemoveStudents = () => {
        if (studentsToRemove.length > 0) {
            if (selectedSection?.isLocked) {
                toast.error('Cannot modify a locked section');
                return;
            }
            removeMutation.mutate(studentsToRemove);
        }
    };

    const toggleRemoveSelection = (profileId: number) => {
        setStudentsToRemove(prev =>
            prev.includes(profileId)
                ? prev.filter(id => id !== profileId)
                : [...prev, profileId]
        );
    };

    const handleAssignStudents = () => {
        if (selectedSection && selectedStudents.length > 0) {
            assignMutation.mutate({
                sectionId: selectedSection.id,
                studentProfileIds: selectedStudents,
            });
        }
    };

    const toggleStudentSelection = (profileId: number) => {
        setSelectedStudents(prev =>
            prev.includes(profileId)
                ? prev.filter(id => id !== profileId)
                : [...prev, profileId]
        );
    };

    // Filter sections by selected batch
    const filteredSections = selectedBatch
        ? sections.filter((s: Section) => s.batchId === selectedBatch)
        : sections;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Section Management
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Create sections and assign students to them
                    </p>
                </div>
            </div>

            {/* Batch Filter */}
            {isSuperAdmin && (
                <Card className="p-4">
                    <label htmlFor="section-department" className="mb-2 block text-sm font-medium text-neutral-700">
                        Select Department:
                    </label>
                    <select
                        id="section-department"
                        value={selectedDepartment ?? ''}
                        onChange={(event) => {
                            setSelectedDepartment(event.target.value ? Number(event.target.value) : null);
                            setSelectedBatch(null);
                        }}
                        className="input max-w-md"
                    >
                        <option value="">Choose a department</option>
                        {departments.map((department: { id: number; name: string; code: string }) => (
                            <option key={department.id} value={department.id}>
                                {department.name} ({department.code})
                            </option>
                        ))}
                    </select>
                </Card>
            )}

            <Card className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-neutral-600 mr-2">Select Batch:</span>
                    {batches.map((batch: Batch) => (
                        <button
                            key={batch.id}
                            onClick={() => setSelectedBatch(batch.id === selectedBatch ? null : batch.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedBatch === batch.id
                                ? 'bg-primary-600 text-white'
                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                }`}
                        >
                            Batch {batch.startYear} - {batch.endYear}
                            <span className="ml-1 text-xs opacity-75">(Sem {batch.currentSemester})</span>
                        </button>
                    ))}
                </div>
            </Card>

            {/* Create Section Card */}
            {selectedBatch && departmentId && (
                <Card className="p-4 bg-primary-50 border-primary-200">
                    <div className="flex items-center gap-4 flex-wrap">
                        <input
                            type="text"
                            placeholder="Section name (e.g., A, B, C)"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
                            className="input flex-1 max-w-xs"
                            maxLength={10}
                        />
                        <Button
                            leftIcon={Plus}
                            onClick={handleCreateSection}
                            isLoading={createMutation.isPending}
                            disabled={!newSectionName.trim()}
                        >
                            Create Section
                        </Button>
                        <div className="border-l border-primary-200 h-8" />
                        <Button
                            variant="outline"
                            leftIcon={BookOpen}
                            onClick={() => setIsCoursesModalOpen(true)}
                        >
                            Manage Courses (Sem {currentSemester})
                        </Button>
                    </div>
                </Card>
            )}

            {/* No Batch Selected */}
            {(!selectedBatch || !departmentId) && (
                <Card className="p-12 text-center">
                    <Layers className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">
                        {!departmentId ? 'Select a department' : 'Select a batch'}
                    </h3>
                    <p className="text-neutral-500 mt-1">
                        Choose a department and batch above to view and manage sections
                    </p>
                </Card>
            )}

            {/* Sections Grid */}
            {selectedBatch && departmentId && (
                <>
                    {sectionsLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        </div>
                    ) : filteredSections.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Layers className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-neutral-900">
                                No sections found
                            </h3>
                            <p className="text-neutral-500 mt-1">
                                Create your first section for this batch
                            </p>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredSections.map((section: Section) => (
                                <Card key={section.id} className="p-5 hover:shadow-lg transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                                                Section {section.name}
                                                {section.isLocked && (
                                                    <Lock className="h-4 w-4 text-amber-500" />
                                                )}
                                            </h3>
                                            <p className="text-sm text-neutral-500">
                                                Batch {section.batch?.startYear}-{section.batch?.endYear}
                                            </p>
                                        </div>
                                        <Badge variant={section.isLocked ? 'warning' : 'neutral'}>
                                            {section._count?.students || 0} students
                                        </Badge>
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={Eye}
                                            onClick={() => handleOpenViewModal(section)}
                                        >
                                            View
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={UserPlus}
                                            onClick={() => handleOpenAssignModal(section)}
                                            disabled={section.isLocked}
                                        >
                                            Assign
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={section.isLocked ? Unlock : Lock}
                                            onClick={() => lockMutation.mutate(section.id)}
                                        >
                                            {section.isLocked ? 'Unlock' : 'Lock'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={Trash2}
                                            onClick={() => handleDeleteSection(section)}
                                            disabled={section.isLocked}
                                            className="text-red-600 hover:bg-red-50"
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Assign Students Modal */}
            {isAssignModalOpen && selectedSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                Assign Students to Section {selectedSection.name}
                            </h2>
                            <button onClick={() => setIsAssignModalOpen(false)}>
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {unassignedStudents.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                                    <p className="text-neutral-500">
                                        No unassigned students found in this batch
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm text-neutral-500 mb-4">
                                        Select students to assign ({selectedStudents.length} selected)
                                    </p>
                                    {unassignedStudents.map((student: Student) => (
                                        <div
                                            key={student.id}
                                            onClick={() => toggleStudentSelection(student.studentProfile.id)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedStudents.includes(student.studentProfile.id)
                                                ? 'bg-primary-50 border-primary-300'
                                                : 'bg-white border-neutral-200 hover:bg-neutral-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-neutral-900">
                                                        {student.name}
                                                    </p>
                                                    <p className="text-sm text-neutral-500">
                                                        {student.studentProfile?.rollNumber} • {student.email}
                                                    </p>
                                                </div>
                                                {selectedStudents.includes(student.studentProfile.id) && (
                                                    <Check className="h-5 w-5 text-primary-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsAssignModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAssignStudents}
                                disabled={selectedStudents.length === 0}
                                isLoading={assignMutation.isPending}
                            >
                                Assign {selectedStudents.length} Students
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* View Section Students Modal */}
            {isViewModalOpen && selectedSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                Students in Section {selectedSection.name}
                            </h2>
                            <button onClick={() => setIsViewModalOpen(false)}>
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {sectionStudentsLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                                </div>
                            ) : sectionStudents.length === 0 ? (
                                <div className="text-center py-8">
                                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                                    <p className="text-neutral-500">
                                        No students in this section
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm text-neutral-500 mb-4">
                                        {selectedSection.isLocked
                                            ? `${sectionStudents.length} students (section is locked)`
                                            : `Click to select students for removal (${studentsToRemove.length} selected)`
                                        }
                                    </p>
                                    {sectionStudents.map((student: { id: number; rollNumber: string; user: { id: number; name: string; email: string } }) => (
                                        <div
                                            key={student.id}
                                            onClick={() => !selectedSection.isLocked && toggleRemoveSelection(student.id)}
                                            className={`p-3 rounded-lg border transition-colors ${selectedSection.isLocked
                                                ? 'bg-neutral-50 cursor-default'
                                                : studentsToRemove.includes(student.id)
                                                    ? 'bg-red-50 border-red-300 cursor-pointer'
                                                    : 'bg-white border-neutral-200 hover:bg-neutral-50 cursor-pointer'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-neutral-900">
                                                        {student.user.name}
                                                    </p>
                                                    <p className="text-sm text-neutral-500">
                                                        {student.rollNumber} • {student.user.email}
                                                    </p>
                                                </div>
                                                {studentsToRemove.includes(student.id) && (
                                                    <UserMinus className="h-5 w-5 text-red-600" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsViewModalOpen(false)}
                            >
                                Close
                            </Button>
                            {!selectedSection.isLocked && studentsToRemove.length > 0 && (
                                <Button
                                    variant="danger"
                                    leftIcon={UserMinus}
                                    onClick={handleRemoveStudents}
                                    isLoading={removeMutation.isPending}
                                >
                                    Remove {studentsToRemove.length} Students
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* Manage Courses Modal */}
            {isCoursesModalOpen && selectedBatch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Manage Courses - Semester {currentSemester}
                                </h2>
                                <p className="text-sm text-neutral-500">
                                    Batch {selectedBatchData?.startYear} • Assign courses to all sections
                                </p>
                            </div>
                            <button onClick={() => setIsCoursesModalOpen(false)}>
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Add Course Section */}
                            <div className="mb-6 p-4 bg-neutral-50 rounded-lg border">
                                <h3 className="text-sm font-medium text-neutral-700 mb-2">Add Course to All Sections</h3>
                                <div className="flex gap-2 items-center">
                                    <select
                                        className="input flex-1"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                allocateCourseMutation.mutate({
                                                    courseId: parseInt(e.target.value),
                                                    batchId: selectedBatch,
                                                    semesterNumber: currentSemester,
                                                });
                                                e.target.value = '';
                                            }
                                        }}
                                        disabled={allocateCourseMutation.isPending}
                                    >
                                        <option value="">Select a course to add...</option>
                                        {availableCourses
                                            .filter((c: Course) =>
                                                !allocationsData?.allocations?.some(
                                                    (a: CourseAllocation) => a.courseId === c.id
                                                )
                                            )
                                            .map((course: Course) => (
                                                <option key={course.id} value={course.id}>
                                                    {course.code} - {course.name} ({course.credits} credits)
                                                </option>
                                            ))
                                        }
                                    </select>
                                    {allocateCourseMutation.isPending && (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                                    )}
                                </div>
                                {availableCourses.length === 0 && (
                                    <p className="text-sm text-amber-600 mt-2">
                                        <strong>No locked courses available.</strong> COE must lock courses before they can be allocated.
                                    </p>
                                )}
                            </div>

                            {/* Allocated Courses Table */}
                            {allocationsLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                                </div>
                            ) : !allocationsData?.allocations?.length ? (
                                <div className="text-center py-8">
                                    <BookOpen className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                                    <p className="text-neutral-500">
                                        No courses allocated yet for Semester {currentSemester}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-neutral-700">
                                        Allocated Courses ({[...new Set(allocationsData.allocations.map((a: CourseAllocation) => a.courseId))].length} courses)
                                    </h3>

                                    {/* Group allocations by course */}
                                    {[...new Set(allocationsData.allocations.map((a: CourseAllocation) => a.courseId))].map((courseId) => {
                                        const courseAllocations = allocationsData.allocations.filter(
                                            (a: CourseAllocation) => a.courseId === courseId
                                        );
                                        const course = courseAllocations[0]?.course;

                                        return (
                                            <Card key={courseId as number} className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div>
                                                        <h4 className="font-medium text-neutral-900">
                                                            {course?.code} - {course?.name}
                                                        </h4>
                                                        <p className="text-sm text-neutral-500">
                                                            {course?.credits} credits
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Teacher assignments per section */}
                                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                    {courseAllocations.map((allocation: CourseAllocation) => (
                                                        <div key={allocation.id} className="flex items-center gap-2 p-2 bg-neutral-50 rounded">
                                                            <span className="text-sm font-medium w-20">
                                                                Section {allocation.section?.name}:
                                                            </span>
                                                            <select
                                                                className="input input-sm flex-1 text-sm"
                                                                value={allocation.teacherId || ''}
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        assignTeacherMutation.mutate({
                                                                            allocationId: allocation.id,
                                                                            teacherId: parseInt(e.target.value),
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={assignTeacherMutation.isPending}
                                                            >
                                                                <option value="">Assign teacher...</option>
                                                                {teachers.map((teacher: Teacher) => (
                                                                    <option key={teacher.id} value={teacher.id}>
                                                                        {teacher.user.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setIsCoursesModalOpen(false)}
                            >
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
