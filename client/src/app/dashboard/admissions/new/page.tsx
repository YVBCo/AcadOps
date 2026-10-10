'use client';

import { useState, useRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save, Download, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { admissionsApi, departmentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

// ─── Types (same as public apply page) ──────────────────────────
interface FieldValidation {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    exactLength?: number;
    pattern?: string;
    customError?: string;
}

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    section: string;
    order: number;
    options?: string[];
    placeholder?: string;
    helpText?: string;
    validation?: FieldValidation;
    width?: 'full' | 'half';
}

interface FormConfig {
    tenantId: number;
    tenantSlug: string;
    tenantType: string;
    collegeName: string;
    collegeAddress?: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    bgColor: string;
    formTitle: string;
    formFields: FormField[];
    departments: { id: number; name: string; code: string }[];
}

export default function NewAdmissionPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(0);
    const downloadAfterSave = useRef(false);

    // ─── Fetch form config dynamically ──────────────────────────
    const { data: formConfig, isLoading: configLoading, isError: configError, refetch: refetchConfig } = useQuery<FormConfig>({
        queryKey: ['admission-form-config', user?.tenantId, user?.id],
        queryFn: () => admissionsApi.getFormConfig(),
    });

    // Fetch departments as fallback for branch_select fields
    const { data: departments = [], isLoading: departmentsLoading, isError: departmentsError } = useQuery<{ id: number; name: string; code: string }[]>({
        queryKey: ['departments-opted', user?.tenantId],
        queryFn: () => departmentApi.getOpted(),
    });

    const [formData, setFormData] = useState<Record<string, any>>({ admissionYear: new Date().getFullYear() });

    // ─── Group fields by section, paginate into steps ───────────
    const sections = useMemo(() => {
        if (!formConfig) return [];
        const sorted = [...formConfig.formFields].sort((a, b) => a.order - b.order);
        const sectionMap = new Map<string, FormField[]>();
        sorted.forEach(f => {
            if (!sectionMap.has(f.section)) sectionMap.set(f.section, []);
            sectionMap.get(f.section)!.push(f);
        });
        return Array.from(sectionMap.entries()).map(([name, fields]) => ({ name, fields }));
    }, [formConfig]);

    // 2-3 sections per step
    const steps = useMemo(() => {
        const result: typeof sections[] = [];
        for (let i = 0; i < sections.length; i += 3) {
            result.push(sections.slice(i, i + 3));
        }
        return result.length > 0 ? result : [[]];
    }, [sections]);

    // ─── Field update helpers ───────────────────────────────────
    const updateField = (id: string, value: any) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    // ─── Form config required field validation ──────────────────
    const validateStepFields = (stepIndex: number): boolean => {
        const stepSections = steps[stepIndex] || [];
        const missing: string[] = [];
        for (const section of stepSections) {
            for (const field of section.fields) {
                if (field.required) {
                    const val = formData[field.id];
                    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                        missing.push(field.label);
                    }
                }
                // Inline validation checks
                if (field.validation && formData[field.id]) {
                    const v = String(formData[field.id]);
                    if (field.validation.exactLength && v.length !== field.validation.exactLength) {
                        missing.push(field.validation.customError || `${field.label} must be ${field.validation.exactLength} characters`);
                    }
                    if (field.validation.pattern && !new RegExp(field.validation.pattern).test(v)) {
                        missing.push(field.validation.customError || `${field.label} format is invalid`);
                    }
                }
            }
        }
        if (missing.length > 0) {
            toast.error(`Please fill required fields: ${missing.join(', ')}`);
            return false;
        }
        return true;
    };

    const validateAllFields = (): boolean => {
        const missing: string[] = [];
        if (!formConfig) return false;
        for (const field of formConfig.formFields) {
            if (field.required) {
                const val = formData[field.id];
                if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                    missing.push(field.label);
                }
            }
        }
        if (!formData.admissionYear) {
            missing.push('Admission Year');
        }
        if (missing.length > 0) {
            toast.error(`Missing required fields: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`);
            // Navigate to the first step with a missing field
            if (formConfig) {
                for (let i = 0; i < steps.length; i++) {
                    for (const section of steps[i]) {
                        for (const field of section.fields) {
                            if (field.required && (!formData[field.id] || formData[field.id] === '')) {
                                setStep(i);
                                return false;
                            }
                        }
                    }
                }
            }
            return false;
        }
        return true;
    };

    // ─── Submit mutation ────────────────────────────────────────
    const createMutation = useMutation({
        mutationFn: (data: Record<string, any>) => admissionsApi.create(data),
        onSuccess: (result: any) => {
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['admissions-stats'] });
            if (downloadAfterSave.current && result?.id) {
                toast.success('Admission saved! Opening printable view...');
                router.push(`/dashboard/admissions/applications/${result.id}/print`);
            } else {
                toast.success('Admission saved successfully!');
                router.push('/dashboard/admissions/applications');
            }
            downloadAfterSave.current = false;
        },
        onError: (err: any) => {
            const details = err.response?.data?.details;
            const detailMessage = Array.isArray(details)
                ? details.slice(0, 3).map((issue: { field?: string; message?: string }) => `${issue.field || 'Form'}: ${issue.message || 'Invalid value'}`).join('; ')
                : '';
            toast.error(detailMessage || err.response?.data?.error || 'Failed to create admission');
            downloadAfterSave.current = false;
        },
    });

    // ─── Prepare payload ────────────────────────────────────────
    const prepareSubmitData = () => {
        // Validate ALL required fields from form config
        if (!validateAllFields()) return null;

        if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
            toast.error('Aadhaar number must be exactly 12 digits');
            return null;
        }

        // Build payload
        const payload: Record<string, any> = {
            ...formData,
            formData: { ...formData },
        };

        // Handle nested structures for backward compat
        if (formData.permanentAddress || formData.permanentState || formData.permanentPin) {
            payload.permanentAddress = {
                address: formData.permanentAddress || '',
                state: formData.permanentState || '',
                pin: formData.permanentPin || '',
            };
        }
        if (formData.localAddress || formData.localState || formData.localPin) {
            payload.localAddress = {
                address: formData.localAddress || '',
                state: formData.localState || '',
                pin: formData.localPin || '',
            };
        }
        if (formData.fatherName || formData.fatherMobile) {
            payload.fatherDetails = {
                name: formData.fatherName || '',
                mobile: formData.fatherMobile || '',
                email: formData.fatherEmail || '',
                occupation: formData.fatherOccupation || '',
                annualIncome: formData.fatherIncome || '',
            };
        }
        if (formData.motherName || formData.motherMobile) {
            payload.motherDetails = {
                name: formData.motherName || '',
                mobile: formData.motherMobile || '',
                email: formData.motherEmail || '',
                occupation: formData.motherOccupation || '',
                annualIncome: formData.motherIncome || '',
            };
        }
        if (payload.speciallyAbled !== undefined) payload.speciallyAbled = payload.speciallyAbled === 'Yes' || payload.speciallyAbled === true;
        if (payload.hostel !== undefined) payload.hostel = payload.hostel === 'Yes' || payload.hostel === true;
        if (payload.applicantDeclaration) payload.applicantDeclaration = true;
        if (payload.parentDeclaration) payload.parentDeclaration = true;

        // Convert howDidYouKnow array to string if present
        if (Array.isArray(payload.howDidYouKnow)) {
            payload.howDidYouKnow = payload.howDidYouKnow.join(', ');
        }

        return payload;
    };

    const handleSave = () => {
        if (createMutation.isPending) return; // Prevent duplicate submissions
        const data = prepareSubmitData();
        if (!data) return;
        downloadAfterSave.current = false;
        createMutation.mutate(data);
    };

    const handleSaveAndDownload = () => {
        if (createMutation.isPending) return; // Prevent duplicate submissions
        const data = prepareSubmitData();
        if (!data) return;
        downloadAfterSave.current = true;
        createMutation.mutate(data);
    };

    // ─── Shared styles ──────────────────────────────────────────
    const sectionTitle = "text-sm font-bold text-slate-800 uppercase tracking-wide bg-slate-100 px-4 py-2 rounded-lg border border-slate-200";
    const fieldLabel = "block text-xs font-semibold text-slate-600 mb-1";
    const selectClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors";
    const checkboxClass = "w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500";
    const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors";

    // ─── Dynamic field renderer ─────────────────────────────────
    const renderField = (field: FormField) => {
        const value = formData[field.id] ?? '';
        const depts = formConfig?.departments || departments;

        switch (field.type) {
            case 'text':
            case 'email':
            case 'number':
            case 'date':
                return (
                    <div key={field.id} className={field.width === 'full' ? 'md:col-span-3' : ''}>
                        <Input
                            id={field.id}
                            label={`${field.label}${field.required ? ' *' : ''}`}
                            type={field.type}
                            value={value}
                            onChange={e => updateField(field.id, e.target.value)}
                            onBlur={e => {
                                if (field.type === 'date') updateField(field.id, e.currentTarget.value);
                            }}
                            placeholder={field.placeholder || ''}
                            maxLength={field.validation?.maxLength || field.validation?.exactLength}
                            min={field.validation?.minValue}
                            max={field.validation?.maxValue}
                        />
                        {field.helpText && <p className="text-[11px] text-slate-400 mt-1 italic">{field.helpText}</p>}
                    </div>
                );

            case 'phone':
                return (
                    <div key={field.id}>
                        <Input
                            label={`${field.label}${field.required ? ' *' : ''}`}
                            type="tel"
                            value={value}
                            onChange={e => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, field.validation?.exactLength || 10);
                                updateField(field.id, val);
                            }}
                            placeholder={field.placeholder || ''}
                            maxLength={field.validation?.exactLength || 10}
                        />
                        {field.helpText && <p className="text-[11px] text-slate-400 mt-1 italic">{field.helpText}</p>}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.id} className={field.width === 'full' ? 'md:col-span-3' : ''}>
                        <label className={fieldLabel}>{field.label}{field.required && ' *'}</label>
                        <textarea
                            value={value}
                            onChange={e => updateField(field.id, e.target.value)}
                            placeholder={field.placeholder || ''}
                            rows={3}
                            maxLength={field.validation?.maxLength}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        />
                        {field.validation?.maxLength && (
                            <p className="text-[11px] text-slate-400 text-right mt-0.5">{String(value).length}/{field.validation.maxLength}</p>
                        )}
                    </div>
                );

            case 'select':
                return (
                    <div key={field.id}>
                        <label className={fieldLabel}>{field.label}{field.required && ' *'}</label>
                        <select value={value} onChange={e => updateField(field.id, e.target.value)} className={selectClass}>
                            <option value="">{field.placeholder || 'Select...'}</option>
                            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                );

            case 'radio':
                return (
                    <div key={field.id}>
                        <label className={fieldLabel}>{field.label}{field.required && ' *'}</label>
                        <div className="flex gap-4 pt-1">
                            {(field.options || []).map(opt => (
                                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={field.id}
                                        value={opt}
                                        checked={value === opt}
                                        onChange={e => updateField(field.id, e.target.value)}
                                        className="w-4 h-4 text-sky-600 border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'multiselect':
                return (
                    <div key={field.id} className="md:col-span-3">
                        <label className={fieldLabel}>{field.label}{field.required && ' *'}</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {(field.options || []).map(opt => {
                                const arr = Array.isArray(value) ? value : [];
                                const selected = arr.includes(opt);
                                return (
                                    <label
                                        key={opt}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${selected
                                            ? 'bg-sky-50 border-sky-300 text-sky-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            onChange={() => {
                                                if (selected) {
                                                    updateField(field.id, arr.filter(v => v !== opt));
                                                } else {
                                                    updateField(field.id, [...arr, opt]);
                                                }
                                            }}
                                            className="sr-only"
                                        />
                                        {opt}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'branch_select':
                return (
                    <div key={field.id} className="md:col-span-3">
                        <label className={fieldLabel}>{field.label}{field.required && ' *'}</label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {depts.map(dept => (
                                <label
                                    key={dept.id}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${value === dept.name
                                        ? 'bg-sky-50 border-sky-400 text-sky-700 ring-2 ring-sky-200'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name={field.id}
                                        value={dept.name}
                                        checked={value === dept.name}
                                        onChange={e => updateField(field.id, e.target.value)}
                                        className="sr-only"
                                    />
                                    {dept.name}
                                </label>
                            ))}
                        </div>
                        {!departmentsLoading && depts.length === 0 && (
                            <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {departmentsError
                                    ? 'Branch options could not be loaded. Refresh the page or contact your administrator.'
                                    : 'No admissions branches are configured for this tenant yet. A Super Admin must create a non-cycle department before applications can be submitted.'}
                            </p>
                        )}
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={field.id} className={field.width === 'full' ? 'md:col-span-3' : ''}>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={!!value}
                                onChange={e => updateField(field.id, e.target.checked)}
                                className={checkboxClass}
                            />
                            <span className="text-sm text-slate-700">
                                {field.label}{field.required && ' *'}
                            </span>
                        </label>
                        {field.helpText && <p className="text-[11px] text-slate-400 mt-1 ml-7 italic">{field.helpText}</p>}
                    </div>
                );

            default:
                return (
                    <div key={field.id}>
                        <Input
                            label={field.label}
                            value={value}
                            onChange={e => updateField(field.id, e.target.value)}
                            placeholder={field.placeholder || ''}
                        />
                    </div>
                );
        }
    };

    // ─── Loading state ──────────────────────────────────────────
    if (configLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
                    <p className="text-sm text-slate-500">Loading form configuration...</p>
                </div>
            </div>
        );
    }

    if (configError) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-slate-700">Could not load the admission form</p>
                    <p className="text-sm text-slate-500">Check your connection and try again. If the problem continues, contact your admissions administrator.</p>
                    <Button onClick={() => refetchConfig()}>Try Again</Button>
                </div>
            </div>
        );
    }

    if (!formConfig || !formConfig.formFields?.length) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-slate-700">No Form Configuration</p>
                    <p className="text-sm text-slate-500">Please configure the admission form fields in Form Config first.</p>
                    <Button onClick={() => router.push('/dashboard/admissions/form-config')}>
                        Go to Form Config
                    </Button>
                </div>
            </div>
        );
    }

    const currentStepSections = steps[step] || [];
    const isLastStep = step === steps.length - 1;
    const totalSteps = steps.length;

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors z-10">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                {formConfig.logoUrl && (
                    <img src={formConfig.logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
                )}
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-slate-800">
                        {formConfig.formTitle || 'New Admission Application'}
                    </h1>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                        {formConfig.collegeName} {formConfig.collegeAddress && ` · ${formConfig.collegeAddress}`}
                    </p>
                    <p className="text-[11px] text-sky-600 font-medium mt-0.5">
                        Step {step + 1} of {totalSteps}
                    </p>
                </div>
            </div>

            {/* Step indicators */}
            <div className="flex gap-2">
                {steps.map((_, i) => (
                    <div key={i} className="flex-1 relative">
                        <div className={`h-2 rounded-full transition-colors ${i <= step ? 'bg-sky-500' : 'bg-slate-200'}`} />
                        {i < steps.length && currentStepSections[0] && i === step && (
                            <span className="text-[10px] text-slate-500 mt-1 block">
                                {steps[i]?.map(s => s.name).join(' & ')}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* ========== DYNAMIC FORM SECTIONS ========== */}
            <Card key={`step-${step}`}>

                {currentStepSections.map(section => (
                    <div key={section.name} className="mb-6">
                        <h2 className={sectionTitle}>{section.name}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {section.fields.map(f => renderField(f))}
                        </div>
                    </div>
                ))}

                {/* ─── Admission Year (shown only on the last step) ─── */}
                {isLastStep && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <h2 className={sectionTitle}>Admission Year *</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div>
                                <label className={fieldLabel}>Select Admission Year *</label>
                                <select
                                    value={formData.admissionYear || new Date().getFullYear()}
                                    onChange={e => updateField('admissionYear', parseInt(e.target.value))}
                                    className={selectClass}
                                    required
                                >
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-red-500 mt-1 font-semibold">* This field is mandatory</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t border-slate-200">
                    {step > 0 ? (
                        <Button variant="outline" onClick={() => setStep(s => s - 1)} leftIcon={ArrowLeft}>
                            Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    {isLastStep ? (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleSave}
                                isLoading={createMutation.isPending && !downloadAfterSave.current}
                                disabled={createMutation.isPending}
                                leftIcon={Save}
                            >
                                Save Only
                            </Button>
                            <Button
                                onClick={handleSaveAndDownload}
                                isLoading={createMutation.isPending && downloadAfterSave.current}
                                disabled={createMutation.isPending}
                                leftIcon={Download}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Save & Download PDF
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => { if (validateStepFields(step)) setStep(s => s + 1); }} rightIcon={ArrowRight}>
                            Next
                        </Button>
                    )}
                </div>
            </Card>
        </div>
    );
}
