'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    BookOpen,
    Pencil,
    Lock,
    Unlock,
    Search,
    X,
    Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { courseApi, departmentApi } from '@/lib/api';

interface Course {
    id: number;
    name: string;
    code: string;
    credits: number;
    departmentId: number;
    semesterNumber?: number;
    internalMarks: number;
    externalMarks: number;
    isLocked: boolean;
    lockedAt?: string;
    department?: { id: number; name: string; code: string };
}

interface Department {
    id: number;
    name: string;
    code: string;
}

export default function COECoursesPage() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDept, setFilterDept] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        credits: 3,
        departmentId: 0,
        semesterNumber: 1,
        internalMarks: 50,
        externalMarks: 50,
        description: '',
    });

    // Queries
    const { data: courses = [], isLoading } = useQuery<Course[]>({
        queryKey: ['courses'],
        queryFn: () => courseApi.getAll(),
    });

    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => departmentApi.getAll(),
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: courseApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            closeModal();
            toast.success('Course created successfully');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create course');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Course> }) =>
            courseApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            closeModal();
            toast.success('Course updated successfully');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update course');
        },
    });

    const lockMutation = useMutation({
        mutationFn: (courseId: number) => courseApi.lock(courseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            toast.success('Course locked successfully');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to lock course');
        },
    });

    const openCreateModal = () => {
        setEditingCourse(null);
        setFormData({
            name: '',
            code: '',
            credits: 3,
            departmentId: departments[0]?.id || 0,
            semesterNumber: 1,
            internalMarks: 50,
            externalMarks: 50,
            description: '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = (course: Course) => {
        if (course.isLocked) {
            toast.error('Cannot edit a locked course');
            return;
        }
        setEditingCourse(course);
        setFormData({
            name: course.name,
            code: course.code,
            credits: course.credits,
            departmentId: course.departmentId,
            semesterNumber: course.semesterNumber || 1,
            internalMarks: course.internalMarks || 50,
            externalMarks: course.externalMarks || 50,
            description: '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCourse(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCourse) {
            updateMutation.mutate({ id: editingCourse.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleLock = (course: Course) => {
        if (confirm(`Are you sure you want to lock "${course.name}"? This cannot be undone.`)) {
            lockMutation.mutate(course.id);
        }
    };

    const filteredCourses = courses.filter((course: Course) => {
        const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = !filterDept || course.departmentId === filterDept;
        return matchesSearch && matchesDept;
    });

    const lockedCount = courses.filter((c: Course) => c.isLocked).length;
    const unlockedCount = courses.filter((c: Course) => !c.isLocked).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Course Management</h1>
                    <p className="text-neutral-500 mt-1">Create and manage course catalog</p>
                </div>
                <Button leftIcon={Plus} onClick={openCreateModal}>
                    Add Course
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-100">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{courses.length}</p>
                        <p className="text-sm text-neutral-500">Total Courses</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-100">
                        <Unlock className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{unlockedCount}</p>
                        <p className="text-sm text-neutral-500">Editable</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-100">
                        <Lock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{lockedCount}</p>
                        <p className="text-sm text-neutral-500">Locked</p>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                    <select
                        value={filterDept || ''}
                        onChange={(e) => setFilterDept(e.target.value ? parseInt(e.target.value) : null)}
                        className="input max-w-xs"
                    >
                        <option value="">All Departments</option>
                        {departments.map((dept: Department) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                    <Badge variant="neutral">{filteredCourses.length} courses</Badge>
                </div>
            </Card>

            {/* Courses Table */}
            {isLoading ? (
                <Card className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                </Card>
            ) : filteredCourses.length === 0 ? (
                <Card className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No courses found</h3>
                    <p className="text-neutral-500 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'Create your first course to get started'}
                    </p>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                            <tr>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Course</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Department</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Semester</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Credits</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Marks</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                                <th className="text-right px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {filteredCourses.map((course: Course) => (
                                <tr key={course.id} className="hover:bg-neutral-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-neutral-900">{course.name}</p>
                                            <p className="text-sm text-neutral-500">{course.code}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="neutral">{course.department?.code || 'N/A'}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-neutral-600">
                                        Sem {course.semesterNumber || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-neutral-600">{course.credits}</td>
                                    <td className="px-6 py-4 text-neutral-600">
                                        <span className="text-xs">
                                            Int: {course.internalMarks || 50} | Ext: {course.externalMarks || 50}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {course.isLocked ? (
                                            <Badge variant="warning" className="flex items-center gap-1 w-fit">
                                                <Lock className="h-3 w-3" /> Locked
                                            </Badge>
                                        ) : (
                                            <Badge variant="success" className="flex items-center gap-1 w-fit">
                                                <Unlock className="h-3 w-3" /> Editable
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {!course.isLocked && (
                                                <>
                                                    <button
                                                        onClick={() => openEditModal(course)}
                                                        className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleLock(course)}
                                                        className="p-2 rounded-lg hover:bg-amber-100 text-amber-600"
                                                        title="Lock Course"
                                                    >
                                                        <Lock className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {editingCourse ? 'Edit Course' : 'Create Course'}
                            </h2>
                            <button onClick={closeModal} className="p-2 rounded-lg hover:bg-neutral-100">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Course Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Data Structures"
                                    required
                                />
                                <Input
                                    label="Course Code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g., CS201"
                                    minLength={2}
                                    maxLength={10}
                                    helperText="Use 2–10 characters (for example, CS201)."
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">Department</label>
                                <select
                                    value={formData.departmentId}
                                    onChange={(e) => setFormData({ ...formData, departmentId: parseInt(e.target.value) })}
                                    className="input"
                                    required
                                >
                                    <option value="">Select Department</option>
                                    {departments.map((dept: Department) => (
                                        <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="label">Semester</label>
                                    <select
                                        value={formData.semesterNumber}
                                        onChange={(e) => setFormData({ ...formData, semesterNumber: parseInt(e.target.value) })}
                                        className="input"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                            <option key={sem} value={sem}>Semester {sem}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    label="Credits"
                                    type="number"
                                    value={formData.credits}
                                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 3 })}
                                    min={1}
                                    max={6}
                                />
                                <div />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Internal Marks"
                                    type="number"
                                    value={formData.internalMarks}
                                    onChange={(e) => setFormData({ ...formData, internalMarks: parseInt(e.target.value) || 50 })}
                                    min={0}
                                    max={100}
                                />
                                <Input
                                    label="External Marks"
                                    type="number"
                                    value={formData.externalMarks}
                                    onChange={(e) => setFormData({ ...formData, externalMarks: parseInt(e.target.value) || 50 })}
                                    min={0}
                                    max={100}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    isLoading={createMutation.isPending || updateMutation.isPending}
                                >
                                    {editingCourse ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
