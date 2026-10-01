'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SemesterSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (semester: number) => void;
    batchYear: number;
}

export function SemesterSelectionDialog({
    isOpen,
    onClose,
    onConfirm,
    batchYear,
}: SemesterSelectionDialogProps) {
    const [selectedSemester, setSelectedSemester] = useState(1);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(selectedSemester);
        setSelectedSemester(1); // Reset for next time
    };

    const handleClose = () => {
        onClose();
        setSelectedSemester(1); // Reset
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                        New Batch Creation
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-sm text-amber-800">
                            <span className="font-semibold">Batch {batchYear}</span> will be created for the first time.
                        </p>
                        <p className="text-sm text-amber-700 mt-1">
                            Select which semester students in this batch should start in:
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Starting Semester
                        </label>
                        <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(parseInt(e.target.value))}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                <option key={sem} value={sem}>
                                    Semester {sem}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            All students approved for Batch {batchYear} will be assigned to this semester.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            className="flex-1 bg-teal-500 hover:bg-teal-600"
                        >
                            Confirm & Create Batch
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
