'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, CheckCircle, ChevronRight, AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import { semesterMarksApi } from '@/lib/api';
import { batchApi, departmentApi, courseApi } from '@/lib/api';

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
}

interface Department {
    id: number;
    name: string;
    code: string;
}

interface Course {
    id: number;
    name: string;
    code: string;
    semesterNumber: number;
}

export function SemesterMarksUpload() {
    const [step, setStep] = useState<'batch' | 'department' | 'course' | 'upload'>('batch');
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

    // Fetch batches
    const { data: batches, isLoading: batchLoading } = useQuery<Batch[]>({
        queryKey: ['batches'],
        queryFn: () => batchApi.getAll(),
    });

    // Fetch departments
    const { data: departments, isLoading: deptLoading } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => departmentApi.getAll(),
        enabled: step === 'department',
    });

    // Fetch courses for selected department
    const { data: allCourses, isLoading: courseLoading } = useQuery<Course[]>({
        queryKey: ['courses', selectedDepartment?.id],
        queryFn: () => courseApi.getAll({ departmentId: selectedDepartment!.id }),
        enabled: !!selectedDepartment && step === 'course',
    });

    const handleBatchSelect = (batch: Batch) => {
        setSelectedBatch(batch);
        setStep('department');
    };

    const handleDepartmentSelect = (dept: Department) => {
        setSelectedDepartment(dept);
        setStep('course');
    };

    const handleCourseSelect = (course: Course) => {
        setSelectedCourse(course);
        setStep('upload');
    };

    const handleBack = () => {
        if (step === 'department') {
            setSelectedBatch(null);
            setStep('batch');
        } else if (step === 'course') {
            setSelectedDepartment(null);
            setStep('department');
        } else if (step === 'upload') {
            setSelectedCourse(null);
            setStep('course');
        }
    };

    const handleReset = () => {
        setStep('batch');
        setSelectedBatch(null);
        setSelectedDepartment(null);
        setSelectedCourse(null);
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
                <button
                    onClick={handleReset}
                    className={`${step === 'batch' ? 'text-amber-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Select Batch
                </button>
                {selectedBatch && (
                    <>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <button
                            onClick={() => {
                                setStep('department');
                                setSelectedDepartment(null);
                                setSelectedCourse(null);
                            }}
                            className={`${step === 'department' ? 'text-amber-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {selectedDepartment ? selectedDepartment.code : 'Select Department'}
                        </button>
                    </>
                )}
                {selectedDepartment && (
                    <>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <button
                            onClick={() => {
                                setStep('course');
                                setSelectedCourse(null);
                            }}
                            className={`${step === 'course' ? 'text-amber-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {selectedCourse ? selectedCourse.code : 'Select Course'}
                        </button>
                    </>
                )}
                {selectedCourse && (
                    <>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <span className="text-amber-600 font-medium">Upload Marks</span>
                    </>
                )}
            </div>

            {/* Step 1: Select Batch */}
            {step === 'batch' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Select Batch</h3>
                    {batchLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading batches...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {batches?.map(batch => (
                                <button
                                    key={batch.id}
                                    onClick={() => handleBatchSelect(batch)}
                                    className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800 group-hover:text-amber-600">
                                                Batch {batch.name}
                                            </h4>
                                            <p className="text-sm text-slate-500 mt-1">
                                                Current Semester: {batch.currentSemester}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Step 2: Select Department */}
            {step === 'department' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                        Select Department for Batch {selectedBatch?.name}
                    </h3>
                    {deptLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading departments...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {departments?.map(dept => (
                                <button
                                    key={dept.id}
                                    onClick={() => handleDepartmentSelect(dept)}
                                    className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800 group-hover:text-amber-600">
                                                {dept.code}
                                            </h4>
                                            <p className="text-sm text-slate-500 mt-1">{dept.name}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Step 3: Select Course */}
            {step === 'course' && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                        Select Course for {selectedDepartment?.code}
                    </h3>
                    {courseLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading courses...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allCourses?.map(course => (
                                <button
                                    key={course.id}
                                    onClick={() => handleCourseSelect(course)}
                                    className="p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-amber-500 hover:bg-amber-50 transition-all text-left group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800 group-hover:text-amber-600">
                                                {course.code}
                                            </h4>
                                            <p className="text-sm text-slate-500 mt-1">{course.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Semester {course.semesterNumber}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* Step 4: Upload Excel File */}
            {step === 'upload' && selectedBatch && selectedDepartment && selectedCourse && (
                <UploadFileStep
                    context={{
                        batchId: selectedBatch.id,
                        batchName: selectedBatch.name,
                        departmentId: selectedDepartment.id,
                        departmentCode: selectedDepartment.code,
                        semesterNumber: selectedBatch.currentSemester,
                        courseId: selectedCourse.id,
                        courseCode: selectedCourse.code,
                        courseName: selectedCourse.name,
                    }}
                    onBack={handleBack}
                    onSuccess={handleReset}
                />
            )}
        </div>
    );
}

// Upload File Step Component
interface UploadContext {
    batchId: number;
    batchName: string;
    departmentId: number;
    departmentCode: string;
    semesterNumber: number;
    courseId: number;
    courseCode: string;
    courseName: string;
}

function UploadFileStep({ context, onBack, onSuccess }: { context: UploadContext; onBack: () => void; onSuccess: () => void }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadResult, setUploadResult] = useState<any>(null);

    const uploadMutation = useMutation({
        mutationFn: (file: File) => semesterMarksApi.uploadMarks(file, {
            batchId: context.batchId,
            departmentId: context.departmentId,
            semesterNumber: context.semesterNumber,
            courseId: context.courseId,
        }),
        onSuccess: (data) => {
            setUploadResult(data);
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setUploadResult(null);
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            uploadMutation.mutate(selectedFile);
        }
    };

    const handleNewUpload = () => {
        setSelectedFile(null);
        setUploadResult(null);
        onSuccess();
    };

    // Show success state
    if (uploadResult && uploadResult.validCount > 0) {
        return (
            <Card className="p-6">
                <div className="text-center py-8">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Upload Successful!</h3>
                    <p className="text-slate-600 mb-6">
                        Your marks have been uploaded and are pending COE review.
                    </p>

                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
                        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                            <div className="text-3xl font-bold text-green-700">
                                {uploadResult.validCount}
                            </div>
                            <div className="text-sm text-green-600 mt-1">Valid Entries</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                            <div className="text-3xl font-bold text-amber-700">
                                {uploadResult.invalidCount}
                            </div>
                            <div className="text-sm text-amber-600 mt-1">Invalid Entries</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <div className="text-3xl font-bold text-slate-700">
                                {uploadResult.validCount + uploadResult.invalidCount}
                            </div>
                            <div className="text-sm text-slate-600 mt-1">Total Entries</div>
                        </div>
                    </div>

                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-2xl mx-auto">
                            <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Validation Errors ({uploadResult.errors.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto text-left">
                                {uploadResult.errors.slice(0, 10).map((err: any, idx: number) => (
                                    <div key={idx} className="text-sm bg-white rounded px-3 py-2">
                                        <span className="font-mono text-amber-700">{err.usn}</span>
                                        <span className="text-slate-600"> - {err.error}</span>
                                    </div>
                                ))}
                                {uploadResult.errors.length > 10 && (
                                    <div className="text-sm text-amber-600 text-center pt-2">
                                        ... and {uploadResult.errors.length - 10} more errors
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Button onClick={handleNewUpload} className="bg-amber-600 hover:bg-amber-700">
                        Upload Another File
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Upload Marks</h3>

            {/* Context Summary */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <h4 className="font-medium text-slate-700 mb-3">Selected Context:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="text-slate-500">Batch:</span>
                        <span className="ml-2 font-medium text-slate-800">{context.batchName}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">Department:</span>
                        <span className="ml-2 font-medium text-slate-800">{context.departmentCode}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">Semester:</span>
                        <span className="ml-2 font-medium text-slate-800">{context.semesterNumber}</span>
                    </div>
                    <div>
                        <span className="text-slate-500">Course:</span>
                        <span className="ml-2 font-medium text-slate-800">{context.courseCode} - {context.courseName}</span>
                    </div>
                </div>
            </div>

            {/* File Upload */}
            {!selectedFile ? (
                <div className="border-2 border-dashed border-amber-300 rounded-xl p-12 text-center bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                    <FileSpreadsheet className="w-16 h-16 text-amber-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-slate-800 mb-2">Upload Excel File</h4>
                    <p className="text-sm text-slate-500 mb-4">
                        Drag and drop your Excel file here, or click to browse
                    </p>
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        id="file-upload"
                        onChange={handleFileChange}
                    />
                    <label
                        htmlFor="file-upload"
                        className="inline-block px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer font-medium transition-colors"
                    >
                        Choose File
                    </label>
                    <p className="text-xs text-slate-400 mt-4">
                        Accepted formats: .xlsx, .xls • Max size: 5MB
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Selected File */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="w-8 h-8 text-amber-600" />
                            <div>
                                <h5 className="font-medium text-slate-800">{selectedFile.name}</h5>
                                <p className="text-sm text-slate-500">
                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedFile(null)}
                            className="text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Upload Button */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleUpload}
                            disabled={uploadMutation.isPending}
                            className="flex-1 bg-amber-600 hover:bg-amber-700"
                        >
                            {uploadMutation.isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Marks
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={onBack}
                            variant="outline"
                            disabled={uploadMutation.isPending}
                        >
                            Back
                        </Button>
                    </div>

                    {/* Error Display */}
                    {uploadMutation.isError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                <div>
                                    <h5 className="font-semibold text-red-800 mb-1">Upload Failed</h5>
                                    <p className="text-sm text-red-700">
                                        {(uploadMutation.error as any)?.response?.data?.error || 'Failed to upload marks. Please try again.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
