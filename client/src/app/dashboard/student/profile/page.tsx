'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Send,
    User,
    Mail,
    Phone,
    MapPin,
    Users,
    CheckCircle,
    Clock,
    XCircle,
    AlertTriangle,
    Lock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

interface EditRequest {
    id: number;
    status: string;
    proposedChanges: Record<string, unknown>;
    reason: string;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
    reviewer: { name: string } | null;
}

export default function StudentProfileEditPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: profile, isLoading } = useQuery({
        queryKey: ['student-profile'],
        queryFn: studentDashboardApi.getProfile,
    });

    const { data: editRequests } = useQuery<EditRequest[]>({
        queryKey: ['student-edit-requests'],
        queryFn: studentDashboardApi.getEditRequests,
    });

    const [form, setForm] = useState({
        name: '',
        mobileNumber: '',
        dateOfBirth: '',
        gender: '',
        bloodGroup: '',
        category: '',
        permanentAddress: { address: '', state: '', pin: '' },
        localAddress: { address: '', state: '', pin: '' },
        fatherName: '',
        fatherMobile: '',
        fatherOccupation: '',
        motherName: '',
        motherMobile: '',
        motherOccupation: '',
    });

    const [reason, setReason] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (profile) {
            setForm({
                name: profile.name || '',
                mobileNumber: profile.mobileNumber || '',
                dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : '',
                gender: profile.gender || '',
                bloodGroup: profile.bloodGroup || '',
                category: profile.category || '',
                permanentAddress: profile.permanentAddress || { address: '', state: '', pin: '' },
                localAddress: profile.localAddress || { address: '', state: '', pin: '' },
                fatherName: profile.fatherDetails?.name || '',
                fatherMobile: profile.fatherDetails?.mobile || '',
                fatherOccupation: profile.fatherDetails?.occupation || '',
                motherName: profile.motherDetails?.name || '',
                motherMobile: profile.motherDetails?.mobile || '',
                motherOccupation: profile.motherDetails?.occupation || '',
            });
        }
    }, [profile]);

    const mutation = useMutation({
        mutationFn: (data: { proposedChanges: Record<string, unknown>; reason: string }) =>
            studentDashboardApi.submitEditRequest(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['student-edit-requests'] });
            setSubmitted(true);
            setReason('');
            setTimeout(() => setSubmitted(false), 5000);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;

        const proposedChanges: Record<string, unknown> = {
            name: form.name,
            mobileNumber: form.mobileNumber,
            dateOfBirth: form.dateOfBirth,
            gender: form.gender,
            bloodGroup: form.bloodGroup,
            category: form.category,
            permanentAddress: form.permanentAddress,
            localAddress: form.localAddress,
            fatherDetails: {
                name: form.fatherName,
                mobile: profile?.fatherDetails?.mobile || form.fatherMobile, // Keep original parent mobile
                occupation: form.fatherOccupation,
            },
            motherDetails: {
                name: form.motherName,
                mobile: profile?.motherDetails?.mobile || form.motherMobile, // Keep original parent mobile
                occupation: form.motherOccupation,
            },
        };

        mutation.mutate({ proposedChanges, reason: reason.trim() });
    };

    const updateField = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const updateAddress = (type: 'permanentAddress' | 'localAddress', field: string, value: string) => {
        setForm(prev => ({
            ...prev,
            [type]: { ...prev[type], [field]: value }
        }));
    };

    const pendingRequest = editRequests?.find(r => r.status === 'PENDING');
    const recentRequests = editRequests?.slice(0, 5) || [];

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="pl-0 hover:pl-2 transition-all text-slate-500"
                        leftIcon={ArrowLeft}
                    >
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
                </div>
                {submitted && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full animate-fade-in">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Request submitted!</span>
                    </div>
                )}
            </div>

            {/* Pending Request Banner */}
            {pendingRequest && (
                <Card className="!p-4 border-amber-200 bg-amber-50">
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold text-amber-800">Pending Edit Request</p>
                            <p className="text-sm text-amber-700 mt-1">
                                You have a pending request submitted on{' '}
                                {new Date(pendingRequest.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}. Please wait for admin approval before submitting a new one.
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                Reason: {pendingRequest.reason}
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Info Banner */}
            <Card className="!p-4 border-indigo-200 bg-indigo-50">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-semibold text-indigo-800">Profile changes require approval</p>
                        <p className="text-sm text-indigo-700 mt-1">
                            Any changes you make will be submitted as a request. An admin or admission clerk
                            will review and approve the changes. Parent phone numbers cannot be changed.
                        </p>
                    </div>
                </div>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-500" />
                        Personal Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <Input
                                value={form.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder="Enter full name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                <span className="flex items-center gap-1">
                                    <Mail className="h-3.5 w-3.5" /> Email
                                </span>
                            </label>
                            <Input
                                value={profile?.email || ''}
                                disabled
                                className="bg-slate-50 text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">Email cannot be changed here</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                            <Input
                                value={form.mobileNumber}
                                onChange={(e) => updateField('mobileNumber', e.target.value)}
                                placeholder="Enter mobile number"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                            <Input
                                type="date"
                                value={form.dateOfBirth}
                                onChange={(e) => updateField('dateOfBirth', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                            <select
                                value={form.gender}
                                onChange={(e) => updateField('gender', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                            <select
                                value={form.bloodGroup}
                                onChange={(e) => updateField('bloodGroup', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">Select Blood Group</option>
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                    <option key={bg} value={bg}>{bg}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => updateField('category', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                <option value="">Select Category</option>
                                {['General', 'OBC', 'SC', 'ST'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Permanent Address */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-indigo-500" />
                        Permanent Address
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <Input
                                value={form.permanentAddress.address}
                                onChange={(e) => updateAddress('permanentAddress', 'address', e.target.value)}
                                placeholder="Enter full address"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <Input
                                value={form.permanentAddress.state}
                                onChange={(e) => updateAddress('permanentAddress', 'state', e.target.value)}
                                placeholder="State"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Code</label>
                            <Input
                                value={form.permanentAddress.pin}
                                onChange={(e) => updateAddress('permanentAddress', 'pin', e.target.value)}
                                placeholder="PIN Code"
                            />
                        </div>
                    </div>
                </Card>

                {/* Local Address */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-purple-500" />
                        Local Address
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <Input
                                value={form.localAddress.address}
                                onChange={(e) => updateAddress('localAddress', 'address', e.target.value)}
                                placeholder="Enter local address"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <Input
                                value={form.localAddress.state}
                                onChange={(e) => updateAddress('localAddress', 'state', e.target.value)}
                                placeholder="State"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Code</label>
                            <Input
                                value={form.localAddress.pin}
                                onChange={(e) => updateAddress('localAddress', 'pin', e.target.value)}
                                placeholder="PIN Code"
                            />
                        </div>
                    </div>
                </Card>

                {/* Parent Details */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-500" />
                        Parent / Guardian Details
                    </h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Father&apos;s Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                    <Input
                                        value={form.fatherName}
                                        onChange={(e) => updateField('fatherName', e.target.value)}
                                        placeholder="Father's name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <span className="flex items-center gap-1">
                                            <Lock className="h-3 w-3 text-slate-400" /> Mobile
                                        </span>
                                    </label>
                                    <Input
                                        value={form.fatherMobile}
                                        disabled
                                        className="bg-slate-50 text-slate-500 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Contact admin to change</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                                    <Input
                                        value={form.fatherOccupation}
                                        onChange={(e) => updateField('fatherOccupation', e.target.value)}
                                        placeholder="Father's occupation"
                                    />
                                </div>
                            </div>
                        </div>
                        <hr className="border-slate-200" />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Mother&apos;s Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                    <Input
                                        value={form.motherName}
                                        onChange={(e) => updateField('motherName', e.target.value)}
                                        placeholder="Mother's name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        <span className="flex items-center gap-1">
                                            <Lock className="h-3 w-3 text-slate-400" /> Mobile
                                        </span>
                                    </label>
                                    <Input
                                        value={form.motherMobile}
                                        disabled
                                        className="bg-slate-50 text-slate-500 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Contact admin to change</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                                    <Input
                                        value={form.motherOccupation}
                                        onChange={(e) => updateField('motherOccupation', e.target.value)}
                                        placeholder="Mother's occupation"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Reason for Change + Submit */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Send className="h-5 w-5 text-indigo-500" />
                        Submit Change Request
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="edit-reason">
                                Reason for changes <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="edit-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Please describe what you changed and why (e.g., 'Updated local address after hostel change')"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                                rows={3}
                                maxLength={500}
                                aria-label="Reason for changes"
                            />
                            <p className="text-xs text-slate-400 mt-1">{reason.length}/500 characters</p>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={() => router.back()}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                leftIcon={Send}
                                isLoading={mutation.isPending}
                                disabled={!!pendingRequest || !reason.trim() || mutation.isPending}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl disabled:opacity-50"
                            >
                                {pendingRequest ? 'Request Pending...' : 'Request Changes'}
                            </Button>
                        </div>
                        {mutation.isError && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm">{(mutation.error as Error)?.message || 'Failed to submit request'}</span>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Previous Edit Requests */}
                {recentRequests.length > 0 && (
                    <Card className="p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Previous Requests</h2>
                        <div className="space-y-3">
                            {recentRequests.map(req => (
                                <div
                                    key={req.id}
                                    className={clsx(
                                        'flex items-center justify-between p-3 rounded-lg border',
                                        req.status === 'PENDING' && 'bg-amber-50 border-amber-200',
                                        req.status === 'APPROVED' && 'bg-emerald-50 border-emerald-200',
                                        req.status === 'REJECTED' && 'bg-red-50 border-red-200',
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                            {req.reason}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                            })}
                                            {req.reviewer && req.status !== 'PENDING' && (
                                                <> · Reviewed by {req.reviewer.name}</>
                                            )}
                                        </p>
                                        {req.reviewNote && (
                                            <p className="text-xs text-slate-600 mt-1 italic">
                                                &ldquo;{req.reviewNote}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                    <div className={clsx(
                                        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ml-3',
                                        req.status === 'PENDING' && 'bg-amber-100 text-amber-700',
                                        req.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                                        req.status === 'REJECTED' && 'bg-red-100 text-red-700',
                                    )}>
                                        {req.status === 'PENDING' && <Clock className="h-3 w-3" />}
                                        {req.status === 'APPROVED' && <CheckCircle className="h-3 w-3" />}
                                        {req.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                                        {req.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}
            </form>
        </div>
    );
}
