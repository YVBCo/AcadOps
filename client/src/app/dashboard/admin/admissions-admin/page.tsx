'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ClipboardList,
    Plus,
    Power,
    PowerOff,
    Trash2,
    Shield,
    AlertTriangle,
    CheckCircle2,
    Mail,
    Calendar,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface AdminUser {
    id: number;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function AdmissionsAdminPage() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });

    // Query to get Admissions Admin users
    const { data: adminsData, isLoading } = useQuery({
        queryKey: ['admissions-admins'],
        queryFn: async () => {
            const response = await userApi.getAll({ role: 'ADMISSIONS_ADMIN' });
            return response.users || [];
        }
    });

    const admins: AdminUser[] = adminsData || [];

    // Create mutation
    const createMutation = useMutation({
        mutationFn: userApi.createAdmissionsAdmin,
        onSuccess: (response: any) => {
            queryClient.invalidateQueries({ queryKey: ['admissions-admins'] });
            setIsCreateModalOpen(false);
            setFormData({ name: '', email: '' });
            toast.success(response.message || 'Admissions Administrator created successfully!');
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to create Admissions Admin'));
        }
    });

    // Toggle activation mutation
    const toggleActivationMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
            userApi.toggleActivation(id, isActive),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admissions-admins'] });
            toast.success(`Admin ${variables.isActive ? 'activated' : 'deactivated'} successfully`);
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to update status'));
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: userApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions-admins'] });
            setDeleteTarget(null);
            toast.success('Admissions Admin deleted successfully');
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to delete user'));
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Admissions Admin Management</h1>
                    <p className="text-neutral-500 mt-1">
                        Create and manage Admissions Administrator accounts
                    </p>
                </div>
                <Button leftIcon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                    Create Admissions Admin
                </Button>
            </div>

            {/* Admins List */}
            {admins.length === 0 ? (
                <Card className="p-6">
                    <div className="text-center py-12">
                        <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                            <ClipboardList className="w-10 h-10 text-neutral-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                            No Admissions Admin
                        </h3>
                        <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                            Create an Admissions Administrator to manage student admissions, USN assignments, and admin clerks.
                        </p>
                        <Button leftIcon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                            Create Admissions Admin
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {admins.map((admin) => (
                        <Card key={admin.id} className="p-6">
                            <div className="space-y-6">
                                {/* Admin Info Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center shadow-lg">
                                            <ClipboardList className="w-7 h-7 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-neutral-900">{admin.name}</h2>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Mail className="w-4 h-4 text-neutral-400" />
                                                <span className="text-neutral-600">{admin.email}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant={admin.isActive ? 'success' : 'error'}>
                                        {admin.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>

                                {/* Admin Details */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-sky-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500">Role</p>
                                            <p className="font-medium text-neutral-800">Admissions Administrator</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500">Permissions</p>
                                            <p className="font-medium text-neutral-800">Full Admissions Access</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500">Created</p>
                                            <p className="font-medium text-neutral-800">
                                                {new Date(admin.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t border-neutral-200">
                                    <Button
                                        variant={admin.isActive ? 'outline' : 'primary'}
                                        leftIcon={admin.isActive ? PowerOff : Power}
                                        onClick={() => toggleActivationMutation.mutate({
                                            id: admin.id,
                                            isActive: !admin.isActive
                                        })}
                                        isLoading={toggleActivationMutation.isPending}
                                    >
                                        {admin.isActive ? 'Deactivate' : 'Activate'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        leftIcon={Trash2}
                                        className="text-red-600 hover:bg-red-50"
                                        onClick={() => setDeleteTarget(admin)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Info Card */}
            <Card className="p-4 bg-sky-50 border-sky-200">
                <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-sky-900">About Admissions Admin Role</h4>
                        <p className="text-sm text-sky-700 mt-1">
                            Admissions Administrators manage the entire admission workflow — creating student admissions,
                            reviewing applications, assigning permanent USNs, and managing admin clerks.
                            They have access to a dedicated dashboard at <strong>/dashboard/admissions</strong>.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Create Admissions Admin</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-lg hover:bg-neutral-100">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <Input
                                label="Full Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter admin name"
                                required
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="admin@college.edu"
                                required
                            />
                            <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                                <p className="text-sm text-sky-700">
                                    <Mail className="w-4 h-4 inline mr-2" />
                                    A secure password will be auto-generated and sent to this email address.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>
                                    Create Admin
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Delete Admissions Admin?</h2>
                            <p className="text-neutral-500 mb-6">
                                This will permanently delete the account <strong>{deleteTarget.name}</strong>.
                                Any admin clerks created by this admin will remain active.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(deleteTarget.id)}
                                    isLoading={deleteMutation.isPending}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
