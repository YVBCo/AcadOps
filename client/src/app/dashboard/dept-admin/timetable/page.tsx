'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
    Calendar,
    Upload,
    ChevronDown,
    AlertCircle,
    Check,
    FileImage,
    FileText,
    Trash2,
    Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Timetable {
    id: number;
    semesterNumber: number;
    fileName: string;
    fileType: 'pdf' | 'image';
    fileUrl: string;
    isActive: boolean;
    createdAt: string;
    uploader: { name: string };
    section: {
        name: string;
        program: { name: string };
        batch: { name: string };
    };
    semester: { name: string };
}

interface Section {
    id: number;
    name: string;
    program: { name: string };
    batch: { name: string };
}

export default function TimetablePage() {
    const [timetables, setTimetables] = useState<Timetable[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadData, setUploadData] = useState({
        sectionId: 0,
        semesterId: 1,
        semesterNumber: 1,
        fileUrl: '',
        fileName: '',
        fileType: 'pdf' as 'pdf' | 'image',
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const sectionsRes = await api.get('/dept-admin/sections');
            setSections(sectionsRes.data);

            // Fetch timetables for each section
            const allTimetables: Timetable[] = [];
            for (const section of sectionsRes.data) {
                try {
                    const res = await api.get(`/dept-admin/timetable/${section.id}`);
                    if (Array.isArray(res.data)) {
                        allTimetables.push(...res.data.map((t: any) => ({ ...t, section })));
                    }
                } catch (e) {
                    // Section might not have timetables
                }
            }
            setTimetables(allTimetables);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!uploadData.sectionId || !uploadData.fileUrl || !uploadData.fileName) {
            setError('Section, file URL, and file name are required');
            return;
        }

        try {
            setUploading(true);
            await api.post('/dept-admin/timetable', uploadData);
            setSuccess('Timetable uploaded successfully');
            setShowUploadModal(false);
            setUploadData({
                sectionId: 0,
                semesterId: 1,
                semesterNumber: 1,
                fileUrl: '',
                fileName: '',
                fileType: 'pdf',
            });
            fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to upload timetable');
        } finally {
            setUploading(false);
        }
    };

    const handleDeactivate = async (id: number) => {
        try {
            await api.delete(`/dept-admin/timetable/${id}`);
            setSuccess('Timetable deactivated');
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to deactivate timetable');
        }
    };

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
                    <h1 className="text-2xl font-bold text-neutral-900">Timetable Management</h1>
                    <p className="text-neutral-500">Upload and manage section timetables (PDF/Image)</p>
                </div>
                <Button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Timetable
                </Button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <Check className="h-5 w-5 text-emerald-500" />
                    <span className="text-emerald-700">{success}</span>
                </div>
            )}

            {/* Timetables Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {timetables.map((timetable) => (
                    <div
                        key={timetable.id}
                        className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-100 hover:shadow-xl transition-shadow"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-blue-50">
                                    {timetable.fileType === 'pdf' ? (
                                        <FileText className="h-6 w-6 text-blue-600" />
                                    ) : (
                                        <FileImage className="h-6 w-6 text-blue-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-neutral-900">
                                        Section {timetable.section.name}
                                    </h3>
                                    <p className="text-sm text-neutral-500">
                                        {timetable.section.program?.name || 'No Program'}
                                    </p>
                                </div>
                            </div>
                            <Badge className={timetable.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}>
                                {timetable.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>

                        <div className="space-y-2 mb-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Semester</span>
                                <span className="font-medium">{timetable.semesterNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">File</span>
                                <span className="font-medium truncate max-w-[150px]">{timetable.fileName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Batch</span>
                                <span className="font-medium">{timetable.section.batch?.name || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.open(timetable.fileUrl, '_blank')}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                            </Button>
                            {timetable.isActive && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeactivate(timetable.id)}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {timetables.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-neutral-100">
                    <Calendar className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-900 mb-2">No timetables uploaded</h3>
                    <p className="text-neutral-500">Upload a timetable to get started</p>
                </div>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-neutral-900 mb-4">Upload Timetable</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Section *
                                </label>
                                <select
                                    value={uploadData.sectionId}
                                    onChange={(e) => setUploadData({ ...uploadData, sectionId: parseInt(e.target.value) })}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2"
                                >
                                    <option value={0}>Select Section</option>
                                    {sections.map((section) => (
                                        <option key={section.id} value={section.id}>
                                            {section.program?.name || 'No Program'} - Section {section.name} ({section.batch?.name})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    Semester Number *
                                </label>
                                <select
                                    value={uploadData.semesterNumber}
                                    onChange={(e) => setUploadData({ ...uploadData, semesterNumber: parseInt(e.target.value) })}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                                        <option key={sem} value={sem}>Semester {sem}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    File Type *
                                </label>
                                <select
                                    value={uploadData.fileType}
                                    onChange={(e) => setUploadData({ ...uploadData, fileType: e.target.value as 'pdf' | 'image' })}
                                    className="w-full border border-neutral-200 rounded-lg px-4 py-2"
                                >
                                    <option value="pdf">PDF</option>
                                    <option value="image">Image</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    File Name *
                                </label>
                                <Input
                                    value={uploadData.fileName}
                                    onChange={(e) => setUploadData({ ...uploadData, fileName: e.target.value })}
                                    placeholder="timetable_sem1.pdf"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                    File URL *
                                </label>
                                <Input
                                    value={uploadData.fileUrl}
                                    onChange={(e) => setUploadData({ ...uploadData, fileUrl: e.target.value })}
                                    placeholder="https://storage.example.com/timetable.pdf"
                                />
                                <p className="text-xs text-neutral-500 mt-1">
                                    Upload your file to cloud storage and paste the URL here
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" onClick={() => setShowUploadModal(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                                {uploading ? 'Uploading...' : 'Upload'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
