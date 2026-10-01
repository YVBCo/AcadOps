'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admissionsApi } from '@/lib/api';

/* ================================================================
   Types
   ================================================================ */
interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    section: string;
    order: number;
    options?: string[];
}

interface FormConfig {
    collegeName?: string;
    collegeAddress?: string;
    logoUrl?: string;
    logoData?: string;
    primaryColor?: string;
    formTitle?: string;
    formFields: FormField[];
}

/* ================================================================
   Mapping helpers — resolve a field ID to its display value from
   both the flat formData JSON and the top-level admission columns.
   ================================================================ */

// Field IDs that map to nested JSON columns
const ADDRESS_FIELDS: Record<string, { column: string; subKey: string }> = {
    permanentAddress: { column: 'permanentAddress', subKey: 'address' },
    permanentState:   { column: 'permanentAddress', subKey: 'state' },
    permanentPin:     { column: 'permanentAddress', subKey: 'pin' },
    localAddress:     { column: 'localAddress', subKey: 'address' },
    localState:       { column: 'localAddress', subKey: 'state' },
    localPin:         { column: 'localAddress', subKey: 'pin' },
};

const PARENT_FIELDS: Record<string, { column: string; subKey: string }> = {
    fatherName:       { column: 'fatherDetails', subKey: 'name' },
    fatherMobile:     { column: 'fatherDetails', subKey: 'mobile' },
    fatherEmail:      { column: 'fatherDetails', subKey: 'email' },
    fatherOccupation: { column: 'fatherDetails', subKey: 'occupation' },
    fatherIncome:     { column: 'fatherDetails', subKey: 'annualIncome' },
    motherName:       { column: 'motherDetails', subKey: 'name' },
    motherMobile:     { column: 'motherDetails', subKey: 'mobile' },
    motherEmail:      { column: 'motherDetails', subKey: 'email' },
    motherOccupation: { column: 'motherDetails', subKey: 'occupation' },
    motherIncome:     { column: 'motherDetails', subKey: 'annualIncome' },
};

const SSLC_FIELDS: Record<string, string> = {
    sslcRegisterNo:    'registerNo',
    sslcSchoolName:    'schoolName',
    sslcPercentage:    'percentage',
    sslcYearOfPassing: 'yearOfPassing',
    sslcMedium:        'medium',
    sslcMarks:         'marks',
    sslcMaxMarks:      'maxMarks',
    sslcBoard:         'board',
};

const PUC_FIELDS: Record<string, string> = {
    pucRegisterNo:    'registerNo',
    pucCollegeName:   'collegeName',
    pucPercentage:    'percentage',
    pucYearOfPassing: 'yearOfPassing',
    pucMedium:        'medium',
    pucMarks:         'marks',
    pucMaxMarks:      'maxMarks',
    pucBoard:         'board',
};

function resolveFieldValue(fieldId: string, admission: Record<string, any>): string {
    const formData = (admission.formData || {}) as Record<string, unknown>;

    // 1. Try formData first (dynamic)
    const fdVal = formData[fieldId];
    if (fdVal !== undefined && fdVal !== null && fdVal !== '') {
        if (typeof fdVal === 'boolean') return fdVal ? 'Yes' : 'No';
        if (Array.isArray(fdVal)) return fdVal.join(', ');
        return String(fdVal);
    }

    // 2. Address fields → nested JSON
    if (ADDRESS_FIELDS[fieldId]) {
        const { column, subKey } = ADDRESS_FIELDS[fieldId];
        const obj = admission[column];
        if (obj && typeof obj === 'object') return String(obj[subKey] || '');
        return '';
    }

    // 3. Parent fields → nested JSON
    if (PARENT_FIELDS[fieldId]) {
        const { column, subKey } = PARENT_FIELDS[fieldId];
        const obj = admission[column];
        if (obj && typeof obj === 'object') return String(obj[subKey] || '');
        return '';
    }

    // 4. SSLC fields → nested JSON
    if (SSLC_FIELDS[fieldId]) {
        const obj = admission.sslcDetails;
        if (obj && typeof obj === 'object') return String(obj[SSLC_FIELDS[fieldId]] || '');
        return '';
    }

    // 5. PUC fields → nested JSON
    if (PUC_FIELDS[fieldId]) {
        const obj = admission.pucDetails;
        if (obj && typeof obj === 'object') return String(obj[PUC_FIELDS[fieldId]] || '');
        return '';
    }

    // 6. Top-level columns (direct match)
    const topVal = admission[fieldId];
    if (topVal !== undefined && topVal !== null && topVal !== '') {
        if (typeof topVal === 'boolean') return topVal ? 'Yes' : 'No';
        if (topVal instanceof Date || (typeof topVal === 'string' && fieldId.toLowerCase().includes('date'))) {
            try { return new Date(String(topVal)).toLocaleDateString('en-IN'); } catch { return String(topVal); }
        }
        return String(topVal);
    }

    return '';
}

