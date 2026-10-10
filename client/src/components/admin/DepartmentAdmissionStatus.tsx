'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Building2, Lock, LockOpen, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { admissionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface DepartmentStatus {
    id: number;
    name: string;
    code: string;
    isAdmissionOpen: boolean;
    admissionClosedAt: string | null;
    studentsAwaitingUsn: number;
}

interface CloseAdmissionResult {
    message: string;
    department: string;
    allocatedCount: number;
    students: Array<{
        studentName: string;
        temporaryUsn: string;
        email: string;
    }>;
}

export function DepartmentAdmissionStatus() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [selectedDept, setSelectedDept] = useState<number | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showResults, setShowResults] = useState<CloseAdmissionResult | null>(null);

    const { data: departments, isLoading } = useQuery<DepartmentStatus[]>({
        queryKey: ['department-admission-status', user?.tenantId, user?.id],
        queryFn: () => admissionsApi.getDepartmentStatus(),
        refetchInterval: 30000,
    });

    const closeAdmissionMutation = useMutation({
        mutationFn: (departmentId: number) => admissionsApi.closeAdmissions(departmentId),
        onSuccess: (data: CloseAdmissionResult) => {
            queryClient.invalidateQueries({ queryKey: ['department-admission-status', user?.tenantId, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            setShowResults(data);
            setShowConfirmation(false);
            setSelectedDept(null);
        },
        onError: (error: any) => window.alert(error.response?.data?.error || error.message || 'Could not close admissions.'),
    });

    const reopenAdmissionMutation = useMutation({
        mutationFn: (departmentId: number) => admissionsApi.reopenAdmissions(departmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['department-admission-status', user?.tenantId, user?.id] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
        },
        onError: (error: any) => window.alert(error.response?.data?.error || error.message || 'Could not reopen admissions.'),
    });

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                </div>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Department Admission Status</h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Close department admissions to allocate temporary USNs alphabetically
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {departments?.map((dept) => (
                        <div
                            key={dept.id}
                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${dept.isAdmissionOpen
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${dept.isAdmissionOpen ? 'bg-emerald-100' : 'bg-slate-200'
                                        }`}
                                >
                                    <Building2
                                        className={`w-6 h-6 ${dept.isAdmissionOpen ? 'text-emerald-600' : 'text-slate-500'
                                            }`}
                                    />
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="font-semibold text-slate-800">{dept.name}</h4>
                                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                            {dept.code}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 mt-2">
                                        {dept.isAdmissionOpen ? (
                                            <>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                                    <LockOpen className="w-4 h-4" />
                                                    Admissions Open
                                                </span>
                                                {dept.studentsAwaitingUsn > 0 && (
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                                        <Users className="w-3 h-3" />
                                                        {dept.studentsAwaitingUsn} student{dept.studentsAwaitingUsn !== 1 ? 's' : ''} awaiting USN
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                                    <Lock className="w-4 h-4" />
                                                    Admissions Closed
                                                </span>
                                                {dept.admissionClosedAt && (
                                                    <span className="text-xs text-slate-500">
                                                        Closed {new Date(dept.admissionClosedAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {dept.isAdmissionOpen ? (
                                    <button
                                        onClick={() => {
                                            setSelectedDept(dept.id);
                                            setShowConfirmation(true);
                                        }}
                                        disabled={dept.studentsAwaitingUsn === 0 || closeAdmissionMutation.isPending}
                                        className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                                    >
                                        {closeAdmissionMutation.isPending && selectedDept === dept.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                                Closing...
                                            </>
                                        ) : (
                                            'Close Admissions'
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => reopenAdmissionMutation.mutate(dept.id)}
                                        disabled={reopenAdmissionMutation.isPending}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm transition-colors"
                                    >
                                        {reopenAdmissionMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                                Reopening...
                                            </>
                                        ) : (
                                            'Reopen Admissions'
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Confirmation Modal */}
            {showConfirmation && selectedDept && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <AlertCircle className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">Close Department Admissions?</h3>
                        </div>

                        <p className="text-slate-600 mb-6">
                            This will close admissions for{' '}
                            <strong>{departments?.find(d => d.id === selectedDept)?.name}</strong> and allocate
                            temporary USNs to all approved students in alphabetical order. This action will:
                        </p>

                        <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 mb-6">
                            <li>Generate sequential temporary USNs (alphabetically by student name)</li>
                            <li>Activate student accounts with login credentials</li>
                            <li>Assign shared branch+batch password (e.g. CSE2023)</li>
                            <li>Send welcome emails to parents</li>
                            <li>Prevent new admissions until reopened</li>
                        </ul>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowConfirmation(false);
                                    setSelectedDept(null);
                                }}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => closeAdmissionMutation.mutate(selectedDept)}
                                className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium transition-colors"
                            >
                                Close & Allocate USNs
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {showResults && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">USNs Allocated Successfully!</h3>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                            <p className="text-emerald-800 font-medium">{showResults.message}</p>
                            <p className="text-sm text-emerald-700 mt-1">
                                Allocated {showResults.allocatedCount} temporary USN{showResults.allocatedCount !== 1 ? 's' : ''} in alphabetical order
                            </p>
                        </div>

                        <h4 className="font-semibold text-slate-800 mb-3">Allocated Students:</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {showResults.students.map((student, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                                >
                                    <div>
                                        <p className="font-medium text-slate-800">{student.studentName}</p>
                                        <p className="text-xs text-slate-500">{student.email}</p>
                                    </div>
                                    <span className="font-mono font-semibold text-sky-600 bg-sky-50 px-3 py-1 rounded">
                                        {student.temporaryUsn}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowResults(null)}
                            className="w-full mt-6 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
