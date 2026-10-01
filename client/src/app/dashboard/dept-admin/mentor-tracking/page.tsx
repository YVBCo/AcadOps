'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mentorAssignmentApi } from '@/lib/api';
import {
    Users, ChevronDown, ChevronUp, Calendar, MessageSquare,
    Phone, Activity, Search, Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface MentorStudent {
    usn: string;
    name: string;
    section: string;
    batch: string;
    meetingsLogged: number;
    parentInteractions: number;
    lastMeeting: string | null;
}

interface MentorTrackingData {
    teacherProfileId: number;
    teacherName: string;
    teacherEmail: string;
    totalStudents: number;
    studentsWithMeetings: number;
    totalMeetingsLogged: number;
    totalParentInteractions: number;
    lastActivity: string | null;
    students: MentorStudent[];
}

export default function MentorTrackingPage() {
    const [expandedMentor, setExpandedMentor] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: mentors = [], isLoading } = useQuery<MentorTrackingData[]>({
        queryKey: ['mentor-tracking'],
        queryFn: () => mentorAssignmentApi.getMentorTracking(),
    });

    const filteredMentors = mentors.filter((mentor) =>
        mentor.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mentor.teacherEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mentor.students.some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.usn.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Summary stats
    const totalMentors = mentors.length;
    const totalStudents = mentors.reduce((sum, m) => sum + m.totalStudents, 0);
    const totalMeetings = mentors.reduce((sum, m) => sum + m.totalMeetingsLogged, 0);
    const totalParent = mentors.reduce((sum, m) => sum + m.totalParentInteractions, 0);
    const mentorsWithActivity = mentors.filter(m => m.totalMeetingsLogged > 0).length;

    const getCompletionColor = (studentsWithMeetings: number, total: number) => {
        if (total === 0) return 'text-slate-400';
        const ratio = studentsWithMeetings / total;
        if (ratio >= 0.8) return 'text-green-600';
        if (ratio >= 0.5) return 'text-amber-600';
        return 'text-red-600';
    };

    const getProgressWidth = (studentsWithMeetings: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((studentsWithMeetings / total) * 100);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600">Loading mentor tracking data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Mentor Tracking</h1>
                <p className="text-slate-600 mt-1">Track mentor interaction completion across your department</p>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="p-4 text-center">
                    <Users className="w-6 h-6 mx-auto text-teal-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">{totalMentors}</p>
                    <p className="text-xs text-slate-500">Total Mentors</p>
                </Card>
                <Card className="p-4 text-center">
                    <Users className="w-6 h-6 mx-auto text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">{totalStudents}</p>
                    <p className="text-xs text-slate-500">Total Students</p>
                </Card>
                <Card className="p-4 text-center">
                    <MessageSquare className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">{totalMeetings}</p>
                    <p className="text-xs text-slate-500">Total Meetings</p>
                </Card>
                <Card className="p-4 text-center">
                    <Phone className="w-6 h-6 mx-auto text-amber-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">{totalParent}</p>
                    <p className="text-xs text-slate-500">Parent Interactions</p>
                </Card>
                <Card className="p-4 text-center">
                    <Activity className="w-6 h-6 mx-auto text-purple-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-800">{mentorsWithActivity}/{totalMentors}</p>
                    <p className="text-xs text-slate-500">Mentors Active</p>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Search by mentor name, email, or student name/USN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Mentor List */}
            {filteredMentors.length === 0 ? (
                <Card className="p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">No Mentor Assignments Found</h3>
                    <p className="text-slate-500">There are no active mentor assignments in your department.</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredMentors.map((mentor) => {
                        const isExpanded = expandedMentor === mentor.teacherProfileId;
                        const progress = getProgressWidth(mentor.studentsWithMeetings, mentor.totalStudents);

                        return (
                            <Card key={mentor.teacherProfileId} className="overflow-hidden">
                                {/* Mentor Summary Row */}
                                <button
                                    onClick={() => setExpandedMentor(isExpanded ? null : mentor.teacherProfileId)}
                                    className="w-full p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                                >
                                    {/* Avatar */}
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                        {mentor.teacherName.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="font-semibold text-slate-800 truncate">{mentor.teacherName}</p>
                                        <p className="text-xs text-slate-500 truncate">{mentor.teacherEmail}</p>
                                    </div>

                                    {/* Stats */}
                                    <div className="hidden sm:flex items-center gap-6 shrink-0">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-slate-800">{mentor.totalStudents}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Students</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-teal-600">{mentor.totalMeetingsLogged}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Meetings</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-amber-600">{mentor.totalParentInteractions}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">Parent</p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="hidden md:flex flex-col items-end gap-1 w-32 shrink-0">
                                        <span className={`text-xs font-semibold ${getCompletionColor(mentor.studentsWithMeetings, mentor.totalStudents)}`}>
                                            {progress}% coverage
                                        </span>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Last Activity */}
                                    <div className="hidden lg:block text-right w-28 shrink-0">
                                        {mentor.lastActivity ? (
                                            <div>
                                                <p className="text-xs text-slate-500">Last Active</p>
                                                <p className="text-xs font-medium text-slate-700">
                                                    {new Date(mentor.lastActivity).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                </p>
                                            </div>
                                        ) : (
                                            <Badge className="bg-red-100 text-red-700 text-[10px]">No Activity</Badge>
                                        )}
                                    </div>

                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                                </button>

                                {/* Expanded Student Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 px-5 pb-5">
                                        <div className="overflow-x-auto mt-4">
                                            <table className="w-full min-w-[600px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-200">
                                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Student</th>
                                                        <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">USN</th>
                                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Section</th>
                                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Meetings</th>
                                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Parent</th>
                                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Last Meeting</th>
                                                        <th className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider py-2 px-3">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {mentor.students.map((student) => (
                                                        <tr key={student.usn} className="hover:bg-slate-50/50">
                                                            <td className="py-2 px-3 text-sm font-medium text-slate-800">{student.name}</td>
                                                            <td className="py-2 px-3 text-sm text-slate-600 font-mono">{student.usn}</td>
                                                            <td className="py-2 px-3 text-sm text-slate-600 text-center">{student.section || '-'}</td>
                                                            <td className="py-2 px-3 text-center">
                                                                <span className={`text-sm font-semibold ${student.meetingsLogged > 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                                                                    {student.meetingsLogged}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <span className={`text-sm font-semibold ${student.parentInteractions > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                    {student.parentInteractions}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-sm text-slate-600 text-center">
                                                                {student.lastMeeting
                                                                    ? new Date(student.lastMeeting).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                    : '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                {student.meetingsLogged > 0 ? (
                                                                    <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>
                                                                ) : (
                                                                    <Badge className="bg-red-100 text-red-700 text-[10px]">Pending</Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
