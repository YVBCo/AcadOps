'use client';

import { useQuery } from '@tanstack/react-query';
import { admissionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BulkUploadModal } from '@/components/admin/BulkUploadModal';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    GraduationCap,
    Search,
    ChevronDown,
    ChevronRight,
    Download,
    Edit3,
    Users,
    Building2,
    Upload,
} from 'lucide-react';

interface Student {
    id: number;
    userId: number;
    rollNumber: string;
    temporaryUsn?: string;
    permanentUsn?: string;
    admissionYear?: number;
    currentSemester?: number;
    user: { id: number; name: string; email: string };
    batch?: { id: number; name: string };
    optedDepartment?: { id: number; name: string; code: string };
    admissionData?: Record<string, any>;
}

// Flatten JSON fields for export
function flattenStudent(s: Student): Record<string, any> {
    const ad = s.admissionData || {};
    const perm = ad.permanentAddress as any || {};
    const local = ad.localAddress as any || {};
    const father = ad.fatherDetails as any || {};
    const mother = ad.motherDetails as any || {};
    const sslc = ad.sslcDetails as any || {};
    const puc = ad.pucDetails as any || {};
    const marks = ad.subjectWiseMarks as any || {};

    return {
        'Admission ID': ad.admissionId || '',
        'USN': s.permanentUsn || s.temporaryUsn || s.rollNumber || '',
        'Name': s.user?.name || ad.applicantName || '',
        'Email': s.user?.email || ad.emailId || '',
        'Gender': ad.gender || '',
        'Date of Birth': ad.dateOfBirth ? new Date(ad.dateOfBirth).toLocaleDateString('en-IN') : '',
        'Blood Group': ad.bloodGroup || '',
        'Nationality': ad.nationality || '',
        'Religion': ad.religion || '',
        'Category': ad.category || '',
        'Sub Caste': ad.subCaste || '',
        'Mother Tongue': ad.motherTongue || '',
        'Specially Abled': ad.speciallyAbled ? 'Yes' : 'No',
        'Aadhaar Number': ad.aadhaarNumber || '',
        'Mobile Number': ad.mobileNumber || '',
        'Hostel': ad.hostel ? 'Yes' : 'No',
        'Pickup Place': ad.pickupPlace || '',
        'Branch': ad.branchSelection || s.optedDepartment?.name || '',
        'Admission Year': ad.admissionYear || s.admissionYear || '',
        'Current Semester': s.currentSemester || '',
        'Applying Through': ad.applyingThrough || '',
        'Permanent Address': perm.address || '',
        'Permanent State': perm.state || '',
        'Permanent Pin': perm.pin || '',
        'Local Address': local.address || '',
        'Local State': local.state || '',
        'Local Pin': local.pin || '',
        'Father Name': father.name || '',
        'Father Email': father.email || '',
        'Father Mobile': father.mobile || '',
        'Father Occupation': father.occupation || '',
        'Father Annual Income': father.annualIncome || '',
        'Mother Name': mother.name || '',
        'Mother Email': mother.email || '',
        'Mother Mobile': mother.mobile || '',
        'Mother Occupation': mother.occupation || '',
        'Mother Annual Income': mother.annualIncome || '',
        'SSLC Register No': sslc.registerNo || '',
        'SSLC School': sslc.schoolName || '',
        'SSLC Medium': sslc.medium || '',
        'SSLC Marks': sslc.marks || '',
        'SSLC Max Marks': sslc.maxMarks || '',
        'SSLC Percentage': sslc.percentage || '',
        'SSLC Year': sslc.yearOfPassing || '',
        'PUC Register No': puc.registerNo || '',
        'PUC College': puc.collegeName || '',
        'PUC Medium': puc.medium || '',
        'PUC Marks': puc.marks || '',
        'PUC Max Marks': puc.maxMarks || '',
        'PUC Percentage': puc.percentage || '',
        'PUC Year': puc.yearOfPassing || '',
        'Physics Obtained': marks.physics?.obtained || '',
        'Physics Max': marks.physics?.max || '',
        'Maths Obtained': marks.mathematics?.obtained || '',
        'Maths Max': marks.mathematics?.max || '',
        'Chemistry Obtained': marks.chemistry?.obtained || '',
        'Chemistry Max': marks.chemistry?.max || '',
        'CET Roll No': ad.cetRollNo || '',
        'CET Rank': ad.cetRank || '',
        'CET Allotted Category': ad.cetAllottedCategory || '',
        'COMEDK Roll No': ad.comedkRollNo || '',
        'COMEDK Rank': ad.comedkRank || '',
    };
}

