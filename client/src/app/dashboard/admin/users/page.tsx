'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Users,
    Pencil,
    Trash2,
    Search,
    X,
    Shield,
    GraduationCap,
    BookOpen,
    UserCog,
    Upload,
    Calendar,
    ArrowRight,
    Building2,
    ArrowLeft,
    Eye,
    ClipboardList,
    Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { userApi, departmentApi, programApi, studentApi, batchApi } from '@/lib/api';
import { useAuthStore, roleLabels, roleVariants, type UserRole } from '@/lib/auth-store';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';
import { type BadgeVariant } from '@/components/ui/badge';

const roleIcons: Partial<Record<UserRole, any>> = {
    STUDENT: GraduationCap,
    TEACHER: BookOpen,
    DEPARTMENT_ADMIN: Building2,
    SUPER_ADMIN: Shield,
    COE: UserCog,
    CLERK: ClipboardList,
    ADMISSIONS_ADMIN: ClipboardList,
    ADMIN_CLERK: ClipboardList,
    FIRST_YEAR_COORDINATOR: Layers3,
    PARENT: Users,
};

interface User {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: number;
    department?: { id: number; name: string; code: string };
    studentProfile?: {
        rollNumber: string;
        section?: { name: string };
        program?: { name: string; code: string };
    };
    isActive?: boolean;
    createdAt: string;
}

interface Department {
    id: number;
    name: string;
    code: string;
    studentCount?: number;
}

interface Program {
    id: number;
    name: string;
    code: string;
    departmentId: number;
}

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester?: number;
    isGraduated?: boolean;
    graduatedAt?: string;
    _count?: { students: number };
}

