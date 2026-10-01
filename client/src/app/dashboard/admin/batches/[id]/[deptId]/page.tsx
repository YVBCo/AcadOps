'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { batchApi, departmentApi } from '@/lib/api';
import {
    Users,
    Search,
    ArrowLeft,
    Eye
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Student {
    id: number;
    rollNumber: string;
    user: {
        id: number;
        name: string;
        email: string;
    };
    program: {
        id: number;
        name: string;
        code: string;
        departmentId: number;
    };
    section?: {
        id: number;
        name: string;
    } | null;
}

interface Batch {
    id: number;
    name: string;
}

interface Department {
    id: number;
    name: string;
    code: string;
}

export default function BatchDepartmentPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = parseInt(params.id as string);
    const deptId = parseInt(params.deptId as string);

    const [batch, setBatch] = useState<Batch | null>(null);
    const [department, setDepartment] = useState<Department | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [batchData, studentsData, deptsData] = await Promise.all([
                    batchApi.getById(batchId),
                    batchApi.getStudents(batchId),
                    departmentApi.getAll()
                ]);

                setBatch(batchData);

                // Find current department
                const currentDept = deptsData.find((d: Department) => d.id === deptId);
                setDepartment(currentDept || null);

                // Filter students by department immediately
                const deptStudents = (studentsData as unknown as Student[]).filter(
                    s => s.program.departmentId === deptId
                );
                setStudents(deptStudents);

            } catch (error) {
                console.error('Failed to load data:', error);
                alert('Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        if (batchId && deptId) {
            loadData();
        }
    }, [batchId, deptId]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery) return students;

        const query = searchQuery.toLowerCase();
        return students.filter(student => {
            const matchesName = student.user.name.toLowerCase().includes(query);
            const matchesEmail = student.user.email.toLowerCase().includes(query);
            const matchesRoll = student.rollNumber.toLowerCase().includes(query);

            return matchesName || matchesEmail || matchesRoll;
        });
    }, [students, searchQuery]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!batch || !department) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-neutral-900">Not Found</h1>
                <p className="text-neutral-500">Batch or Department not found.</p>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in min-h-screen">
            {/* Header */}
            <div>
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-4 pl-0 hover:pl-2 transition-all"
                    leftIcon={ArrowLeft}
                >
                    Back to Departments
                </Button>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="neutral" className="font-mono">Batch {batch.name}</Badge>
                            <Badge variant="primary" className="font-mono">{department.code}</Badge>
                        </div>
                        <h1 className="text-3xl font-bold font-display text-neutral-900">
                            {department.name} Students
                        </h1>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <Card className="p-4 bg-white shadow-sm border-neutral-200">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, USN..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="text-sm text-neutral-500 font-medium">
                        Showing {filteredStudents.length} students
                    </div>
                </div>
            </Card>

            {/* Students Table */}
            <Card className="overflow-hidden border-neutral-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Roll Number</th>
                                <th>Program</th>
                                <th>Section</th>
                                <th className="w-20 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Search className="h-8 w-8 text-neutral-300" />
                                            <p className="font-medium">No students found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold uppercase">
                                                    {student.user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-neutral-900">{student.user.name}</div>
                                                    <div className="text-xs text-neutral-500">{student.user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge variant="neutral" className="font-mono text-xs">
                                                {student.rollNumber}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="font-medium text-neutral-900">{student.program.code}</div>
                                        </td>
                                        <td>
                                            {student.section ? (
                                                <Badge variant="success" className="py-0 px-2">
                                                    Section {student.section.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-neutral-400 text-sm italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => router.push(`/dashboard/admin/students/${student.user.id}`)}
                                                    className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-all"
                                                    title="View Full Profile"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
