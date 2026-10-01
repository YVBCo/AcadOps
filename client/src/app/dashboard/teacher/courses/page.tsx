'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    BookOpen,
    Users,
    FileText,
    ClipboardCheck,
    Loader2,
    Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CourseAllocation {
    id: number;
    courseId: number;
    sectionId: number;
    semesterNumber: number;
    course: { id: number; name: string; code: string; credits: number };
    section: {
        id: number;
        name: string;
        batch: { id: number; name: string; currentSemester: number };
        _count: { students: number };
    };
}

export default function TeacherCoursesPage() {
    const { user } = useAuthStore();

    // Fetch allocations
    const { data: allocations = [], isLoading } = useQuery({
        queryKey: ['teacher-allocations'],
        queryFn: teacherApi.getMyAllocations,
        enabled: !!user,
    });

    // Group allocations by batch
    const groupedByBatch = useMemo(() => {
        const groups: Record<string, CourseAllocation[]> = {};
        (allocations as CourseAllocation[]).forEach(alloc => {
            const batchName = alloc.section.batch.name;
            if (!groups[batchName]) {
                groups[batchName] = [];
            }
            groups[batchName].push(alloc);
        });
        return groups;
    }, [allocations]);

    // Calculate stats
    const stats = useMemo(() => {
        const allocs = allocations as CourseAllocation[];
        const uniqueCourses = new Set(allocs.map(a => a.courseId)).size;
        const uniqueSections = new Set(allocs.map(a => a.sectionId)).size;
        const totalStudents = allocs.reduce((sum, a) => sum + (a.section._count?.students || 0), 0);

        return { courses: uniqueCourses, sections: uniqueSections, students: totalStudents };
    }, [allocations]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">My Courses</h1>
                <p className="text-neutral-500 mt-1">View all your course allocations</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-neutral-900">{stats.courses}</p>
                        <p className="text-sm text-neutral-500">Unique Courses</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-neutral-900">{stats.sections}</p>
                        <p className="text-sm text-neutral-500">Sections</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-neutral-900">{stats.students}</p>
                        <p className="text-sm text-neutral-500">Total Students</p>
                    </div>
                </Card>
            </div>

            {/* Empty state */}
            {(allocations as CourseAllocation[]).length === 0 ? (
                <Card className="p-12 text-center">
                    <BookOpen className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No Course Allocations</h3>
                    <p className="text-neutral-500">You haven't been allocated any courses yet. Contact your Department Admin.</p>
                </Card>
            ) : (
                /* Grouped by Batch */
                <div className="space-y-8">
                    {Object.entries(groupedByBatch).map(([batchName, batchAllocations]) => (
                        <div key={batchName}>
                            <div className="flex items-center gap-3 mb-4">
                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-sm px-3 py-1">
                                    Batch {batchName}
                                </Badge>
                                <span className="text-sm text-neutral-500">
                                    {batchAllocations.length} {batchAllocations.length === 1 ? 'allocation' : 'allocations'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {batchAllocations.map((alloc) => (
                                    <Card key={alloc.id} className="p-5 hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-4">
                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                                                <BookOpen className="h-6 w-6 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-neutral-900">
                                                        {alloc.course.code}
                                                    </h4>
                                                    <Badge variant="outline" className="text-xs">
                                                        {alloc.course.credits} Credits
                                                    </Badge>
                                                </div>
                                                <p className="text-neutral-600 mt-0.5">{alloc.course.name}</p>

                                                <div className="flex items-center gap-3 mt-3 text-sm text-neutral-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        Section {alloc.section.name}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-3.5 w-3.5" />
                                                        {alloc.section._count?.students || 0} students
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 mt-4">
                                                    <Link href={`/dashboard/teacher/internal-marks?allocationId=${alloc.id}`}>
                                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                                                            Enter Marks
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/dashboard/teacher/attendance?allocationId=${alloc.id}`}>
                                                        <Button size="sm" variant="outline">
                                                            <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                                                            Attendance
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
