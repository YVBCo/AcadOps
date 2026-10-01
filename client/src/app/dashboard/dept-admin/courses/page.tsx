'use client';

import { useEffect, useState } from 'react';
import { api, courseApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    BookOpen,
    ChevronDown,
    AlertCircle,
    Lock,
    Plus,
    Pencil,
    Trash2,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Course {
    id: number;
    name: string;
    code: string;
    credits: number;
    semesterNumber: number;
    internalMarks?: number;
    externalMarks?: number;
    isLocked: boolean;
    department: { name: string };
    program: { name: string; code: string } | null;
    targetBatch?: { id: number; name: string } | null;
    targetBatchId?: number | null;
    description?: string;
}

interface CourseAllocation {
    id: number;
    semesterNumber: number;
    courseId: number;
    course: { id: number; name: string; code: string };
    section: { id: number; name: string; batch?: { id: number; name: string } };
    teacher: { id: number; user: { name: string } } | null;
}

interface Section {
    id: number;
    name: string;
    program: { name: string };
    batch: { id: number; name: string };
}

interface Batch {
    id: number;
    name: string;
    currentSemester: number;
}

// Tenant types where dept admin manages courses (no COE)
const SELF_MANAGED_TYPES = ['DEGREE', 'MBA', 'MCA', 'LAW'];

export default function CoursesPage() {
    const { user } = useAuthStore();
    const [courses, setCourses] = useState<Course[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [allAllocations, setAllAllocations] = useState<CourseAllocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSemester, setSelectedSemester] = useState<number | undefined>();
    const [maxSemesters, setMaxSemesters] = useState(8);

    // Course management state
    const canManageCourses = user?.tenantType ? SELF_MANAGED_TYPES.includes(user.tenantType) : false;
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [courseForm, setCourseForm] = useState({
        name: '', code: '', credits: 3, semesterNumber: 1,
        targetBatchId: 0,
        internalMarks: undefined as number | undefined,
        externalMarks: undefined as number | undefined,
        description: '',
    });
    const [saving, setSaving] = useState(false);

    // Allocate state
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [allocateBatch, setAllocateBatch] = useState<number>(0);
    const [allocating, setAllocating] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const [coursesRes, sectionsRes, batchesRes, semConfig] = await Promise.all([
                api.get('/dept-admin/courses'),
                api.get('/dept-admin/sections'),
                api.get('/batches'),
                courseApi.getMaxSemesters().catch(() => ({ maxSemesters: 8, tenantType: 'ENGINEERING' })),
            ]);

            setCourses(coursesRes.data);
            setSections(sectionsRes.data);
            setBatches(batchesRes.data);
            setMaxSemesters(semConfig.maxSemesters);

            // Fetch allocations
            const sectionIds = sectionsRes.data.map((s: Section) => s.id);
            const allocPromises = sectionIds.map((id: number) =>
                api.get(`/dept-admin/sections/${id}/allocations`).catch(() => ({ data: [] }))
            );
            const allocResults = await Promise.all(allocPromises);
            setAllAllocations(allocResults.flatMap(r => r.data));
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    // Course CRUD handlers
    const openCreateModal = () => {
        setEditingCourse(null);
        setCourseForm({ name: '', code: '', credits: 3, semesterNumber: 1, targetBatchId: 0, internalMarks: undefined, externalMarks: undefined, description: '' });
        setShowCreateModal(true);
    };

    const openEditModal = (course: Course) => {
        setEditingCourse(course);
        setCourseForm({
            name: course.name,
            code: course.code,
            credits: course.credits,
            semesterNumber: course.semesterNumber,
            targetBatchId: course.targetBatchId || 0,
            internalMarks: course.internalMarks,
            externalMarks: course.externalMarks,
            description: course.description || '',
        });
        setShowCreateModal(true);
    };

    const handleSaveCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);
            if (editingCourse) {
                await courseApi.update(editingCourse.id, {
                    name: courseForm.name,
                    code: courseForm.code,
                    credits: courseForm.credits,
                    description: courseForm.description || undefined,
                });
            } else {
                await courseApi.create({
                    name: courseForm.name,
                    code: courseForm.code,
                    credits: courseForm.credits,
                    departmentId: user?.departmentId || 0,
                    semesterNumber: courseForm.semesterNumber,
                    targetBatchId: courseForm.targetBatchId || undefined,
                    internalMarks: courseForm.internalMarks,
                    externalMarks: courseForm.externalMarks,
                    description: courseForm.description || undefined,
                });
            }
            setShowCreateModal(false);
            setEditingCourse(null);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save course');
        } finally {
            setSaving(false);
        }
    };

    const handleLockCourse = async (courseId: number) => {
        const course = courses.find(c => c.id === courseId);
        const batchName = course?.targetBatch?.name;
        const msg = batchName
            ? `Lock this course? It will be auto-assigned to all students in Batch ${batchName}. This cannot be undone.`
            : 'Lock this course? Once locked, it cannot be edited.';
        if (!confirm(msg)) return;
        try {
            await courseApi.lock(courseId);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to lock course');
        }
    };

    const handleDeleteCourse = async (courseId: number) => {
        if (!confirm('Delete this course? This cannot be undone.')) return;
        try {
            await courseApi.delete(courseId);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to delete course');
        }
    };

    const handleAllocate = async () => {
        if (!selectedCourse || !allocateBatch) {
            setError('Please select a batch');
            return;
        }
        const batchSections = sections.filter(s => s.batch?.id === allocateBatch);
        if (batchSections.length === 0) {
            setError('No sections found for this batch');
            return;
        }
        try {
            setAllocating(true);
            const promises = batchSections.map(section =>
                api.post('/dept-admin/courses/allocate', {
                    courseId: selectedCourse.id,
                    sectionId: section.id,
                    semesterNumber: selectedCourse.semesterNumber,
                })
            );
            await Promise.all(promises);
            setShowAllocateModal(false);
            setSelectedCourse(null);
            setAllocateBatch(0);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to allocate course');
        } finally {
            setAllocating(false);
        }
    };

    const semesters = [...new Set(courses.map(c => c.semesterNumber))].sort((a, b) => a - b);
    const filteredCourses = selectedSemester
        ? courses.filter(c => c.semesterNumber === selectedSemester)
        : courses;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Courses</h1>
                    <p className="text-neutral-500">
                        {canManageCourses
                            ? 'Create, manage, and allocate courses to sections'
                            : 'View COE-approved courses and allocate to sections'}
                    </p>
                </div>
                {canManageCourses && (
                    <Button onClick={openCreateModal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="h-4 w-4 mr-2" /> New Course
                    </Button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <span className="text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Info Banner */}
            {!canManageCourses && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-blue-700 text-sm">
                        <strong>Note:</strong> Only COE-locked courses can be allocated to sections.
                        Course creation and editing is managed by the COE.
                    </p>
                </div>
            )}
            {canManageCourses && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-emerald-700 text-sm">
                        <strong>Workflow:</strong> Create courses with a target batch → Lock them to auto-assign to all students in that batch.
                        Locked courses cannot be edited.
                    </p>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative">
                    <select
                        value={selectedSemester || ''}
                        onChange={(e) => setSelectedSemester(e.target.value ? parseInt(e.target.value) : undefined)}
                        className="appearance-none bg-white border border-neutral-200 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                        <option value="">All Semesters</option>
                        {Array.from({ length: maxSemesters }, (_, i) => i + 1).map((sem) => (
                            <option key={sem} value={sem}>Semester {sem}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                </div>
                <Badge variant="outline" className="text-neutral-600">
                    {filteredCourses.length} courses
                </Badge>
            </div>

            {/* Courses Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-100">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Course</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Code</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Semester</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Credits</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {filteredCourses.map((course) => (
                                <tr key={course.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-amber-50">
                                                <BookOpen className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-neutral-900">{course.name}</p>
                                                {course.program && (
                                                    <p className="text-sm text-neutral-500">{course.program.code}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-sm text-neutral-700">{course.code}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-neutral-900">Sem {course.semesterNumber}</span>
                                            {course.targetBatch && (
                                                <Badge className="bg-purple-100 text-purple-700 text-xs w-fit">
                                                    Batch {course.targetBatch.name}
                                                </Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-neutral-900">{course.credits}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {course.isLocked ? (
                                            <Badge className="bg-emerald-100 text-emerald-700">
                                                <Lock className="h-3 w-3 mr-1" /> Locked
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                                                Draft
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Course management buttons for self-managed tenants */}
                                            {canManageCourses && !course.isLocked && (
                                                <>
                                                    <button
                                                        onClick={() => openEditModal(course)}
                                                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleLockCourse(course.id)}
                                                        className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                    >
                                                        <Lock className="h-3 w-3 mr-1" /> Lock
                                                    </Button>
                                                    <button
                                                        onClick={() => handleDeleteCourse(course.id)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                            {/* Allocate button for locked courses */}
                                            {course.isLocked && (
                                                <>
                                                    {allAllocations
                                                        .filter(a => a.course?.id === course.id || a.courseId === course.id)
                                                        .map(alloc => (
                                                            <Badge key={alloc.id} className="bg-blue-100 text-blue-700">
                                                                {alloc.section?.batch?.name || 'Batch'} - Sec {alloc.section?.name}
                                                            </Badge>
                                                        ))
                                                    }
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedCourse(course);
                                                            setShowAllocateModal(true);
                                                        }}
                                                        className="text-xs"
                                                    >
                                                        <Plus className="h-3 w-3 mr-1" />
                                                        {allAllocations.some(a => a.course?.id === course.id || a.courseId === course.id) ? 'Add More' : 'Allocate'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredCourses.length === 0 && (
                <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No courses found</h3>
                    <p className="text-neutral-500">
                        {canManageCourses ? 'Create your first course to get started' : 'COE has not approved any courses yet'}
                    </p>
                    {canManageCourses && (
                        <Button onClick={openCreateModal} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="h-4 w-4 mr-2" /> Create Course
                        </Button>
                    )}
                </div>
            )}

            {/* Create/Edit Course Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-neutral-900">
                                {editingCourse ? 'Edit Course' : 'Create Course'}
                            </h2>
                            <button onClick={() => { setShowCreateModal(false); setEditingCourse(null); }}
                                className="p-2 rounded-lg hover:bg-neutral-100">
                                <X className="h-5 w-5 text-neutral-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCourse} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Course Name *</label>
                                <input
                                    type="text"
                                    value={courseForm.name}
                                    onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                                    placeholder="e.g., Data Structures"
                                    className="input w-full"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Course Code *</label>
                                    <input
                                        type="text"
                                        value={courseForm.code}
                                        onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
                                        placeholder="e.g., CS301"
                                        className="input w-full font-mono"
                                        required
                                        maxLength={10}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Credits *</label>
                                    <input
                                        type="number"
                                        value={courseForm.credits}
                                        onChange={(e) => setCourseForm({ ...courseForm, credits: parseInt(e.target.value) || 1 })}
                                        className="input w-full"
                                        min={1}
                                        max={10}
                                        required
                                    />
                                </div>
                            </div>
                            {!editingCourse && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 mb-1">Semester *</label>
                                            <select
                                                value={courseForm.semesterNumber}
                                                onChange={(e) => setCourseForm({ ...courseForm, semesterNumber: parseInt(e.target.value) })}
                                                className="input w-full"
                                            >
                                                {Array.from({ length: maxSemesters }, (_, i) => i + 1).map(s => (
                                                    <option key={s} value={s}>Sem {s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                                Target Batch {canManageCourses ? '*' : ''}
                                            </label>
                                            <select
                                                value={courseForm.targetBatchId}
                                                onChange={(e) => setCourseForm({ ...courseForm, targetBatchId: parseInt(e.target.value) })}
                                                className="input w-full"
                                                required={canManageCourses}
                                            >
                                                <option value={0}>Select Batch</option>
                                                {batches.map((batch) => (
                                                    <option key={batch.id} value={batch.id}>
                                                        Batch {batch.name} (Sem {batch.currentSemester})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 mb-1">Internal Marks</label>
                                            <input
                                                type="number"
                                                value={courseForm.internalMarks ?? ''}
                                                onChange={(e) => setCourseForm({ ...courseForm, internalMarks: e.target.value ? parseInt(e.target.value) : undefined })}
                                                className="input w-full"
                                                placeholder="Auto"
                                                min={0}
                                                max={100}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 mb-1">External Marks</label>
                                            <input
                                                type="number"
                                                value={courseForm.externalMarks ?? ''}
                                                onChange={(e) => setCourseForm({ ...courseForm, externalMarks: e.target.value ? parseInt(e.target.value) : undefined })}
                                                className="input w-full"
                                                placeholder="Auto"
                                                min={0}
                                                max={100}
                                            />
                                        </div>
                                    </div>
                                    {courseForm.targetBatchId > 0 && (
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
                                            <strong>Auto-assign:</strong> When this course is locked, it will be automatically assigned to all students in Batch {batches.find(b => b.id === courseForm.targetBatchId)?.name || ''} for Semester {courseForm.semesterNumber}.
                                        </div>
                                    )}
                                </>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                                <textarea
                                    value={courseForm.description}
                                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                                    className="input w-full"
                                    rows={2}
                                    placeholder="Optional description"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="ghost" onClick={() => { setShowCreateModal(false); setEditingCourse(null); }} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
                                    {saving ? 'Saving...' : (editingCourse ? 'Update Course' : 'Create Course')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Allocate Modal */}
            {showAllocateModal && selectedCourse && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-neutral-900 mb-2">Allocate Course</h2>
                        <p className="text-neutral-500 mb-4">
                            Allocate <strong>{selectedCourse.name}</strong> to a batch&apos;s sections
                        </p>

                        <div className="space-y-4">
                            <div className="bg-neutral-50 rounded-lg p-3">
                                <p className="text-sm text-neutral-500">Course Semester</p>
                                <p className="font-bold text-neutral-900">Semester {selectedCourse.semesterNumber}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Select Batch *</label>
                                <select
                                    value={allocateBatch}
                                    onChange={(e) => setAllocateBatch(parseInt(e.target.value))}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value={0}>Select Batch</option>
                                    {batches.map((batch) => (
                                        <option key={batch.id} value={batch.id}>
                                            Batch {batch.name} (Current: Sem {batch.currentSemester})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {allocateBatch > 0 && (
                                <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-sm font-medium text-neutral-700 mb-2">
                                        Course will be allocated to:
                                    </p>
                                    {sections.filter(s => s.batch?.id === allocateBatch).length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {sections
                                                .filter(s => s.batch?.id === allocateBatch)
                                                .map((section) => (
                                                    <span key={section.id} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                                                        Section {section.name}
                                                    </span>
                                                ))
                                            }
                                        </div>
                                    ) : (
                                        <p className="text-amber-600 text-sm">No sections found for this batch</p>
                                    )}
                                </div>
                            )}

                            {allocateBatch > 0 && batches.find(b => b.id === allocateBatch)?.currentSemester !== selectedCourse.semesterNumber && (
                                <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
                                    ⚠️ <strong>Warning:</strong> Selected batch is in Semester {batches.find(b => b.id === allocateBatch)?.currentSemester}, but this course is for Semester {selectedCourse.semesterNumber}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => { setShowAllocateModal(false); setAllocateBatch(0); }}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAllocate}
                                disabled={allocating || !allocateBatch || sections.filter(s => s.batch?.id === allocateBatch).length === 0}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {allocating ? 'Allocating...' : `Allocate to ${sections.filter(s => s.batch?.id === allocateBatch).length} Section(s)`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
