'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { subjectApi, attendanceApi, assignmentApi, marksApi } from '@/lib/api';
import {
    ArrowLeft,
    BookOpen,
    Users,
    Calendar,
    ClipboardList,
    GraduationCap,
    Check,
    X,
    Clock,
    Shield,
    Plus,
    Save,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, SemesterStatusBadge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

type TabType = 'overview' | 'attendance' | 'assignments' | 'grades';

interface Student {
    id: number;
    userId: number;
    name: string;
    email: string;
    rollNumber: string;
    enrolledAt: string;
}

interface AttendanceEntry {
    studentId: number;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
}

export default function TeacherSubjectPage() {
    const router = useRouter();
    const params = useParams();
    const subjectId = parseInt(params.id as string);
    const { user, isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceEntries, setAttendanceEntries] = useState<Map<number, AttendanceEntry>>(new Map());
    const [showCreateAssignment, setShowCreateAssignment] = useState(false);
    const [selectedExamType, setSelectedExamType] = useState<string>('MIDTERM');
    const [gradeEntries, setGradeEntries] = useState<Map<number, number>>(new Map());

    // Auth check
    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'TEACHER') {
            router.push('/login');
        }
    }, [isAuthenticated, user, router]);

    // Fetch subject details
    const { data: subject, isLoading: loadingSubject } = useQuery({
        queryKey: ['subject', subjectId],
        queryFn: () => subjectApi.getById(subjectId),
        enabled: !!subjectId,
    });

    // Fetch enrolled students
    const { data: students = [], isLoading: loadingStudents } = useQuery({
        queryKey: ['subject-students', subjectId],
        queryFn: () => subjectApi.getEnrolledStudents(subjectId),
        enabled: !!subjectId,
    });

    // Fetch attendance for selected date
    const { data: existingAttendance } = useQuery({
        queryKey: ['attendance', subjectId, attendanceDate],
        queryFn: () => attendanceApi.getAttendanceSheet(subjectId, attendanceDate),
        enabled: !!subjectId && activeTab === 'attendance',
    });

    // Fetch assignments
    const { data: assignments = [] } = useQuery({
        queryKey: ['assignments', subjectId],
        queryFn: () => assignmentApi.getBySubject(subjectId),
        enabled: !!subjectId && activeTab === 'assignments',
    });

    // Fetch grade summary
    const { data: gradeSummary = [] } = useQuery({
        queryKey: ['grade-summary', subjectId],
        queryFn: () => marksApi.getSummary(subjectId),
        enabled: !!subjectId && activeTab === 'grades',
    });

    // Fetch students for grading
    const { data: studentsForGrading = [] } = useQuery({
        queryKey: ['students-grading', subjectId, selectedExamType],
        queryFn: () => marksApi.getStudentsForGrading(subjectId, selectedExamType),
        enabled: !!subjectId && activeTab === 'grades',
    });

    // Initialize attendance entries when students or existing attendance changes
    useEffect(() => {
        if (students.length > 0) {
            const newEntries = new Map<number, AttendanceEntry>();
            students.forEach((student: Student) => {
                const existing = existingAttendance?.find((a: { studentId: number }) => a.studentId === student.id);
                newEntries.set(student.id, {
                    studentId: student.id,
                    status: existing?.status || 'PRESENT',
                    remarks: existing?.remarks,
                });
            });
            setAttendanceEntries(newEntries);
        }
    }, [students, existingAttendance]);

    // Save attendance mutation
    const saveAttendanceMutation = useMutation({
        mutationFn: () => {
            const entries = Array.from(attendanceEntries.values());
            return attendanceApi.bulkMarkAttendance(subjectId, {
                date: attendanceDate,
                entries,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance', subjectId] });
            alert('Attendance saved successfully!');
        },
        onError: (error: Error) => {
            alert('Failed to save attendance: ' + error.message);
        },
    });

    // Create assignment mutation
    const createAssignmentMutation = useMutation({
        mutationFn: (data: { title: string; description: string; dueDate: string; maxScore: number }) => {
            return assignmentApi.create({
                subjectId,
                ...data,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments', subjectId] });
            setShowCreateAssignment(false);
        },
    });

    // Save grades mutation
    const saveGradesMutation = useMutation({
        mutationFn: () => {
            const entries = Array.from(gradeEntries.entries()).map(([studentId, score]) => ({
                studentId,
                score,
            }));
            return marksApi.bulkRecord(subjectId, {
                examType: selectedExamType as 'MIDTERM' | 'FINAL' | 'QUIZ' | 'PRACTICAL' | 'INTERNAL',
                maxScore: 100,
                entries,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students-grading', subjectId] });
            queryClient.invalidateQueries({ queryKey: ['grade-summary', subjectId] });
            alert('Grades saved successfully!');
        },
    });

    const updateAttendanceStatus = (studentId: number, status: AttendanceEntry['status']) => {
        setAttendanceEntries(prev => {
            const newMap = new Map(prev);
            const entry = newMap.get(studentId);
            if (entry) {
                newMap.set(studentId, { ...entry, status });
            }
            return newMap;
        });
    };

    const markAllPresent = () => {
        setAttendanceEntries(prev => {
            const newMap = new Map(prev);
            newMap.forEach((entry, key) => {
                newMap.set(key, { ...entry, status: 'PRESENT' });
            });
            return newMap;
        });
    };

    if (!isAuthenticated || user?.role !== 'TEACHER') {
        return null;
    }

    if (loadingSubject) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!subject) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Subject not found
                </div>
            </div>
        );
    }

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'overview', label: 'Overview', icon: <BookOpen className="w-4 h-4" /> },
        { id: 'attendance', label: 'Attendance', icon: <Calendar className="w-4 h-4" /> },
        { id: 'assignments', label: 'Assignments', icon: <ClipboardList className="w-4 h-4" /> },
        { id: 'grades', label: 'Grades', icon: <GraduationCap className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            {/* Header */}
            <div className="mb-6">
                <Link href="/dashboard/teacher" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {subject.course?.name || 'Subject'} {subject.section && `(Section ${subject.section})`}
                        </h1>
                        <p className="text-slate-600">{subject.course?.code}</p>
                    </div>
                    <SemesterStatusBadge status={subject.semester?.status || 'ACTIVE'} />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-white rounded-xl p-1 shadow-sm w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <BookOpen className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Course Details</h3>
                                <p className="text-sm text-slate-500">Subject information</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div><span className="text-slate-500">Code:</span> <span className="font-medium">{subject.course?.code}</span></div>
                            <div><span className="text-slate-500">Credits:</span> <span className="font-medium">{subject.course?.credits}</span></div>
                            <div><span className="text-slate-500">Section:</span> <span className="font-medium">{subject.section || 'N/A'}</span></div>
                            <div><span className="text-slate-500">Semester:</span> <span className="font-medium">{subject.semester?.name}</span></div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-100 rounded-xl">
                                <Users className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Enrolled Students</h3>
                                <p className="text-sm text-slate-500">{students.length} students</p>
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {students.map((student: Student) => (
                                <div key={student.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <span className="font-medium text-sm">{student.name}</span>
                                    <span className="text-xs text-slate-500">{student.rollNumber}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <ClipboardList className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Quick Stats</h3>
                                <p className="text-sm text-slate-500">At a glance</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between"><span className="text-slate-500">Students:</span> <span className="font-medium">{students.length}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Assignments:</span> <span className="font-medium">{assignments?.length || 0}</span></div>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'attendance' && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <h3 className="font-semibold text-lg">Mark Attendance</h3>
                            <input
                                type="date"
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                                className="px-3 py-2 border rounded-lg"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={markAllPresent}>
                                Mark All Present
                            </Button>
                            <Button
                                onClick={() => saveAttendanceMutation.mutate()}
                                disabled={saveAttendanceMutation.isPending}
                            >
                                {saveAttendanceMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Attendance
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4">Roll No</th>
                                    <th className="text-left py-3 px-4">Student Name</th>
                                    <th className="text-center py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student: Student) => {
                                    const entry = attendanceEntries.get(student.id);
                                    return (
                                        <tr key={student.id} className="border-b hover:bg-slate-50">
                                            <td className="py-3 px-4 font-mono text-sm">{student.rollNumber}</td>
                                            <td className="py-3 px-4">{student.name}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex justify-center gap-2">
                                                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map(status => {
                                                        const isActive = entry?.status === status;
                                                        const colors = {
                                                            PRESENT: 'bg-green-500 text-white',
                                                            ABSENT: 'bg-red-500 text-white',
                                                            LATE: 'bg-yellow-500 text-white',
                                                            EXCUSED: 'bg-blue-500 text-white',
                                                        };
                                                        const icons = {
                                                            PRESENT: <Check className="w-4 h-4" />,
                                                            ABSENT: <X className="w-4 h-4" />,
                                                            LATE: <Clock className="w-4 h-4" />,
                                                            EXCUSED: <Shield className="w-4 h-4" />,
                                                        };
                                                        return (
                                                            <button
                                                                key={status}
                                                                onClick={() => updateAttendanceStatus(student.id, status)}
                                                                className={`p-2 rounded-lg transition-all ${isActive ? colors[status] : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                    }`}
                                                                title={status}
                                                            >
                                                                {icons[status]}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'assignments' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Assignments</h3>
                        <Button onClick={() => setShowCreateAssignment(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Assignment
                        </Button>
                    </div>

                    {showCreateAssignment && (
                        <Card className="p-6">
                            <h4 className="font-semibold mb-4">New Assignment</h4>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    createAssignmentMutation.mutate({
                                        title: formData.get('title') as string,
                                        description: formData.get('description') as string,
                                        dueDate: formData.get('dueDate') as string,
                                        maxScore: parseInt(formData.get('maxScore') as string),
                                    });
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium mb-1">Title</label>
                                    <input name="title" required className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <textarea name="description" rows={3} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Due Date</label>
                                        <input type="datetime-local" name="dueDate" required className="w-full px-3 py-2 border rounded-lg" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Max Score</label>
                                        <input type="number" name="maxScore" defaultValue={100} className="w-full px-3 py-2 border rounded-lg" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="submit" disabled={createAssignmentMutation.isPending}>
                                        {createAssignmentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        Create
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => setShowCreateAssignment(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    )}

                    <div className="grid gap-4">
                        {assignments.map((assignment: { id: number; title: string; description: string; dueDate: string; maxScore: number; _count?: { submissions: number } }) => (
                            <Card key={assignment.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold">{assignment.title}</h4>
                                        <p className="text-sm text-slate-500">{assignment.description}</p>
                                        <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                            <span>Due: {formatDate(assignment.dueDate)}</span>
                                            <span>Max Score: {assignment.maxScore}</span>
                                            <span>Submissions: {assignment._count?.submissions || 0}</span>
                                        </div>
                                    </div>
                                    <Link href={`/dashboard/teacher/assignments/${assignment.id}`}>
                                        <Button variant="outline" size="sm">View Submissions</Button>
                                    </Link>
                                </div>
                            </Card>
                        ))}
                        {assignments.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                No assignments yet. Create your first assignment!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'grades' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <h3 className="font-semibold text-lg">Enter Grades</h3>
                                <select
                                    value={selectedExamType}
                                    onChange={(e) => setSelectedExamType(e.target.value)}
                                    className="px-3 py-2 border rounded-lg"
                                >
                                    <option value="MIDTERM">Midterm</option>
                                    <option value="FINAL">Final</option>
                                    <option value="QUIZ">Quiz</option>
                                    <option value="PRACTICAL">Practical</option>
                                    <option value="INTERNAL">Internal</option>
                                </select>
                            </div>
                            <Button
                                onClick={() => saveGradesMutation.mutate()}
                                disabled={saveGradesMutation.isPending || gradeEntries.size === 0}
                            >
                                {saveGradesMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Save Grades
                            </Button>
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4">Roll No</th>
                                    <th className="text-left py-3 px-4">Student Name</th>
                                    <th className="text-left py-3 px-4">Current Score</th>
                                    <th className="text-left py-3 px-4">New Score (0-100)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsForGrading.map((student: { studentId: number; studentName: string; rollNumber: string; marks: { score: number } | null }) => (
                                    <tr key={student.studentId} className="border-b hover:bg-slate-50">
                                        <td className="py-3 px-4 font-mono text-sm">{student.rollNumber}</td>
                                        <td className="py-3 px-4">{student.studentName}</td>
                                        <td className="py-3 px-4">{student.marks?.score ?? '-'}</td>
                                        <td className="py-3 px-4">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                placeholder={student.marks?.score?.toString() || 'Enter score'}
                                                className="w-24 px-2 py-1 border rounded"
                                                onChange={(e) => {
                                                    const score = parseInt(e.target.value);
                                                    if (!isNaN(score)) {
                                                        setGradeEntries(prev => {
                                                            const newMap = new Map(prev);
                                                            newMap.set(student.studentId, score);
                                                            return newMap;
                                                        });
                                                    }
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>

                    {gradeSummary.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-semibold text-lg mb-4">Grade Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {gradeSummary.map((summary: { examType: string; avgScore: number; count: number }) => (
                                    <div key={summary.examType} className="p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm text-slate-500">{summary.examType}</div>
                                        <div className="text-2xl font-bold">{summary.avgScore.toFixed(1)}</div>
                                        <div className="text-xs text-slate-400">{summary.count} graded</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
