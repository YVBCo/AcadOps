'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    RefreshCw,
    Search,
    Save,
    AlertCircle,
    Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { clerkMarksApi } from '@/lib/api';

interface Result {
    id: number;
    studentUsn: string;
    internalMarks: number;
    semesterMarks: number;
    totalMarks: number;
    status: string;
    department: { name: string; code: string };
    batch: { name: string };
    course: { name: string; code: string };
    revaluations: Array<{ id: number; oldMarks: number; newMarks: number; status: string }>;
}

export default function RevaluationsPage() {
    const queryClient = useQueryClient();
    const [searchUsn, setSearchUsn] = useState('');
    const [selectedResult, setSelectedResult] = useState<Result | null>(null);
    const [newMarks, setNewMarks] = useState<number | ''>('');

    // Search results query
    const { data: results = [], isLoading, refetch } = useQuery({
        queryKey: ['clerk-results', searchUsn],
        queryFn: () => clerkMarksApi.getResults({ studentUsn: searchUsn }),
        enabled: false,
    });

    // Submit revaluation mutation
    const submitMutation = useMutation({
        mutationFn: clerkMarksApi.submitRevaluation,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clerk-results'] });
            queryClient.invalidateQueries({ queryKey: ['clerk-stats'] });
            setSelectedResult(null);
            setNewMarks('');
            toast.success('Revaluation submitted for COE approval');
            refetch();
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to submit revaluation');
        },
    });

    const handleSearch = () => {
        if (!searchUsn.trim()) {
            toast.error('Please enter a USN to search');
            return;
        }
        refetch();
    };

    const handleSubmit = () => {
        if (!selectedResult || newMarks === '') {
            toast.error('Please select a result and enter new marks');
            return;
        }

        submitMutation.mutate({
            resultId: selectedResult.id,
            newMarks: newMarks as number,
        });
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'warning' | 'success' | 'error' | 'neutral'> = {
            PENDING: 'warning',
            APPROVED: 'success',
            PASS: 'success',
            FAIL: 'error',
            MAKEUP_ELIGIBLE: 'warning',
            LOCKED: 'neutral',
        };
        return <Badge variant={variants[status] || 'neutral'}>{status}</Badge>;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Revaluation Entry</h1>
                <p className="text-neutral-500 mt-1">Submit revaluation marks for published results</p>
            </div>

            {/* Search */}
            <Card className="p-6">
                <h3 className="font-semibold text-neutral-900 mb-4">Search Published Results</h3>
                <div className="flex gap-4">
                    <div className="flex-1 max-w-md">
                        <Input
                            placeholder="Enter Student USN (e.g., 1RV22CS001)"
                            value={searchUsn}
                            onChange={(e) => setSearchUsn(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button onClick={handleSearch} leftIcon={Search} isLoading={isLoading}>
                        Search
                    </Button>
                </div>
            </Card>

            {/* Results */}
            {results.length > 0 && (
                <Card className="overflow-hidden">
                    <div className="p-4 border-b border-neutral-200 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold text-neutral-900">Published Results for {searchUsn}</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-neutral-50">
                                <tr>
                                    <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600">Course</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Internal</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Semester</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Total</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Status</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Revaluations</th>
                                    <th className="text-center px-6 py-3 text-sm font-medium text-neutral-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {results.map((result: Result) => (
                                    <tr key={result.id} className="hover:bg-neutral-50">
                                        <td className="px-6 py-3">
                                            <div>
                                                <p className="font-medium">{result.course.code}</p>
                                                <p className="text-sm text-neutral-500">{result.course.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">{result.internalMarks}/50</td>
                                        <td className="px-6 py-3 text-center">{result.semesterMarks}/50</td>
                                        <td className="px-6 py-3 text-center font-semibold">{result.totalMarks}/100</td>
                                        <td className="px-6 py-3 text-center">{getStatusBadge(result.status)}</td>
                                        <td className="px-6 py-3 text-center">
                                            {result.revaluations.length > 0 ? (
                                                <Badge variant="neutral">{result.revaluations.length} pending</Badge>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedResult(result);
                                                    setNewMarks('');
                                                }}
                                            >
                                                Request Reval
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {searchUsn && results.length === 0 && !isLoading && (
                <Card className="text-center py-12">
                    <AlertCircle className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900">No published results found</h3>
                    <p className="text-neutral-500 mt-1">
                        No published results found for USN: {searchUsn}
                    </p>
                </Card>
            )}

            {/* Revaluation Form Modal */}
            {selectedResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedResult(null)} />
                    <Card className="relative w-full max-w-md animate-scale-in">
                        <div className="p-6 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Submit Revaluation</h2>
                            <p className="text-sm text-neutral-500 mt-1">{selectedResult.course.code} - {selectedResult.course.name}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-neutral-50">
                                <div>
                                    <p className="text-sm text-neutral-500">Original Semester Marks</p>
                                    <p className="text-xl font-bold text-neutral-900">{selectedResult.semesterMarks}/50</p>
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-500">Total Marks</p>
                                    <p className="text-xl font-bold text-neutral-900">{selectedResult.totalMarks}/100</p>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                                <strong>Note:</strong> Original marks will be preserved. This creates a new revaluation entry.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">New Semester Marks (0-50)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={newMarks}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!e.target.value) setNewMarks('');
                                        else if (val >= 0 && val <= 50) setNewMarks(val);
                                    }}
                                    placeholder="Enter new marks"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setSelectedResult(null)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    isLoading={submitMutation.isPending}
                                    leftIcon={Save}
                                    className="flex-1"
                                    disabled={newMarks === ''}
                                >
                                    Submit Revaluation
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Info Box */}
            <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                        <h4 className="font-medium text-purple-900">Revaluation Guidelines</h4>
                        <ul className="text-sm text-purple-700 mt-1 list-disc list-inside space-y-1">
                            <li>Only published results can be revaluated</li>
                            <li>Original marks are preserved; revaluation creates a new entry</li>
                            <li>COE must approve revaluations before they affect results</li>
                            <li>Multiple revaluations can be submitted for the same result</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