export default function UsersPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();

    // View State
    const [viewLevel, setViewLevel] = useState<'BATCHES' | 'DEPARTMENTS' | 'STUDENTS'>('BATCHES');
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [roleFilter, setRoleFilter] = useState<UserRole>('STUDENT');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ created: number } | null>(null);

    // Forms
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'STUDENT' as UserRole,
        departmentId: undefined as number | undefined,
        rollNumber: '',
        admissionYear: new Date().getFullYear(),
        currentSemester: 1,
    });

    const [bulkFormData, setBulkFormData] = useState({
        departmentId: 0,
        rollNumberPrefix: '',
        startNumber: 1,
        endNumber: 60,
        admissionYear: new Date().getFullYear(),
        currentSemester: 1,
        cycle: undefined as 'PHYSICS' | 'CHEMISTRY' | undefined,
        emailDomain: 'vcet.edu.in'
    });

    // Queries
    const { data: usersData, isLoading: isUsersLoading } = useQuery({
        queryKey: ['users', roleFilter, selectedDept?.id],
        queryFn: () => userApi.getAll({
            role: roleFilter,
            departmentId: roleFilter === 'STUDENT' ? undefined : undefined // Fetch all for non-students for simplicity, or filter by dept
        }),
    });

    const { data: batches = [] } = useQuery({
        queryKey: ['batches'],
        queryFn: batchApi.getAll,
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentApi.getAll,
    });

    const { data: programs = [] } = useQuery({
        queryKey: ['programs'],
        queryFn: () => programApi.getAll(),
    });

    const { data: deptStudentsData } = useQuery({
        queryKey: ['deptStudents', selectedDept?.id, selectedBatch?.id, currentUser?.departmentId],
        queryFn: async () => {
            if (selectedDept?.id === -1 && selectedBatch) {
                const profiles = await batchApi.getStudents(selectedBatch.id);
                return {
                    users: profiles.map((profile: any) => ({
                        ...profile.user,
                        studentProfile: {
                            ...profile,
                            section: profile.section,
                            program: profile.program,
                        },
                    })),
                };
            }
            return studentApi.getStudents({
                // For Dept Admin, use their department; otherwise use selected department
                departmentId: currentUser?.role === 'DEPARTMENT_ADMIN'
                    ? currentUser.departmentId
                    : selectedDept?.id,
                batchId: selectedBatch?.id,
                take: 1000 // Increased to show all students in a department/batch
            });
        },
        enabled: !!(selectedBatch && viewLevel === 'STUDENTS' &&
            (selectedDept?.id === -1 || selectedDept?.id || (currentUser?.role === 'DEPARTMENT_ADMIN' && currentUser.departmentId))),
    });

    // Query for student counts per department for selected batch
    const { data: studentCounts = [] } = useQuery({
        queryKey: ['studentCounts', selectedBatch?.id],
        queryFn: () => studentApi.getCountsByBatch(selectedBatch!.id),
        enabled: !!selectedBatch && viewLevel === 'DEPARTMENTS',
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: userApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeModal();
            toast.success('User created successfully');
        },
        onError: (err: unknown) => toast.error(getApiErrorMessage(err, 'Failed to create user')),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => userApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            closeModal();
            toast.success('User updated successfully');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: userApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User deleted');
        },
    });

    const toggleActivationMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
            userApi.toggleActivation(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User status updated');
        },
    });

    const bulkCreateMutation = useMutation({
        mutationFn: studentApi.bulkCreate,
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['studentCounts'] }); // Refresh counts
            setBulkResult(result);
            toast.success(`${result.created} students created`);
        },
        onError: (error: unknown) => {
            const axiosError = error as any;
            const message = axiosError?.response?.data?.error
                || axiosError?.response?.data?.message
                || axiosError?.message
                || 'Failed to create students';
            toast.error(message);
            console.error('Bulk create error details:', JSON.stringify(axiosError?.response?.data, null, 2));
        },
    });

    // Derived Logic
    const users = usersData?.users || [];
    const deptStudents = deptStudentsData?.users || [];

    // For Hierarchical View - use real counts from API
    const batchDepartments = useMemo(() => {
        if (!selectedBatch) return [];
        const countsMap = new Map(studentCounts.map((c: { departmentId: number; count: number }) => [c.departmentId, c.count]));
        const departmentCards = departments.map((dept: Department) => ({
            ...dept,
            studentCount: countsMap.get(dept.id) || 0
        }));
        if (currentUser?.role === 'SUPER_ADMIN') {
            departmentCards.unshift({
                id: -1,
                name: 'All batch students',
                code: 'ALL',
                studentCount: selectedBatch._count?.students || 0,
            });
        }
        return departmentCards;
    }, [selectedBatch, departments, studentCounts, currentUser?.role]);

    const displayedUsers = roleFilter === 'STUDENT' && viewLevel === 'STUDENTS' ? deptStudents : users;

    const filteredUsers = displayedUsers.filter(
        (user: User) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.studentProfile?.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Handlers
    const handleBulkCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setBulkResult(null);
        // Only send required fields - programId and batchId are resolved on backend
        const payload = {
            departmentId: bulkFormData.departmentId,
            rollNumberPrefix: bulkFormData.rollNumberPrefix,
            startNumber: bulkFormData.startNumber,
            endNumber: bulkFormData.endNumber,
            admissionYear: bulkFormData.admissionYear,
            currentSemester: bulkFormData.currentSemester,
            emailDomain: bulkFormData.emailDomain,
            ...(bulkFormData.cycle && { cycle: bulkFormData.cycle }),
        };
        bulkCreateMutation.mutate(payload);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            name: '',
            email: '',
            password: '',
            role: 'STUDENT',
            departmentId: currentUser?.departmentId || undefined,
            rollNumber: '',
            admissionYear: new Date().getFullYear(),
            currentSemester: 1,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            departmentId: user.departmentId,
            rollNumber: user.studentProfile?.rollNumber || '',
            admissionYear: new Date().getFullYear(),
            currentSemester: 1,
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser) {
            updateMutation.mutate({
                id: editingUser.id,
                data: {
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    departmentId: formData.departmentId,
                },
            });
        } else {
            createMutation.mutate({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                departmentId: formData.departmentId,
                ...(formData.role === 'STUDENT' && {
                    rollNumber: formData.rollNumber,
                    admissionYear: formData.admissionYear,
                    currentSemester: formData.currentSemester,
                }),
            } as any);
        }
    };

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this user?')) {
            deleteMutation.mutate(id);
        }
    };

    // Handle batch click - for Dept Admins, skip to students directly
    const handleBatchClick = (batch: Batch) => {
        setSelectedBatch(batch);
        if (currentUser?.role === 'DEPARTMENT_ADMIN' && currentUser.departmentId) {
            // For Department Admin, skip department selection and go directly to students
            const userDept = departments.find((d: Department) => d.id === currentUser.departmentId);
            if (userDept) {
                setSelectedDept(userDept);
                setViewLevel('STUDENTS');
            } else {
                setViewLevel('STUDENTS'); // Still skip, dept will be auto-filtered
            }
        } else {
            // For Super Admin, show department selection
            setViewLevel('DEPARTMENTS');
        }
    };

    // Render Helpers
    const renderBatchGrid = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-neutral-800">Select Batch</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {batches.map((batch: Batch) => (
                    <div key={batch.id} onClick={() => handleBatchClick(batch)} className="cursor-pointer group relative h-full">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-400 to-accent-600 rounded-2xl opacity-20 blur group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative h-full bg-white rounded-2xl p-6 shadow-xl border border-white/20 flex flex-col justify-between overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full -mr-8 -mt-8"></div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-bold text-xl shadow-inner border border-primary-100">
                                        {batch.name.substring(0, 2)}
                                    </div>
                                    <Badge variant={batch.isGraduated ? 'success' : 'neutral'} className="shadow-sm">
                                        {batch.isGraduated ? 'Graduated' : 'Active'}
                                    </Badge>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-1">Batch</h3>
                                    <div className="text-3xl font-bold text-neutral-900 font-display">{batch.name}</div>
                                    <div className="flex items-center gap-2 text-primary-600 text-sm mt-1 font-medium">
                                        <Calendar className="w-4 h-4" />
                                        <span>Started {batch.startYear}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-neutral-600">
                                    <Users className="w-4 h-4" />
                                    <span className="font-semibold">{batch._count?.students || 0}</span> Students
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDepartmentGrid = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => { setViewLevel('BATCHES'); setSelectedBatch(null); }} leftIcon={ArrowLeft}>Back to Batches</Button>
                <h2 className="text-xl font-semibold text-neutral-800">Batch {selectedBatch?.name} / Select Department</h2>
            </div>
            {batchDepartments.length === 0 ? (
                <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                    <p className="text-neutral-500">No departments found for this batch.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {batchDepartments.map((dept: Department) => (
                        <div key={dept.id} onClick={() => { setSelectedDept(dept); setViewLevel('STUDENTS'); }} className="cursor-pointer group relative h-full">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-secondary-400 to-accent-600 rounded-2xl opacity-20 blur group-hover:opacity-40 transition duration-500"></div>
                            <div className="relative h-full bg-white rounded-2xl p-6 shadow-xl border border-white/20 flex flex-col justify-between overflow-hidden">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-secondary-100 to-secondary-50 flex items-center justify-center text-secondary-600 font-bold text-xl shadow-inner border border-secondary-100">
                                            {dept.code}
                                        </div>
                                        <Badge variant="neutral" className="shadow-sm">{dept.code}</Badge>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-1">Department</h3>
                                        <div className="text-xl font-bold text-neutral-900 font-display line-clamp-2">{dept.name}</div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-neutral-400" />
                                        <span className="font-semibold text-neutral-900">{dept.studentCount}</span> Students
                                    </div>
                                    <div className="h-8 w-8 rounded-full bg-secondary-50 flex items-center justify-center group-hover:bg-secondary-100 transition-colors">
                                        <ArrowRight className="w-4 h-4 text-secondary-600 group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderUserTable = () => (
        <Card>
            {(roleFilter !== 'STUDENT' && isUsersLoading) ? (
                <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
            ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center">
                    <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No users found</h3>
                    <p className="text-neutral-500 mt-1">{searchQuery ? 'Try adjusting your search' : 'No users available'}</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                {roleFilter === 'STUDENT' && <th>Roll Number</th>}
                                <th>Department</th>
                                {roleFilter === 'STUDENT' && <th>Section</th>}
                                <th>Created</th>
                                <th className="w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user: User) => {
                                const RoleIcon = roleIcons[user.role] || Users;
                                return (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-neutral-900">{user.name}</p>
                                                    <p className="text-sm text-neutral-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant={roleVariants[user.role] || 'neutral'}>
                                                <RoleIcon className="h-3 w-3 mr-1" /> {roleLabels[user.role]}
                                            </Badge>
                                        </td>
                                        {roleFilter === 'STUDENT' && (
                                            <td>
                                                {user.studentProfile ? (
                                                    <Badge variant="neutral" className="font-mono text-xs">{user.studentProfile.rollNumber}</Badge>
                                                ) : <span className="text-neutral-300 text-xs">—</span>}
                                            </td>
                                        )}
                                        <td>
                                            {user.department ? <span className="text-neutral-600">{user.department.name}</span> : <span className="text-neutral-400">—</span>}
                                        </td>
                                        {roleFilter === 'STUDENT' && (
                                            <td>
                                                {user.studentProfile?.section ? (
                                                    <Badge variant="success" className="py-0 px-2 h-5">Section {user.studentProfile.section.name}</Badge>
                                                ) : <span className="text-neutral-400 text-sm italic">Unassigned</span>}
                                            </td>
                                        )}
                                        <td className="text-neutral-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex gap-1">
                                                {user.role === 'STUDENT' ? (
                                                    <button
                                                        onClick={() => router.push(`/dashboard/admin/students/${user.id}`)}
                                                        className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600"
                                                        title="View Profile"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                ) : (
                                                    <button onClick={() => openEditModal(user)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600"><Pencil className="h-4 w-4" /></button>
                                                )}

                                                {currentUser?.role === 'SUPER_ADMIN' && user.role === 'COE' && (
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(user.isActive ? 'Deactivate this user?' : 'Activate this user?')) {
                                                                toggleActivationMutation.mutate({ id: user.id, isActive: !user.isActive });
                                                            }
                                                        }}
                                                        className={`p-2 rounded-lg hover:bg-neutral-100 ${user.isActive ? 'text-green-600' : 'text-red-500'}`}
                                                        title={user.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {user.isActive ? <Shield className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                    </button>
                                                )}

                                                {currentUser?.role === 'SUPER_ADMIN' && user.id !== currentUser.id && (
                                                    <button onClick={() => handleDelete(user.id)} className="p-2 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Student Management</h1>
                    <p className="text-neutral-500 mt-1">Manage student accounts and enrollments</p>
                </div>
                <div className="flex gap-2">
                    {currentUser?.role !== 'DEPARTMENT_ADMIN' && (
                        <Button variant="secondary" leftIcon={Upload} onClick={() => setIsBulkModalOpen(true)}>Bulk Create Students</Button>
                    )}
                    <Button leftIcon={Plus} onClick={openCreateModal}>Add Student</Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                    {/* Role filter removed - Students only */}
                </div>
            </Card>

            {/* Content Area */}
            {roleFilter === 'STUDENT' ? (
                <div className="min-h-[400px]">
                    {viewLevel === 'BATCHES' && renderBatchGrid()}
                    {viewLevel === 'DEPARTMENTS' && renderDepartmentGrid()}
                    {viewLevel === 'STUDENTS' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-4">
                                {/* For Dept Admin, go back to batches; for others, go back to departments */}
                                {currentUser?.role === 'DEPARTMENT_ADMIN' ? (
                                    <Button variant="ghost" onClick={() => { setViewLevel('BATCHES'); setSelectedBatch(null); setSelectedDept(null); }} leftIcon={ArrowLeft}>Back to Batches</Button>
                                ) : (
                                    <Button variant="ghost" onClick={() => { setViewLevel('DEPARTMENTS'); setSelectedDept(null); }} leftIcon={ArrowLeft}>Back to Departments</Button>
                                )}
                                <div className="flex items-center gap-2">
                                    <Badge variant="neutral">Batch {selectedBatch?.name}</Badge>
                                    <Badge variant="primary">{selectedDept?.id === -1 ? 'ALL' : selectedDept?.code || currentUser?.department?.code}</Badge>
                                    <span className="font-semibold text-neutral-800">
                                        {selectedDept?.id === -1 ? 'All batch' : selectedDept?.name || currentUser?.department?.name} Students
                                    </span>
                                </div>
                            </div>
                            {renderUserTable()}
                        </div>
                    )}
                </div>
            ) : (
                renderUserTable()
            )}

            {/* User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">{editingUser ? 'Edit User' : 'Create User'}</h2>
                            <button onClick={closeModal} className="p-2 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5 text-neutral-500" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <Input label="Full Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" required />
                            <Input label="Email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Enter email address" required />
                            {!editingUser && <Input label="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Enter password (min 8 chars)" required />}
                            <div>
                                <label className="label">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="input"
                                    disabled
                                >
                                    <option value="STUDENT">Student</option>
                                </select>
                                <p className="text-xs text-neutral-500 mt-1">Only student accounts can be created here</p>
                            </div>
                            {/* Student-specific fields */}
                            {!editingUser && formData.role === 'STUDENT' && (
                                <>
                                    <Input label="Roll Number (USN)" value={formData.rollNumber} onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value.toUpperCase() })} placeholder="e.g. 4MH24CS001" required />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="label">Admission Year</label>
                                            <input type="number" value={formData.admissionYear} onChange={(e) => setFormData({ ...formData, admissionYear: parseInt(e.target.value) || new Date().getFullYear() })} className="input" min={2000} max={2100} required />
                                        </div>
                                        <div>
                                            <label className="label">Current Semester</label>
                                            <select value={formData.currentSemester} onChange={(e) => setFormData({ ...formData, currentSemester: parseInt(e.target.value) })} className="input">
                                                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="label">Department</label>
                                <select value={formData.departmentId || ''} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value ? parseInt(e.target.value) : undefined })} className="input" disabled={currentUser?.role === 'DEPARTMENT_ADMIN'} required>
                                    <option value="">Select Department</option>
                                    {departments.map((dept: Department) => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="ghost" onClick={closeModal} className="flex-1">Cancel</Button>
                                <Button type="submit" className="flex-1" isLoading={createMutation.isPending || updateMutation.isPending}>{editingUser ? 'Update' : 'Create'}</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Create Modal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }} />
                    <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Bulk Create Students</h2>
                            <button onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }} className="p-1 rounded-lg hover:bg-neutral-100"><X className="h-5 w-5" /></button>
                        </div>
                        {bulkResult ? (
                            <div className="p-6 space-y-4 text-center">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4"><GraduationCap className="h-8 w-8 text-green-600" /></div>
                                <h3 className="text-xl font-semibold text-neutral-900">{bulkResult.created} Students Created</h3>
                                <Button onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }} className="w-full">Done</Button>
                            </div>
                        ) : (
                            <form onSubmit={handleBulkCreate} className="p-6 space-y-4">
                                <div>
                                    <label className="label">Department</label>
                                    <select
                                        value={bulkFormData.departmentId}
                                        onChange={(e) => {
                                            const deptId = parseInt(e.target.value);
                                            setBulkFormData({
                                                ...bulkFormData,
                                                departmentId: deptId,
                                            });
                                        }}
                                        className="input"
                                        required
                                    >
                                        <option value="0">Select Department</option>
                                        {departments.map((dept: Department) => (
                                            <option key={dept.id} value={dept.id}>
                                                {dept.name} ({dept.code})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Students will belong to this department
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Roll Number Prefix</label>
                                    <input
                                        type="text"
                                        value={bulkFormData.rollNumberPrefix}
                                        onChange={(e) => setBulkFormData({ ...bulkFormData, rollNumberPrefix: e.target.value.toUpperCase() })}
                                        placeholder="e.g., 4MH23CS"
                                        className="input"
                                        required
                                    />
                                    <p className="text-xs text-neutral-500 mt-1">
                                        Students will have roll numbers like {bulkFormData.rollNumberPrefix || 'PREFIX'}001, {bulkFormData.rollNumberPrefix || 'PREFIX'}002, etc.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Start Number</label>
                                        <input
                                            type="number"
                                            value={bulkFormData.startNumber || ''}
                                            onChange={(e) => setBulkFormData({ ...bulkFormData, startNumber: e.target.value ? parseInt(e.target.value) : 0 })}
                                            min={1}
                                            max={999}
                                            className="input"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">End Number</label>
                                        <input
                                            type="number"
                                            value={bulkFormData.endNumber || ''}
                                            onChange={(e) => setBulkFormData({ ...bulkFormData, endNumber: e.target.value ? parseInt(e.target.value) : 0 })}
                                            min={1}
                                            max={999}
                                            className="input"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Admission Year</label>
                                    <input
                                        type="number"
                                        value={bulkFormData.admissionYear}
                                        onChange={(e) => setBulkFormData({ ...bulkFormData, admissionYear: parseInt(e.target.value) })}
                                        placeholder="e.g., 2023"
                                        className="input"
                                        required
                                    />
                                    <p className="text-xs text-neutral-500 mt-1">
                                        This will be the batch for these students
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Current Semester</label>
                                        <select
                                            value={bulkFormData.currentSemester}
                                            onChange={(e) => setBulkFormData({ ...bulkFormData, currentSemester: parseInt(e.target.value) })}
                                            className="input"
                                            required
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                                <option key={sem} value={sem}>{sem}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {(bulkFormData.currentSemester <= 2) && (
                                        <div>
                                            <label className="label">First Year Cycle</label>
                                            <select
                                                value={bulkFormData.cycle || ''}
                                                onChange={(e) => setBulkFormData({ ...bulkFormData, cycle: e.target.value as 'PHYSICS' | 'CHEMISTRY' | undefined })}
                                                className="input"
                                                required
                                            >
                                                <option value="">Select Cycle</option>
                                                <option value="PHYSICS">Physics Cycle</option>
                                                <option value="CHEMISTRY">Chemistry Cycle</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="label">Email Domain</label>
                                    <input
                                        type="text"
                                        value={bulkFormData.emailDomain}
                                        onChange={(e) => setBulkFormData({ ...bulkFormData, emailDomain: e.target.value })}
                                        placeholder="student.edu"
                                        className="input"
                                    />
                                </div>
                                <div className="bg-primary-50 rounded-lg p-4">
                                    <p className="text-sm text-primary-700">
                                        <strong>Preview:</strong> {bulkFormData.endNumber - bulkFormData.startNumber + 1} students with roll numbers from{' '}
                                        <span className="font-mono bg-primary-100 px-1 rounded">{bulkFormData.rollNumberPrefix}{String(bulkFormData.startNumber).padStart(3, '0')}</span> to{' '}
                                        <span className="font-mono bg-primary-100 px-1 rounded">{bulkFormData.rollNumberPrefix}{String(bulkFormData.endNumber).padStart(3, '0')}</span>
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="ghost" onClick={() => { setIsBulkModalOpen(false); setBulkResult(null); }} className="flex-1">Cancel</Button>
                                    <Button type="submit" className="flex-1" isLoading={bulkCreateMutation.isPending} disabled={!bulkFormData.departmentId || !bulkFormData.rollNumberPrefix || !bulkFormData.admissionYear || (bulkFormData.currentSemester <= 2 && !bulkFormData.cycle)}>
                                        Create {bulkFormData.endNumber - bulkFormData.startNumber + 1} Students
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
