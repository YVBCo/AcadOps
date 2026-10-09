'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    BookOpen,
    Pencil,
    Trash2,
    Search,
    X,
    Building2,
    GraduationCap,
    Check,
    ChevronDown,
    Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { courseApi, departmentApi, programApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface Course {
    id: number;
    name: string;
    code: string;
    credits: number;
    description?: string;
    departmentId: number;
    programId: number;
    department?: { name: string; code: string };
    program?: { name: string; code: string };
}

interface Department {
    id: number;
    name: string;
    code: string;
}

interface Program {
    id: number;
    name: string;
    code: string;
    departmentId: number;
}

export default function CoursesPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Filters
    const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
    const [programFilter, setProgramFilter] = useState<number | ''>('');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        credits: 3,
        description: '',
        departmentId: 0,
        programId: 0,
    });

    // Determine current user permissions
    const isCOE = user?.role === 'COE';
    const canManage = isCOE; // Only COE can create/edit/delete

    const { data: courses = [], isLoading } = useQuery({
        queryKey: ['courses', departmentFilter, programFilter],
        queryFn: () => courseApi.getAll({
            departmentId: departmentFilter || undefined,
            programId: programFilter || undefined
        }),
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentApi.getAll,
    });

    const { data: programs = [] } = useQuery({
        queryKey: ['programs', formData.departmentId || departmentFilter],
        queryFn: () => programApi.getAll(formData.departmentId || (departmentFilter as number) || undefined),
        enabled: true, // Always load initially
    });

    const createMutation = useMutation({
        mutationFn: courseApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            closeModal();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof courseApi.update>[1] }) =>
            courseApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
            closeModal();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: courseApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['courses'] });
        },
    });

    const openCreateModal = () => {
        setEditingCourse(null);
        setFormData({
            name: '',
            code: '',
            credits: 4, // Default to 4
            description: '',
            departmentId: user?.departmentId || 0,
            programId: 0,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (course: Course) => {
        setEditingCourse(course);
        setFormData({
            name: course.name,
            code: course.code,
            credits: course.credits,
            description: course.description || '',
            departmentId: course.departmentId,
            programId: course.programId,
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingCourse(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.departmentId || !formData.programId) {
            alert('Please select both Department and Program');
            return;
        }

        if (editingCourse) {
            updateMutation.mutate({
                id: editingCourse.id,
                data: {
                    name: formData.name,
                    code: formData.code,
                    credits: formData.credits,
                    description: formData.description,
                },
            });
        } else {
            createMutation.mutate({
                name: formData.name,
                code: formData.code,
                credits: formData.credits,
                departmentId: formData.departmentId,
                programId: formData.programId,
                description: formData.description,
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
            deleteMutation.mutate(id);
        }
    };

    // Derived programs list for the modal (filtered by selected department)
    const modalPrograms = programs.filter((p: Program) =>
        !formData.departmentId || p.departmentId === formData.departmentId
    );

    // Derived programs list for filter (filtered by selected department filter)
    const filterPrograms = programs.filter((p: Program) =>
        !departmentFilter || p.departmentId === departmentFilter
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Course Catalog
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Manage academic courses and curriculum
                    </p>
                </div>
                {canManage && (
                    <Button leftIcon={Plus} onClick={openCreateModal}>
                        Add Course
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
                    <div className="relative flex-1 w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <div className="w-full md:w-48">
                            <select
                                value={departmentFilter}
                                onChange={(e) => {
                                    setDepartmentFilter(e.target.value ? parseInt(e.target.value) : '');
                                    setProgramFilter(''); // Reset program when dept changes
                                }}
                                className="input h-10 py-1"
                            >
                                <option value="">All Departments</option>
                                {departments.map((dept: Department) => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-full md:w-48">
                            <select
                                value={programFilter}
                                onChange={(e) => setProgramFilter(e.target.value ? parseInt(e.target.value) : '')}
                                className="input h-10 py-1"
                                disabled={!departmentFilter && filterPrograms.length === 0} // Optional behavior
                            >
                                <option value="">All Programs</option>
                                {filterPrograms.map((prog: Program) => (
                                    <option key={prog.id} value={prog.id}>{prog.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Courses Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card-premium p-6 animate-pulse">
                            <div className="h-6 bg-neutral-200 rounded w-3/4 mb-4" />
                            <div className="h-4 bg-neutral-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : courses.length === 0 ? (
                <Card className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">
                        No courses found
                    </h3>
                    <p className="text-neutral-500 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'No courses available'}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.filter((course: Course) =>
                        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        course.code.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map((course: Course) => (
                        <Card key={course.id} className="relative group hover:shadow-lg transition-shadow">
                            {canManage && (
                                <div className="absolute top-4 right-4 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => openEditModal(course)}
                                        className="p-2 rounded-lg bg-neutral-100 hover:bg-blue-100 text-neutral-600 hover:text-blue-600"
                                        aria-label={`Edit ${course.name}`}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(course.id)}
                                        className="p-2 rounded-lg bg-neutral-100 hover:bg-red-100 text-neutral-600 hover:text-red-600"
                                        aria-label={`Delete ${course.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
                                    <BookOpen className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-neutral-900 truncate" title={course.name}>
                                        {course.name}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="primary">{course.code}</Badge>
                                        <span className="text-sm text-neutral-500">{course.credits} Credits</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-neutral-200 space-y-2">
                                {course.department && (
                                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                                        <Building2 className="h-4 w-4 text-neutral-400" />
                                        <span>{course.department.name}</span>
                                    </div>
                                )}
                                {course.program && (
                                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                                        <GraduationCap className="h-4 w-4 text-neutral-400" />
                                        <span>{course.program.name}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {editingCourse ? 'Edit Course' : 'Create Course'}
                            </h2>
                            <button onClick={closeModal} className="p-2 rounded-lg hover:bg-neutral-100">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <Input
                                label="Course Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Engineering Mathematics I"
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Course Code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g., 22MAT11"
                                    required
                                />
                                <Input
                                    label="Credits"
                                    type="number"
                                    value={formData.credits}
                                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) })}
                                    required
                                    min={0}
                                />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="label">Department</label>
                                    <select
                                        value={formData.departmentId}
                                        onChange={(e) => setFormData({ ...formData, departmentId: parseInt(e.target.value), programId: 0 })}
                                        className="input"
                                        required
                                        disabled={!!editingCourse} // Prevent moving course across depts for simplicity unless backend supports
                                    >
                                        <option value="0">Select Department</option>
                                        {departments.map((dept: Department) => (
                                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Program</label>
                                    <select
                                        value={formData.programId}
                                        onChange={(e) => setFormData({ ...formData, programId: parseInt(e.target.value) })}
                                        className="input"
                                        required
                                        disabled={!formData.departmentId || !!editingCourse}
                                    >
                                        <option value="0">Select Program</option>
                                        {modalPrograms.map((prog: Program) => (
                                            <option key={prog.id} value={prog.id}>{prog.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label">Description (Optional)</label>
                                <textarea
                                    className="input min-h-[80px] py-2"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description of the course..."
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
