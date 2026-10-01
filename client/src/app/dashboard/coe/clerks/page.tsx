'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Users,
    UserCheck,
    UserX,
    Search,
    X,
    Mail,
    Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { clerkApi } from '@/lib/api';

interface Clerk {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: string;
}

export default function COEClerksPage() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });

    // Queries
    const { data: clerks = [], isLoading } = useQuery({
        queryKey: ['clerks'],
        queryFn: clerkApi.getAll,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: clerkApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clerks'] });
            setIsModalOpen(false);
            setFormData({ name: '', email: '' });
            toast.success('Clerk created successfully. Credentials sent via email.');
        },
        onError: (error: Error) => {
            toast.error(getApiErrorMessage(error, 'Failed to create clerk'));
        },
    });

    const toggleMutation = useMutation({
        mutationFn: clerkApi.toggle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clerks'] });
            toast.success('Clerk status updated');
        },
        onError: (error: Error) => {
            toast.error(getApiErrorMessage(error, 'Failed to update clerk status'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: clerkApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clerks'] });
            toast.success('Clerk deleted');
        },
        onError: (error: Error) => {
            toast.error(getApiErrorMessage(error, 'Failed to delete clerk'));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    const handleToggle = (clerk: Clerk) => {
        toggleMutation.mutate(clerk.id);
    };

    const handleDelete = (clerk: Clerk) => {
        if (confirm(`Are you sure you want to delete clerk "${clerk.name}"?`)) {
            deleteMutation.mutate(clerk.id);
        }
    };

    const filteredClerks = clerks.filter((clerk: Clerk) =>
        clerk.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clerk.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = clerks.filter((c: Clerk) => c.isActive).length;
    const inactiveCount = clerks.filter((c: Clerk) => !c.isActive).length;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Clerk Management</h1>
                    <p className="text-neutral-500 mt-1">Manage clerks for marks entry</p>
                </div>
                <Button leftIcon={Plus} onClick={() => setIsModalOpen(true)}>
                    Add Clerk
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-100">
                        <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{clerks.length}</p>
                        <p className="text-sm text-neutral-500">Total Clerks</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-100">
                        <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{activeCount}</p>
                        <p className="text-sm text-neutral-500">Active</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-red-100">
                        <UserX className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{inactiveCount}</p>
                        <p className="text-sm text-neutral-500">Inactive</p>
                    </div>
                </Card>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search clerks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                    <Badge variant="neutral">{filteredClerks.length} clerks</Badge>
                </div>
            </Card>

            {/* Clerks List */}
            {isLoading ? (
                <Card className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                </Card>
            ) : filteredClerks.length === 0 ? (
                <Card className="text-center py-12">
                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No clerks found</h3>
                    <p className="text-neutral-500 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'Create your first clerk to get started'}
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClerks.map((clerk: Clerk) => (
                        <Card key={clerk.id} className="p-6 relative group">
                            {/* Actions */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleDelete(clerk)}
                                    className="p-2 rounded-lg hover:bg-red-100 text-neutral-400 hover:text-red-600"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold ${clerk.isActive ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-neutral-400 to-neutral-600'}`}>
                                    {clerk.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-neutral-900 truncate">{clerk.name}</h3>
                                    <div className="flex items-center gap-1 text-sm text-neutral-500 mt-1">
                                        <Mail className="h-3 w-3" />
                                        <span className="truncate">{clerk.email}</span>
                                    </div>
                                    <div className="mt-3">
                                        {clerk.isActive ? (
                                            <Badge variant="success">Active</Badge>
                                        ) : (
                                            <Badge variant="neutral">Inactive</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-neutral-100">
                                <Button
                                    variant={clerk.isActive ? 'outline' : 'primary'}
                                    size="sm"
                                    className="w-full"
                                    onClick={() => handleToggle(clerk)}
                                    isLoading={toggleMutation.isPending}
                                >
                                    {clerk.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Create Clerk</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg hover:bg-neutral-100">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="p-3 rounded-lg bg-blue-50 text-sm text-blue-700">
                                <p>Login credentials will be auto-generated and sent to the clerk's email.</p>
                            </div>

                            <Input
                                label="Clerk Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., John Doe"
                                required
                            />

                            <Input
                                label="Email Address"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="e.g., john.doe@college.edu"
                                required
                            />

                            <p className="text-xs text-neutral-500">
                                <strong>Clerk Permissions:</strong> Enter semester-end marks and revaluation marks only.
                                Cannot approve, finalize, or publish results.
                            </p>

                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    isLoading={createMutation.isPending}
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
