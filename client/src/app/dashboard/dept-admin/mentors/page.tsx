'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorAssignmentApi, studentApi, batchApi } from '@/lib/api';
import { Users, UserCheck, Plus, X, Calendar, Search, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Teacher {
    id: number;
    designation: string;
    user: { id: number; name: string; email: string };
    department: { id: number; name: string; code: string };
}

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
}

interface MentorGroup {
    teacher: { id: number; user: { name: string; email: string }; designation?: string };
    students: Array<{
        id: number;
        rollNumber: string;
        user: { name: string; email: string };
        section?: { name: string };
        batch?: { name: string };
        assignmentId: number;
    }>;
}

interface StudentsResponse {
    users: Array<{
        id: number;
        name: string;
        studentProfile?: {
            id: number;
            rollNumber: string;
            currentSemester: number;
            section?: { name: string };
            batchId?: number;
        };
    }>;
    total: number;
}

export default function MentorsPage() {
    const queryClient = useQueryClient();
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [selectedStudents, setSelectedStudents] = useState<Map<string, { usn: string; name: string; batchName: string; semester: number }>>(new Map());
    const [studentSearch, setStudentSearch] = useState('');
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
    const [filterBatchId, setFilterBatchId] = useState<number | null>(null);

    // Get current academic year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const academicYear = currentMonth >= 6 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;

    // Fetch batches
    const { data: batches } = useQuery<Batch[]>({
        queryKey: ['batches'],
        queryFn: () => batchApi.getAll(),
    });

    // Fetch teachers
    const { data: teachersData, isLoading: teachersLoading } = useQuery<any[]>({
        queryKey: ['dept-teachers'],
        queryFn: () => mentorAssignmentApi.getTeachers(),
    });

    // Transform teacher data
    const teachers: Teacher[] = (teachersData || [])
        .filter(t => t.teacherProfile)
        .map(t => ({
            id: t.teacherProfile.id,
            designation: t.teacherProfile.designation || 'Teacher',
            user: { id: t.id, name: t.name, email: t.email },
            department: { id: t.departmentId, name: '', code: '' },
        }));

    // Fetch assignments (grouped by teacher from backend)
    const { data: mentorGroups, isLoading: assignmentsLoading } = useQuery<MentorGroup[]>({
        queryKey: ['mentor-assignments', filterBatchId],
        queryFn: () => mentorAssignmentApi.getAssignments(filterBatchId || undefined),
    });

    // Fetch students for selected batch in assignment modal
    const { data: studentsResponse, isLoading: studentsLoading } = useQuery<StudentsResponse>({
        queryKey: ['batch-students', selectedBatchId],
        queryFn: () => studentApi.getStudents({ batchId: selectedBatchId || undefined }),
        enabled: showAssignModal && !!selectedBatchId,
    });

    // Assign mutation
    const assignMutation = useMutation({
        mutationFn: (data: { teacherProfileId: number; studentUsns: string[]; semesterNumber: number; academicYear: string }) =>
            mentorAssignmentApi.assign(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-assignments'] });
            setShowAssignModal(false);
            setSelectedTeacher(null);
            setSelectedStudents(new Map());
            setSelectedBatchId(null);
        },
    });

    // Expire mutation
    const expireMutation = useMutation({
        mutationFn: (assignmentId: number) => mentorAssignmentApi.expire(assignmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mentor-assignments'] });
        },
    });

    const isLoading = teachersLoading || assignmentsLoading;

    // Transform students from API response
    const students = (studentsResponse?.users || [])
        .filter(u => u.studentProfile)
        .map(u => ({
            usn: u.studentProfile!.rollNumber || '',
            name: u.name,
            rollNumber: u.studentProfile!.rollNumber || '',
            currentSemester: u.studentProfile!.currentSemester || 1,
            section: u.studentProfile!.section,
        }));

    const filteredStudents = students.filter(s => {
        if (!studentSearch.trim()) return true;
        const term = studentSearch.toLowerCase();
        return s.name.toLowerCase().includes(term) ||
            s.usn.toLowerCase().includes(term) ||
            s.rollNumber?.toLowerCase().includes(term);
    });

    const toggleStudent = (student: typeof students[0]) => {
        const newMap = new Map(selectedStudents);
        const batchName = batches?.find(b => b.id === selectedBatchId)?.name || '';
        if (newMap.has(student.usn)) {
            newMap.delete(student.usn);
        } else {
            newMap.set(student.usn, {
                usn: student.usn,
                name: student.name,
                batchName,
                semester: student.currentSemester,
            });
        }
        setSelectedStudents(newMap);
    };

    const toggleAllFiltered = () => {
        const newMap = new Map(selectedStudents);
        const allSelected = filteredStudents.every(s => newMap.has(s.usn));
        const batchName = batches?.find(b => b.id === selectedBatchId)?.name || '';
        if (allSelected) {
            filteredStudents.forEach(s => newMap.delete(s.usn));
        } else {
            filteredStudents.forEach(s => {
                newMap.set(s.usn, {
                    usn: s.usn,
                    name: s.name,
                    batchName,
                    semester: s.currentSemester,
                });
            });
        }
        setSelectedStudents(newMap);
    };

    const handleAssign = () => {
        if (!selectedTeacher || selectedStudents.size === 0) return;
        const usns = Array.from(selectedStudents.keys());
        const firstStudent = selectedStudents.values().next().value;

        assignMutation.mutate({
            teacherProfileId: selectedTeacher.id,
            studentUsns: usns,
            semesterNumber: firstStudent?.semester || 1,
            academicYear,
        });
    };

    // Count stats
    const totalMentors = (mentorGroups || []).length;
    const totalAssigned = (mentorGroups || []).reduce((sum, g) => sum + g.students.length, 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading mentors...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Mentor Management</h1>
                    <p className="text-slate-600">Assign mentors to students in your department</p>
                </div>
                <button
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg font-medium shadow-lg shadow-teal-500/30 hover:shadow-xl transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Assign Mentor
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                            <UserCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Active Mentors</p>
                            <p className="text-2xl font-bold text-slate-800">{totalMentors}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Assigned Students</p>
                            <p className="text-2xl font-bold text-slate-800">{totalAssigned}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Academic Year</p>
                            <p className="text-2xl font-bold text-slate-800">{academicYear}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter by Batch */}
            <div className="flex items-center gap-4">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                    value={filterBatchId || ''}
                    onChange={(e) => setFilterBatchId(e.target.value ? Number(e.target.value) : null)}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                    <option value="">All Batches</option>
                    {(batches || []).map(batch => (
                        <option key={batch.id} value={batch.id}>{batch.name} (Sem {batch.currentSemester})</option>
                    ))}
                </select>
            </div>

            {/* Mentor List */}
            {totalMentors === 0 ? (
                <div className="text-center py-16">
                    <UserCheck className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">No Mentor Assignments</h3>
                    <p className="text-slate-500 mb-6">Start by assigning mentors to students</p>
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors"
                    >
                        Assign First Mentor
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {(mentorGroups || []).map((group) => (
                        <Card key={group.teacher.id} className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                                        {group.teacher.user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-800">{group.teacher.user.name}</h3>
                                        <p className="text-sm text-slate-500">{group.teacher.designation || 'Teacher'} • {group.teacher.user.email}</p>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                                    {group.students.length} students
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {group.students.map(student => (
                                    <div
                                        key={student.assignmentId}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-800 text-sm">
                                                {student.user.name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {student.rollNumber}
                                                {student.batch && ` • ${student.batch.name}`}
                                                {student.section && ` • ${student.section.name}`}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => expireMutation.mutate(student.assignmentId)}
                                            disabled={expireMutation.isPending}
                                            className="p-1 text-slate-400 hover:text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all"
                                            title="Remove assignment"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">Assign Mentor to Students</h2>
                                <button
                                    onClick={() => {
                                        setShowAssignModal(false);
                                        setSelectedTeacher(null);
                                        setSelectedStudents(new Map());
                                        setSelectedBatchId(null);
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                            {/* Teacher Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Select Mentor (Teacher)
                                </label>
                                <select
                                    value={selectedTeacher?.id || ''}
                                    onChange={(e) => {
                                        const teacher = teachers?.find(t => t.id === Number(e.target.value));
                                        setSelectedTeacher(teacher || null);
                                    }}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">Choose a teacher...</option>
                                    {teachers?.map(teacher => (
                                        <option key={teacher.id} value={teacher.id}>
                                            {teacher.user.name} ({teacher.designation})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Batch Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Select Batch
                                </label>
                                <select
                                    value={selectedBatchId || ''}
                                    onChange={(e) => {
                                        setSelectedBatchId(e.target.value ? Number(e.target.value) : null);
                                        setStudentSearch('');
                                    }}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                    <option value="">Choose a batch...</option>
                                    {(batches || []).map(batch => (
                                        <option key={batch.id} value={batch.id}>
                                            {batch.name} (Sem {batch.currentSemester})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Selected Students Summary (cross-batch) */}
                            {selectedStudents.size > 0 && (
                                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-teal-800">
                                            {selectedStudents.size} student{selectedStudents.size !== 1 ? 's' : ''} selected
                                        </p>
                                        <button
                                            onClick={() => setSelectedStudents(new Map())}
                                            className="text-xs text-teal-600 hover:text-teal-800 underline"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Array.from(selectedStudents.values()).map(s => (
                                            <span
                                                key={s.usn}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs"
                                            >
                                                {s.name} <span className="text-teal-500">({s.batchName})</span>
                                                <button
                                                    onClick={() => {
                                                        const newMap = new Map(selectedStudents);
                                                        newMap.delete(s.usn);
                                                        setSelectedStudents(newMap);
                                                    }}
                                                    className="hover:text-red-500 ml-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Student Selection */}
                            {selectedBatchId ? (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Select Students from {batches?.find(b => b.id === selectedBatchId)?.name}
                                        </label>
                                        {filteredStudents.length > 0 && (
                                            <button
                                                onClick={toggleAllFiltered}
                                                className="text-xs text-teal-600 hover:text-teal-800 underline"
                                            >
                                                {filteredStudents.every(s => selectedStudents.has(s.usn)) ? 'Deselect all' : 'Select all'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={studentSearch}
                                            onChange={(e) => setStudentSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                        {studentsLoading ? (
                                            <div className="p-4 text-center text-slate-500">Loading students...</div>
                                        ) : filteredStudents.length === 0 ? (
                                            <div className="p-4 text-center text-slate-500">No students found in this batch</div>
                                        ) : (
                                            filteredStudents.map(student => (
                                                <label
                                                    key={student.usn}
                                                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStudents.has(student.usn)}
                                                        onChange={() => toggleStudent(student)}
                                                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-medium text-slate-800 text-sm">{student.name}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {student.usn} • Sem {student.currentSemester} • {student.section?.name || 'No section'}
                                                        </p>
                                                    </div>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        💡 You can switch batches to select students from multiple batches
                                    </p>
                                </div>
                            ) : (
                                <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                                    <Users className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-sm">Select a batch to view students</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAssignModal(false);
                                    setSelectedTeacher(null);
                                    setSelectedStudents(new Map());
                                    setSelectedBatchId(null);
                                }}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={!selectedTeacher || selectedStudents.size === 0 || assignMutation.isPending}
                                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {assignMutation.isPending ? 'Assigning...' : `Assign ${selectedStudents.size} Student${selectedStudents.size !== 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
