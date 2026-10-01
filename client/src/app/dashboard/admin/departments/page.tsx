'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Building2,
    Pencil,
    Trash2,
    Search,
    X,
} from 'lucide-react';
import { type AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { departmentApi, userApi } from '@/lib/api';

/** Extract a human-readable message from an Axios error (or any Error). */
function getErrorMessage(error: unknown, fallback: string): string {
    const axiosErr = error as AxiosError<{ error?: string; message?: string }>;
    if (axiosErr?.response?.data) {
        const data = axiosErr.response.data;
        return data.error || data.message || fallback;
    }
    if (error instanceof Error) return error.message || fallback;
    return fallback;
}

interface Department {
    id: number;
    name: string;
    code: string;
    description?: string;
    programs?: { id: number; name: string }[];
    _count?: { users: number; courses: number };
}

export default function DepartmentsPage() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
    });

    // Assign Admin Modal State
    const [isAssignAdminModalOpen, setIsAssignAdminModalOpen] = useState(false);
    const [assignAdminDept, setAssignAdminDept] = useState<Department | null>(null);
    const [adminFormData, setAdminFormData] = useState({ name: '', email: '' });

    const { data: departments = [], isLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentApi.getAll,
    });

    const createMutation = useMutation({
        mutationFn: departmentApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
        onError: (error: unknown) => {
            alert(getErrorMessage(error, 'Failed to create department'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name?: string; code?: string; description?: string } }) =>
            departmentApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            closeModal();
        },
        onError: (error: unknown) => {
            alert(getErrorMessage(error, 'Failed to update department'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: departmentApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
        onError: (error: unknown) => {
            alert(getErrorMessage(error, 'Failed to delete department. Ensure it has no associated users or programs.'));
        },
    });

    const assignAdminMutation = useMutation({
        mutationFn: userApi.createDepartmentAdmin,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeAssignAdminModal();
            alert('Department Admin created and welcome email sent!');
        },
        onError: (error: unknown) => {
            alert(getErrorMessage(error, 'Failed to create admin'));
        },
    });

    const openCreateModal = () => {
        setEditingDept(null);
        setFormData({ name: '', code: '', description: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (dept: Department) => {
        setEditingDept(dept);
        setFormData({
            name: dept.name,
            code: dept.code,
            description: dept.description || '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingDept(null);
        setFormData({ name: '', code: '', description: '' });
    };

    const openAssignAdminModal = (dept: Department) => {
        setAssignAdminDept(dept);
        setAdminFormData({ name: '', email: '' });
        setIsAssignAdminModalOpen(true);
    };

    const closeAssignAdminModal = () => {
        setIsAssignAdminModalOpen(false);
        setAssignAdminDept(null);
        setAdminFormData({ name: '', email: '' });
    };

    const handleAssignAdminSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignAdminDept) return;
        assignAdminMutation.mutate({
            name: adminFormData.name,
            email: adminFormData.email,
            departmentId: assignAdminDept.id,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDept) {
            updateMutation.mutate({ id: editingDept.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this department?')) {
            deleteMutation.mutate(id);
        }
    };

    const filteredDepartments = departments.filter(
        (dept: Department) =>
            dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dept.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Departments
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        Manage academic departments and their structure
                    </p>
                </div>
                <Button leftIcon={Plus} onClick={openCreateModal}>
                    Add Department
                </Button>
            </div>

            {/* Search and filters */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            id="department-search"
                            name="department-search"
                            type="text"
                            placeholder="Search departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                    <Badge variant="neutral">{filteredDepartments.length} departments</Badge>
                </div>
            </Card>

            {/* Departments grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card-premium p-6 animate-pulse">
                            <div className="h-6 bg-neutral-200 rounded w-3/4 mb-4" />
                            <div className="h-4 bg-neutral-200 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : filteredDepartments.length === 0 ? (
                <Card className="text-center py-12">
                    <Building2 className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">
                        No departments found
                    </h3>
                    <p className="text-neutral-500 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'Create your first department to get started'}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDepartments.map((dept: Department) => (
                        <Card key={dept.id} className="relative group hover:shadow-lg transition-shadow">
                            {/* Actions */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={() => openEditModal(dept)}
                                    className="p-2 rounded-lg bg-neutral-100 hover:bg-primary-100 text-neutral-600 hover:text-primary-600"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(dept.id)}
                                    className="p-2 rounded-lg bg-neutral-100 hover:bg-red-100 text-neutral-600 hover:text-red-600"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Assign Admin Button */}
                            <Button
                                size="sm"
                                variant="outline"
                                className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => openAssignAdminModal(dept)}
                            >
                                Assign Admin
                            </Button>

                            {/* Content */}
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-primary-100">
                                    <Building2 className="h-6 w-6 text-primary-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-neutral-900 truncate">
                                        {dept.name}
                                    </h3>
                                    <Badge variant="neutral" className="mt-2">
                                        {dept.code}
                                    </Badge>
                                </div>
                            </div>

                            {dept.description && (
                                <p className="text-sm text-neutral-500 mt-4 line-clamp-2">
                                    {dept.description}
                                </p>
                            )}

                            {/* Stats */}
                            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-neutral-200">
                                <div>
                                    <p className="text-2xl font-bold text-neutral-900">
                                        {dept.programs?.length || 0}
                                    </p>
                                    <p className="text-xs text-neutral-500">Programs</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-neutral-900">
                                        {dept._count?.courses || 0}
                                    </p>
                                    <p className="text-xs text-neutral-500">Courses</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-neutral-900">
                                        {dept._count?.users || 0}
                                    </p>
                                    <p className="text-xs text-neutral-500">Users</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={closeModal}
                    />

                    {/* Modal content */}
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {editingDept ? 'Edit Department' : 'Create Department'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 rounded-lg hover:bg-neutral-100"
                            >
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <Input
                                label="Department Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Computer Science and Engineering"
                                required
                            />
                            <Input
                                label="Department Code"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="e.g., CSE"
                                required
                            />
                            <div>
                                <label htmlFor="department-description" className="label">Description (Optional)</label>
                                <textarea
                                    id="department-description"
                                    name="department-description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description of the department"
                                    rows={3}
                                    className="input resize-none"
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
                                    {editingDept ? 'Update' : 'Create'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Admin Modal */}
            {isAssignAdminModalOpen && assignAdminDept && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={closeAssignAdminModal}
                    />

                    {/* Modal content */}
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">
                                Assign Admin for {assignAdminDept.name}
                            </h2>
                            <button
                                onClick={closeAssignAdminModal}
                                className="p-2 rounded-lg hover:bg-neutral-100"
                            >
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignAdminSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-neutral-500">
                                A new Department Admin will be created. Login credentials will be sent to their email.
                            </p>
                            <Input
                                label="Admin Name"
                                value={adminFormData.name}
                                onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                                placeholder="e.g., John Doe"
                                required
                            />
                            <Input
                                label="Admin Email"
                                type="email"
                                value={adminFormData.email}
                                onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                                placeholder="e.g., john.doe@college.edu"
                                required
                            />

                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={closeAssignAdminModal} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    isLoading={assignAdminMutation.isPending}
                                >
                                    Create & Send Email
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
