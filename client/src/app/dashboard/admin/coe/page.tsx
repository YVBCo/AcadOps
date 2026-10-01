'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    UserCog,
    Plus,
    Power,
    PowerOff,
    Trash2,
    KeyRound,
    Shield,
    AlertTriangle,
    CheckCircle2,
    Mail,
    Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { userApi } from '@/lib/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

interface COEUser {
    id: number;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

export default function COEManagementPage() {
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });

    // Query to get COE user
    const { data: coeUser, isLoading } = useQuery<COEUser | null>({
        queryKey: ['coe-user'],
        queryFn: async () => {
            const response = await userApi.getAll({ role: 'COE' });
            const coes = response.users || [];
            return coes.length > 0 ? coes[0] : null;
        }
    });

    // Create COE mutation
    const createMutation = useMutation({
        mutationFn: async (data: { name: string; email: string }) => {
            return userApi.create({
                ...data,
                password: 'placeholder', // Backend will auto-generate
                role: 'COE' as any,
                departmentId: undefined
            });
        },
        onSuccess: (response: any) => {
            queryClient.invalidateQueries({ queryKey: ['coe-user'] });
            setIsCreateModalOpen(false);
            setFormData({ name: '', email: '' });
            toast.success(response.message || 'COE created! Credentials sent via email.');
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to create COE user'));
        }
    });

    // Toggle activation mutation
    const toggleActivationMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
            return userApi.toggleActivation(id, isActive);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['coe-user'] });
            toast.success(`COE ${variables.isActive ? 'activated' : 'deactivated'} successfully`);
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to update COE status'));
        }
    });

    // Delete COE mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return userApi.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['coe-user'] });
            setIsDeleteModalOpen(false);
            toast.success('COE user deleted successfully');
        },
        onError: (error: any) => {
            toast.error(getApiErrorMessage(error, 'Failed to delete COE user'));
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">COE Management</h1>
                    <p className="text-neutral-500 mt-1">
                        Manage the Controller of Examinations account
                    </p>
                </div>
            </div>

            {/* COE Status Card */}
            <Card className="p-6">
                {coeUser ? (
                    <div className="space-y-6">
                        {/* COE Info Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
                                    <UserCog className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-neutral-900">{coeUser.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Mail className="w-4 h-4 text-neutral-400" />
                                        <span className="text-neutral-600">{coeUser.email}</span>
                                    </div>
                                </div>
                            </div>
                            <Badge variant={coeUser.isActive ? 'success' : 'error'}>
                                {coeUser.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>

                        {/* COE Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Role</p>
                                    <p className="font-medium text-neutral-800">Controller of Examinations</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Permissions</p>
                                    <p className="font-medium text-neutral-800">Full Course Management</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500">Created</p>
                                    <p className="font-medium text-neutral-800">
                                        {new Date(coeUser.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-neutral-200">
                            <Button
                                variant={coeUser.isActive ? 'outline' : 'primary'}
                                leftIcon={coeUser.isActive ? PowerOff : Power}
                                onClick={() => toggleActivationMutation.mutate({
                                    id: coeUser.id,
                                    isActive: !coeUser.isActive
                                })}
                                isLoading={toggleActivationMutation.isPending}
                            >
                                {coeUser.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                                variant="ghost"
                                leftIcon={Trash2}
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setIsDeleteModalOpen(true)}
                            >
                                Delete COE
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* No COE State */
                    <div className="text-center py-12">
                        <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                            <UserCog className="w-10 h-10 text-neutral-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                            No COE Account
                        </h3>
                        <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                            Create a Controller of Examinations account to manage courses and academic content.
                        </p>
                        <Button
                            leftIcon={Plus}
                            onClick={() => setIsCreateModalOpen(true)}
                        >
                            Create COE Account
                        </Button>
                    </div>
                )}
            </Card>

            {/* Info Card */}
            <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex gap-3">
                    <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-blue-900">About COE Role</h4>
                        <p className="text-sm text-blue-700 mt-1">
                            The Controller of Examinations (COE) has exclusive access to manage courses.
                            Only one COE account can exist at a time. Super Admins cannot create or modify courses.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Create COE Account</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <Input
                                label="Full Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Enter COE name"
                                required
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="coe@college.edu"
                                required
                            />
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-700">
                                    <Mail className="w-4 h-4 inline mr-2" />
                                    A secure password will be auto-generated and sent to this email address.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" isLoading={createMutation.isPending}>
                                    Create COE
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && coeUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Delete COE Account?</h2>
                            <p className="text-neutral-500 mb-6">
                                This will permanently delete the COE account <strong>{coeUser.name}</strong>.
                                You can create a new COE after this.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 bg-red-600 hover:bg-red-700"
                                    onClick={() => deleteMutation.mutate(coeUser.id)}
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
