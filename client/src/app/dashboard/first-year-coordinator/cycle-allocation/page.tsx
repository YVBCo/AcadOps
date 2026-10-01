'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Users,
    Layers3,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Loader2,
    FlaskConical,
    AtomIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
    _count: {
        students: number;
    };
}

interface Department {
    id: number;
    name: string;
    code: string;
    isCycleDepartment: boolean;
}

interface Allocation {
    id: number;
    batchId: number;
    optedDepartment: Department;
    semester1Cycle: Department;
    allocatedByUser: { id: number; name: string };
    allocatedAt: string;
    isLocked: boolean;
    studentCounts?: {
        semester1: number;
        semester2: number;
        total: number;
    };
}

export default function CycleAllocationPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [cycleDepartments, setCycleDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [allocating, setAllocating] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedBatch) {
            fetchAllocations(selectedBatch);
        }
    }, [selectedBatch]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [batchesRes, deptsRes, cycleDeptsRes] = await Promise.all([
                api.get<{ data: Batch[] }>('/first-year-coordinator/batches'),
                api.get<{ data: Department[] }>('/first-year-coordinator/departments'),
                api.get<{ data: Department[] }>('/first-year-coordinator/cycle-departments'),
            ]);

            setBatches(batchesRes.data.data);
            setDepartments(deptsRes.data.data.filter((d) => !d.isCycleDepartment));
            setCycleDepartments(cycleDeptsRes.data.data);

            if (batchesRes.data.data.length > 0) {
                setSelectedBatch(batchesRes.data.data[0].id);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllocations = async (batchId: number) => {
        try {
            const response = await api.get<{ data: Allocation[] }>(
                `/first-year-coordinator/allocations/${batchId}`
            );
            setAllocations(response.data.data);
        } catch (err: any) {
            console.error('Failed to load allocations:', err);
        }
    };

    const handleAllocate = async (departmentId: number, cycleId: number) => {
        if (!selectedBatch) return;

        try {
            setAllocating(departmentId);
            setError(null);
            setSuccess(null);

            const response = await api.post('/first-year-coordinator/allocate-cycle', {
                batchId: selectedBatch,
                optedDepartmentId: departmentId,
                semester1CycleId: cycleId,
            });

            setSuccess(response.data.message);
            await fetchAllocations(selectedBatch);

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to allocate cycle');
        } finally {
            setAllocating(null);
        }
    };

    const getOppositeCycle = (cycleId: number) => {
        return cycleDepartments.find((c) => c.id !== cycleId);
    };

    const unallocatedDepartments = departments.filter(
        (dept) => !allocations.some((a) => a.optedDepartment.id === dept.id)
    );

    const selectedBatchData = batches.find((b) => b.id === selectedBatch);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Cycle Allocation</h1>
                <p className="text-slate-600 mt-1">
                    Assign departments to Physics or Chemistry cycles for semester 1. Students will automatically swap to
                    the opposite cycle in semester 2.
                </p>
            </div>

            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-green-700">{success}</span>
                </div>
            )}

            {/* Batch Selection */}
            <Card>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Batch</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {batches.map((batch) => (
                        <button
                            key={batch.id}
                            onClick={() => setSelectedBatch(batch.id)}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${selectedBatch === batch.id
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 hover:border-indigo-300'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-slate-800">Batch {batch.name}</h4>
                                <Badge variant="outline">Sem {batch.currentSemester}</Badge>
                            </div>
                            <p className="text-sm text-slate-600">{batch._count.students} first year students</p>
                        </button>
                    ))}
                </div>
            </Card>

            {selectedBatch && (
                <>
                    {/* Allocated Departments */}
                    {allocations.length > 0 && (
                        <Card>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                Allocated Departments ({allocations.length})
                            </h3>
                            <div className="space-y-3">
                                {allocations.map((allocation) => {
                                    const oppositeCycle = getOppositeCycle(allocation.semester1Cycle.id);
                                    return (
                                        <div
                                            key={allocation.id}
                                            className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                                        {allocation.optedDepartment.name}
                                                        <Badge variant="outline" className="ml-2">
                                                            {allocation.optedDepartment.code}
                                                        </Badge>
                                                    </h4>
                                                    {allocation.studentCounts && (
                                                        <p className="text-sm text-slate-600 mt-1">
                                                            {allocation.studentCounts.total} students total
                                                            <span className="mx-2">•</span>
                                                            Sem 1: {allocation.studentCounts.semester1}
                                                            <span className="mx-2">•</span>
                                                            Sem 2: {allocation.studentCounts.semester2}
                                                        </p>
                                                    )}
                                                </div>
                                                {allocation.isLocked && (
                                                    <Badge className="bg-green-600">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        Locked
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 border border-green-200">
                                                    <div className="p-2 bg-blue-100 rounded-lg">
                                                        {allocation.semester1Cycle.code === 'PHY' ? (
                                                            <AtomIcon className="h-5 w-5 text-blue-600" />
                                                        ) : (
                                                            <FlaskConical className="h-5 w-5 text-purple-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-600 font-medium">Semester 1</p>
                                                        <p className="font-semibold text-slate-800">{allocation.semester1Cycle.name}</p>
                                                    </div>
                                                </div>

                                                {oppositeCycle && (
                                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 border border-green-200">
                                                        <div className="p-2 bg-purple-100 rounded-lg">
                                                            {oppositeCycle.code === 'PHY' ? (
                                                                <AtomIcon className="h-5 w-5 text-blue-600" />
                                                            ) : (
                                                                <FlaskConical className="h-5 w-5 text-purple-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-slate-600 font-medium">Semester 2 (Auto-swap)</p>
                                                            <p className="font-semibold text-slate-800">{oppositeCycle.name}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-green-200">
                                                <p className="text-xs text-slate-600">
                                                    Allocated by <strong>{allocation.allocatedByUser.name}</strong> on{' '}
                                                    {new Date(allocation.allocatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Unallocated Departments */}
                    {unallocatedDepartments.length > 0 && (
                        <Card>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                Pending Allocation ({unallocatedDepartments.length})
                            </h3>
                            <div className="space-y-3">
                                {unallocatedDepartments.map((dept) => (
                                    <div
                                        key={dept.id}
                                        className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                                    {dept.name}
                                                    <Badge variant="outline">{dept.code}</Badge>
                                                </h4>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    Choose a cycle for semester 1. Students will automatically swap in semester 2.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {cycleDepartments.map((cycle) => {
                                                const opposite = getOppositeCycle(cycle.id);
                                                return (
                                                    <button
                                                        key={cycle.id}
                                                        onClick={() => handleAllocate(dept.id, cycle.id)}
                                                        disabled={allocating === dept.id}
                                                        className={`h-auto p-4 rounded-xl flex flex-col items-start gap-2 bg-white border-2 transition-all duration-200 ${cycle.code === 'PHY'
                                                                ? 'border-blue-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-200/50'
                                                                : 'border-purple-200 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-200/50'
                                                            } ${allocating === dept.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {allocating === dept.id ? (
                                                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                                        ) : (
                                                            <>
                                                                <div className="w-full flex items-center justify-between">
                                                                    <span className="font-semibold text-slate-800">Assign to {cycle.name}</span>
                                                                    {cycle.code === 'PHY' ? (
                                                                        <AtomIcon className="h-5 w-5 text-blue-600" />
                                                                    ) : (
                                                                        <FlaskConical className="h-5 w-5 text-purple-600" />
                                                                    )}
                                                                </div>
                                                                {opposite && (
                                                                    <div className="w-full flex items-center gap-2 text-xs text-slate-600">
                                                                        <ArrowRight className="h-3 w-3" />
                                                                        <span>Auto-swap to {opposite.name} in Sem 2</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {unallocatedDepartments.length === 0 && allocations.length === 0 && (
                        <Card>
                            <div className="text-center py-12">
                                <Layers3 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                <p className="text-slate-600 font-medium">No departments found for allocation</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    There are no departments with first year students in this batch.
                                </p>
                            </div>
                        </Card>
                    )}

                    {unallocatedDepartments.length === 0 && allocations.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-3" />
                            <h3 className="text-lg font-semibold text-green-800">All Departments Allocated!</h3>
                            <p className="text-green-700 mt-1">
                                All departments in this batch have been assigned to a cycle.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
