'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, admissionsApi, departmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Save,
    User,
    MapPin,
    Users,
    CheckCircle,
    Clock,
    AlertTriangle,
    GitBranch,
} from 'lucide-react';



const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];

const CATEGORIES = [
    'GM (General Merit)', 'OBC (2A)', 'OBC (2B)', 'OBC (3A)', 'OBC (3B)',
    'SC', 'ST', 'Cat-1',
];

const selectClass = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white";

export default function EditStudentPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuthStore();
    const userId = parseInt(params.id as string);

    // Fetch departments dynamically
    const { data: deptList = [] } = useQuery<{ id: number; name: string; code: string }[]>({
        queryKey: ['departments-opted'],
        queryFn: () => departmentApi.getOpted(),
    });
    const BRANCHES = deptList.map(d => d.name);

    const isAdmissionsAdmin = currentUser?.role === 'ADMISSIONS_ADMIN';
    const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
    const isClerk = currentUser?.role === 'ADMIN_CLERK';
    const isDeptAdmin = currentUser?.role === 'DEPARTMENT_ADMIN';
    const canDirectEdit = isAdmissionsAdmin || isSuperAdmin;
    const needsApproval = isClerk || isDeptAdmin;

    const { data: userData, isLoading } = useQuery({
        queryKey: ['user', userId],
        queryFn: () => userApi.getById(userId),
        enabled: !!userId,
    });

    const admissionData = userData?.studentProfile?.admissionData;

    const [form, setForm] = useState({
        name: '',
        mobileNumber: '',
        dateOfBirth: '',
        gender: '',
        bloodGroup: '',
        category: '',
        religion: '',
        religionOther: '',
        permanentAddress: { address: '', state: '', pin: '' },
        localAddress: { address: '', state: '', pin: '' },
        fatherName: '',
        fatherMobile: '',
        fatherOccupation: '',
        motherName: '',
        motherMobile: '',
        motherOccupation: '',
    });

    const [saved, setSaved] = useState(false);
    const [requested, setRequested] = useState(false);
    const [reason, setReason] = useState('');
    const [newBranch, setNewBranch] = useState('');
    const [branchChanging, setBranchChanging] = useState(false);

    useEffect(() => {
        if (userData && admissionData) {
            const religion = admissionData.religion || '';
            const isKnownReligion = RELIGIONS.includes(religion);
            setForm({
                name: admissionData.applicantName || userData.name || '',
                mobileNumber: admissionData.mobileNumber || '',
                dateOfBirth: admissionData.dateOfBirth ? new Date(admissionData.dateOfBirth).toISOString().split('T')[0] : '',
                gender: admissionData.gender || '',
                bloodGroup: admissionData.bloodGroup || '',
                category: admissionData.category || '',
                religion: isKnownReligion ? religion : (religion ? 'Other' : ''),
                religionOther: isKnownReligion ? '' : religion,
                permanentAddress: admissionData.permanentAddress || { address: '', state: '', pin: '' },
                localAddress: admissionData.localAddress || { address: '', state: '', pin: '' },
                fatherName: (admissionData.fatherDetails as any)?.name || '',
                fatherMobile: (admissionData.fatherDetails as any)?.mobile || '',
                fatherOccupation: (admissionData.fatherDetails as any)?.occupation || '',
                motherName: (admissionData.motherDetails as any)?.name || '',
                motherMobile: (admissionData.motherDetails as any)?.mobile || '',
                motherOccupation: (admissionData.motherDetails as any)?.occupation || '',
            });
            setNewBranch(admissionData.branchSelection || '');
        }
    }, [userData, admissionData]);

    // Admin/Super Admin direct save
    const adminMutation = useMutation({
        mutationFn: (data: any) => admissionsApi.updateStudentInfo(userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', userId] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to update');
        },
    });

    // Clerk/Dept Admin edit request
    const clerkMutation = useMutation({
        mutationFn: (data: any) => admissionsApi.createEditRequest(userId, data),
        onSuccess: () => {
            setRequested(true);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to submit edit request');
        },
    });

    // Branch change mutation (admissions admin only)
    const branchMutation = useMutation({
        mutationFn: (branch: string) => admissionsApi.changeBranch(userId, branch),
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ['user', userId] });
            toast.success(result.message);
            if (result.usnReassigned) {
                toast.info(`New temporary USN: ${result.newTemporaryUsn}. Please assign a new permanent USN.`);
            }
            setBranchChanging(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to change branch');
        },
    });

    const buildPayload = () => {
        const religion = form.religion === 'Other' ? (form.religionOther?.trim() || 'Other') : form.religion;
        const payload: any = {
            name: form.name,
            mobileNumber: form.mobileNumber,
            dateOfBirth: form.dateOfBirth,
            gender: form.gender,
            bloodGroup: form.bloodGroup,
            category: form.category,
            religion,
            permanentAddress: form.permanentAddress,
            localAddress: form.localAddress,
            fatherDetails: {
                name: form.fatherName,
                mobile: form.fatherMobile,
                occupation: form.fatherOccupation,
            },
            motherDetails: {
                name: form.motherName,
                mobile: form.motherMobile,
                occupation: form.motherOccupation,
            },
        };
        // Super Admin must include reason
        if (isSuperAdmin) {
            payload.reason = reason;
        }
        return payload;
    };

    const handleAdminSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSuperAdmin && !reason.trim()) {
            toast.error('You must provide a reason for editing student info');
            return;
        }
        adminMutation.mutate(buildPayload());
    };

    const handleClerkRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error('Please provide a reason for the edit');
            return;
        }
        clerkMutation.mutate({
            proposedChanges: buildPayload(),
            reason: reason,
        });
    };

    const handleBranchChange = () => {
        if (!newBranch.trim()) {
            toast.error('Please select a branch');
            return;
        }
        if (newBranch === admissionData?.branchSelection) {
            toast.info('Same branch selected — no change needed');
            return;
        }
        branchMutation.mutate(newBranch);
    };

    const updateField = (field: string, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const updateAddress = (type: 'permanentAddress' | 'localAddress', field: string, value: string) => {
        setForm(prev => ({
            ...prev,
            [type]: { ...(prev[type] as any), [field]: value },
        }));
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (requested) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <Card className="p-8 text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-amber-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Edit Request Submitted</h2>
                    <p className="text-slate-600 mb-6">
                        Your edit request has been submitted to the Admissions Administrator for approval.
                        Changes will be applied once approved.
                    </p>
                    <Button onClick={() => router.back()}>
                        Go Back
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="pl-0 hover:pl-2 transition-all text-slate-500"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Edit Student Info
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {userData?.name} — {userData?.studentProfile?.rollNumber}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {saved && (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full animate-fade-in">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Saved!</span>
                        </div>
                    )}
                    {needsApproval && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">Changes need admin approval</span>
                        </div>
                    )}
                    {isSuperAdmin && (
                        <div className="flex items-center gap-2 text-violet-600 bg-violet-50 px-4 py-2 rounded-full">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">Reason required</span>
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={canDirectEdit ? handleAdminSave : handleClerkRequest} className="space-y-6">
                {/* Reason field — required for Super Admin AND for edit requestors */}
                {(isSuperAdmin || needsApproval) && (
                    <Card className={`p-6 ${isSuperAdmin ? 'border-violet-200 bg-violet-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                        <h2 className={`text-lg font-bold mb-3 flex items-center gap-2 ${isSuperAdmin ? 'text-violet-900' : 'text-amber-900'}`}>
                            <AlertTriangle className={`h-5 w-5 ${isSuperAdmin ? 'text-violet-500' : 'text-amber-500'}`} />
                            Reason for Edit *
                        </h2>
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why do these details need to be changed?"
                            className="bg-white"
                        />
                    </Card>
                )}

                {/* Personal Information */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <User className="h-5 w-5 text-teal-500" />
                        Personal Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Enter full name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                            <Input type="tel" maxLength={10} value={form.mobileNumber} onChange={(e) => updateField('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter 10-digit mobile number" pattern="[0-9]{10}" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                            <Input type="date" value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                            <select value={form.gender} onChange={(e) => updateField('gender', e.target.value)} className={selectClass}>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                            <select value={form.bloodGroup} onChange={(e) => updateField('bloodGroup', e.target.value)} className={selectClass}>
                                <option value="">Select Blood Group</option>
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                    <option key={bg} value={bg}>{bg}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Religion</label>
                            <select value={form.religion} onChange={(e) => updateField('religion', e.target.value)} className={selectClass}>
                                <option value="">Select Religion</option>
                                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {form.religion === 'Other' && (
                                <Input
                                    className="mt-2"
                                    value={form.religionOther}
                                    onChange={(e) => updateField('religionOther', e.target.value)}
                                    placeholder="Please specify your religion"
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                            <select value={form.category} onChange={(e) => updateField('category', e.target.value)} className={selectClass}>
                                <option value="">Select Category</option>
                                {CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Permanent Address */}
                <Card className="p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-teal-500" />
                        Permanent Address
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <Input value={form.permanentAddress.address} onChange={(e) => updateAddress('permanentAddress', 'address', e.target.value)} placeholder="Enter full address" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <Input value={form.permanentAddress.state} onChange={(e) => updateAddress('permanentAddress', 'state', e.target.value)} placeholder="State" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Code</label>
                            <Input value={form.permanentAddress.pin} onChange={(e) => updateAddress('permanentAddress', 'pin', e.target.value)} placeholder="PIN Code" />
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
                            <Input value={form.localAddress.address} onChange={(e) => updateAddress('localAddress', 'address', e.target.value)} placeholder="Enter local address" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <Input value={form.localAddress.state} onChange={(e) => updateAddress('localAddress', 'state', e.target.value)} placeholder="State" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Code</label>
                            <Input value={form.localAddress.pin} onChange={(e) => updateAddress('localAddress', 'pin', e.target.value)} placeholder="PIN Code" />
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
                                    <Input value={form.fatherName} onChange={(e) => updateField('fatherName', e.target.value)} placeholder="Father's name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                                    <Input type="tel" maxLength={10} value={form.fatherMobile} onChange={(e) => updateField('fatherMobile', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" pattern="[0-9]{10}" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                                    <Input value={form.fatherOccupation} onChange={(e) => updateField('fatherOccupation', e.target.value)} placeholder="Father's occupation" />
                                </div>
                            </div>
                        </div>
                        <hr className="border-slate-200" />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Mother&apos;s Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                                    <Input value={form.motherName} onChange={(e) => updateField('motherName', e.target.value)} placeholder="Mother's name" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
                                    <Input type="tel" maxLength={10} value={form.motherMobile} onChange={(e) => updateField('motherMobile', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" pattern="[0-9]{10}" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Occupation</label>
                                    <Input value={form.motherOccupation} onChange={(e) => updateField('motherOccupation', e.target.value)} placeholder="Mother's occupation" />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" type="button" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        leftIcon={canDirectEdit ? Save : Clock}
                        isLoading={adminMutation.isPending || clerkMutation.isPending}
                        className={canDirectEdit
                            ? "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-500/25 hover:shadow-xl"
                            : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl"
                        }
                    >
                        {canDirectEdit ? 'Save Changes' : 'Submit for Approval'}
                    </Button>
                </div>
            </form>

            {/* Branch Change Section — Admissions Admin only */}
            {isAdmissionsAdmin && (
                <Card className="p-6 border-indigo-200">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <GitBranch className="h-5 w-5 text-indigo-500" />
                        Branch Change
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">
                        Current branch: <strong className="text-slate-700">{admissionData?.branchSelection || 'Not set'}</strong>
                        {userData?.studentProfile?.permanentUsn && (
                            <span className="text-amber-600 ml-2">
                                ⚠ Permanent USN exists — changing branch will reset USN and require reassignment.
                            </span>
                        )}
                    </p>
                    {branchChanging ? (
                        <div className="space-y-3">
                            <select
                                value={newBranch}
                                onChange={(e) => setNewBranch(e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Select New Branch</option>
                                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    onClick={handleBranchChange}
                                    isLoading={branchMutation.isPending}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                                >
                                    Confirm Branch Change
                                </Button>
                                <Button variant="secondary" type="button" onClick={() => setBranchChanging(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setBranchChanging(true)}
                            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                            <GitBranch className="h-4 w-4 mr-2" />
                            Change Branch
                        </Button>
                    )}
                </Card>
            )}
        </div>
    );
}
