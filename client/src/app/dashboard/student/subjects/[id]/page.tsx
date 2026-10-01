'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { subjectApi, attendanceApi, assignmentApi, marksApi } from '@/lib/api';
import {
    ArrowLeft,
    BookOpen,
    Calendar,
    ClipboardList,
    GraduationCap,
    Check,
    X,
    Clock,
    Shield,
    Upload,
    Loader2,
    AlertCircle,
    User,
    FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, SemesterStatusBadge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

type TabType = 'overview' | 'attendance' | 'assignments' | 'grades';

interface AttendanceRecord {
    id: number;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
}

interface Assignment {
    id: number;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
}

interface Submission {
    id: number;
    submittedAt: string;
    isLate: boolean;
    score: number | null;
    feedback: string | null;
}

export default function StudentSubjectPage() {
    const router = useRouter();
    const params = useParams();
    const subjectId = parseInt(params.id as string);
    const { user, isAuthenticated } = useAuthStore();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

    // Auth check
    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'STUDENT') {
            router.push('/login');
        }
    }, [isAuthenticated, user, router]);

    // Fetch subject details
    const { data: subject, isLoading: loadingSubject } = useQuery({
        queryKey: ['subject', subjectId],
        queryFn: () => subjectApi.getById(subjectId),
        enabled: !!subjectId,
    });

    // Fetch student's attendance for this subject
    const { data: attendance = [] } = useQuery({
        queryKey: ['my-attendance', subjectId],
        queryFn: () => attendanceApi.getMyAttendance(subjectId),
        enabled: !!subjectId && activeTab === 'attendance',
    });

    // Fetch assignments
    const { data: assignments = [] } = useQuery({
        queryKey: ['assignments', subjectId],
        queryFn: () => assignmentApi.getBySubject(subjectId),
        enabled: !!subjectId && activeTab === 'assignments',
    });

    // Fetch my submissions
    const { data: mySubmissions = [] } = useQuery({
        queryKey: ['my-submissions'],
        queryFn: () => assignmentApi.getMySubmissions(),
        enabled: activeTab === 'assignments',
    });

    // Fetch my grades
    const { data: myGrades = [] } = useQuery({
        queryKey: ['my-grades', subjectId],
        queryFn: () => marksApi.getMyMarks(subjectId),
        enabled: !!subjectId && activeTab === 'grades',
    });

    // Submit assignment mutation
    const submitAssignmentMutation = useMutation({
        mutationFn: (data: { assignmentId: number; content: string }) => {
            return assignmentApi.submit(data.assignmentId, { content: data.content });
        },
        onSuccess: () => {
            setSelectedAssignment(null);
            alert('Assignment submitted successfully!');
        },
        onError: (error: Error) => {
            alert('Failed to submit: ' + error.message);
        },
    });

    if (!isAuthenticated || user?.role !== 'STUDENT') {
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
                    Subject not found or you are not enrolled
                </div>
            </div>
        );
    }

    // Calculate attendance stats
    const attendanceStats = {
        present: attendance.filter((a: AttendanceRecord) => a.status === 'PRESENT').length,
        absent: attendance.filter((a: AttendanceRecord) => a.status === 'ABSENT').length,
        late: attendance.filter((a: AttendanceRecord) => a.status === 'LATE').length,
        excused: attendance.filter((a: AttendanceRecord) => a.status === 'EXCUSED').length,
        total: attendance.length,
        percentage: attendance.length > 0
            ? ((attendance.filter((a: AttendanceRecord) => a.status === 'PRESENT' || a.status === 'LATE').length / attendance.length) * 100).toFixed(1)
            : 0,
    };

    // Get submission for an assignment
    const getSubmission = (assignmentId: number): Submission | undefined => {
        return mySubmissions.find((s: Submission & { assignmentId: number }) => s.assignmentId === assignmentId);
    };

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
                <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {subject.course?.name || 'Subject'} {subject.section && `(Section ${subject.section})`}
                        </h1>
                        <p className="text-slate-600">{subject.course?.code} • {subject.course?.credits} Credits</p>
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
                                ? 'bg-emerald-500 text-white shadow-md'
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            <div className="p-3 bg-purple-100 rounded-xl">
                                <User className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">Instructor</h3>
                                <p className="text-sm text-slate-500">Teachers for this subject</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {subject.teachers?.map((t: { teacher: { user: { name: string } }; isPrimary: boolean }) => (
                                <div key={t.teacher.user.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                    <span className="font-medium">{t.teacher.user.name}</span>
                                    {t.isPrimary && <Badge variant="primary">Primary</Badge>}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'attendance' && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Card className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                            <div className="text-3xl font-bold">{attendanceStats.percentage}%</div>
                            <div className="text-sm opacity-90">Attendance</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span className="text-2xl font-bold">{attendanceStats.present}</span>
                            </div>
                            <div className="text-sm text-slate-500">Present</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <X className="w-5 h-5 text-red-500" />
                                <span className="text-2xl font-bold">{attendanceStats.absent}</span>
                            </div>
                            <div className="text-sm text-slate-500">Absent</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-yellow-500" />
                                <span className="text-2xl font-bold">{attendanceStats.late}</span>
                            </div>
                            <div className="text-sm text-slate-500">Late</div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-blue-500" />
                                <span className="text-2xl font-bold">{attendanceStats.excused}</span>
                            </div>
                            <div className="text-sm text-slate-500">Excused</div>
                        </Card>
                    </div>

                    {/* Attendance List */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-lg mb-4">Attendance Records</h3>
                        <div className="space-y-2">
                            {attendance.map((record: AttendanceRecord) => {
                                const statusColors = {
                                    PRESENT: 'bg-green-100 text-green-700',
                                    ABSENT: 'bg-red-100 text-red-700',
                                    LATE: 'bg-yellow-100 text-yellow-700',
                                    EXCUSED: 'bg-blue-100 text-blue-700',
                                };
                                return (
                                    <div key={record.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <span className="font-medium">{formatDate(record.date)}</span>
                                        <Badge className={statusColors[record.status]}>{record.status}</Badge>
                                    </div>
                                );
                            })}
                            {attendance.length === 0 && (
                                <div className="text-center py-8 text-slate-500">
                                    No attendance records yet
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'assignments' && (
                <div className="space-y-4">
                    {assignments.map((assignment: Assignment) => {
                        const submission = getSubmission(assignment.id);
                        const isPastDue = new Date(assignment.dueDate) < new Date();

                        return (
                            <Card key={assignment.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold">{assignment.title}</h4>
                                            {submission && (
                                                <Badge variant={submission.isLate ? 'warning' : 'success'}>
                                                    {submission.isLate ? 'Late Submission' : 'Submitted'}
                                                </Badge>
                                            )}
                                            {!submission && isPastDue && (
                                                <Badge variant="error">Past Due</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">{assignment.description}</p>
                                        <div className="flex gap-4 mt-2 text-sm text-slate-600">
                                            <span>Due: {formatDate(assignment.dueDate)}</span>
                                            <span>Max Score: {assignment.maxScore}</span>
                                            {submission?.score !== null && submission?.score !== undefined && (
                                                <span className="font-medium text-emerald-600">
                                                    Score: {submission.score}/{assignment.maxScore}
                                                </span>
                                            )}
                                        </div>
                                        {submission?.feedback && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                                <span className="font-medium">Feedback:</span> {submission.feedback}
                                            </div>
                                        )}
                                    </div>
                                    {!submission && (
                                        <Button onClick={() => setSelectedAssignment(assignment)}>
                                            <Upload className="w-4 h-4 mr-2" />
                                            Submit
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}

                    {assignments.length === 0 && (
                        <Card className="p-8 text-center text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            No assignments yet
                        </Card>
                    )}

                    {/* Submit Modal */}
                    {selectedAssignment && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <Card className="w-full max-w-lg p-6 m-4">
                                <h3 className="font-semibold text-lg mb-4">Submit: {selectedAssignment.title}</h3>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        submitAssignmentMutation.mutate({
                                            assignmentId: selectedAssignment.id,
                                            content: formData.get('content') as string,
                                        });
                                    }}
                                >
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium mb-1">Your Answer</label>
                                        <textarea
                                            name="content"
                                            rows={6}
                                            required
                                            className="w-full px-3 py-2 border rounded-lg"
                                            placeholder="Enter your submission..."
                                        />
                                    </div>
                                    {new Date(selectedAssignment.dueDate) < new Date() && (
                                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
                                            ⚠️ This assignment is past due. Your submission will be marked as late.
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Button type="submit" disabled={submitAssignmentMutation.isPending}>
                                            {submitAssignmentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                            Submit
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setSelectedAssignment(null)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'grades' && (
                <Card className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Your Grades</h3>
                    {myGrades.length > 0 && myGrades[0]?.marks?.length > 0 ? (
                        <div className="space-y-4">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4">Exam Type</th>
                                        <th className="text-left py-3 px-4">Score</th>
                                        <th className="text-left py-3 px-4">Max Score</th>
                                        <th className="text-left py-3 px-4">Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myGrades[0].marks.map((mark: { examType: string; score: number; maxScore: number; percentage: number }) => (
                                        <tr key={mark.examType} className="border-b hover:bg-slate-50">
                                            <td className="py-3 px-4 font-medium">{mark.examType}</td>
                                            <td className="py-3 px-4">{mark.score}</td>
                                            <td className="py-3 px-4">{mark.maxScore}</td>
                                            <td className="py-3 px-4">
                                                <Badge variant={mark.percentage >= 40 ? 'success' : 'error'}>
                                                    {mark.percentage.toFixed(1)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {myGrades[0]?.percentage && (
                                <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-white">
                                    <div className="text-sm opacity-90">Overall Percentage</div>
                                    <div className="text-3xl font-bold">{myGrades[0].percentage.toFixed(1)}%</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-500">
                            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            No grades available yet
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