/* ================================================================
   Component
   ================================================================ */
export default function PrintAdmissionPage() {
    const params = useParams();
    const router = useRouter();
    const admissionId = Number(params.id);

    const { data: admission, isLoading } = useQuery({
        queryKey: ['admission', admissionId],
        queryFn: () => admissionsApi.getById(admissionId),
        enabled: !!admissionId,
    });

    const { data: formConfig } = useQuery<FormConfig>({
        queryKey: ['admission-form-config'],
        queryFn: () => admissionsApi.getFormConfig(),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
            </div>
        );
    }

    if (!admission) {
        return <div className="text-center py-12 text-slate-500">Admission not found</div>;
    }

    const d = admission as Record<string, any>;
    const handlePrint = () => window.print();
    const admYear = d.admissionYear || new Date().getFullYear();

    // College info from form config
    const collegeName = formConfig?.collegeName || 'Institution';
    const collegeAddress = formConfig?.collegeAddress || '';
    const logoUrl = formConfig?.logoData || formConfig?.logoUrl || '';
    const headerColor = formConfig?.primaryColor || '#1e3a5f';

    // Group fields by section, preserving order
    const fields = formConfig?.formFields || [];
    const sectionMap = new Map<string, FormField[]>();
    for (const f of fields) {
        const section = f.section || 'Other';
        if (!sectionMap.has(section)) sectionMap.set(section, []);
        sectionMap.get(section)!.push(f);
    }
    // Sort within each section by order
    for (const arr of sectionMap.values()) {
        arr.sort((a, b) => a.order - b.order);
    }
    const sections = Array.from(sectionMap.entries());

    // Split sections roughly in half for 2-page layout
    const midpoint = Math.ceil(sections.length / 2);
    const page1Sections = sections.slice(0, midpoint);
    const page2Sections = sections.slice(midpoint);

    // Section colors (cycle through)
    const sectionColors = ['#0c4a6e', '#155e75', '#164e63', '#1e3a5f', '#7c2d12', '#065f46', '#4338ca', '#92400e', '#6b21a8', '#be123c'];

    return (
        <>
            {/* Print-only Styles */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #printable-form, #printable-form * { visibility: visible !important; }
                    #printable-form {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        font-size: 9px;
                        line-height: 1.3;
                    }
                    .no-print { display: none !important; }
                    .section-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .page-1, .page-2 {
                        page-break-after: always;
                        page-break-inside: avoid;
                        min-height: 100vh;
                        box-sizing: border-box;
                    }
                    .page-2 { page-break-after: auto; }
                    @page {
                        margin: 5mm;
                        size: A4;
                    }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; }
                }
            `}</style>

            {/* Action Bar (hidden during print) */}
            <div className="no-print flex items-center gap-4 mb-6 max-w-4xl mx-auto">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-slate-800">Print Application — {d.admissionId}</h1>
                    <p className="text-sm text-slate-500">{d.applicantName} • 2-page printable format (front &amp; back)</p>
                </div>
                <Button leftIcon={Printer} onClick={handlePrint}>
                    Print / Download PDF
                </Button>
            </div>

            {/* ==================== PRINTABLE FORM ==================== */}
            <div id="printable-form" className="max-w-4xl mx-auto bg-white border border-slate-300 shadow-sm overflow-hidden" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10px' }}>

                {/* ═══════════════════ PAGE 1 (FRONT) ═══════════════════ */}
                <div className="page-1">

                    {/* ===== HEADER (from Form Config) ===== */}
                    <div style={{ background: `linear-gradient(135deg, ${headerColor} 0%, ${lightenColor(headerColor, 20)} 100%)`, color: 'white', textAlign: 'center', padding: '10px 16px', position: 'relative' }}>
                        {/* Logo in top-left */}
                        {logoUrl && (
                            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                                <img
                                    src={logoUrl}
                                    alt="Logo"
                                    style={{ maxHeight: '50px', maxWidth: '50px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.9)', padding: '2px' }}
                                />
                            </div>
                        )}
                        <h1 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.5px', margin: 0 }}>
                            {collegeName.toUpperCase()}
                        </h1>
                        {collegeAddress && (
                            <p style={{ fontSize: '8px', marginTop: '2px', opacity: 0.85 }}>
                                {collegeAddress}
                            </p>
                        )}
                        <div style={{ marginTop: '4px', background: 'rgba(255,255,255,0.15)', display: 'inline-block', padding: '2px 14px', borderRadius: '3px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>
                                {formConfig?.formTitle || `APPLICATION FORM ${admYear} - ${admYear + 4}`}
                            </span>
                        </div>
                    </div>

                    {/* USN & Admission No Bar */}
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                            <tr>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <strong>USN:</strong> {d.studentProfile?.temporaryUsn || d.studentProfile?.permanentUsn || '____________________'}
                                </td>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <strong>Admission No:</strong> {d.admissionId || '____________________'}
                                </td>
                                <td style={{ padding: '4px 10px', borderBottom: '1px solid #cbd5e1', fontSize: '10px' }}>
                                    <strong>Admission Year:</strong> {admYear}
                                </td>
                                <td style={{ padding: '3px 10px', borderBottom: '1px solid #cbd5e1', width: '70px', textAlign: 'center' }}>
                                    <div style={{ border: '1px solid #94a3b8', width: '60px', height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '8px' }}>
                                        Photo
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Dynamic Sections — Page 1 */}
                    {page1Sections.map(([sectionName, sectionFields], sIdx) => (
                        <div key={sectionName}>
                            <SectionHeader title={`${sIdx + 1}. ${sectionName}`} color={sectionColors[sIdx % sectionColors.length]} />
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {renderSectionRows(sectionFields, d)}
                                </tbody>
                            </table>
                        </div>
                    ))}

                </div>{/* END PAGE 1 */}

                {/* ═══════════════════ PAGE 2 (BACK) ═══════════════════ */}
                <div className="page-2">

                    {/* Mini Header for Page 2 */}
                    <div style={{ background: headerColor, color: 'white', padding: '4px 12px', fontSize: '9px', display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{collegeName}</strong> — Admission Application (Page 2)</span>
                        <span>Admission No: <strong>{d.admissionId}</strong> | Year: <strong>{admYear}</strong></span>
                    </div>

                    {/* Dynamic Sections — Page 2 */}
                    {page2Sections.map(([sectionName, sectionFields], sIdx) => (
                        <div key={sectionName}>
                            <SectionHeader title={`${page1Sections.length + sIdx + 1}. ${sectionName}`} color={sectionColors[(page1Sections.length + sIdx) % sectionColors.length]} />
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {renderSectionRows(sectionFields, d)}
                                </tbody>
                            </table>
                        </div>
                    ))}

                    {/* ===== TERMS & CONDITIONS / DECLARATIONS ===== */}
                    <SectionHeader title="TERMS & CONDITIONS / DECLARATIONS" color="#be123c" />
                    <div style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
                        <div style={{ fontSize: '8px', lineHeight: 1.4, color: '#334155', marginBottom: '6px' }}>
                            <p style={{ fontWeight: 700, fontSize: '9px', marginBottom: '3px', color: '#1e293b' }}>Terms &amp; Conditions:</p>
                            <ol style={{ paddingLeft: '14px', margin: 0 }}>
                                <li>The student shall abide by the rules and regulations of the institute.</li>
                                <li>The student should NOT bring mobile phone and personal vehicle to the campus.</li>
                                <li>The student should maintain discipline and decorum both inside and outside the campus.</li>
                                <li>Any misconduct or indiscipline will be dealt with as per the institute rules and may result in dismissal.</li>
                                <li>Fees once paid will not be refunded except as per AICTE/VTU/Government norms.</li>
                                <li>The institute reserves the right to change fee structure as per governing body decisions.</li>
                                <li>Ragging in any form is strictly prohibited and is a punishable offence as per law.</li>
                                <li>The student should attend a minimum of 85% of the classes to be eligible for the examinations.</li>
                            </ol>
                        </div>

                        {/* Applicant Declaration */}
                        <div style={{ padding: '5px 6px', marginBottom: '6px', background: '#fefce8', borderRadius: '3px', border: '1px solid #fde68a' }}>
                            <p style={{ fontSize: '8.5px', lineHeight: 1.4, color: '#713f12', margin: 0 }}>
                                I hereby declare that the information given above are correct to the best of my knowledge and I am solely
                                responsible for any discrepancy in the information provided above. I shall abide by the rules &amp; regulations of the Institute.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ borderBottom: '1px solid #475569', width: '160px', marginBottom: '3px' }} />
                                    <p style={{ fontSize: '8px', fontWeight: 700, color: '#475569', margin: 0 }}>Signature of the Applicant</p>
                                </div>
                            </div>
                        </div>

                        {/* Parent Declaration */}
                        <div style={{ padding: '5px 6px', background: '#eff6ff', borderRadius: '3px', border: '1px solid #bfdbfe' }}>
                            <p style={{ fontSize: '8.5px', lineHeight: 1.4, color: '#1e3a5f', margin: 0 }}>
                                I endorse the information furnished by my son/daughter/ward and I ensure that he/she follows the rules &amp;
                                regulations laid down by the institute. I agree to all the terms and conditions stated above.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ borderBottom: '1px solid #475569', width: '160px', marginBottom: '3px' }} />
                                    <p style={{ fontSize: '8px', fontWeight: 700, color: '#475569', margin: 0 }}>Signature of Parent / Guardian</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: '8px', color: '#475569', margin: 0 }}>Date: _______________</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ===== FOR OFFICE USE ===== */}
                    <div style={{ padding: '5px 10px', background: '#f1f5f9', borderTop: '2px solid #94a3b8' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: '#334155', margin: 0, marginBottom: '3px' }}>FOR OFFICE USE ONLY</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', fontSize: '9px', color: '#64748b' }}>
                            <div>Status: <strong style={{ color: statusColor(d.status) }}>{d.status || 'DRAFT'}</strong></div>
                            <div>Entered By: {d.enteredByUser?.name || ''}</div>
                            <div>Date: {fmtDate(d.createdAt)}</div>
                            <div>Admission Year: <strong>{admYear}</strong></div>
                        </div>
                    </div>

                </div>{/* END PAGE 2 */}

            </div>
        </>
    );
}

/* ================================================================
   Render section fields as table rows (pair fields 3-per-row)
   ================================================================ */
function renderSectionRows(fields: FormField[], admission: Record<string, any>) {
    const rows: React.ReactNode[] = [];

    for (let i = 0; i < fields.length; i += 3) {
        const f1 = fields[i];
        const f2 = fields[i + 1];
        const f3 = fields[i + 2];

        const v1 = resolveFieldValue(f1.id, admission);
        const v2 = f2 ? resolveFieldValue(f2.id, admission) : '';
        const v3 = f3 ? resolveFieldValue(f3.id, admission) : '';

        // Special rendering for checkbox/boolean fields
        const renderVal = (val: string, field: FormField) => {
            if (field.type === 'checkbox' || field.type === 'radio-yes-no') {
                return (
                    <>
                        <Check checked={val === 'Yes' || val === 'true'} /> Yes &nbsp;
                        <Check checked={val === 'No' || val === 'false'} /> No
                    </>
                );
            }
            if (field.type === 'select' && field.options && field.options.length <= 5) {
                return (
                    <>
                        {field.options.map(opt => (
                            <span key={opt} style={{ marginRight: '10px' }}>
                                <Check checked={val === opt} /> {opt}
                            </span>
                        ))}
                    </>
                );
            }
            return val;
        };

        rows.push(
            <tr key={f1.id}>
                <Td label>{f1.label}</Td>
                <Td>{renderVal(v1, f1)}</Td>
                {f2 ? (
                    <>
                        <Td label>{f2.label}</Td>
                        <Td>{renderVal(v2, f2)}</Td>
                    </>
                ) : (
                    <Td colSpan={2}></Td>
                )}
                {f3 ? (
                    <>
                        <Td label>{f3.label}</Td>
                        <Td>{renderVal(v3, f3)}</Td>
                    </>
                ) : !f2 ? null : (
                    <Td colSpan={2}></Td>
                )}
            </tr>
        );
    }

    return rows;
}

/* ================================================================
   Helper Components & Utilities
   ================================================================ */

const tdStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0',
    padding: '3px 8px',
    fontSize: '10px',
    color: '#1e293b',
};

function SectionHeader({ title, color }: { title: string; color: string }) {
    return (
        <div
            className="section-header"
            style={{
                background: color,
                color: 'white',
                padding: '3px 10px',
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
            }}
        >
            {title}
        </div>
    );
}

function Td({ children, label, colSpan }: { children?: React.ReactNode; label?: boolean; colSpan?: number }) {
    return (
        <td
            colSpan={colSpan}
            style={{
                ...tdStyle,
                ...(label ? { fontWeight: 600, background: '#f8fafc', color: '#475569', fontSize: '9px', whiteSpace: 'nowrap' } : {}),
            }}
        >
            {children}
        </td>
    );
}

function Check({ checked }: { checked: boolean }) {
    return (
        <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            border: '1.5px solid #475569',
            borderRadius: '2px',
            verticalAlign: 'middle',
            background: checked ? '#1e3a5f' : 'transparent',
            position: 'relative',
        }}>
            {checked && (
                <span style={{
                    position: 'absolute',
                    top: '-1px',
                    left: '1px',
                    color: 'white',
                    fontSize: '8px',
                    fontWeight: 900,
                    lineHeight: 1,
                }}>✓</span>
            )}
        </span>
    );
}

function fmtDate(v: string | null | undefined) {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('en-IN'); } catch { return v; }
}

function statusColor(status: string) {
    switch (status) {
        case 'APPROVED': return '#059669';
        case 'REJECTED': return '#dc2626';
        case 'SUBMITTED': return '#d97706';
        default: return '#64748b';
    }
}

/** Lighten a hex color by a percentage */
function lightenColor(hex: string, percent: number): string {
    try {
        const h = hex.replace('#', '');
        const r = Math.min(255, parseInt(h.substring(0, 2), 16) + Math.round(255 * percent / 100));
        const g = Math.min(255, parseInt(h.substring(2, 4), 16) + Math.round(255 * percent / 100));
        const b = Math.min(255, parseInt(h.substring(4, 6), 16) + Math.round(255 * percent / 100));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
        return hex;
    }
}
