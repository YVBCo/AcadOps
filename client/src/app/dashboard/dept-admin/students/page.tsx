'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    Users,
    Search,
    ChevronDown,
    AlertCircle,
    GraduationCap,
    Hash,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Student {
    id: number;
    name: string;
    email: string;
    studentProfile: {
        usn: string;
        rollNumber: number;
        program: { name: string; code: string };
        section: { name: string } | null;
        batch: { name: string } | null;
    };
}

interface Batch {
    id: number;
    name: string;
}

interface Section {
    id: number;
    name: string;
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [selectedBatch, setSelectedBatch] = useState<number | undefined>();
    const [selectedSection, setSelectedSection] = useState<number | undefined>();
    const [searchQuery, setSearchQuery] = useState('');

    const pageSize = 20;

    useEffect(() => {
        fetchFilters();
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [page, selectedBatch, selectedSection]);

    const fetchFilters = async () => {
        try {
            const [batchesRes, sectionsRes] = await Promise.all([
                api.get('/batches'),
                api.get('/dept-admin/sections'),
            ]);
            setBatches(batchesRes.data);
            setSections(sectionsRes.data);
        } catch (err) {
            console.error('Failed to load filters', err);
        }
    };

    const fetchStudents = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.append('skip', (page * pageSize).toString());
            params.append('take', pageSize.toString());
            if (selectedBatch) params.append('batchId', selectedBatch.toString());
            if (selectedSection) params.append('sectionId', selectedSection.toString());

            const res = await api.get(`/dept-admin/students?${params}`);
            setStudents(res.data.users || []);
            setTotal(res.data.total || 0);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter((student) =>
        searchQuery
            ? student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.studentProfile?.usn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email.toLowerCase().includes(searchQuery.toLowerCase())
            : true
    );

    if (loading && students.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Students</h1>
                <p className="text-neutral-500">View and manage students in your department</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, USN, or email..."
                        className="pl-10"
                    />
                </div>

                <div className="relative">
                    <select
                        value={selectedBatch || ''}
                        onChange={(e) => {
                            setSelectedBatch(e.target.value ? parseInt(e.target.value) : undefined);
                            setPage(0);
                        }}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">All Batches</option>
                        {batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                {batch.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>

                <div className="relative">
                    <select
                        value={selectedSection || ''}
                        onChange={(e) => {
                            setSelectedSection(e.target.value ? parseInt(e.target.value) : undefined);
                            setPage(0);
                        }}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">All Sections</option>
                        {sections.map((section: any) => (
                            <option key={section.id} value={section.id}>
                                Section {section.name}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>

                <Badge variant="outline" className="text-neutral-600">
                    {total} students
                </Badge>
            </div>

            {/* Students Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-100">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    Student
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    USN
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    Program
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    Section
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    Batch
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold">
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-neutral-900">{student.name}</p>
                                                <p className="text-sm text-neutral-500">{student.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-4 w-4 text-neutral-400" />
                                            <span className="font-mono text-sm text-neutral-900">
                                                {student.studentProfile?.usn || 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <GraduationCap className="h-4 w-4 text-neutral-400" />
                                            <span className="text-neutral-900">
                                                {student.studentProfile?.program?.code || 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {student.studentProfile?.section ? (
                                            <Badge className="bg-emerald-100 text-emerald-700">
                                                Section {student.studentProfile.section.name}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-neutral-400">
                                                Unassigned
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-neutral-900">
                                            {student.studentProfile?.batch?.name || 'N/A'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > pageSize && (
                    <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
                        <p className="text-sm text-neutral-500">
                            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, total)} of {total}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={(page + 1) * pageSize >= total}
                                className="px-3 py-1 text-sm rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {filteredStudents.length === 0 && !loading && (
                <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No students found</h3>
                    <p className="text-neutral-500">Try adjusting your filters</p>
                </div>
            )}
        </div>
    );
}
