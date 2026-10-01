'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { User, CheckCircle, Loader2, AlertCircle, Hash } from 'lucide-react';
import { useState } from 'react';
import { coeApi } from '@/lib/api';

interface Student {
    id: number;
    name: string;
    email: string;
    temporaryUsn: string | null;
    permanentUsn: string | null;
    batch?: {
        name: string;
    };
    department?: {
        name: string;
        code: string;
    };
}

export function PermanentUsnAssignment() {
    const queryClient = useQueryClient();
    const [usnInputs, setUsnInputs] = useState<Record<number, string>>({});
    const [assigningId, setAssigningId] = useState<number | null>(null);

    const { data: students, isLoading } = useQuery<Student[]>({
        queryKey: ['students-awaiting-usn'],
        queryFn: () => coeApi.getStudentsAwaitingUsn(),
        refetchInterval: 30000,
    });

    const assignUsnMutation = useMutation({
        mutationFn: ({ studentProfileId, usn }: { studentProfileId: number; usn: string }) =>
            coeApi.assignPermanentUsn(studentProfileId, usn),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['students-awaiting-usn'] });
            // Clear the input for this student
            setUsnInputs(prev => {
                const newInputs = { ...prev };
                delete newInputs[variables.studentProfileId];
                return newInputs;
            });
            setAssigningId(null);
        },
        onError: () => {
            setAssigningId(null);
        },
    });

    const handleUsnChange = (studentId: number, value: string) => {
        setUsnInputs(prev => ({
            ...prev,
            [studentId]: value.toUpperCase(),
        }));
    };

    const handleAssignUsn = (studentId: number) => {
        const usn = usnInputs[studentId]?.trim();
        if (!usn) return;
        setAssigningId(studentId);
        assignUsnMutation.mutate({ studentProfileId: studentId, usn });
    };

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">Permanent USN Assignment</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Assign permanent USNs to students with temporary USNs
                    </p>
                </div>
                <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                    {students?.length || 0} students pending
                </div>
            </div>

            {!students || students.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
                    <p className="text-slate-600 font-medium">All students have permanent USNs</p>
                    <p className="text-sm text-slate-500 mt-1">No pending USN assignments</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {students.map((student) => (
                        <div
                            key={student.id}
                            className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-amber-300 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                {/* Student Info */}
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-6 h-6 text-amber-600" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-800 truncate">{student.name}</h4>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded inline-flex items-center gap-1">
                                            <Hash className="w-3 h-3" />
                                            {student.temporaryUsn || 'No Temp USN'}
                                        </span>
                                        {student.department && (
                                            <span className="text-xs text-slate-500">
                                                {student.department.code} • {student.batch?.name || 'N/A'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* USN Input */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="text"
                                        value={usnInputs[student.id] || ''}
                                        onChange={(e) => handleUsnChange(student.id, e.target.value)}
                                        placeholder="Enter permanent USN"
                                        className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                                        disabled={assigningId === student.id}
                                    />
                                    <button
                                        onClick={() => handleAssignUsn(student.id)}
                                        disabled={!usnInputs[student.id]?.trim() || assigningId === student.id}
                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2 min-w-[100px] justify-center"
                                    >
                                        {assigningId === student.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4" />
                                                Assign
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {assignUsnMutation.isError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                        Failed to assign USN. Please check if the USN is already in use or try again.
                    </span>
                </div>
            )}
        </Card>
    );
}
