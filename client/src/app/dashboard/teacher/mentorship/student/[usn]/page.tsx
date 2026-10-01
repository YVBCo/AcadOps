'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, User, BookOpen, ClipboardCheck, GraduationCap,
    Mail, Hash, Building2, Calendar, Plus, MessageSquare, Phone,
    Users, Edit3, Save, X, ChevronDown, ChevronUp, Shield, Key, Eye, EyeOff, Lock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ParentInfo {
    name: string;
    loginId: string;
    phone: string;
    relationship: string;
    hasDefaultPassword?: boolean;
}

interface StudentProfile {
    usn: string;
    name: string;
    email: string;
    rollNumber: string;
    currentSemester: number;
    admissionYear: number;
    department: { id: number; name: string; code: string } | null;
    section?: { id: number; name: string } | null;
    batch?: { id: number; name: string } | null;
    program?: { id: number; name: string } | null;
    parentInfo?: ParentInfo | null;
}

interface StudentInteraction {
    id: number;
    meetingNumber: number;
    personalAspects: string | null;
    academicAspects: string | null;
    careerAspects: string | null;
    otherAspects: string | null;
    interactionDate: string;
}

interface ParentInteraction {
    id: number;
    interactionDate: string;
    mode: 'CALL' | 'MEETING';
    purpose: 'ATTENDANCE' | 'IA_MARKS' | 'BEHAVIOR' | 'OTHER';
    summary: string;
    mentorSignature: boolean;
    hodSignature: boolean;
}

interface AcademicData {
    courses: Array<{
        courseId: number;
        courseName: string;
        courseCode: string;
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
        calculatedTotal?: number | null;
        isFinalized: boolean;
    }>;
}

interface AttendanceData {
    courses: Array<{
        courseId: number;
        courseName: string;
        courseCode: string;
        totalClasses: number;
        present: number;
        absent: number;
        percentage: number;
    }>;
}

const ASPECT_ROWS = [
    { key: 'personalAspects', label: 'Interaction on Personal Aspects' },
    { key: 'academicAspects', label: 'Interaction on Academic Aspects' },
    { key: 'careerAspects', label: 'Interaction on Career Aspects' },
    { key: 'otherAspects', label: 'Interaction on Other Aspects' },
] as const;

const PURPOSE_LABELS: Record<string, string> = {
    ATTENDANCE: 'Attendance',
    IA_MARKS: 'IA Marks',
    BEHAVIOR: 'Behavior',
    OTHER: 'Other',
};