// Helper: escape CSV value
function csvEscape(val: any): string {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export default function StudentsPage() {
    const { user: currentUser } = useAuthStore();
    const searchParams = useSearchParams();
    const isAdmin = currentUser?.role === 'ADMISSIONS_ADMIN' || currentUser?.role === 'ADMIN_CLERK';
    const isSuperAdmin = currentUser?.role === 'ADMISSIONS_ADMIN';
    const [search, setSearch] = useState('');
    const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    // Auto-open bulk upload modal if ?upload=true is in the URL
    useEffect(() => {
        if (searchParams.get('upload') === 'true' && isSuperAdmin) {
            setShowBulkUpload(true);
        }
    }, [searchParams, isSuperAdmin]);

    const { data: rawStudentData, isLoading } = useQuery({
        queryKey: ['admissions-students'],
        queryFn: () => admissionsApi.getStudents(),
    });
    const students: Student[] = Array.isArray(rawStudentData) ? rawStudentData : (rawStudentData?.students ?? []);

    // Filter by search
    const filtered = useMemo(() => {
        if (!search.trim()) return students;
        const q = search.toLowerCase();
        return students.filter(s =>
            s.user.name.toLowerCase().includes(q) ||
            s.rollNumber?.toLowerCase().includes(q) ||
            s.permanentUsn?.toLowerCase().includes(q) ||
            s.admissionData?.admissionId?.toLowerCase().includes(q)
        );
    }, [students, search]);

    // Group by batch → department
    const grouped = useMemo(() => {
        const map = new Map<string, Map<string, Student[]>>();
        for (const s of filtered) {
            const batchName = s.batch?.name || 'Unknown Batch';
            const deptName = s.optedDepartment?.name || s.admissionData?.branchSelection || 'Unknown';
            if (!map.has(batchName)) map.set(batchName, new Map());
            const deptMap = map.get(batchName)!;
            if (!deptMap.has(deptName)) deptMap.set(deptName, []);
            deptMap.get(deptName)!.push(s);
        }
        return map;
    }, [filtered]);

    const toggleBatch = (batch: string) => {
        setExpandedBatches(prev => {
            const next = new Set(prev);
            if (next.has(batch)) next.delete(batch); else next.add(batch);
            return next;
        });
    };

    const toggleDept = (key: string) => {
        setExpandedDepts(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // Download CSV for a batch + department (no external dependency)
    const downloadExcel = useCallback((batchName: string, deptName: string, deptStudents: Student[]) => {
        const rows = deptStudents.map(flattenStudent);
        if (rows.length === 0) return;

        const headers = Object.keys(rows[0]);
        const csvLines = [
            headers.map(csvEscape).join(','),
            ...rows.map(row => headers.map(h => csvEscape(row[h])).join(','))
        ];
        const csvContent = csvLines.join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Students_Batch-${batchName}_${deptName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                        Students
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        {filtered.length} approved student{filtered.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {isSuperAdmin && (
                    <Button
                        onClick={() => setShowBulkUpload(true)}
                        leftIcon={Upload}
                        className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-lg shadow-sky-500/25"
                    >
                        Bulk Upload
                    </Button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, USN, or admission ID..."
                    className="pl-10"
                />
            </div>

            {/* Batches */}
            {grouped.size === 0 ? (
                <Card className="p-12 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-semibold text-slate-600">No students found</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        {search ? 'Try a different search term.' : 'Approved admissions will appear here.'}
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {[...grouped.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([batchName, deptMap]) => {
                        const batchExpanded = expandedBatches.has(batchName);
                        const batchCount = [...deptMap.values()].reduce((sum, arr) => sum + arr.length, 0);

                        return (
                            <Card key={batchName} className="overflow-hidden">
                                {/* Batch Header */}
                                <button
                                    onClick={() => toggleBatch(batchName)}
                                    className="w-full flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-colors text-left"
                                >
                                    {batchExpanded
                                        ? <ChevronDown className="h-5 w-5 text-indigo-500" />
                                        : <ChevronRight className="h-5 w-5 text-indigo-500" />
                                    }
                                    <GraduationCap className="h-5 w-5 text-indigo-600" />
                                    <span className="font-bold text-indigo-900">Batch {batchName}</span>
                                    <span className="ml-auto text-sm font-medium text-indigo-500 bg-indigo-100 px-3 py-1 rounded-full">
                                        {batchCount} student{batchCount !== 1 ? 's' : ''}
                                    </span>
                                </button>

                                {batchExpanded && (
                                    <div className="divide-y divide-slate-100">
                                        {[...deptMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([deptName, deptStudents]) => {
                                            const deptKey = `${batchName}__${deptName}`;
                                            const deptExpanded = expandedDepts.has(deptKey);

                                            return (
                                                <div key={deptKey}>
                                                    {/* Department Header with download button */}
                                                    <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                                        <button
                                                            onClick={() => toggleDept(deptKey)}
                                                            className="flex-1 flex items-center gap-3 px-6 py-3 text-left pl-12"
                                                        >
                                                            {deptExpanded
                                                                ? <ChevronDown className="h-4 w-4 text-teal-500" />
                                                                : <ChevronRight className="h-4 w-4 text-teal-500" />
                                                            }
                                                            <Building2 className="h-4 w-4 text-teal-600" />
                                                            <span className="font-semibold text-teal-800 text-sm">{deptName}</span>
                                                            <span className="text-xs font-medium text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                                                                {deptStudents.length}
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); downloadExcel(batchName, deptName, deptStudents); }}
                                                            title={`Download ${deptName} students as Excel`}
                                                            className="mr-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            Excel
                                                        </button>
                                                    </div>

                                                    {/* Student Table */}
                                                    {deptExpanded && (
                                                        <div className="bg-white">
                                                            <table className="w-full text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                                                                        <th className="py-2 px-6 pl-16 text-left font-medium">USN / Roll</th>
                                                                        <th className="py-2 px-4 text-left font-medium">Name</th>
                                                                        <th className="py-2 px-4 text-left font-medium">Admission ID</th>
                                                                        <th className="py-2 px-4 text-left font-medium">Mobile</th>
                                                                        {isAdmin && <th className="py-2 px-4 text-right font-medium">Action</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {deptStudents.map(s => (
                                                                        <tr key={s.id} className="hover:bg-sky-50/40 transition-colors">
                                                                            <td className="py-3 px-6 pl-16">
                                                                                <div>
                                                                                    <span className="font-mono font-semibold text-slate-800">
                                                                                        {s.permanentUsn || s.rollNumber}
                                                                                    </span>
                                                                                    {s.permanentUsn && s.temporaryUsn && (
                                                                                        <span className="block text-xs text-slate-400 font-mono">
                                                                                            Temp: {s.temporaryUsn}
                                                                                        </span>
                                                                                    )}
                                                                                    {!s.permanentUsn && (
                                                                                        <span className="ml-2 text-xs text-amber-500 font-medium">(temp)</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-3 px-4">
                                                                                <span className="font-medium text-slate-800">{s.user.name}</span>
                                                                            </td>
                                                                            <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                                                                                {s.admissionData?.admissionId || '—'}
                                                                            </td>
                                                                            <td className="py-3 px-4 text-slate-500">
                                                                                {s.admissionData?.mobileNumber || '—'}
                                                                            </td>
                                                                            {isAdmin && (
                                                                                <td className="py-3 px-4 text-right">
                                                                                    <Link href={`/dashboard/admissions/students/${s.user.id}/edit`}>
                                                                                        <Button variant="ghost" className="text-xs text-indigo-600 hover:bg-indigo-50 h-8 px-3">
                                                                                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                                                                                            Edit
                                                                                        </Button>
                                                                                    </Link>
                                                                                </td>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={showBulkUpload}
                onClose={() => setShowBulkUpload(false)}
            />
        </div>
    );
}
