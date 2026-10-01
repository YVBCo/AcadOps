'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { GraduationCap, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/lib/config';

const API_BASE = API_URL;

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
    width?: string;
    validation?: {
        minLength?: number;
        maxLength?: number;
        exactLength?: number;
        pattern?: string;
        customError?: string;
    };
}

interface FormConfig {
    tenantId: number;
    tenantSlug: string;
    collegeName: string;
    collegeAddress?: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    bgColor: string;
    formTitle: string;
    formFields: FormField[];
    departments: { id: number; name: string; code: string }[];
}

export default function TenantApplyPage() {
    const params = useParams();
    const slug = params.slug as string;

    const [config, setConfig] = useState<FormConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [admissionId, setAdmissionId] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get(`${API_BASE}/admissions/public/form-config/${slug}`);
                setConfig(res.data);
            } catch (err: unknown) {
                if (axios.isAxiosError(err) && err.response?.status === 403) {
                    setError('Applications are currently closed for this institution.');
                } else if (axios.isAxiosError(err) && err.response?.status === 404) {
                    setError('Institution not found.');
                } else {
                    setError('Failed to load application form. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };
        if (slug) fetchConfig();
    }, [slug]);

    // Group fields by section
    const sections = config?.formFields
        ? Array.from(new Set(config.formFields.map(f => f.section)))
        : [];

    const getFieldsForSection = useCallback((section: string) => {
        return (config?.formFields || [])
            .filter(f => f.section === section)
            .sort((a, b) => a.order - b.order);
    }, [config]);

    const handleFieldChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        // Clear validation error when field is filled
        if (validationErrors[fieldId]) {
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[fieldId];
                return next;
            });
        }
    };

    const validateCurrentStep = useCallback((): boolean => {
        if (!config) return false;
        const currentSection = sections[currentStep];
        const fields = getFieldsForSection(currentSection);
        const errors: Record<string, string> = {};

        for (const field of fields) {
            if (field.required) {
                const value = formData[field.id];
                if (!value || value.trim() === '') {
                    errors[field.id] = `${field.label} is required`;
                }
            }
            // Validation rules
            if (field.validation && formData[field.id]) {
                const val = formData[field.id];
                if (field.validation.exactLength && val.length !== field.validation.exactLength) {
                    errors[field.id] = field.validation.customError || `${field.label} must be exactly ${field.validation.exactLength} characters`;
                }
                if (field.validation.pattern) {
                    const regex = new RegExp(field.validation.pattern);
                    if (!regex.test(val)) {
                        errors[field.id] = field.validation.customError || `${field.label} format is invalid`;
                    }
                }
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [config, currentStep, formData, getFieldsForSection, sections]);

    const handleNext = () => {
        if (validateCurrentStep()) {
            setCurrentStep(prev => Math.min(prev + 1, sections.length - 1));
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const validateAllSteps = useCallback((): boolean => {
        if (!config) return false;
        const allErrors: Record<string, string> = {};

        for (const field of config.formFields) {
            if (field.required) {
                const value = formData[field.id];
                if (!value || value.trim() === '') {
                    allErrors[field.id] = `${field.label} is required`;
                }
            }
        }

        setValidationErrors(allErrors);
        if (Object.keys(allErrors).length > 0) {
            // Navigate to the first section with errors
            const firstErrorField = config.formFields.find(f => allErrors[f.id]);
            if (firstErrorField) {
                const sectionIndex = sections.indexOf(firstErrorField.section);
                if (sectionIndex >= 0) setCurrentStep(sectionIndex);
            }
        }
        return Object.keys(allErrors).length === 0;
    }, [config, formData, sections]);

    const handleSubmit = async () => {
        if (!validateAllSteps() || !config) return;

        setSubmitting(true);
        try {
            // Build the payload matching the createAdmission schema
            const payload: Record<string, unknown> = {
                applicantName: formData.applicantName || '',
                admissionYear: new Date().getFullYear(),
                formData: { ...formData },
            };

            // Map known field IDs to top-level properties
            const directFields = [
                'applyingThrough', 'gender', 'bloodGroup', 'nationality', 'religion',
                'category', 'subCaste', 'motherTongue', 'aadhaarNumber', 'emailId',
                'mobileNumber', 'pickupPlace', 'branchSelection', 'cetRollNo', 'cetRank',
                'comedkRollNo', 'comedkRank', 'howDidYouKnow',
            ];
            for (const key of directFields) {
                if (formData[key]) payload[key] = formData[key];
            }

            // Boolean fields
            if (formData.speciallyAbled) payload.speciallyAbled = formData.speciallyAbled === 'Yes';
            if (formData.hostel) payload.hostel = formData.hostel === 'Yes';

            // Date fields
            if (formData.dateOfBirth) payload.dateOfBirth = new Date(formData.dateOfBirth).toISOString();

            // Address objects
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

            // Parent details
            if (formData.fatherName || formData.fatherMobile) {
                payload.fatherDetails = {
                    name: formData.fatherName || '',
                    email: formData.fatherEmail || '',
                    mobile: formData.fatherMobile || '',
                    occupation: formData.fatherOccupation || '',
                    annualIncome: formData.fatherIncome || '',
                };
            }
            if (formData.motherName || formData.motherMobile) {
                payload.motherDetails = {
                    name: formData.motherName || '',
                    email: formData.motherEmail || '',
                    mobile: formData.motherMobile || '',
                    occupation: formData.motherOccupation || '',
                    annualIncome: formData.motherIncome || '',
                };
            }

            // SSLC / PUC details
            if (formData.sslcRegisterNo || formData.sslcSchoolName || formData.sslcPercentage) {
                payload.sslcDetails = {
                    registerNo: formData.sslcRegisterNo || '',
                    schoolName: formData.sslcSchoolName || '',
                    percentage: formData.sslcPercentage || '',
                    yearOfPassing: formData.sslcYearOfPassing || '',
                };
            }
            if (formData.pucRegisterNo || formData.pucCollegeName || formData.pucPercentage) {
                payload.pucDetails = {
                    registerNo: formData.pucRegisterNo || '',
                    collegeName: formData.pucCollegeName || '',
                    percentage: formData.pucPercentage || '',
                    yearOfPassing: formData.pucYearOfPassing || '',
                };
            }

            const res = await axios.post(`${API_BASE}/admissions/public/apply/${slug}`, payload);
            setAdmissionId(res.data.admissionId);
            setSubmitted(true);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to submit application. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Loading
    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#6366f1' }} />
                    <p style={{ marginTop: '16px', color: '#64748b' }}>Loading application form...</p>
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Error or closed
    if (error && !config) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '16px' }}>
                <div style={{ maxWidth: '480px', width: '100%', background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', padding: '48px 40px', textAlign: 'center' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
                    }}>
                        <AlertCircle style={{ width: '36px', height: '36px', color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                        {error}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6 }}>
                        Please contact the institution&apos;s admission office directly for assistance.
                    </p>
                </div>
            </div>
        );
    }

    // Success
    if (submitted && admissionId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: '16px' }}>
                <div style={{ maxWidth: '520px', width: '100%', background: '#fff', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.08)', padding: '48px 40px', textAlign: 'center' }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.3)',
                    }}>
                        <CheckCircle style={{ width: '40px', height: '40px', color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                        Application Submitted!
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
                        Your application has been submitted successfully.
                    </p>
                    <div style={{
                        background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '12px',
                        padding: '20px', marginBottom: '16px',
                    }}>
                        <p style={{ color: '#15803d', fontSize: '14px', marginBottom: '4px' }}>Your Application ID</p>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: '#166534', letterSpacing: '1px' }}>
                            {admissionId}
                        </p>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                        Please save this ID for future reference. The institution will review your application.
                    </p>
                </div>
            </div>
        );
    }

    if (!config) return null;

    const currentSection = sections[currentStep];
    const currentFields = getFieldsForSection(currentSection);
    const primaryColor = config.primaryColor || '#6366f1';

    return (
        <div style={{ minHeight: '100vh', background: config.bgColor || '#f1f5f9' }}>
            {/* Header */}
            <div style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${config.secondaryColor || '#4f46e5'})`,
                color: '#fff', padding: '24px 16px', position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
                {config.logoUrl && (
                    <div style={{
                        position: 'absolute',
                        left: '24px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                    }} className="hidden md:block">
                        <img src={config.logoUrl} alt="Logo" style={{ height: '60px' }} />
                    </div>
                )}
                
                {/* Mobile Logo */}
                {config.logoUrl && (
                    <div className="block md:hidden mb-3">
                        <img src={config.logoUrl} alt="Logo" style={{ height: '50px' }} />
                    </div>
                )}

                <div style={{ textAlign: 'center', paddingLeft: '16px', paddingRight: '16px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>
                        {config.collegeName}
                    </h1>
                    {config.collegeAddress && (
                        <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px', fontWeight: 400, maxWidth: '600px', margin: '4px auto 0' }}>
                            {config.collegeAddress}
                        </p>
                    )}
                    <p style={{ fontSize: '15px', opacity: 0.95, marginTop: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {config.formTitle}
                    </p>
                </div>
            </div>

            {/* Progress Steps */}
            <div style={{
                maxWidth: '800px', margin: '0 auto', padding: '20px 16px 0',
                display: 'flex', gap: '4px', overflowX: 'auto',
            }}>
                {sections.map((s, i) => (
                    <button
                        key={s}
                        onClick={() => { if (i < currentStep) setCurrentStep(i); }}
                        style={{
                            flex: 1, minWidth: '80px', padding: '8px 4px',
                            background: i === currentStep ? primaryColor : i < currentStep ? '#22c55e' : '#e2e8f0',
                            color: i <= currentStep ? '#fff' : '#64748b',
                            border: 'none', borderRadius: '8px', cursor: i < currentStep ? 'pointer' : 'default',
                            fontSize: '11px', fontWeight: 600, transition: 'all 0.2s',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                    >
                        {i + 1}. {s}
                    </button>
                ))}
            </div>

            {/* Form */}
            <div style={{ maxWidth: '800px', margin: '20px auto', padding: '0 16px 40px' }}>
                <div style={{
                    background: '#fff', borderRadius: '16px', padding: '32px 28px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '24px' }}>
                        {currentSection}
                    </h2>

                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
                            padding: '12px 16px', marginBottom: '20px', color: '#dc2626', fontSize: '14px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                        {currentFields.map(field => (
                            <div key={field.id} style={{ gridColumn: field.width === 'full' ? 'span 2' : 'span 1' }}>
                                <FieldRenderer
                                    field={field}
                                    value={formData[field.id] || ''}
                                    onChange={(val) => handleFieldChange(field.id, val)}
                                    error={validationErrors[field.id]}
                                    departments={config.departments}
                                    primaryColor={primaryColor}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', gap: '12px' }}>
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            style={{
                                padding: '12px 24px', borderRadius: '10px', border: '1px solid #e2e8f0',
                                background: currentStep === 0 ? '#f1f5f9' : '#fff',
                                color: currentStep === 0 ? '#cbd5e1' : '#475569',
                                fontWeight: 600, fontSize: '14px', cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            <ChevronLeft size={18} /> Previous
                        </button>

                        {currentStep < sections.length - 1 ? (
                            <button
                                onClick={handleNext}
                                style={{
                                    padding: '12px 28px', borderRadius: '10px', border: 'none',
                                    background: primaryColor, color: '#fff',
                                    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: `0 4px 12px ${primaryColor}40`,
                                }}
                            >
                                Next <ChevronRight size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                style={{
                                    padding: '12px 28px', borderRadius: '10px', border: 'none',
                                    background: submitting ? '#94a3b8' : '#22c55e', color: '#fff',
                                    fontWeight: 600, fontSize: '14px', cursor: submitting ? 'wait' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                                }}
                            >
                                {submitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
                                {submitting ? 'Submitting...' : 'Submit Application'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

/* ===== Field Renderer ===== */

function FieldRenderer({
    field, value, onChange, error, departments, primaryColor,
}: {
    field: FormField;
    value: string;
    onChange: (val: string) => void;
    error?: string;
    departments: { id: number; name: string; code: string }[];
    primaryColor: string;
}) {
    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '13px', fontWeight: 600,
        color: '#334155', marginBottom: '6px',
    };
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: error ? '2px solid #ef4444' : '1px solid #e2e8f0',
        fontSize: '14px', color: '#0f172a', outline: 'none',
        transition: 'border-color 0.2s',
        background: '#fff', boxSizing: 'border-box',
    };

    return (
        <div>
            <label style={labelStyle}>
                {field.label}
                {field.required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
            </label>

            {field.type === 'text' || field.type === 'email' || field.type === 'phone' ? (
                <input
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    style={inputStyle}
                />
            ) : field.type === 'date' ? (
                <input
                    type="date"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    style={inputStyle}
                />
            ) : field.type === 'textarea' ? (
                <textarea
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                />
            ) : field.type === 'select' ? (
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    style={inputStyle}
                >
                    <option value="">Select...</option>
                    {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : field.type === 'radio' ? (
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '6px 0' }}>
                    {(field.options || []).map(opt => (
                        <label key={opt} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            cursor: 'pointer', fontSize: '14px', color: '#334155',
                        }}>
                            <input
                                type="radio"
                                name={field.id}
                                value={opt}
                                checked={value === opt}
                                onChange={() => onChange(opt)}
                                style={{ accentColor: primaryColor }}
                            />
                            {opt}
                        </label>
                    ))}
                </div>
            ) : field.type === 'branch_select' ? (
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    style={inputStyle}
                >
                    <option value="">Select Branch...</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name} ({dept.code})</option>
                    ))}
                </select>
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={field.placeholder || ''}
                    style={inputStyle}
                />
            )}

            {field.helpText && !error && (
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{field.helpText}</p>
            )}
            {error && (
                <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: 500 }}>{error}</p>
            )}
        </div>
    );
}
