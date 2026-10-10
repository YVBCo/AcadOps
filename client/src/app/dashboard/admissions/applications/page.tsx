'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
    Search,
    Filter,
    Eye,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    ChevronLeft,
    ChevronRight,
    Printer,
    Pencil,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { admissionsApi, batchApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { SemesterSelectionDialog } from '@/components/SemesterSelectionDialog';
import { toast } from 'sonner';

interface Admission {
    id: number;
    admissionId: string;
    applicantName: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    emailId?: string;
    mobileNumber?: string;
    branchSelection?: string;
    createdAt: string;
    admissionYear?: number;
    enteredByUser?: { id: number; name: string };
    approvedByUser?: { id: number; name: string };
    studentProfile?: {
        id: number;
        rollNumber: string;
        temporaryUsn?: string;
        permanentUsn?: string;
        isPermanentUsnLocked: boolean;
    };
}

const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    SUBMITTED: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
};

const statusIcons: Record<string, React.ElementType> = {
    DRAFT: FileText,
    SUBMITTED: Clock,
    APPROVED: CheckCircle,
    REJECTED: XCircle,
};

export default function ApplicationsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const router = useRouter();
    const isAdmin = user?.role === 'ADMISSIONS_ADMIN';

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(0);
    const pageSize = 20;

    const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
    const [reviewReason, setReviewReason] = useState('');
    const [usnInput, setUsnInput] = useState('');

    // Semester selection dialog state
    const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
    const [pendingApprovalId, setPendingApprovalId] = useState<number | null>(null);
    const [batchYear, setBatchYear] = useState<number>(new Date().getFullYear());

    // Lateral entry dialog state
    const [lateralEntryDialogOpen, setLateralEntryDialogOpen] = useState(false);
    const [pendingLateralAdmissionId, setPendingLateralAdmissionId] = useState<number | null>(null);

    const { data, isLoading, isError, refetch } = useQuery<{ admissions: Admission[]; total: number }>({
        // The results vary by tenant and, for submitted items, by clerk.
        queryKey: ['admissions', user?.tenantId ?? null, user?.id ?? null, statusFilter, search, page],
        queryFn: () => admissionsApi.getAll({
            status: statusFilter || undefined,
            search: search || undefined,
            skip: page * pageSize,
            take: pageSize,
        }),
    });

    // Fetch all batches for checking existence
    const { data: batchesData } = useQuery({
        queryKey: ['batches'],
        queryFn: () => batchApi.getAll(),
    });

    const batches = batchesData || [];

    const reviewMutation = useMutation({
        mutationFn: ({ id, status, reason, batchSemester, isLateralEntry }: {
            id: number;
            status: 'APPROVED' | 'REJECTED';
            reason?: string;
            batchSemester?: number;
            isLateralEntry?: boolean;
        }) => admissionsApi.review(id, { status, reason, batchSemester, isLateralEntry }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            queryClient.invalidateQueries({ queryKey: ['batches'] });
            setSelectedAdmission(null);
            setReviewReason('');
            setPendingApprovalId(null);
            setPendingLateralAdmissionId(null);
            setLateralEntryDialogOpen(false);
            toast.success('Admission reviewed successfully!');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to review admission. Please try again.');
        },
    });

    // Handle approve button click - check if batch exists first
    const handleApprove = (admission: Admission) => {
        // Pre-check: branch selection must be filled for approval
        if (!admission.branchSelection) {
            toast.error('Branch selection is missing. Please edit the application and set the branch before approving.');
            return;
        }

        const admissionYear = admission.admissionYear || new Date().getFullYear();
        const batch = batches.find((b: any) => b.name === String(admissionYear));

        if (!batch) {
            // Batch doesn't exist - show semester selection dialog
            setPendingApprovalId(admission.id);
            setBatchYear(admissionYear);
            setSemesterDialogOpen(true);
        } else if (batch.currentSemester >= 3) {
            // Batch is at 3rd sem or above - ask if lateral entry
            setPendingLateralAdmissionId(admission.id);
            setLateralEntryDialogOpen(true);
        } else {
            // Regular 1st/2nd sem admission - approve directly
            reviewMutation.mutate({ id: admission.id, status: 'APPROVED', isLateralEntry: false });
        }
    };

    // Handle semester selection confirmation
    const handleSemesterConfirm = (semester: number) => {
        if (pendingApprovalId) {
            if (semester >= 3) {
                // If assigning to 3rd+ sem batch, ask if lateral entry
                setPendingLateralAdmissionId(pendingApprovalId);
                setSemesterDialogOpen(false);
                setLateralEntryDialogOpen(true);
            } else {
                reviewMutation.mutate({
                    id: pendingApprovalId,
                    status: 'APPROVED',
                    batchSemester: semester,
                    isLateralEntry: false,
                });
                setSemesterDialogOpen(false);
            }
        }
    };

    // Handle lateral entry confirmation
    const handleLateralEntryConfirm = (isLateral: boolean) => {
        const admissionId = pendingLateralAdmissionId;
        if (admissionId) {
            reviewMutation.mutate({
                id: admissionId,
                status: 'APPROVED',
                isLateralEntry: isLateral,
            });
        }
        setLateralEntryDialogOpen(false);
        setPendingLateralAdmissionId(null);
    };

    const assignUsnMutation = useMutation({
        mutationFn: ({ profileId, usn }: { profileId: number; usn: string }) =>
            admissionsApi.assignUsn(profileId, usn),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            setUsnInput('');
            setSelectedAdmission(null);
        },
    });

    const submitMutation = useMutation({
        mutationFn: (id: number) => admissionsApi.submit(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
        },
    });

    const admissions = data?.admissions || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Applications</h1>
                <span className="text-sm text-slate-500">{isError ? 'Unable to load total' : `${total} total`}</span>
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, or email..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map(status => (
                            <button
                                key={status}
                                onClick={() => { setStatusFilter(status); setPage(0); }}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${statusFilter === status
                                    ? 'bg-sky-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {status || 'All'}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Table */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl"></div>
                    ))}
                </div>
            ) : isError ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <p className="text-slate-700 font-medium">Could not load applications</p>
                        <p className="text-sm text-slate-500 mt-1">The application list request failed. Try again before treating this as an empty list.</p>
                        <button onClick={() => refetch()} className="mt-4 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700">Try Again</button>
                    </div>
                </Card>
            ) : admissions.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No applications found</p>
                        <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
                    </div>
                </Card>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ID</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Name</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Branch</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">USN</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Entered By</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {admissions.map(adm => {
                                    const StatusIcon = statusIcons[adm.status] || FileText;
                                    return (
                                        <tr key={adm.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-mono text-slate-700">{adm.admissionId}</td>
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{adm.applicantName}</p>
                                                    {adm.emailId && <p className="text-xs text-slate-500">{adm.emailId}</p>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">{adm.branchSelection || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[adm.status]}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {adm.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-slate-600">
                                                {adm.studentProfile?.permanentUsn || adm.studentProfile?.temporaryUsn || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {!adm.admissionYear ? 'Public' : (adm.enteredByUser?.name || '—')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedAdmission(adm)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-sky-600 transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {adm.status === 'DRAFT' && (
                                                        <button
                                                            onClick={() => router.push(`/dashboard/admissions/applications/${adm.id}/edit`)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                                                            title="Edit draft"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => router.push(`/dashboard/admissions/applications/${adm.id}/print`)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
                                                        title="Print / Download"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                    {adm.status === 'DRAFT' && (
                                                        <button
                                                            onClick={() => submitMutation.mutate(adm.id)}
                                                            className="px-2 py-1 rounded-lg bg-sky-50 text-sky-600 text-xs font-medium hover:bg-sky-100 transition-colors"
                                                        >
                                                            Submit
                                                        </button>
                                                    )}
                                                    {isAdmin && adm.status === 'SUBMITTED' && (
                                                        <div key="review-actions" className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleApprove(adm)}
                                                                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedAdmission(adm)}
                                                                className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                            <p className="text-sm text-slate-500">
                                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Detail / Review Modal */}
            {selectedAdmission && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">
                                {selectedAdmission.admissionId}
                            </h3>
                            <button
                                onClick={() => { setSelectedAdmission(null); setReviewReason(''); }}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <XCircle className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <div><span className="text-slate-500">Name:</span> <span className="font-medium">{selectedAdmission.applicantName}</span></div>
                                <div><span className="text-slate-500">Branch:</span> <span className="font-medium">{selectedAdmission.branchSelection || '—'}</span></div>
                                <div><span className="text-slate-500">Email:</span> <span className="font-medium">{selectedAdmission.emailId || '—'}</span></div>
                                <div><span className="text-slate-500">Mobile:</span> <span className="font-medium">{selectedAdmission.mobileNumber || '—'}</span></div>
                                <div><span className="text-slate-500">Status:</span> <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedAdmission.status]}`}>{selectedAdmission.status}</span></div>
                                <div><span className="text-slate-500">Entered by:</span> <span className="font-medium">{!selectedAdmission.admissionYear ? 'Public' : (selectedAdmission.enteredByUser?.name || '—')}</span></div>
                            </div>

                            {selectedAdmission.studentProfile && (
                                <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase">Student Profile</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-slate-500">Temp USN:</span> <span className="font-mono">{selectedAdmission.studentProfile.temporaryUsn || '—'}</span></div>
                                        <div><span className="text-slate-500">Perm USN:</span> <span className="font-mono">{selectedAdmission.studentProfile.permanentUsn || '—'}</span></div>
                                    </div>

                                    {/* Assign Permanent USN */}
                                    {isAdmin && !selectedAdmission.studentProfile.isPermanentUsnLocked && (
                                        <div className="flex gap-2 mt-2">
                                            <input
                                                type="text"
                                                placeholder="Enter permanent USN..."
                                                value={usnInput}
                                                onChange={(e) => setUsnInput(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => assignUsnMutation.mutate({ profileId: selectedAdmission.studentProfile!.id, usn: usnInput })}
                                                isLoading={assignUsnMutation.isPending}
                                                disabled={!usnInput.trim()}
                                            >
                                                Assign
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Review Controls */}
                            {isAdmin && selectedAdmission.status === 'SUBMITTED' && (
                                <div className="p-3 bg-amber-50 rounded-xl space-y-3">
                                    <p className="text-xs font-semibold text-amber-700 uppercase">Review Actions</p>
                                    <textarea
                                        placeholder="Rejection reason (required for rejection)..."
                                        value={reviewReason}
                                        onChange={(e) => setReviewReason(e.target.value)}
                                        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm resize-none"
                                        rows={2}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-500 hover:bg-emerald-600"
                                            onClick={() => {
                                                handleApprove(selectedAdmission);
                                            }}
                                            isLoading={reviewMutation.isPending}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => {
                                                if (!reviewReason.trim()) { alert('Rejection reason is required'); return; }
                                                reviewMutation.mutate({ id: selectedAdmission.id, status: 'REJECTED', reason: reviewReason });
                                            }}
                                            isLoading={reviewMutation.isPending}
                                        >
                                            <XCircle className="w-4 h-4 mr-1" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Semester Selection Dialog */}
            <SemesterSelectionDialog
                isOpen={semesterDialogOpen}
                onClose={() => {
                    setSemesterDialogOpen(false);
                    setPendingApprovalId(null);
                }}
                onConfirm={handleSemesterConfirm}
                batchYear={batchYear}
            />

            {/* Lateral Entry Confirmation Dialog */}
            {lateralEntryDialogOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Lateral Entry?</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            This student&apos;s batch is at 3rd semester or above. Is this a <span className="font-semibold text-amber-700">lateral entry</span> admission?
                        </p>
                        <p className="text-xs text-slate-500 mb-5">
                            Lateral entry students will receive a separate temporary USN sequence (e.g., LCSE001) when admissions close.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                className="flex-1 bg-amber-500 hover:bg-amber-600"
                                onClick={() => handleLateralEntryConfirm(true)}
                                isLoading={reviewMutation.isPending}
                                disabled={reviewMutation.isPending}
                            >
                                Yes, Lateral Entry
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleLateralEntryConfirm(false)}
                                isLoading={reviewMutation.isPending}
                                disabled={reviewMutation.isPending}
                            >
                                No, Regular
                            </Button>
                        </div>
                        <button
                            onClick={() => { setLateralEntryDialogOpen(false); setPendingLateralAdmissionId(null); }}
                            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
