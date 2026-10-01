'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { batchApi } from '@/lib/api';
import {
    Users,
    ArrowLeft,
    Building2,
    ArrowRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Student {
    id: number;
    program: {
        id: number;
        name: string;
        code: string;
        departmentId: number;
        department?: {
            id: number;
            name: string;
            code: string;
        }
    };
}

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
}

interface Department {
    id: number;
    name: string;
    code: string;
    studentCount: number;
}

export default function BatchDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = parseInt(params.id as string);

    const [batch, setBatch] = useState<Batch | null>(null);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                // Fetch batch and students to derive departments
                const [batchData, studentsData] = await Promise.all([
                    batchApi.getById(batchId),
                    batchApi.getStudents(batchId)
                ]);

                setBatch(batchData);

                // Derive unique departments from students
                const deptMap = new Map<number, Department>();
                (studentsData as unknown as Student[]).forEach(student => {
                    if (student.program?.department) {
                        const dept = student.program.department;
                        // Use departmentId as key to ensure uniqueness
                        const deptId = student.program.departmentId;

                        // If department object is available via include
                        if (student.program.department) {
                            if (!deptMap.has(deptId)) {
                                deptMap.set(deptId, {
                                    id: deptId,
                                    name: student.program.department.name,
                                    code: student.program.department.code,
                                    studentCount: 0
                                });
                            }
                            const existing = deptMap.get(deptId)!;
                            existing.studentCount++;
                        }
                    }
                });

                setDepartments(Array.from(deptMap.values()));

            } catch (error) {
                console.error('Failed to load batch data:', error);
                alert('Failed to load batch details');
            } finally {
                setLoading(false);
            }
        };

        if (batchId) {
            loadData();
        }
    }, [batchId]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!batch) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-neutral-900">Batch Not Found</h1>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8 animate-fade-in min-h-screen content-start">
            {/* Header */}
            <div>
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-4 pl-0 hover:pl-2 transition-all"
                    leftIcon={ArrowLeft}
                >
                    Back to Batches
                </Button>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-display text-neutral-900">
                            Batch {batch.name}
                        </h1>
                        <p className="text-neutral-500 mt-1 flex items-center gap-2">
                            Select a department to view enrolled students
                        </p>
                    </div>
                </div>
            </div>

            {/* Departments Grid */}
            {departments.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-neutral-200">
                    <div className="h-16 w-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-neutral-300" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-900">No Departments Found</h3>
                    <p className="text-neutral-500 mt-1">No students have been assigned to departments in this batch yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {departments.map((dept) => (
                        <div
                            key={dept.id}
                            onClick={() => router.push(`/dashboard/admin/batches/${batchId}/${dept.id}`)}
                            className="cursor-pointer group relative h-full"
                        >
                            {/* Glowing Background Effect */}
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
                                        <div className="text-xl font-bold text-neutral-900 font-display line-clamp-2">
                                            {dept.name}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-neutral-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-neutral-400" />
                                        <span className="font-semibold text-neutral-900">{dept.studentCount}</span>
                                        <span className="text-neutral-500 text-sm">Students</span>
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
}
