'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ClipboardCheck,
    Search,
    Save,
    AlertCircle,
    CheckCircle,
    Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { clerkMarksApi } from '@/lib/api';

interface Student {
    usn: string;
    internalMarks: number;
    semesterMarks: number | null;
    semesterMarksStatus: string | null;
}

interface MarksEntry {
    studentUsn: string;
    marks: number;
    examType: 'REGULAR' | 'MAKEUP' | 'REWRITE';
}

export default function SemesterMarksPage() {
    const queryClient = useQueryClient();
    const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
    const [examType, setExamType] = useState<'REGULAR' | 'MAKEUP' | 'REWRITE'>('REGULAR');
    const [marksData, setMarksData] = useState<Record<string, number>>({});

    // Fetch assignments (departments & batches)
    const { data: assignments, isLoading: loadingAssignments } = useQuery({
        queryKey: ['clerk-assignments'],
        queryFn: clerkMarksApi.getAssignments,
    });

    // Fetch courses for selected department
    const { data: courses = [], isLoading: loadingCourses } = useQuery({
        queryKey: ['clerk-courses', selectedDepartment],
        queryFn: () => clerkMarksApi.getCourses(selectedDepartment!),
        enabled: !!selectedDepartment,
    });

    // Fetch students for marks entry
    const { data: students = [], isLoading: loadingStudents } = useQuery({
        queryKey: ['clerk-students', selectedDepartment, selectedBatch, selectedCourse],
        queryFn: () => clerkMarksApi.getStudents(selectedDepartment!, selectedBatch!, selectedCourse!),
        enabled: !!selectedDepartment && !!selectedBatch && !!selectedCourse,
    });

    // Submit mutation
    const submitMutation = useMutation({
        mutationFn: clerkMarksApi.submitSemesterMarks,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clerk-students'] });
            queryClient.invalidateQueries({ queryKey: ['clerk-stats'] });
            setMarksData({});
            toast.success('Semester marks submitted for COE approval');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to submit marks');
        },
    });

    const handleMarksChange = (usn: string, value: string) => {
        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 0 || numValue > 50) return;
        setMarksData((prev) => ({ ...prev, [usn]: numValue }));
    };

    const handleSubmit = () => {
        if (!selectedDepartment || !selectedBatch || !selectedCourse) {
            toast.error('Please select department, batch, and course');
            return;
        }

        const entries: MarksEntry[] = Object.entries(marksData).map(([usn, marks]) => ({
            studentUsn: usn,
            marks,
            examType,
        }));

        if (entries.length === 0) {
            toast.error('Please enter marks for at least one student');
            return;
        }

        submitMutation.mutate({
            departmentId: selectedDepartment,
            batchId: selectedBatch,
            courseId: selectedCourse,
            entries,
        });
    };

    const getStatusBadge = (status: string | null) => {
        if (!status) return null;
        const variants: Record<string, 'warning' | 'success' | 'neutral'> = {
            PENDING: 'warning',
            APPROVED: 'success',
            LOCKED: 'neutral',
        };
        return <Badge variant={variants[status] || 'neutral'}>{status}</Badge>;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Semester Marks Entry</h1>
                <p className="text-neutral-500 mt-1">Enter semester-end examination marks (out of 50)</p>
            </div>

            {/* Filters */}
            <Card className="p-6">
                <h3 className="font-semibold text-neutral-900 mb-4">Select Course</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Department Select */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Department</label>
                        <select
                            className="input w-full"
                            value={selectedDepartment || ''}
                            onChange={(e) => {
                                setSelectedDepartment(e.target.value ? parseInt(e.target.value) : null);
                                setSelectedCourse(null);
                            }}
                        >
                            <option value="">Select Department</option>
                            {assignments?.departments?.map((dept: { id: number; name: string; code: string }) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Batch Select */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Batch</label>
                        <select
                            className="input w-full"
                            value={selectedBatch || ''}
                            onChange={(e) => setSelectedBatch(e.target.value ? parseInt(e.target.value) : null)}
                        >
                            <option value="">Select Batch</option>
                            {assignments?.batches?.map((batch: { id: number; name: string }) => (
                                <option key={batch.id} value={batch.id}>
                                    {batch.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Course Select */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Course</label>
                        <select
                            className="input w-full"
                            value={selectedCourse || ''}
                            onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!selectedDepartment}
                        >
                            <option value="">Select Course</option>
                            {courses.map((course: { id: number; name: string; code: string }) => (
                                <option key={course.id} value={course.id}>
                                    {course.code} - {course.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Exam Type */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Exam Type</label>
                        <select
                            className="input w-full"
                            value={examType}
                            onChange={(e) => setExamType(e.target.value as 'REGULAR' | 'MAKEUP' | 'REWRITE')}
                        >
                            <option value="REGULAR">Regular</option>
                            <option value="MAKEUP">Makeup</option>
                            <option value="REWRITE">Rewrite</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Students Table */}
            {selectedDepartment && selectedBatch && selectedCourse && (
                <Card className="overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-teal-600" />
                            <h3 className="font-semibold text-neutral-900">Students with Internal Marks</h3>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            isLoading={submitMutation.isPending}
                            leftIcon={Save}
                            disabled={Object.keys(marksData).length === 0}
                        >
                            Submit for Approval
                        </Button>
                    </div>

                    {loadingStudents ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-neutral-900">No students found</h3>
                            <p className="text-neutral-500 mt-1">
                                No students have internal marks submitted for this course yet.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-neutral-50">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">USN</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Internal Marks</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Semester Marks</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Status</th>
                                        <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Enter Marks (0-50)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {students.map((student: Student) => (
                                        <tr key={student.usn} className="hover:bg-neutral-50">
                                            <td className="px-6 py-3 font-mono text-sm">{student.usn}</td>
                                            <td className="px-6 py-3 text-center">{student.internalMarks}/50</td>
                                            <td className="px-6 py-3 text-center">
                                                {student.semesterMarks !== null ? `${student.semesterMarks}/50` : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {getStatusBadge(student.semesterMarksStatus)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {student.semesterMarksStatus === 'APPROVED' || student.semesterMarksStatus === 'LOCKED' ? (
                                                    <span className="text-sm text-neutral-400">Locked</span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="50"
                                                        className="input w-24 text-center"
                                                        value={marksData[student.usn] ?? ''}
                                                        onChange={(e) => handleMarksChange(student.usn, e.target.value)}
                                                        placeholder="0-50"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}

            {/* Info Box */}
            <Card className="p-4 bg-amber-50 border-amber-200">
                <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-amber-900">Important Notes</h4>
                        <ul className="text-sm text-amber-700 mt-1 list-disc list-inside space-y-1">
                            <li>Only students with submitted internal marks can have semester marks entered</li>
                            <li>Marks must be between 0 and 50</li>
                            <li>Entries remain pending until COE approves them</li>
                            <li>You cannot edit entries after they are approved</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
