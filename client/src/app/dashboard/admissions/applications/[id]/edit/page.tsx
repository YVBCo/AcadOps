'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { admissionsApi, departmentApi } from '@/lib/api';
import { toast } from 'sonner';

const CERTIFICATES = [
    'CET Admission Order',
    '10+2 Marks Card (Original) + 3 copies',
    'Class 10th Marks Card (Original) + 3 copies',
    'Copy of Aadhaar Card (3 copies)',
    '6 Recent Color passport size photographs',
    'Caste / Income Certificate',
    'Transfer Certificate (ORIGINAL)',
];

const HOW_KNOW_OPTIONS = [
    'News in Print Media', 'Print / Visual Media', 'Education Expo / Fair',
    'Friends', 'Parents / Relatives', 'PU Teachers / College', 'Others',
];

const RELIGIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'];
const CATEGORIES = ['GM (General Merit)', 'OBC (2A)', 'OBC (2B)', 'OBC (3A)', 'OBC (3B)', 'SC', 'ST', 'Cat-1'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function EditAdmissionPage() {
    const router = useRouter();
    const params = useParams();
    const id = Number(params.id);
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);

    const { data: departments = [] } = useQuery<{ id: number; name: string; code: string }[]>({
        queryKey: ['departments-opted'],
        queryFn: () => departmentApi.getOpted(),
    });
    const branchNames = departments.map(d => d.name);

    const { data: admission, isLoading } = useQuery({
        queryKey: ['admission', id],
        queryFn: () => admissionsApi.getById(id),
        enabled: !!id,
    });

    const [formData, setFormData] = useState<Record<string, any>>({
        speciallyAbled: false,
        hostel: false,
        applicantDeclaration: false,
        parentDeclaration: false,
        permanentAddress: { address: '', state: '', pin: '' },
        localAddress: { address: '', state: '', pin: '' },
        fatherDetails: { name: '', email: '', mobile: '', occupation: '', annualIncome: '' },
        motherDetails: { name: '', email: '', mobile: '', occupation: '', annualIncome: '' },
        sslcDetails: { registerNo: '', schoolName: '', medium: '', marks: '', maxMarks: '', percentage: '', yearOfPassing: '' },
        pucDetails: { registerNo: '', collegeName: '', medium: '', marks: '', maxMarks: '', percentage: '', yearOfPassing: '' },
        subjectWiseMarks: {
            physics: { obtained: '', max: '' },
            mathematics: { obtained: '', max: '' },
            chemistry: { obtained: '', max: '' },
            other: { obtained: '', max: '' },
        },
        documents: [],
        howDidYouKnow: [],
    });

    // Load existing data when admission loads
    useEffect(() => {
        if (admission) {
            const howKnow = admission.howDidYouKnow
                ? admission.howDidYouKnow.split(', ').filter(Boolean)
                : [];
            setFormData({
                applicantName: admission.applicantName || '',
                applyingThrough: admission.applyingThrough || '',
                gender: admission.gender || '',
                bloodGroup: admission.bloodGroup || '',
                dateOfBirth: admission.dateOfBirth ? admission.dateOfBirth.split('T')[0] : '',
                nationality: admission.nationality || '',
                religion: admission.religion || '',
                category: admission.category || '',
                subCaste: admission.subCaste || '',
                motherTongue: admission.motherTongue || '',
                speciallyAbled: admission.speciallyAbled || false,
                aadhaarNumber: admission.aadhaarNumber || '',
                emailId: admission.emailId || '',
                mobileNumber: admission.mobileNumber || '',
                hostel: admission.hostel || false,
                pickupPlace: admission.pickupPlace || '',
                permanentAddress: admission.permanentAddress || { address: '', state: '', pin: '' },
                localAddress: admission.localAddress || { address: '', state: '', pin: '' },
                fatherDetails: admission.fatherDetails || { name: '', email: '', mobile: '', occupation: '', annualIncome: '' },
                motherDetails: admission.motherDetails || { name: '', email: '', mobile: '', occupation: '', annualIncome: '' },
                branchSelection: admission.branchSelection || '',
                cetRollNo: admission.cetRollNo || '',
                cetRank: admission.cetRank || '',
                cetAllottedCategory: admission.cetAllottedCategory || '',
                comedkRollNo: admission.comedkRollNo || '',
                comedkRank: admission.comedkRank || '',
                sslcDetails: admission.sslcDetails || { registerNo: '', schoolName: '', medium: '', marks: '', maxMarks: '', percentage: '', yearOfPassing: '' },
                pucDetails: admission.pucDetails || { registerNo: '', collegeName: '', medium: '', marks: '', maxMarks: '', percentage: '', yearOfPassing: '' },
                subjectWiseMarks: admission.subjectWiseMarks || { physics: { obtained: '', max: '' }, mathematics: { obtained: '', max: '' }, chemistry: { obtained: '', max: '' }, other: { obtained: '', max: '' } },
                documents: admission.documents || [],
                howDidYouKnow: howKnow,
                applicantDeclaration: admission.applicantDeclaration || false,
                parentDeclaration: admission.parentDeclaration || false,
                admissionYear: admission.admissionYear || new Date().getFullYear(),
            });
        }
    }, [admission]);

    const updateMutation = useMutation({
        mutationFn: (data: Record<string, any>) => admissionsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            toast.success('Draft saved successfully!');
            router.push('/dashboard/admissions/applications');
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to save'),
    });

    const submitMutation = useMutation({
        mutationFn: async (data: Record<string, any>) => {
            await admissionsApi.update(id, data);
            return admissionsApi.submit(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            toast.success('Application submitted for review!');
            router.push('/dashboard/admissions/applications');
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit'),
    });

    const updateField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
    const updateNested = (parent: string, field: string, value: any) =>
        setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }));
    const updateSubjectMarks = (subject: string, type: 'obtained' | 'max', value: string) =>
        setFormData(prev => ({
            ...prev,
            subjectWiseMarks: { ...prev.subjectWiseMarks, [subject]: { ...prev.subjectWiseMarks[subject], [type]: value } },
        }));
    const toggleDocument = (doc: string) =>
        setFormData(prev => {
            const docs = prev.documents || [];
            return { ...prev, documents: docs.includes(doc) ? docs.filter((d: string) => d !== doc) : [...docs, doc] };
        });
    const toggleHowKnow = (option: string) =>
        setFormData(prev => {
            const list = Array.isArray(prev.howDidYouKnow) ? prev.howDidYouKnow : [];
            return { ...prev, howDidYouKnow: list.includes(option) ? list.filter((o: string) => o !== option) : [...list, option] };
        });

    const prepareData = () => {
        if (!formData.applicantName?.trim()) { toast.error('Applicant name is required'); return null; }
        if (!formData.admissionYear) { toast.error('Admission Year is required'); return null; }
        if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) { toast.error('Aadhaar number must be exactly 12 digits'); return null; }
        const religion = formData.religion === 'Other' ? (formData.religionOther?.trim() || 'Other') : formData.religion;
        return { ...formData, religion, howDidYouKnow: Array.isArray(formData.howDidYouKnow) ? formData.howDidYouKnow.join(', ') : formData.howDidYouKnow };
    };

    const handleSave = () => { const data = prepareData(); if (data) updateMutation.mutate(data); };
    const handleSubmit = () => { const data = prepareData(); if (data) submitMutation.mutate(data); };

    const sectionTitle = "text-sm font-bold text-slate-800 uppercase tracking-wide bg-slate-100 px-4 py-2 rounded-lg border border-slate-200";
    const fieldLabel = "block text-xs font-semibold text-slate-600 mb-1";
    const selectClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors";
    const checkboxClass = "w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500";

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    if (admission && admission.status !== 'DRAFT') {
        return (
            <div className="space-y-4 max-w-5xl mx-auto">
                <Card className="p-8 text-center">
                    <p className="text-slate-600 font-medium">This admission is no longer a draft and cannot be edited.</p>
                    <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">
                        Edit Draft — {admission?.admissionId}
                    </h1>
                    <p className="text-sm text-slate-500">
                        Step {step} of 2 — Make changes and save or submit for review
                    </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">DRAFT</span>
            </div>

            {/* Step indicators */}
            <div className="flex gap-2">
                <div className="flex-1">
                    <div className={`h-2 rounded-full transition-colors ${step >= 1 ? 'bg-sky-500' : 'bg-slate-200'}`} />
                    <span className="text-[10px] text-slate-500 mt-1 block">Personal & Admission Details</span>
                </div>
                <div className="flex-1">
                    <div className={`h-2 rounded-full transition-colors ${step >= 2 ? 'bg-sky-500' : 'bg-slate-200'}`} />
                    <span className="text-[10px] text-slate-500 mt-1 block">Academic & Declaration</span>
                </div>
            </div>

            {/* ========== PAGE 1 ========== */}
            {step === 1 && (
                <Card key="step-1">
                    {/* Applying Through */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Admission Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className={fieldLabel}>Applying Through *</label>
                                <div className="flex gap-4">
                                    {['CET', 'COMEDK', 'Management'].map(opt => (
                                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="applyingThrough" value={opt} checked={formData.applyingThrough === opt}
                                                onChange={e => updateField('applyingThrough', e.target.value)} className="w-4 h-4 text-sky-600 border-slate-300" />
                                            <span className="text-sm text-slate-700">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Personal */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Personal Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="md:col-span-2">
                                <Input label="Name of the Applicant *" value={formData.applicantName || ''} onChange={e => updateField('applicantName', e.target.value)} />
                            </div>
                            <div>
                                <label className={fieldLabel}>Blood Group</label>
                                <select value={formData.bloodGroup || ''} onChange={e => updateField('bloodGroup', e.target.value)} className={selectClass}>
                                    <option value="">Select</option>
                                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={fieldLabel}>Gender</label>
                                <div className="flex gap-4 pt-2">
                                    {['Male', 'Female'].map(g => (
                                        <label key={g} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="gender" value={g} checked={formData.gender === g}
                                                onChange={e => updateField('gender', e.target.value)} className="w-4 h-4 text-sky-600 border-slate-300" />
                                            <span className="text-sm text-slate-700">{g === 'Male' ? 'M' : 'F'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Input label="Date of Birth" type="date" value={formData.dateOfBirth || ''} onChange={e => updateField('dateOfBirth', e.target.value)} />
                            <Input label="Mother Tongue" value={formData.motherTongue || ''} onChange={e => updateField('motherTongue', e.target.value)} />
                            <Input label="Nationality" value={formData.nationality || ''} onChange={e => updateField('nationality', e.target.value)} />
                            <div>
                                <label className={fieldLabel}>Religion</label>
                                <select value={formData.religion || ''} onChange={e => updateField('religion', e.target.value)} className={selectClass}>
                                    <option value="">Select Religion</option>
                                    {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                {formData.religion === 'Other' && (
                                    <Input className="mt-2" value={formData.religionOther || ''} onChange={e => updateField('religionOther', e.target.value)} placeholder="Please specify" />
                                )}
                            </div>
                            <div>
                                <label className={fieldLabel}>Category</label>
                                <select value={formData.category || ''} onChange={e => updateField('category', e.target.value)} className={selectClass}>
                                    <option value="">Select Category</option>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={fieldLabel}>Specially Abled</label>
                                <div className="flex gap-4 pt-2">
                                    {[true, false].map(val => (
                                        <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="speciallyAbled" checked={formData.speciallyAbled === val}
                                                onChange={() => updateField('speciallyAbled', val)} className="w-4 h-4 text-sky-600 border-slate-300" />
                                            <span className="text-sm text-slate-700">{val ? 'Y' : 'N'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Input label="Aadhaar No." value={formData.aadhaarNumber || ''} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 12); updateField('aadhaarNumber', val); }} maxLength={12} />
                                {formData.aadhaarNumber && formData.aadhaarNumber.length !== 12 && (
                                    <p className="text-xs text-red-500 mt-1">{formData.aadhaarNumber.length}/12 digits</p>
                                )}
                            </div>
                            <Input label="Sub Caste" value={formData.subCaste || ''} onChange={e => updateField('subCaste', e.target.value)} />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Contact Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Input label="Email ID" type="email" value={formData.emailId || ''} onChange={e => updateField('emailId', e.target.value)} />
                            <Input label="Mobile No." value={formData.mobileNumber || ''} onChange={e => updateField('mobileNumber', e.target.value)} />
                            <Input label="Pick-Up Place" value={formData.pickupPlace || ''} onChange={e => updateField('pickupPlace', e.target.value)} />
                            <div>
                                <label className={fieldLabel}>Hostel</label>
                                <div className="flex gap-4 pt-2">
                                    {[true, false].map(val => (
                                        <label key={String(val)} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border cursor-pointer transition-colors ${formData.hostel === val ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                                            <input type="radio" name="hostel" checked={formData.hostel === val} onChange={() => updateField('hostel', val)} className="w-4 h-4 text-sky-600 border-slate-300" />
                                            <span className="text-sm font-medium text-slate-700">{val ? 'YES' : 'NO'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Address Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700">Permanent Address</label>
                                <textarea value={formData.permanentAddress?.address || ''} onChange={e => updateNested('permanentAddress', 'address', e.target.value)}
                                    placeholder="Full address" rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500" />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="State" value={formData.permanentAddress?.state || ''} onChange={e => updateNested('permanentAddress', 'state', e.target.value)} />
                                    <Input label="Pin" value={formData.permanentAddress?.pin || ''} onChange={e => updateNested('permanentAddress', 'pin', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700">Local Address</label>
                                <textarea value={formData.localAddress?.address || ''} onChange={e => updateNested('localAddress', 'address', e.target.value)}
                                    placeholder="Full address" rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500" />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="State" value={formData.localAddress?.state || ''} onChange={e => updateNested('localAddress', 'state', e.target.value)} />
                                    <Input label="Pin" value={formData.localAddress?.pin || ''} onChange={e => updateNested('localAddress', 'pin', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Parent Details */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Parent / Guardian Details</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                                <label className="text-sm font-bold text-slate-700">Father&apos;s Details</label>
                                <Input label="Name" value={formData.fatherDetails?.name || ''} onChange={e => updateNested('fatherDetails', 'name', e.target.value)} />
                                <Input label="E-Mail ID" type="email" value={formData.fatherDetails?.email || ''} onChange={e => updateNested('fatherDetails', 'email', e.target.value)} />
                                <Input label="Mobile No." value={formData.fatherDetails?.mobile || ''} onChange={e => updateNested('fatherDetails', 'mobile', e.target.value)} />
                                <Input label="Occupation" value={formData.fatherDetails?.occupation || ''} onChange={e => updateNested('fatherDetails', 'occupation', e.target.value)} />
                                <Input label="Annual Income (Rs)" value={formData.fatherDetails?.annualIncome || ''} onChange={e => updateNested('fatherDetails', 'annualIncome', e.target.value)} />
                            </div>
                            <div className="space-y-3 p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                                <label className="text-sm font-bold text-slate-700">Mother&apos;s Details</label>
                                <Input label="Name" value={formData.motherDetails?.name || ''} onChange={e => updateNested('motherDetails', 'name', e.target.value)} />
                                <Input label="E-Mail ID" type="email" value={formData.motherDetails?.email || ''} onChange={e => updateNested('motherDetails', 'email', e.target.value)} />
                                <Input label="Mobile No." value={formData.motherDetails?.mobile || ''} onChange={e => updateNested('motherDetails', 'mobile', e.target.value)} />
                                <Input label="Occupation" value={formData.motherDetails?.occupation || ''} onChange={e => updateNested('motherDetails', 'occupation', e.target.value)} />
                                <Input label="Annual Income (Rs)" value={formData.motherDetails?.annualIncome || ''} onChange={e => updateNested('motherDetails', 'annualIncome', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Branch */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Selected Course and Quota Information</h2>
                        <div className="mt-4">
                            <label className={fieldLabel}>Select Branch</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {branchNames.map(branch => (
                                    <label key={branch} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${formData.branchSelection === branch ? 'bg-sky-50 border-sky-400 text-sky-700 ring-2 ring-sky-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                        <input type="radio" name="branchSelection" value={branch} checked={formData.branchSelection === branch}
                                            onChange={e => updateField('branchSelection', e.target.value)} className="sr-only" />
                                        {branch}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Input label="CET Roll No." value={formData.cetRollNo || ''} onChange={e => updateField('cetRollNo', e.target.value)} />
                            <Input label="CET Rank" value={formData.cetRank || ''} onChange={e => updateField('cetRank', e.target.value)} />
                            <Input label="Allotted Category (CET)" value={formData.cetAllottedCategory || ''} onChange={e => updateField('cetAllottedCategory', e.target.value)} />
                            <Input label="COMEDK Roll No." value={formData.comedkRollNo || ''} onChange={e => updateField('comedkRollNo', e.target.value)} />
                            <Input label="COMEDK Rank" value={formData.comedkRank || ''} onChange={e => updateField('comedkRank', e.target.value)} />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-200">
                        <Button onClick={() => setStep(2)} rightIcon={ArrowRight}>Next: Academic Details</Button>
                    </div>
                </Card>
            )}

            {/* ========== PAGE 2 ========== */}
            {step === 2 && (
                <Card key="step-2">
                    {/* SSLC */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Education Details — SSLC / CBSE(X) / ICSE(X) / 10th</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Input label="Register No." value={formData.sslcDetails?.registerNo || ''} onChange={e => updateNested('sslcDetails', 'registerNo', e.target.value)} />
                            <Input label="Name of the School" value={formData.sslcDetails?.schoolName || ''} onChange={e => updateNested('sslcDetails', 'schoolName', e.target.value)} />
                            <Input label="Medium of Instruction" value={formData.sslcDetails?.medium || ''} onChange={e => updateNested('sslcDetails', 'medium', e.target.value)} />
                            <Input label="Marks Obtained" type="number" value={formData.sslcDetails?.marks || ''} onChange={e => updateNested('sslcDetails', 'marks', e.target.value)} />
                            <Input label="Maximum Marks" type="number" value={formData.sslcDetails?.maxMarks || ''} onChange={e => updateNested('sslcDetails', 'maxMarks', e.target.value)} />
                            <Input label="Percentage" value={formData.sslcDetails?.percentage || ''} onChange={e => updateNested('sslcDetails', 'percentage', e.target.value)} />
                            <Input label="Year of Passing" value={formData.sslcDetails?.yearOfPassing || ''} onChange={e => updateNested('sslcDetails', 'yearOfPassing', e.target.value)} />
                        </div>
                    </div>

                    {/* PUC */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Education Details — PUC / CBSE(XII) / ICSE(XII) / 10+2</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Input label="Register No." value={formData.pucDetails?.registerNo || ''} onChange={e => updateNested('pucDetails', 'registerNo', e.target.value)} />
                            <Input label="Name of the College" value={formData.pucDetails?.collegeName || ''} onChange={e => updateNested('pucDetails', 'collegeName', e.target.value)} />
                            <Input label="Medium of Instruction" value={formData.pucDetails?.medium || ''} onChange={e => updateNested('pucDetails', 'medium', e.target.value)} />
                            <Input label="Marks Obtained" type="number" value={formData.pucDetails?.marks || ''} onChange={e => updateNested('pucDetails', 'marks', e.target.value)} />
                            <Input label="Maximum Marks" type="number" value={formData.pucDetails?.maxMarks || ''} onChange={e => updateNested('pucDetails', 'maxMarks', e.target.value)} />
                            <Input label="Percentage" value={formData.pucDetails?.percentage || ''} onChange={e => updateNested('pucDetails', 'percentage', e.target.value)} />
                            <Input label="Year of Passing" value={formData.pucDetails?.yearOfPassing || ''} onChange={e => updateNested('pucDetails', 'yearOfPassing', e.target.value)} />
                        </div>
                    </div>

                    {/* Subject Marks */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Subject-wise Marks (PUC / 12th)</h2>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 w-1/3">Subjects</th>
                                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 w-1/3">Obtained Marks</th>
                                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 w-1/3">Max. Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[{ key: 'physics', label: 'Physics' }, { key: 'mathematics', label: 'Mathematics' }, { key: 'chemistry', label: 'Chemistry' }, { key: 'other', label: 'Biology / Statistics / CS' }].map(subject => (
                                        <tr key={subject.key}>
                                            <td className="px-4 py-2 text-sm text-slate-700 border border-slate-200 font-medium">{subject.label}</td>
                                            <td className="px-2 py-1 border border-slate-200">
                                                <input type="number" value={formData.subjectWiseMarks?.[subject.key]?.obtained || ''} onChange={e => updateSubjectMarks(subject.key, 'obtained', e.target.value)}
                                                    className="w-full px-3 py-1.5 text-center text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-sky-500 rounded" placeholder="—" />
                                            </td>
                                            <td className="px-2 py-1 border border-slate-200">
                                                <input type="number" value={formData.subjectWiseMarks?.[subject.key]?.max || ''} onChange={e => updateSubjectMarks(subject.key, 'max', e.target.value)}
                                                    className="w-full px-3 py-1.5 text-center text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-sky-500 rounded" placeholder="—" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Certificates */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Certificates to be Enclosed</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {CERTIFICATES.map(cert => (
                                <label key={cert} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={(formData.documents || []).includes(cert)} onChange={() => toggleDocument(cert)} className={checkboxClass} />
                                    <span className="text-sm text-slate-700">{cert}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* How did you know */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>How did you come to know about the College?</h2>
                        <div className="flex flex-wrap gap-3 mt-4">
                            {HOW_KNOW_OPTIONS.map(option => (
                                <label key={option} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${(Array.isArray(formData.howDidYouKnow) ? formData.howDidYouKnow : []).includes(option) ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                    <input type="checkbox" checked={(Array.isArray(formData.howDidYouKnow) ? formData.howDidYouKnow : []).includes(option)} onChange={() => toggleHowKnow(option)} className="sr-only" />
                                    {option}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Admission Year */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Admission Year *</h2>
                        <div className="mt-4 max-w-xs">
                            <Input type="number" label="Admission Year (Batch) *" value={formData.admissionYear || new Date().getFullYear()} onChange={e => updateField('admissionYear', parseInt(e.target.value))} min={2000} max={2100} required />
                            <p className="text-xs text-red-600 font-semibold mt-1">* Required field</p>
                        </div>
                    </div>

                    {/* Declarations */}
                    <div className="mb-6">
                        <h2 className={sectionTitle}>Declarations</h2>
                        <div className="space-y-4 mt-4">
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                <p className="text-sm text-amber-900 leading-relaxed mb-3">
                                    I hereby declare that the information given above are correct to the best of my knowledge and I am solely
                                    responsible for any discrepancy in the information provided above.
                                </p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={formData.applicantDeclaration} onChange={e => updateField('applicantDeclaration', e.target.checked)} className={checkboxClass} />
                                    <span className="text-sm font-semibold text-amber-800">I, the applicant, agree to the above declaration</span>
                                </label>
                            </div>
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                                <p className="text-sm text-blue-900 leading-relaxed mb-3">
                                    I endorse the information furnished by my son/daughter/ward and I ensure that he/she follows the rules &amp;
                                    regulations laid down by the institute.
                                </p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked={formData.parentDeclaration} onChange={e => updateField('parentDeclaration', e.target.checked)} className={checkboxClass} />
                                    <span className="text-sm font-semibold text-blue-800">I, the parent/guardian, agree to the above</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between pt-4 border-t border-slate-200">
                        <Button variant="outline" onClick={() => setStep(1)} leftIcon={ArrowLeft}>Back</Button>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handleSave} isLoading={updateMutation.isPending} leftIcon={Save}>
                                Save Draft
                            </Button>
                            <Button onClick={handleSubmit} isLoading={submitMutation.isPending} leftIcon={Send} className="bg-emerald-600 hover:bg-emerald-700">
                                Save &amp; Submit
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
