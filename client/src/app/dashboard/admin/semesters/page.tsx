'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { batchApi, courseApi } from '@/lib/api';
import { Calendar, Users, GraduationCap, ArrowRight, BookOpen, ChevronRight, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Batch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
    isGraduated?: boolean;
    graduatedAt?: string;
    _count?: {
        students: number;
    };
}

export default function SemestersPage() {
    const queryClient = useQueryClient();
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [progressResult, setProgressResult] = useState<any>(null);

    const { data: batches = [], isLoading } = useQuery({
        queryKey: ['batches'],
        queryFn: () => batchApi.getAll(),
    });

    // Fetch tenant-aware max semesters
    const { data: semesterConfig } = useQuery({
        queryKey: ['maxSemesters'],
        queryFn: () => courseApi.getMaxSemesters(),
    });
    const maxSemesters = semesterConfig?.maxSemesters || 8;

    const progressMutation = useMutation({
        mutationFn: (batchId: number) => batchApi.progressSemester(batchId),
        onSuccess: (data) => {
            setProgressResult(data);
            queryClient.invalidateQueries({ queryKey: ['batches'] });
        },
    });

    // Dynamic semester slots based on tenant type
    const semesterSlots = Array.from({ length: maxSemesters }, (_, i) => i + 1);

    const handleEndSemester = (batch: Batch) => {
        setSelectedBatch(batch);
        setShowConfirmModal(true);
        setProgressResult(null);
    };

    const confirmEndSemester = () => {
        if (selectedBatch) {
            progressMutation.mutate(selectedBatch.id);
        }
    };

    const getProgressionInfo = (semester: number) => {
        if (semester === 1) {
            return {
                title: 'PHY ↔ CHEM Cycle Swap',
                description: 'Students in Physics will move to Chemistry and vice versa.',
                icon: '🔄',
            };
        } else if (semester === 2) {
            return {
                title: 'Move to Opted Departments',
                description: 'Students will move from cycle departments (PHY/CHEM) to their opted departments (CS, EC, etc.).',
                icon: '🎓',
            };
        } else if (semester === maxSemesters) {
            return {
                title: 'Graduation 🎓',
                description: 'This batch will graduate! All students will be marked as graduated and their data preserved.',
                icon: '🎓',
            };
        } else {
            return {
                title: 'Normal Progression',
                description: 'Students will advance to the next semester in their current department.',
                icon: '📚',
            };
        }
    };

    // Separate active and graduated batches
    const activeBatches = batches.filter((b: Batch) => !b.isGraduated);
    const graduatedBatches = batches.filter((b: Batch) => b.isGraduated);

    return (
        <div className="space-y-8 animate-fade-in p-2 md:p-4">
            {/* Header Section */}
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                    Academic Progression
                </h1>
                <p className="text-neutral-500 mt-1">
                    Visualizing the journey of every batch from Semester 1 through Graduation.
                </p>
            </div>

            {/* Semester Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {semesterSlots.map((semNum) => {
                    // Find if any active (non-graduated) batch is currently in this semester
                    const currentBatch = activeBatches.find((b: Batch) => b.currentSemester === semNum);

                    return (
                        <SemesterCard
                            key={semNum}
                            semesterNumber={semNum}
                            batch={currentBatch}
                            onEndSemester={handleEndSemester}
                            maxSemesters={maxSemesters}
                        />
                    );
                })}
            </div>

            {/* Graduated Batches Section */}
            {graduatedBatches.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                        <GraduationCap className="w-6 h-6 text-green-600" />
                        Graduated Batches
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {graduatedBatches.map((batch: Batch) => (
                            <div
                                key={batch.id}
                                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant="success">Graduated</Badge>
                                    <span className="text-2xl">🎓</span>
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900">Batch {batch.name}</h3>
                                <p className="text-sm text-neutral-500">Started {batch.startYear}</p>
                                <div className="flex items-center gap-2 mt-2 text-sm text-neutral-600">
                                    <Users className="w-4 h-4" />
                                    <span>{batch._count?.students || 0} students</span>
                                </div>
                                {batch.graduatedAt && (
                                    <p className="text-xs text-green-600 mt-2">
                                        Graduated: {new Date(batch.graduatedAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && selectedBatch && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        {!progressResult ? (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-neutral-900">End Semester {selectedBatch.currentSemester}</h2>
                                        <p className="text-sm text-neutral-500">Batch {selectedBatch.name}</p>
                                    </div>
                                </div>

                                <div className="bg-neutral-50 rounded-xl p-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">{getProgressionInfo(selectedBatch.currentSemester).icon}</span>
                                        <h3 className="font-semibold text-neutral-900">
                                            {getProgressionInfo(selectedBatch.currentSemester).title}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-neutral-600">
                                        {getProgressionInfo(selectedBatch.currentSemester).description}
                                    </p>
                                </div>

                                <p className="text-sm text-neutral-600 mb-6">
                                    {selectedBatch.currentSemester === maxSemesters ? (
                                        <>This action will <strong>graduate</strong> all <strong>{selectedBatch._count?.students || 0} students</strong>. Their data will be preserved. This action cannot be undone.</>
                                    ) : (
                                        <>This action will progress all <strong>{selectedBatch._count?.students || 0} students</strong> to Semester {selectedBatch.currentSemester + 1}. This action cannot be undone.</>
                                    )}
                                </p>

                                <div className="flex flex-col gap-3">
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                        onClick={confirmEndSemester}
                                        disabled={progressMutation.isPending}
                                    >
                                        {progressMutation.isPending ? 'Processing...' : (selectedBatch.currentSemester === maxSemesters ? 'Graduate Batch 🎓' : 'Confirm End Semester')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full border-gray-300"
                                        onClick={() => setShowConfirmModal(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center py-6">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${progressResult.isGraduation ? 'bg-green-100' : 'bg-blue-100'}`}>
                                        <GraduationCap className={`w-8 h-8 ${progressResult.isGraduation ? 'text-green-600' : 'text-blue-600'}`} />
                                    </div>
                                    <h2 className="text-xl font-bold text-neutral-900 mb-2">
                                        {progressResult.isGraduation ? 'Batch Graduated! 🎓' : 'Semester Completed!'}
                                    </h2>
                                    <p className="text-neutral-600 mb-4">
                                        {progressResult.isGraduation
                                            ? `Congratulations! ${progressResult.studentsProgressed} students have graduated. The batch has been marked as graduated and moved to the alumni section.`
                                            : progressResult.message
                                        }
                                    </p>

                                    {progressResult.swapInfo && (
                                        <div className="bg-blue-50 rounded-xl p-4 mb-4 text-left">
                                            <h3 className="font-semibold text-blue-900 mb-2">Cycle Swap Results:</h3>
                                            <ul className="text-sm text-blue-700 space-y-1">
                                                <li>PHY → CHEM: {progressResult.swapInfo.phyToChem} students</li>
                                                <li>CHEM → PHY: {progressResult.swapInfo.chemToPhy} students</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                    onClick={() => setShowConfirmModal(false)}
                                >
                                    Close
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SemesterCard({ semesterNumber, batch, onEndSemester, maxSemesters }: {
    semesterNumber: number;
    batch?: Batch;
    onEndSemester?: (batch: Batch) => void;
    maxSemesters: number;
}) {
    const isActive = !!batch;

    // Premium Active Card Style (Gradient Border + Glass)
    if (isActive) {
        return (
            <div className="group relative h-full">
                {/* Glowing Background Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-400 to-primary-600 rounded-2xl opacity-75 blur opacity-20 group-hover:opacity-40 transition duration-500"></div>

                <div className="relative h-full bg-white rounded-2xl p-6 shadow-xl border border-white/20 flex flex-col justify-between overflow-hidden">
                    {/* Decorative Circle */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-bl-full -mr-8 -mt-8"></div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center text-primary-600 font-bold text-xl shadow-inner border border-primary-100">
                                {semesterNumber}
                            </div>
                            <Badge variant="success" className="shadow-sm">Active</Badge>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-1">Current Batch</h3>

                            <div className="text-2xl font-bold text-neutral-900 font-display">
                                Batch {batch.name}
                            </div>
                            <div className="flex items-center gap-2 text-primary-600 text-sm mt-1 font-medium">
                                <Calendar className="w-4 h-4" />
                                <span>Started {batch.startYear}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-neutral-100">
                        <div className="flex items-center justify-between text-sm mb-4">
                            <div className="flex items-center gap-2 text-neutral-600">
                                <Users className="w-4 h-4" />
                                <span className="font-semibold">{batch._count?.students || 0}</span> Students
                            </div>
                            {/* Visual indicator of progress */}
                            <div className="flex gap-1">
                                {[...Array(maxSemesters)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full ${i < semesterNumber ? 'bg-primary-500' : 'bg-neutral-200'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* End Semester / Graduate Button */}
                        {onEndSemester && (
                            <Button
                                className={`w-full text-white group ${semesterNumber === maxSemesters
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                                    : 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800'
                                    }`}
                                onClick={() => onEndSemester(batch)}
                            >
                                {semesterNumber === maxSemesters ? 'Graduate Batch 🎓' : 'End Semester'}
                                <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Inactive / Empty Slot Styling
    return (
        <div className="relative h-full group">
            <div className="relative h-full bg-white/40 backdrop-blur-sm rounded-2xl p-6 border-2 border-dashed border-neutral-200 flex flex-col justify-between transition-all duration-300 group-hover:bg-white/60 group-hover:border-neutral-300">
                <div className="flex justify-between items-start opacity-50">
                    <div className="h-12 w-12 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-400 font-bold text-xl">
                        {semesterNumber}
                    </div>
                </div>

                <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-50 mb-3 text-neutral-300">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <p className="text-neutral-400 font-medium">Vacant Semester</p>
                    <p className="text-xs text-neutral-300 mt-1">No batch in progress</p>
                </div>

                <div className="mt-4 pt-4 border-t border-transparent">
                    <div className="h-5"></div>
                </div>
            </div>
        </div>
    );
}


