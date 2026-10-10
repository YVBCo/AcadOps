'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    BookOpen,
    Search,
    Lock,
    Unlock,
    Building2,
    ChevronDown,
    ChevronUp,
    Users,
    ClipboardList,
    FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { courseApi, internalMarksApi, batchApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface Course {
    id: number;
    name: string;
    code: string;
    credits: number;
    departmentId: number;
    semesterNumber?: number;
    internalMarks: number;
    externalMarks: number;
    isLocked: boolean;
    lockedAt?: string;
    department?: { id: number; name: string; code: string };
}

interface Section {
    id: number;
    name: string;
    batchId: number;
    batch?: { id: number; name: string };
    _count?: { students: number };
}

interface InternalMarksDetail {
    id: number;
    studentUsn: string;
    courseId: number;
    internal1: number | null;
    internal2: number | null;
    internal3: number | null;
    assignmentMarks: number | null;
    calculatedTotal: number | null;
    isFinalized: boolean;
}

interface SemesterEndMark {
    id: number;
    studentUsn: string;
    marks: number;
    status: 'PENDING' | 'APPROVED' | 'LOCKED';
}

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
}

// Marks Viewer Component for a single course
function MarksViewer({ course, departmentId }: { course: Course; departmentId: number }) {
    const [activeTab, setActiveTab] = useState<'internal' | 'semester'>('internal');
    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [selectedSection, setSelectedSection] = useState<number | null>(null);

    // Fetch batches
    const { data: batches = [] } = useQuery<Batch[]>({
        queryKey: ['batches'],
        queryFn: () => batchApi.getAll(),
    });

    // Fetch sections for selected batch
    const { data: sections = [], isLoading: sectionsLoading } = useQuery<Section[]>({
        queryKey: ['sections', selectedBatch],
        queryFn: () => internalMarksApi.getSections(selectedBatch!),
        enabled: !!selectedBatch,
    });

    // Fetch internal marks for selected section and course
    const { data: internalMarks = [], isLoading: marksLoading } = useQuery<InternalMarksDetail[]>({
        queryKey: ['internal-marks', selectedSection, course.id],
        queryFn: () => internalMarksApi.getBySection(selectedSection!, course.id),
        enabled: !!selectedSection && activeTab === 'internal',
    });

    // Fetch semester marks
    const { data: semesterMarks = [], isLoading: semMarksLoading } = useQuery<SemesterEndMark[]>({
        queryKey: ['semester-marks', departmentId, selectedBatch, course.id],
        queryFn: () => internalMarksApi.getSemesterMarks({
            departmentId,
            batchId: selectedBatch!,
            courseId: course.id,
        }),
        enabled: !!selectedBatch && activeTab === 'semester',
    });

    return (
        <div className="bg-neutral-50 p-4 space-y-4">
            {/* Batch and Section Filters */}
            <div className="flex flex-wrap items-start gap-4">
                <div className="flex-shrink-0">
                    <label className="text-xs font-medium text-neutral-500 mb-1 block">Batch</label>
                    <select
                        value={selectedBatch || ''}
                        onChange={(e) => {
                            setSelectedBatch(e.target.value ? parseInt(e.target.value) : null);
                            setSelectedSection(null);
                        }}
                        className="input text-sm py-2 px-3 w-[220px]"
                    >
                        <option value="">Select Batch</option>
                        {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                Batch {batch.name} (Sem {batch.currentSemester})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedBatch && (
                    <div className="flex-shrink-0">
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Section</label>
                        <select
                            value={selectedSection || ''}
                            onChange={(e) => setSelectedSection(e.target.value ? parseInt(e.target.value) : null)}
                            className="input text-sm py-2 px-3 w-[220px]"
                            disabled={sectionsLoading}
                        >
                            <option value="">Select Section</option>
                            {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    Section {section.name} ({section._count?.students || 0} students)
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-neutral-200">
                <button
                    onClick={() => setActiveTab('internal')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'internal'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        }`}
                >
                    <ClipboardList className="h-4 w-4 inline mr-2" />
                    Internal Marks
                </button>
                <button
                    onClick={() => setActiveTab('semester')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'semester'
                        ? 'border-primary-600 text-primary-600'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        }`}
                >
                    <FileText className="h-4 w-4 inline mr-2" />
                    Semester Marks (View Only)
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
                {activeTab === 'internal' ? (
                    <InternalMarksTable
                        marks={internalMarks}
                        isLoading={marksLoading}
                        sectionSelected={!!selectedSection}
                    />
                ) : (
                    <SemesterMarksTable
                        marks={semesterMarks}
                        isLoading={semMarksLoading}
                        batchSelected={!!selectedBatch}
                    />
                )}
            </div>
        </div>
    );
}

// Internal Marks Table Component
function InternalMarksTable({
    marks,
    isLoading,
    sectionSelected,
}: {
    marks: InternalMarksDetail[];
    isLoading: boolean;
    sectionSelected: boolean;
}) {
    if (!sectionSelected) {
        return (
            <div className="text-center py-8 text-neutral-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Select a batch and section to view internal marks</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
            </div>
        );
    }

    if (marks.length === 0) {
        return (
            <div className="text-center py-8 text-neutral-500">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No internal marks recorded yet</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-neutral-100">
                    <tr>
                        <th className="text-left px-4 py-2 font-medium text-neutral-600">USN</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Internal 1</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Internal 2</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Internal 3</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Assignments</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Total</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                    {marks.map((mark) => (
                        <tr key={mark.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-2 font-mono text-neutral-900">{mark.studentUsn}</td>
                            <td className="px-4 py-2 text-center">{mark.internal1 ?? '-'}</td>
                            <td className="px-4 py-2 text-center">{mark.internal2 ?? '-'}</td>
                            <td className="px-4 py-2 text-center">{mark.internal3 ?? '-'}</td>
                            <td className="px-4 py-2 text-center">{mark.assignmentMarks ?? '-'}</td>
                            <td className="px-4 py-2 text-center font-semibold">
                                {mark.calculatedTotal !== null ? mark.calculatedTotal.toFixed(1) : '-'}
                            </td>
                            <td className="px-4 py-2 text-center">
                                {mark.isFinalized ? (
                                    <Badge variant="success" className="text-xs">Finalized</Badge>
                                ) : (
                                    <Badge variant="warning" className="text-xs">Pending</Badge>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Semester Marks Table Component (View Only)
function SemesterMarksTable({
    marks,
    isLoading,
    batchSelected,
}: {
    marks: SemesterEndMark[];
    isLoading: boolean;
    batchSelected: boolean;
}) {
    if (!batchSelected) {
        return (
            <div className="text-center py-8 text-neutral-500">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Select a batch to view semester marks</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
            </div>
        );
    }

    if (marks.length === 0) {
        return (
            <div className="text-center py-8 text-neutral-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No semester marks entered by COE/Clerk yet</p>
                <p className="text-xs mt-1">Semester marks are entered by the Clerk and approved by COE</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-neutral-100">
                    <tr>
                        <th className="text-left px-4 py-2 font-medium text-neutral-600">USN</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Marks (out of 50)</th>
                        <th className="text-center px-4 py-2 font-medium text-neutral-600">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                    {marks.map((mark) => (
                        <tr key={mark.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-2 font-mono text-neutral-900">{mark.studentUsn}</td>
                            <td className="px-4 py-2 text-center font-semibold">{mark.marks}</td>
                            <td className="px-4 py-2 text-center">
                                {mark.status === 'APPROVED' ? (
                                    <Badge variant="success" className="text-xs">Approved</Badge>
                                ) : mark.status === 'LOCKED' ? (
                                    <Badge variant="primary" className="text-xs">Locked</Badge>
                                ) : (
                                    <Badge variant="warning" className="text-xs">Pending</Badge>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Main Page Component
export default function DeptAdminCoursesPage() {
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSemester, setFilterSemester] = useState<number | null>(null);
    const [expandedCourse, setExpandedCourse] = useState<number | null>(null);

    // Department admins see their department; Super Admins see the tenant catalog.
    const departmentId = user?.role === 'SUPER_ADMIN' ? undefined : user?.departmentId;
    const { data: courses = [], isLoading } = useQuery<Course[]>({
        queryKey: ['courses', user?.tenantId, user?.role, departmentId],
        queryFn: () => courseApi.getAll(departmentId ? { departmentId } : undefined),
        enabled: user?.role === 'SUPER_ADMIN' || !!departmentId,
    });

    const filteredCourses = courses.filter((course: Course) => {
        const matchesSearch = course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            course.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSemester = !filterSemester || course.semesterNumber === filterSemester;
        return matchesSearch && matchesSemester;
    });

    const lockedCount = courses.filter((c: Course) => c.isLocked).length;
    const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);

    const toggleExpand = (courseId: number) => {
        setExpandedCourse(expandedCourse === courseId ? null : courseId);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">
                        Courses
                    </h1>
                    <p className="text-neutral-500 mt-1">
                        View courses and student marks for your department
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-100">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{courses.length}</p>
                        <p className="text-sm text-neutral-500">Total Courses</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-100">
                        <Unlock className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{courses.length - lockedCount}</p>
                        <p className="text-sm text-neutral-500">Editable</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-100">
                        <Lock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{lockedCount}</p>
                        <p className="text-sm text-neutral-500">Locked</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-100">
                        <Building2 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-neutral-900">{totalCredits}</p>
                        <p className="text-sm text-neutral-500">Total Credits</p>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                    <select
                        value={filterSemester || ''}
                        onChange={(e) => setFilterSemester(e.target.value ? parseInt(e.target.value) : null)}
                        className="input max-w-xs"
                    >
                        <option value="">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                            <option key={sem} value={sem}>Semester {sem}</option>
                        ))}
                    </select>
                    <Badge variant="neutral">{filteredCourses.length} courses</Badge>
                </div>
            </Card>

            {/* Courses Table */}
            {isLoading ? (
                <Card className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                </Card>
            ) : filteredCourses.length === 0 ? (
                <Card className="text-center py-12">
                    <BookOpen className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">
                        No courses found
                    </h3>
                    <p className="text-neutral-500 mt-1">
                        {searchQuery
                            ? 'Try adjusting your search'
                            : 'Courses are created by the COE and assigned to departments'
                        }
                    </p>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-neutral-50 border-b border-neutral-200">
                            <tr>
                                <th className="w-8"></th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Course</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Semester</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Credits</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Marks Distribution</th>
                                <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {filteredCourses.map((course: Course) => (
                                <React.Fragment key={course.id}>
                                    <tr
                                        className="hover:bg-neutral-50 cursor-pointer"
                                        onClick={() => toggleExpand(course.id)}
                                    >
                                        <td className="px-2 py-4 text-center">
                                            {expandedCourse === course.id ? (
                                                <ChevronUp className="h-4 w-4 text-neutral-400" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-neutral-900">{course.name}</p>
                                                <p className="text-sm text-neutral-500">{course.code}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            {course.semesterNumber ? `Semester ${course.semesterNumber}` : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="primary">{course.credits} credits</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-600">
                                            <div className="flex gap-2">
                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                    Internal: {course.internalMarks || 50}
                                                </span>
                                                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                                    External: {course.externalMarks || 50}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {course.isLocked ? (
                                                <Badge variant="warning" className="flex items-center gap-1 w-fit">
                                                    <Lock className="h-3 w-3" /> Locked
                                                </Badge>
                                            ) : (
                                                <Badge variant="success" className="flex items-center gap-1 w-fit">
                                                    <Unlock className="h-3 w-3" /> Editable
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedCourse === course.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0">
                                                <MarksViewer course={course} departmentId={user?.departmentId!} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
    );
}
