'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    UserCog,
    Plus,
    Mail,
    Briefcase,
    AlertCircle,
    BookOpen,
    Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Teacher {
    id: number;
    name: string;
    email: string;
    teacherProfile: {
        id: number;
        employeeId: string;
        designation: string | null;
        subjectAssignments: Array<{
            subject: {
                course: { name: string; code: string };
            };
        }>;
        courseAllocations: Array<{
            course: { name: string; code: string };
            section: { name: string };
        }>;
    };
}

export default function TeachersPage() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeacher, setNewTeacher] = useState({
        name: '',
        email: '',
        employeeId: '',
        designation: '',
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchTeachers();
    }, []);

    const fetchTeachers = async () => {
        try {
            setLoading(true);
            setError(null);

            const res = await api.get('/dept-admin/teachers');
            setTeachers(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load teachers');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeacher = async () => {
        if (!newTeacher.name || !newTeacher.email || !newTeacher.employeeId) {
            setError('Name, email, and employee ID are required');
            return;
        }

        try {
            setCreating(true);
            setError(null);
            await api.post('/dept-admin/teachers', newTeacher);
            setSuccess('Teacher created successfully. Credentials sent via email.');
            setShowCreateModal(false);
            setNewTeacher({ name: '', email: '', employeeId: '', designation: '' });
            fetchTeachers();
            setTimeout(() => setSuccess(null), 5000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create teacher');
        } finally {
            setCreating(false);
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
                    <h1 className="text-2xl font-bold text-neutral-900">Teachers</h1>
                    <p className="text-neutral-500">Manage department teachers and their course assignments</p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Teacher
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <Check className="h-5 w-5 text-emerald-500" />
                    <span className="text-emerald-700">{success}</span>
                </div>
            )}

            {/* Teachers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teachers.map((teacher) => (
                    <div
                        key={teacher.id}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-100 hover:shadow-xl transition-shadow"
                    >
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                                {teacher.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-neutral-900 truncate">{teacher.name}</h3>
                                <p className="text-sm text-neutral-500 truncate">{teacher.email}</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="h-4 w-4 text-neutral-400" />
                                <span className="text-neutral-600">
                                    {teacher.teacherProfile?.employeeId || 'N/A'}
                                </span>
                            </div>
                            {teacher.teacherProfile?.designation && (
                                <div className="flex items-center gap-2 text-sm">
                                    <UserCog className="h-4 w-4 text-neutral-400" />
                                    <span className="text-neutral-600">
                                        {teacher.teacherProfile.designation}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Course Allocations */}
                        {teacher.teacherProfile?.courseAllocations?.length > 0 && (
                            <div className="border-t border-neutral-100 pt-4">
                                <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
                                    Assigned Courses
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {teacher.teacherProfile.courseAllocations.slice(0, 3).map((alloc, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                            {alloc.course.code} - {alloc.section.name}
                                        </Badge>
                                    ))}
                                    {teacher.teacherProfile.courseAllocations.length > 3 && (
                                        <Badge variant="outline" className="text-xs text-neutral-400">
                                            +{teacher.teacherProfile.courseAllocations.length - 3} more
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {teachers.length === 0 && (
                <div className="text-center py-12">
                    <UserCog className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No teachers found</h3>
                    <p className="text-neutral-500">Add a new teacher to get started</p>
                </div>
            )}

            {/* Create Teacher Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-neutral-900 mb-4">Add New Teacher</h2>
                        <p className="text-sm text-neutral-500 mb-4">
                            Credentials will be sent to the teacher's email automatically.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Full Name *
                                </label>
                                <Input
                                    value={newTeacher.name}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                                    placeholder="Dr. John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Email *
                                </label>
                                <Input
                                    type="email"
                                    value={newTeacher.email}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                    placeholder="john.doe@university.edu"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Employee ID *
                                </label>
                                <Input
                                    value={newTeacher.employeeId}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, employeeId: e.target.value })}
                                    placeholder="EMP001"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Designation
                                </label>
                                <Input
                                    value={newTeacher.designation}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, designation: e.target.value })}
                                    placeholder="Assistant Professor"
                                />
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
                                onClick={handleCreateTeacher}
                                disabled={creating}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {creating ? 'Creating...' : 'Create & Send Credentials'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
