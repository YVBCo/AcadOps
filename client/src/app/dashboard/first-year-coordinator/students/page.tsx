'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import {
    Users,
    Search,
    Filter,
    Loader2,
    GraduationCap,
    AtomIcon,
    FlaskConical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StudentData {
    id: number;
    userId: number;
    name: string;
    email: string;
    rollNumber: string;
    currentSemester: number;
    cycleDepartment: {
        id: number;
        name: string;
        code: string;
    } | null;
    permanentUsn: string | null;
    temporaryUsn: string | null;
}

interface GroupedStudents {
    [batchId: string]: {
        batch: any;
        departments: {
            [deptId: string]: {
                department: any;
                students: StudentData[];
            };
        };
    };
}

export default function StudentsPage() {
    const [students, setStudents] = useState<GroupedStudents>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [semesterFilter, setSemesterFilter] = useState<number | null>(null);

    useEffect(() => {
        fetchStudents();
    }, [semesterFilter]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (semesterFilter) params.append('semester', semesterFilter.toString());

            const response = await api.get(`/first-year-coordinator/students?${params}`);
            setStudents(response.data.data);
        } catch (err: any) {
            console.error('Failed to load students:', err);
        } finally {
            setLoading(false);
        }
    };

    const filterStudents = (students: StudentData[]) => {
        if (!searchTerm) return students;

        return students.filter(
            (s) =>
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.permanentUsn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.temporaryUsn?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const totalStudents = Object.values(students).reduce((sum, batch) => {
        return (
            sum +
            Object.values(batch.departments).reduce((deptSum, dept) => deptSum + dept.students.length, 0)
        );
    }, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">First Year Students</h1>
                <p className="text-slate-600 mt-1">
                    View all students in semesters 1 and 2, grouped by batch and department.
                </p>
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, roll number, USN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Semester Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-slate-400" />
                        <select
                            value={semesterFilter || ''}
                            onChange={(e) => setSemesterFilter(e.target.value ? parseInt(e.target.value) : null)}
                            className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Semesters</option>
                            <option value="1">Semester 1</option>
                            <option value="2">Semester 2</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <span className="font-semibold text-indigo-800">{totalStudents} Students</span>
                    </div>
                </div>
            </Card>

            {/* Grouped Students */}
            {Object.entries(students).map(([batchId, batchData]) => (
                <Card key={batchId}>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <GraduationCap className="h-6 w-6 text-indigo-600" />
                            Batch {batchData.batch.name}
                        </h2>
                        <p className="text-slate-600 mt-1">Semester {batchData.batch.currentSemester}</p>
                    </div>

                    {Object.entries(batchData.departments).map(([deptId, deptData]) => {
                        const filteredStudents = filterStudents(deptData.students);

                        if (filteredStudents.length === 0 && searchTerm) return null;

                        return (
                            <div key={deptId} className="mb-6 last:mb-0">
                                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                                {deptData.department.name}
                                                <Badge variant="outline">{deptData.department.code}</Badge>
                                            </h3>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {filteredStudents.length} students
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredStudents.map((student) => (
                                        <div
                                            key={student.id}
                                            className="p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-slate-800 truncate">{student.name}</h4>
                                                    <p className="text-sm text-slate-600 truncate">{student.email}</p>
                                                </div>
                                                <Badge className={`ml-2 flex-shrink-0 ${student.currentSemester === 1 ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                                    Sem {student.currentSemester}
                                                </Badge>
                                            </div>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-600">Roll No:</span>
                                                    <span className="font-medium text-slate-800">{student.rollNumber}</span>
                                                </div>

                                                {student.permanentUsn && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600">USN:</span>
                                                        <span className="font-mono font-medium text-slate-800">
                                                            {student.permanentUsn}
                                                        </span>
                                                    </div>
                                                )}

                                                {student.temporaryUsn && !student.permanentUsn && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600">Temp USN:</span>
                                                        <span className="font-mono font-medium text-slate-800">
                                                            {student.temporaryUsn}
                                                        </span>
                                                    </div>
                                                )}

                                                {student.cycleDepartment && (
                                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                                        <div className="flex items-center gap-2">
                                                            {student.cycleDepartment.code === 'PHY' ? (
                                                                <AtomIcon className="h-4 w-4 text-blue-600" />
                                                            ) : (
                                                                <FlaskConical className="h-4 w-4 text-purple-600" />
                                                            )}
                                                            <span className="text-xs text-slate-600">
                                                                {student.cycleDepartment.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </Card>
            ))}

            {totalStudents === 0 && (
                <Card>
                    <div className="text-center py-12">
                        <Users className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-600 font-medium">No students found</p>
                        <p className="text-slate-500 text-sm mt-1">
                            There are no first year students to display.
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
