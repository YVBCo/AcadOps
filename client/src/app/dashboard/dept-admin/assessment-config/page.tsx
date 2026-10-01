'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Book, Calculator, FlaskConical, FileText, Save, Check, AlertCircle } from 'lucide-react';

import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

interface Course {
    id: number;
    name: string;
    code: string;
    semesterNumber?: number;
}

interface AssessmentConfig {
    id?: number;
    courseId: number;
    semesterNumber: number;
    numInternals: number;
    maxMarksPerInternal: number;
    internalsToConsider: number;
    internalWeightage: number;
    hasAssignment: boolean;
    numAssignments: number;
    maxAssignmentMarks: number;
    assignmentWeightage: number;
    hasLab: boolean;
    numLabExams: number;
    maxLabMarks: number;
    labWeightage: number;
    totalMarks: number;
}

const defaultConfig: Omit<AssessmentConfig, 'id' | 'courseId' | 'semesterNumber'> = {
    numInternals: 3,
    maxMarksPerInternal: 30,
    internalsToConsider: 2,
    internalWeightage: 30,
    hasAssignment: true,
    numAssignments: 1,
    maxAssignmentMarks: 20,
    assignmentWeightage: 20,
    hasLab: false,
    numLabExams: 0,
    maxLabMarks: 0,
    labWeightage: 0,
    totalMarks: 50,
};

