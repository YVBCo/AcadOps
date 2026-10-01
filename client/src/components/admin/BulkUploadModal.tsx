'use client';

import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    X,
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ArrowRight,
    ArrowLeft,
    Users,
    XCircle,
} from 'lucide-react';
import { admissionsApi } from '@/lib/api';

interface ParsedRow {
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
    isValid: boolean;
}

interface ParseResult {
    rows: ParsedRow[];
    summary: { total: number; valid: number; invalid: number };
}

interface BulkUploadResult {
    created: number;
    skipped: number;
    errors: { row: number; name: string; error: string }[];
}

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'upload' | 'preview' | 'confirm' | 'result';

export function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<Step>('upload');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Parse mutation
    const parseMutation = useMutation({
        mutationFn: (file: File) => admissionsApi.bulkUploadParse(file),
        onSuccess: (data: ParseResult) => {
            setParseResult(data);
            setError(null);
            setStep('preview');
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error || err?.message || 'Failed to parse file';
            setError(msg);
        },
    });

    // Confirm mutation
    const confirmMutation = useMutation({
        mutationFn: (rows: ParsedRow[]) => admissionsApi.bulkUploadConfirm(rows),
        onSuccess: (data: BulkUploadResult) => {
            setUploadResult(data);
            setStep('result');
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-students'] });
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error || err?.message || 'Failed to create students';
            setError(msg);
        },
    });

    const handleDownloadTemplate = useCallback(async () => {
        try {
            const blob = await admissionsApi.downloadTemplate();
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'student_admission_template.xlsx';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError('Failed to download template');
        }
    }, []);

    const handleFileSelect = useCallback((file: File) => {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        ];
        if (!validTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
            setError('Only Excel files (.xlsx, .xls) are allowed. Please download and use the template.');
            return;
        }
        setSelectedFile(file);
        setError(null);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleUpload = () => {
        if (!selectedFile) return;
        parseMutation.mutate(selectedFile);
    };

    const handleConfirm = () => {
        if (!parseResult) return;
        const validRows = parseResult.rows.filter(r => r.isValid);
        if (validRows.length === 0) {
            setError('No valid rows to upload');
            return;
        }
        setStep('confirm');
        confirmMutation.mutate(validRows);
    };

    const handleReset = () => {
        setStep('upload');
        setSelectedFile(null);
        setParseResult(null);
        setUploadResult(null);
        setError(null);
        parseMutation.reset();
        confirmMutation.reset();
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-sky-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/30">
                            <FileSpreadsheet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Bulk Upload Students</h2>
                            <p className="text-xs text-slate-500">
                                {step === 'upload' && 'Upload your Excel file'}
                                {step === 'preview' && 'Review parsed data'}
                                {step === 'confirm' && 'Creating students...'}
                                {step === 'result' && 'Upload complete'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center px-6 py-3 bg-slate-50/50 border-b border-slate-100">
                    {(['upload', 'preview', 'confirm', 'result'] as Step[]).map((s, idx) => (
                        <div key={s} className="flex items-center">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                step === s
                                    ? 'bg-sky-100 text-sky-700'
                                    : (['upload', 'preview', 'confirm', 'result'].indexOf(step) > idx
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-400')
                            }`}>
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/60">
                                    {['upload', 'preview', 'confirm', 'result'].indexOf(step) > idx ? '✓' : idx + 1}
                                </span>
                                {s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : s === 'confirm' ? 'Creating' : 'Done'}
                            </div>
                            {idx < 3 && <ArrowRight className="w-4 h-4 text-slate-300 mx-1" />}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Error banner */}
                    {error && (
                        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-red-800">Error</p>
                                <p className="text-sm text-red-600 mt-0.5">{error}</p>
                            </div>
                            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    )}

                    {/* ─── Step 1: Upload ─────────────────────────────── */}
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {/* Download template card */}
                            <div className="p-5 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                                        <Download className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-slate-800">Step 1: Download Template</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Download the Excel template, fill in the student data, and upload it back.
                                            <strong className="text-slate-700"> Only files using this exact template will be accepted.</strong>
                                        </p>
                                        <button
                                            onClick={handleDownloadTemplate}
                                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Template (.xlsx)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Upload area */}
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-3">Step 2: Upload Filled Template</h3>
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative cursor-pointer p-10 rounded-xl border-2 border-dashed transition-all duration-200 text-center ${
                                        isDragging
                                            ? 'border-sky-400 bg-sky-50 scale-[1.01]'
                                            : selectedFile
                                                ? 'border-emerald-300 bg-emerald-50/50'
                                                : 'border-slate-300 bg-slate-50/50 hover:border-sky-300 hover:bg-sky-50/30'
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleFileSelect(f);
                                        }}
                                        className="hidden"
                                    />
                                    {selectedFile ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{selectedFile.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {(selectedFile.size / 1024).toFixed(1)} KB — Click or drag to replace
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <Upload className="w-7 h-7 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-600">
                                                    Drag and drop your Excel file here
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    or click to browse — Only .xlsx/.xls files accepted
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Step 2: Preview ────────────────────────────── */}
                    {step === 'preview' && parseResult && (
                        <div className="space-y-4">
                            {/* Summary cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                                    <p className="text-2xl font-bold text-slate-800">{parseResult.summary.total}</p>
                                    <p className="text-xs text-slate-500 mt-1">Total Rows</p>
                                </div>
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{parseResult.summary.valid}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Valid</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                                    <p className="text-2xl font-bold text-red-700">{parseResult.summary.invalid}</p>
                                    <p className="text-xs text-red-600 mt-1">With Errors</p>
                                </div>
                            </div>

                            {/* Data table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Row</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Branch</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Year</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Issues</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {parseResult.rows.map((row) => (
                                                <tr key={row.rowNumber} className={row.isValid ? 'bg-white' : 'bg-red-50/50'}>
                                                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{row.rowNumber}</td>
                                                    <td className="px-3 py-2">
                                                        {row.isValid ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                                                        {row.data['Applicant Name'] || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                                        {row.data['Email'] || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                                                        {row.data['Branch'] || '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                        {row.data['Admission Year'] || '—'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {row.errors.length > 0 && (
                                                            <span className="text-xs text-red-600">{row.errors.join('; ')}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {parseResult.summary.invalid > 0 && (
                                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                                    <strong>{parseResult.summary.invalid}</strong> rows have errors and will be skipped.
                                    Only <strong>{parseResult.summary.valid}</strong> valid rows will be created.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Step 3: Creating ───────────────────────────── */}
                    {step === 'confirm' && !uploadResult && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center mb-6">
                                <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Creating Students...</h3>
                            <p className="text-sm text-slate-500">
                                Processing {parseResult?.summary.valid} student records. This may take a moment.
                            </p>
                            <div className="mt-6 w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                            </div>
                        </div>
                    )}

                    {/* ─── Step 4: Result ─────────────────────────────── */}
                    {step === 'result' && uploadResult && (
                        <div className="space-y-6">
                            {/* Success banner */}
                            <div className="flex flex-col items-center py-6">
                                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800">Upload Complete!</h3>
                                <p className="text-sm text-slate-500 mt-1">Students have been created as approved admissions</p>
                            </div>

                            {/* Result stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                                    <Users className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-emerald-700">{uploadResult.created}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Created</p>
                                </div>
                                <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                                    <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-amber-700">{uploadResult.skipped}</p>
                                    <p className="text-xs text-amber-600 mt-1">Skipped</p>
                                </div>
                                <div className="p-5 rounded-xl bg-red-50 border border-red-200 text-center">
                                    <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                                    <p className="text-3xl font-bold text-red-700">{uploadResult.errors.length}</p>
                                    <p className="text-xs text-red-600 mt-1">Errors</p>
                                </div>
                            </div>

                            {/* Error details */}
                            {uploadResult.errors.length > 0 && (
                                <div className="border border-red-200 rounded-xl overflow-hidden">
                                    <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                                        <h4 className="text-sm font-semibold text-red-800">Error Details</h4>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                                        {uploadResult.errors.map((err, i) => (
                                            <div key={i} className="px-4 py-2 text-sm">
                                                <span className="font-medium text-slate-700">Row {err.row}</span>
                                                <span className="text-slate-400 mx-1">·</span>
                                                <span className="text-slate-600">{err.name}</span>
                                                <span className="text-slate-400 mx-1">—</span>
                                                <span className="text-red-600">{err.error}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    <div>
                        {step === 'preview' && (
                            <button
                                onClick={() => { setStep('upload'); setParseResult(null); setError(null); }}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {step === 'result' ? (
                            <button
                                onClick={handleClose}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
                            >
                                Close
                            </button>
                        ) : step === 'upload' ? (
                            <button
                                onClick={handleUpload}
                                disabled={!selectedFile || parseMutation.isPending}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/25"
                            >
                                {parseMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                {parseMutation.isPending ? 'Parsing...' : 'Upload & Parse'}
                            </button>
                        ) : step === 'preview' ? (
                            <button
                                onClick={handleConfirm}
                                disabled={!parseResult || parseResult.summary.valid === 0}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Create {parseResult?.summary.valid} Students
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