export default function StudentDetailPage() {
    const params = useParams();
    const usn = params.usn as string;
    const queryClient = useQueryClient();

    // State for new meeting form
    const [showNewMeeting, setShowNewMeeting] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        personalAspects: '',
        academicAspects: '',
        careerAspects: '',
        otherAspects: '',
        interactionDate: new Date().toISOString().split('T')[0],
    });

    // State for new parent interaction form
    const [showNewParent, setShowNewParent] = useState(false);
    const [newParent, setNewParent] = useState({
        interactionDate: new Date().toISOString().split('T')[0],
        mode: 'CALL' as 'CALL' | 'MEETING',
        purpose: 'ATTENDANCE' as 'ATTENDANCE' | 'IA_MARKS' | 'BEHAVIOR' | 'OTHER',
        summary: '',
    });

    // Parent password change state
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newParentPassword, setNewParentPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Sections expanded state
    const [expandedSections, setExpandedSections] = useState({
        menteeInteraction: true,
        parentInteraction: true,
        academic: false,
        attendance: false,
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Queries
    const { data: profile, isLoading: profileLoading } = useQuery<StudentProfile>({
        queryKey: ['mentor-student-profile', usn],
        queryFn: () => mentorApi.getStudentProfile(usn),
        enabled: !!usn,
    });

    const { data: interactions, isLoading: interactionsLoading } = useQuery<{
        studentInteractions: StudentInteraction[];
        parentInteractions: ParentInteraction[];
    }>({
        queryKey: ['mentor-student-interactions', usn],
        queryFn: () => mentorApi.getInteractions(usn),
        enabled: !!usn,
    });

    const { data: academic, isLoading: academicLoading } = useQuery<AcademicData>({
        queryKey: ['mentor-student-academic', usn],
        queryFn: () => mentorApi.getStudentAcademic(usn),
        enabled: !!usn,
    });

    const { data: attendance, isLoading: attendanceLoading } = useQuery<AttendanceData>({
        queryKey: ['mentor-student-attendance', usn],
        queryFn: () => mentorApi.getStudentAttendance(usn),
        enabled: !!usn,
    });

    // Mutations
    const addMeetingMutation = useMutation({
        mutationFn: (data: typeof newMeeting) =>
            mentorApi.logStudentInteraction(usn, {
                ...data,
                interactionDate: data.interactionDate,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-student-interactions', usn] });
            toast.success('Meeting logged successfully');
            setShowNewMeeting(false);
            setNewMeeting({
                personalAspects: '', academicAspects: '', careerAspects: '', otherAspects: '',
                interactionDate: new Date().toISOString().split('T')[0],
            });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Failed to log meeting');
        },
    });

    const addParentMutation = useMutation({
        mutationFn: (data: typeof newParent) =>
            mentorApi.logParentInteraction(usn, {
                ...data,
                interactionDate: data.interactionDate,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-student-interactions', usn] });
            toast.success('Parent interaction logged successfully');
            setShowNewParent(false);
            setNewParent({
                interactionDate: new Date().toISOString().split('T')[0],
                mode: 'CALL', purpose: 'ATTENDANCE', summary: '',
            });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Failed to log interaction');
        },
    });

    // Parent password change mutation
    const changePasswordMutation = useMutation({
        mutationFn: (password: string) => mentorApi.changeParentPassword(usn, password),
        onSuccess: (data: { parentName: string }) => {
            toast.success(`Password changed for ${data.parentName}`);
            setShowPasswordChange(false);
            setNewParentPassword('');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Failed to change password');
        },
    });

    const isLoading = profileLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600">Loading student details...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-16">
                <User className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">Student Not Found</h3>
                <p className="text-slate-500 mb-6">Could not find student with USN: {usn}</p>
                <Link href="/dashboard/teacher/mentorship/students" className="text-teal-600 hover:text-teal-700 font-medium">
                    ← Back to Students
                </Link>
            </div>
        );
    }

    const studentInteractions = interactions?.studentInteractions || [];
    const parentInteractions = interactions?.parentInteractions || [];

    // Sort student interactions by meeting number for the table
    const sortedMeetings = [...studentInteractions].sort((a, b) => a.meetingNumber - b.meetingNumber);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/teacher/mentorship" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{profile.name}</h1>
                    <p className="text-slate-600">{profile.usn} • Digital Mentor Card</p>
                </div>
            </div>

            {/* Student Profile Card */}
            <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-2xl shrink-0">
                        {profile.name?.charAt(0).toUpperCase() || 'S'}
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Email</p>
                                <p className="text-sm font-medium text-slate-800">{profile.email || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Hash className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Roll Number</p>
                                <p className="text-sm font-medium text-slate-800">{profile.rollNumber}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Department</p>
                                <p className="text-sm font-medium text-slate-800">{profile.department?.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <GraduationCap className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Current Semester</p>
                                <p className="text-sm font-medium text-slate-800">Semester {profile.currentSemester}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Batch / Section</p>
                                <p className="text-sm font-medium text-slate-800">
                                    {profile.batch?.name || 'N/A'} / {profile.section?.name || 'N/A'}
                                </p>
                            </div>
                        </div>
                        {profile.program && (
                            <div className="flex items-center gap-3">
                                <BookOpen className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500">Program</p>
                                    <p className="text-sm font-medium text-slate-800">{profile.program.name}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* ========== PARENT CREDENTIALS CARD ========== */}
            {profile.parentInfo && (
                <Card className="p-6 border-amber-200 bg-amber-50/30">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Parent Credentials</h2>
                            <p className="text-sm text-slate-500">Login details for {profile.parentInfo.name || 'parent'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Parent Name</p>
                                <p className="text-sm font-medium text-slate-800">{profile.parentInfo.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Login ID (Phone)</p>
                                <p className="text-sm font-medium text-slate-800 font-mono">{profile.parentInfo.loginId || profile.parentInfo.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Key className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Password</p>
                                <p className="text-sm font-medium text-slate-800">Parent@123 <span className="text-xs text-amber-600">(default)</span></p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">Relationship</p>
                                <p className="text-sm font-medium text-slate-800 capitalize">{profile.parentInfo.relationship?.toLowerCase() || 'Father'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Change Password Section */}
                    <div className="mt-4 pt-4 border-t border-amber-200">
                        {!showPasswordChange ? (
                            <Button
                                variant="outline"
                                onClick={() => setShowPasswordChange(true)}
                                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                Change Parent Password
                            </Button>
                        ) : (
                            <div className="flex items-center gap-3 max-w-md">
                                <div className="relative flex-1">
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="New password (min 6 chars)"
                                        value={newParentPassword}
                                        onChange={(e) => setNewParentPassword(e.target.value)}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <Button
                                    onClick={() => {
                                        if (newParentPassword.length < 6) {
                                            toast.error('Password must be at least 6 characters');
                                            return;
                                        }
                                        changePasswordMutation.mutate(newParentPassword);
                                    }}
                                    disabled={changePasswordMutation.isPending}
                                    className="bg-amber-600 hover:bg-amber-700"
                                >
                                    <Save className="w-4 h-4 mr-1" />
                                    {changePasswordMutation.isPending ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => { setShowPasswordChange(false); setNewParentPassword(''); }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* ========== MENTEE INTERACTION TABLE ========== */}
            <Card className="overflow-hidden">
                <button
                    onClick={() => toggleSection('menteeInteraction')}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                            <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-semibold text-slate-800">Details of Interaction with Mentee</h2>
                            <p className="text-sm text-slate-500">{sortedMeetings.length} meeting(s) recorded</p>
                        </div>
                    </div>
                    {expandedSections.menteeInteraction ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {expandedSections.menteeInteraction && (
                    <div className="px-6 pb-6">
                        {/* Meeting Grid Table */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 w-48">Particulars</th>
                                        {sortedMeetings.length > 0 ? (
                                            sortedMeetings.map((m) => (
                                                <th key={m.id} className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 min-w-[140px]">
                                                    <div>{m.meetingNumber <= 4 ? `${m.meetingNumber}${['st', 'nd', 'rd', 'th'][m.meetingNumber - 1]} Meeting` : `Meeting ${m.meetingNumber}`}</div>
                                                    <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                                                        {new Date(m.interactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </div>
                                                </th>
                                            ))
                                        ) : (
                                            <th className="text-center text-xs text-slate-400 py-3 px-4">No meetings yet</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ASPECT_ROWS.map((row) => (
                                        <tr key={row.key} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4 text-sm font-medium text-slate-700 bg-slate-50/50 border-r border-slate-100">{row.label}</td>
                                            {sortedMeetings.length > 0 ? (
                                                sortedMeetings.map((m) => (
                                                    <td key={m.id} className="py-3 px-4 text-sm text-slate-600 text-center border-r border-slate-100 last:border-r-0">
                                                        {(m as any)[row.key] || <span className="text-slate-300">—</span>}
                                                    </td>
                                                ))
                                            ) : (
                                                <td className="py-3 px-4 text-sm text-slate-300 text-center">—</td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Add Meeting Button or Form */}
                        {!showNewMeeting ? (
                            <Button
                                onClick={() => setShowNewMeeting(true)}
                                className="mt-4 bg-teal-600 hover:bg-teal-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Log New Meeting
                            </Button>
                        ) : (
                            <div className="mt-4 border border-teal-200 rounded-xl p-5 bg-teal-50/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-800">
                                        Meeting #{sortedMeetings.length + 1}
                                    </h3>
                                    <button onClick={() => setShowNewMeeting(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                        <X className="w-4 h-4 text-slate-500" />
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Date of Meeting</label>
                                        <Input
                                            type="date"
                                            value={newMeeting.interactionDate}
                                            onChange={(e) => setNewMeeting(prev => ({ ...prev, interactionDate: e.target.value }))}
                                            className="max-w-xs"
                                        />
                                    </div>
                                    {ASPECT_ROWS.map((row) => (
                                        <div key={row.key}>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">{row.label}</label>
                                            <textarea
                                                value={(newMeeting as any)[row.key]}
                                                onChange={(e) => setNewMeeting(prev => ({ ...prev, [row.key]: e.target.value }))}
                                                rows={2}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                                                placeholder={`Enter details about ${row.label.toLowerCase()}...`}
                                            />
                                        </div>
                                    ))}
                                    <div className="flex gap-3 pt-2">
                                        <Button
                                            onClick={() => addMeetingMutation.mutate(newMeeting)}
                                            disabled={addMeetingMutation.isPending}
                                            className="bg-teal-600 hover:bg-teal-700 text-white"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {addMeetingMutation.isPending ? 'Saving...' : 'Save Meeting'}
                                        </Button>
                                        <Button variant="outline" onClick={() => setShowNewMeeting(false)}>Cancel</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ========== PARENT INTERACTION TABLE ========== */}
            <Card className="overflow-hidden">
                <button
                    onClick={() => toggleSection('parentInteraction')}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <Phone className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-semibold text-slate-800">Details of Interaction with Parent</h2>
                            <p className="text-sm text-slate-500">
                                {parentInteractions.length} interaction(s) logged
                                <span className="text-xs text-slate-400 ml-2">(Areas of concern: academics / attendance / behavior / fee dues / etc.)</span>
                            </p>
                        </div>
                    </div>
                    {expandedSections.parentInteraction ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {expandedSections.parentInteraction && (
                    <div className="px-6 pb-6">
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 w-40">Date of Interaction</th>
                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 w-28">Mode</th>
                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 w-32">Purpose</th>
                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">Brief of Interaction</th>
                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4 w-28">Signatures</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {parentInteractions.length > 0 ? (
                                        parentInteractions.map((pi) => (
                                            <tr key={pi.id} className="hover:bg-slate-50/50">
                                                <td className="py-3 px-4 text-sm text-slate-700">
                                                    {new Date(pi.interactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className={`text-xs ${pi.mode === 'CALL' ? '' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                                                        {pi.mode === 'CALL' ? '📞 Call' : '🤝 Meeting'}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                        {PURPOSE_LABELS[pi.purpose] || pi.purpose}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-slate-600">{pi.summary}</td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={`text-xs ${pi.mentorSignature ? 'text-green-600' : 'text-slate-400'}`}>
                                                            {pi.mentorSignature ? '✓ Mentor' : '○ Mentor'}
                                                        </span>
                                                        <span className={`text-xs ${pi.hodSignature ? 'text-green-600' : 'text-slate-400'}`}>
                                                            {pi.hodSignature ? '✓ HoD' : '○ HoD'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                                                No parent interactions logged yet
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Add Parent Interaction */}
                        {!showNewParent ? (
                            <Button
                                onClick={() => setShowNewParent(true)}
                                className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Log Parent Interaction
                            </Button>
                        ) : (
                            <div className="mt-4 border border-amber-200 rounded-xl p-5 bg-amber-50/30">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-800">New Parent Interaction</h3>
                                    <button onClick={() => setShowNewParent(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                                        <X className="w-4 h-4 text-slate-500" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                                        <Input
                                            type="date"
                                            value={newParent.interactionDate}
                                            onChange={(e) => setNewParent(prev => ({ ...prev, interactionDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
                                        <select
                                            value={newParent.mode}
                                            onChange={(e) => setNewParent(prev => ({ ...prev, mode: e.target.value as any }))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="CALL">📞 Phone Call</option>
                                            <option value="MEETING">🤝 In-Person Meeting</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Purpose</label>
                                        <select
                                            value={newParent.purpose}
                                            onChange={(e) => setNewParent(prev => ({ ...prev, purpose: e.target.value as any }))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="ATTENDANCE">Attendance</option>
                                            <option value="IA_MARKS">IA Marks</option>
                                            <option value="BEHAVIOR">Behavior</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Brief of Interaction</label>
                                    <textarea
                                        value={newParent.summary}
                                        onChange={(e) => setNewParent(prev => ({ ...prev, summary: e.target.value }))}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                                        placeholder="Describe the interaction with parent..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-3">
                                    <Button
                                        onClick={() => addParentMutation.mutate(newParent)}
                                        disabled={addParentMutation.isPending || !newParent.summary.trim()}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {addParentMutation.isPending ? 'Saving...' : 'Save Interaction'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowNewParent(false)}>Cancel</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ========== ACADEMIC PERFORMANCE ========== */}
            <Card className="overflow-hidden">
                <button
                    onClick={() => toggleSection('academic')}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-teal-600" />
                        <h2 className="text-lg font-semibold text-slate-800">Academic Performance</h2>
                    </div>
                    {expandedSections.academic ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {expandedSections.academic && (
                    <div className="px-6 pb-6">
                        {academicLoading ? (
                            <p className="text-slate-500 text-center py-4">Loading academic data...</p>
                        ) : !academic?.courses || academic.courses.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">No academic records available</p>
                        ) : (
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">Course</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">IA1</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">IA2</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">IA3</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">Assignment</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">Total</th>
                                            <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-3 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {academic.courses.map((course) => (
                                            <tr key={course.courseId} className="hover:bg-slate-50">
                                                <td className="py-3 px-4">
                                                    <p className="font-medium text-slate-800">{course.courseName}</p>
                                                    <p className="text-xs text-slate-500">{course.courseCode}</p>
                                                </td>
                                                <td className="text-center py-3 px-4 font-mono text-sm">{course.internal1 ?? '-'}</td>
                                                <td className="text-center py-3 px-4 font-mono text-sm">{course.internal2 ?? '-'}</td>
                                                <td className="text-center py-3 px-4 font-mono text-sm">{course.internal3 ?? '-'}</td>
                                                <td className="text-center py-3 px-4 font-mono text-sm">{course.assignmentMarks ?? '-'}</td>
                                                <td className="text-center py-3 px-4 font-mono text-sm font-semibold text-teal-600">
                                                    {course.calculatedTotal?.toFixed(1) ?? '-'}
                                                </td>
                                                <td className="text-center py-3 px-4">
                                                    <Badge className={course.isFinalized ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                                                        {course.isFinalized ? 'Finalized' : 'Pending'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* ========== ATTENDANCE ========== */}
            <Card className="overflow-hidden">
                <button
                    onClick={() => toggleSection('attendance')}
                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <ClipboardCheck className="w-5 h-5 text-teal-600" />
                        <h2 className="text-lg font-semibold text-slate-800">Attendance Summary</h2>
                    </div>
                    {expandedSections.attendance ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {expandedSections.attendance && (
                    <div className="px-6 pb-6">
                        {attendanceLoading ? (
                            <p className="text-slate-500 text-center py-4">Loading attendance data...</p>
                        ) : !attendance?.courses || attendance.courses.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">No attendance records available</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {attendance.courses.map((course) => (
                                    <div key={course.courseId} className="p-4 bg-slate-50 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-medium text-slate-800 truncate">{course.courseName}</p>
                                            <span className={`text-lg font-bold ${course.percentage >= 75 ? 'text-green-600' : course.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {course.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">{course.courseCode}</p>
                                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${course.percentage >= 75 ? 'bg-green-500' : course.percentage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min(course.percentage, 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {course.present} present / {course.totalClasses} total classes
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}
