'use client';

import { useQuery } from '@tanstack/react-query';
import { mentorApi } from '@/lib/api';
import Link from 'next/link';
import { Users, ArrowLeft, ArrowRight, Search, Phone, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useState, useMemo } from 'react';

interface ParentInfo {
    name: string;
    loginId: string;
    phone: string;
    relationship: string;
}

interface Student {
    usn: string;
    name: string;
    email: string;
    currentSemester: number;
    section?: { name: string };
    batch?: { name: string };
    department?: { name: string };
    parentInfo?: ParentInfo | null;
}

export default function MentorStudentsPage() {
    const [search, setSearch] = useState('');

    const { data: students, isLoading } = useQuery<Student[]>({
        queryKey: ['mentor-students'],
        queryFn: () => mentorApi.getStudents(),
    });

    const filteredStudents = useMemo(() => {
        if (!students) return [];
        if (!search.trim()) return students;
        const term = search.toLowerCase();
        return students.filter(s =>
            s.name.toLowerCase().includes(term) ||
            s.usn.toLowerCase().includes(term) ||
            s.email.toLowerCase().includes(term) ||
            s.parentInfo?.phone?.includes(term)
        );
    }, [students, search]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading students...</p>
                </div>
            </div>
        );
    }

    const studentList = students || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/teacher/mentorship"
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Assigned Students</h1>
                    <p className="text-slate-600">{studentList.length} students under your mentorship</p>
                </div>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name, USN, email, or parent phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                </div>
            </Card>

            {/* Student Grid */}
            {filteredStudents.length === 0 ? (
                <div className="text-center py-16">
                    <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">No Students Found</h3>
                    <p className="text-slate-500">
                        {search ? 'Try a different search term' : 'No students assigned to you yet'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => (
                        <Link
                            key={student.usn}
                            href={`/dashboard/teacher/mentorship/student/${student.usn}`}
                        >
                            <Card className="p-5 hover:shadow-lg transition-all hover:border-teal-200 cursor-pointer group">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                                        {student.name?.charAt(0).toUpperCase() || 'S'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-800 group-hover:text-teal-700 transition-colors truncate">
                                            {student.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-mono">{student.usn}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                                                Sem {student.currentSemester}
                                            </span>
                                            {student.section && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                                    {student.section.name}
                                                </span>
                                            )}
                                        </div>
                                        {/* Parent Info */}
                                        {student.parentInfo && (
                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                                                    <span className="font-medium">Parent:</span>
                                                    <span className="text-slate-600">{student.parentInfo.name || student.parentInfo.relationship}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-mono text-slate-600">{student.parentInfo.phone}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition-colors shrink-0 mt-1" />
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