export default function AssessmentConfigPage() {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [config, setConfig] = useState<Omit<AssessmentConfig, 'id' | 'courseId' | 'semesterNumber'>>(defaultConfig);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Fetch courses
    const { data: courses = [], isLoading: loadingCourses } = useQuery({
        queryKey: ['dept-admin-courses'],
        queryFn: async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/dept-admin/courses?all=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch courses');
            return res.json();
        }
    });

    // Fetch existing config when course is selected
    const { data: existingConfig, isLoading: loadingConfig } = useQuery({
        queryKey: ['ia-config', selectedCourse?.id, selectedCourse?.semesterNumber],
        queryFn: async () => {
            if (!selectedCourse) return null;
            const token = localStorage.getItem('token');
            const res = await fetch(
                `${API_BASE}/dept-admin/ia-config/${selectedCourse.id}?semesterNumber=${selectedCourse.semesterNumber || 1}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!selectedCourse,
    });

    // Save config mutation
    const saveMutation = useMutation({
        mutationFn: async (data: typeof config) => {
            if (!selectedCourse) throw new Error('No course selected');
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/dept-admin/ia-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    courseId: selectedCourse.id,
                    semesterNumber: selectedCourse.semesterNumber || 1,
                    ...data,
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to save config');
            }
            return res.json();
        },
        onSuccess: () => {
            setSaveStatus('saved');
            queryClient.invalidateQueries({ queryKey: ['ia-config'] });
            setTimeout(() => setSaveStatus('idle'), 2000);
        },
        onError: () => {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        },
    });

    // Load existing config when fetched
    const handleSelectCourse = (course: Course) => {
        setSelectedCourse(course);
        setSaveStatus('idle');
    };

    // Update config when existing config is loaded
    if (existingConfig && selectedCourse) {
        const newConfig = {
            numInternals: existingConfig.numInternals ?? defaultConfig.numInternals,
            maxMarksPerInternal: existingConfig.maxMarksPerInternal ?? defaultConfig.maxMarksPerInternal,
            internalsToConsider: existingConfig.internalsToConsider ?? defaultConfig.internalsToConsider,
            internalWeightage: existingConfig.internalWeightage ?? defaultConfig.internalWeightage,
            hasAssignment: existingConfig.hasAssignment ?? defaultConfig.hasAssignment,
            numAssignments: existingConfig.numAssignments ?? defaultConfig.numAssignments,
            maxAssignmentMarks: existingConfig.maxAssignmentMarks ?? defaultConfig.maxAssignmentMarks,
            assignmentWeightage: existingConfig.assignmentWeightage ?? defaultConfig.assignmentWeightage,
            hasLab: existingConfig.hasLab ?? defaultConfig.hasLab,
            numLabExams: existingConfig.numLabExams ?? defaultConfig.numLabExams,
            maxLabMarks: existingConfig.maxLabMarks ?? defaultConfig.maxLabMarks,
            labWeightage: existingConfig.labWeightage ?? defaultConfig.labWeightage,
            totalMarks: 50,
        };
        if (JSON.stringify(config) !== JSON.stringify(newConfig)) {
            setConfig(newConfig);
        }
    }

    // Calculate total weightage
    const totalWeightage = config.internalWeightage +
        (config.hasAssignment ? config.assignmentWeightage : 0) +
        (config.hasLab ? config.labWeightage : 0);

    const isValidConfig = totalWeightage === 50;

    const handleSave = () => {
        if (!isValidConfig) return;
        setSaveStatus('saving');
        saveMutation.mutate(config);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Assessment Configuration</h1>
                    <p className="text-neutral-500 mt-1">Configure internal assessment structure per course</p>
                </div>
            </div>

            {/* Course Selection */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Book className="w-5 h-5 text-blue-600" />
                    Select Course
                </h2>

                {loadingCourses ? (
                    <div className="text-neutral-500">Loading courses...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {courses.map((course: Course) => (
                            <button
                                key={course.id}
                                onClick={() => handleSelectCourse(course)}
                                className={`p-4 rounded-lg border text-left transition-all ${selectedCourse?.id === course.id
                                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                    : 'border-neutral-200 hover:border-blue-300 hover:bg-neutral-50'
                                    }`}
                            >
                                <div className="font-medium text-neutral-900">{course.code}</div>
                                <div className="text-sm text-neutral-500 truncate">{course.name}</div>
                                {course.semesterNumber && (
                                    <div className="text-xs text-blue-600 mt-1">Semester {course.semesterNumber}</div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Configuration Panel */}
            {selectedCourse && (
                <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-purple-600" />
                            Configuration for {selectedCourse.code}
                        </h2>

                        {/* Total Weightage Indicator */}
                        <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isValidConfig ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {isValidConfig ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            Total: {totalWeightage}/50
                        </div>
                    </div>

                    {loadingConfig ? (
                        <div className="text-neutral-500">Loading configuration...</div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Internal Exams Section */}
                            <div className="space-y-4 p-4 bg-blue-50 rounded-xl">
                                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                                    <Calculator className="w-4 h-4" />
                                    Internal Exams
                                </h3>

                                <div>
                                    <label className="block text-sm text-blue-700 mb-1">Number of Internals</label>
                                    <select
                                        value={config.numInternals}
                                        onChange={(e) => setConfig({ ...config, numInternals: parseInt(e.target.value) })}
                                        className="w-full p-2 border border-blue-200 rounded-lg bg-white"
                                    >
                                        <option value={1}>1 Internal</option>
                                        <option value={2}>2 Internals</option>
                                        <option value={3}>3 Internals</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-blue-700 mb-1">Max Marks per Internal</label>
                                    <input
                                        type="number"
                                        value={config.maxMarksPerInternal}
                                        onChange={(e) => setConfig({ ...config, maxMarksPerInternal: parseInt(e.target.value) || 0 })}
                                        className="w-full p-2 border border-blue-200 rounded-lg bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-blue-700 mb-1">Consider Best Of</label>
                                    <select
                                        value={config.internalsToConsider}
                                        onChange={(e) => setConfig({ ...config, internalsToConsider: parseInt(e.target.value) })}
                                        className="w-full p-2 border border-blue-200 rounded-lg bg-white"
                                    >
                                        {[...Array(config.numInternals)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>Best of {i + 1}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-blue-700 mb-1">Weightage (out of 50)</label>
                                    <input
                                        type="number"
                                        value={config.internalWeightage}
                                        onChange={(e) => setConfig({ ...config, internalWeightage: parseInt(e.target.value) || 0 })}
                                        max={50}
                                        min={0}
                                        className="w-full p-2 border border-blue-200 rounded-lg bg-white"
                                    />
                                </div>
                            </div>

                            {/* Assignment Section */}
                            <div className="space-y-4 p-4 bg-amber-50 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Assignments
                                    </h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.hasAssignment}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                hasAssignment: e.target.checked,
                                                assignmentWeightage: e.target.checked ? 20 : 0
                                            })}
                                            className="w-4 h-4 rounded border-amber-300 text-amber-600"
                                        />
                                        <span className="text-sm text-amber-700">Enable</span>
                                    </label>
                                </div>

                                {config.hasAssignment && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-amber-700 mb-1">Number of Assignments</label>
                                            <input
                                                type="number"
                                                value={config.numAssignments}
                                                onChange={(e) => setConfig({ ...config, numAssignments: parseInt(e.target.value) || 1 })}
                                                min={1}
                                                className="w-full p-2 border border-amber-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-amber-700 mb-1">Max Marks (total)</label>
                                            <input
                                                type="number"
                                                value={config.maxAssignmentMarks}
                                                onChange={(e) => setConfig({ ...config, maxAssignmentMarks: parseInt(e.target.value) || 0 })}
                                                className="w-full p-2 border border-amber-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-amber-700 mb-1">Weightage (out of 50)</label>
                                            <input
                                                type="number"
                                                value={config.assignmentWeightage}
                                                onChange={(e) => setConfig({ ...config, assignmentWeightage: parseInt(e.target.value) || 0 })}
                                                max={50}
                                                min={0}
                                                className="w-full p-2 border border-amber-200 rounded-lg bg-white"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Lab Section */}
                            <div className="space-y-4 p-4 bg-green-50 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-green-900 flex items-center gap-2">
                                        <FlaskConical className="w-4 h-4" />
                                        Lab Component
                                    </h3>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.hasLab}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                hasLab: e.target.checked,
                                                labWeightage: e.target.checked ? 10 : 0,
                                                numLabExams: e.target.checked ? 1 : 0,
                                                maxLabMarks: e.target.checked ? 50 : 0,
                                            })}
                                            className="w-4 h-4 rounded border-green-300 text-green-600"
                                        />
                                        <span className="text-sm text-green-700">Enable</span>
                                    </label>
                                </div>

                                {config.hasLab && (
                                    <>
                                        <div>
                                            <label className="block text-sm text-green-700 mb-1">Number of Lab Exams</label>
                                            <input
                                                type="number"
                                                value={config.numLabExams}
                                                onChange={(e) => setConfig({ ...config, numLabExams: parseInt(e.target.value) || 1 })}
                                                min={1}
                                                className="w-full p-2 border border-green-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-green-700 mb-1">Max Lab Marks (total)</label>
                                            <input
                                                type="number"
                                                value={config.maxLabMarks}
                                                onChange={(e) => setConfig({ ...config, maxLabMarks: parseInt(e.target.value) || 0 })}
                                                className="w-full p-2 border border-green-200 rounded-lg bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm text-green-700 mb-1">Weightage (out of 50)</label>
                                            <input
                                                type="number"
                                                value={config.labWeightage}
                                                onChange={(e) => setConfig({ ...config, labWeightage: parseInt(e.target.value) || 0 })}
                                                max={50}
                                                min={0}
                                                className="w-full p-2 border border-green-200 rounded-lg bg-white"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t border-neutral-200">
                        <button
                            onClick={handleSave}
                            disabled={!isValidConfig || saveStatus === 'saving'}
                            className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all ${isValidConfig
                                ? saveStatus === 'saved'
                                    ? 'bg-green-600 text-white'
                                    : saveStatus === 'error'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                                }`}
                        >
                            {saveStatus === 'saving' ? (
                                <>Saving...</>
                            ) : saveStatus === 'saved' ? (
                                <><Check className="w-4 h-4" /> Saved!</>
                            ) : saveStatus === 'error' ? (
                                <><AlertCircle className="w-4 h-4" /> Error - Try Again</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save Configuration</>
                            )}
                        </button>
                    </div>

                    {!isValidConfig && (
                        <div className="text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Total weightage must equal 50. Current: {totalWeightage}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
