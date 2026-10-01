'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { admissionsApi } from '@/lib/api';
import {
    Save, Upload, Eye, Plus, Trash2, GripVertical, ArrowUp, ArrowDown,
    CheckCircle2, AlertCircle, ExternalLink, Edit3, X, Copy, ChevronDown, ChevronRight,
    Settings2, Layers, Type,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

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
    id: number;
    collegeName: string;
    collegeAddress: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    bgColor: string;
    formTitle: string;
    formFields: FormField[];
    isPublished: boolean;
}

const FIELD_TYPES: { value: string; label: string; icon: string }[] = [
    { value: 'text', label: 'Text', icon: 'Aa' },
    { value: 'email', label: 'Email', icon: '@' },
    { value: 'phone', label: 'Phone', icon: '📱' },
    { value: 'number', label: 'Number', icon: '#' },
    { value: 'date', label: 'Date', icon: '📅' },
    { value: 'select', label: 'Dropdown', icon: '▼' },
    { value: 'radio', label: 'Radio', icon: '◉' },
    { value: 'checkbox', label: 'Checkbox', icon: '☑' },
    { value: 'textarea', label: 'Text Area', icon: '¶' },
    { value: 'multiselect', label: 'Multi-Select', icon: '☰' },
    { value: 'branch_select', label: 'Branch Select', icon: '🎓' },
];

const NEEDS_OPTIONS = ['select', 'radio', 'multiselect'];

// ─── Main Component ──────────────────────────────────────────────────

export default function FormConfigPage() {
    const [config, setConfig] = useState<FormConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [slug, setSlug] = useState('');

    // Modal states
    const [editingField, setEditingField] = useState<FormField | null>(null);
    const [editingFieldIndex, setEditingFieldIndex] = useState<number>(-1);
    const [isAddingField, setIsAddingField] = useState(false);
    const [addToSection, setAddToSection] = useState('');

    // Section management
    const [addingSectionName, setAddingSectionName] = useState('');
    const [showAddSection, setShowAddSection] = useState(false);
    const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
    const [newSectionName, setNewSectionName] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchConfig = useCallback(async () => {
        try {
            const data = await admissionsApi.getFormConfig();
            setConfig(data);
            // Extract slug
            const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
            if (user.tenantSlug) setSlug(user.tenantSlug);
        } catch {
            showToast('error', 'Failed to load config');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // ─── Derived data ────────────────────────────────────────────────

    const sections = useMemo(() => {
        if (!config) return [];
        const map = new Map<string, FormField[]>();
        const sorted = [...config.formFields].sort((a, b) => a.order - b.order);
        sorted.forEach(f => {
            if (!map.has(f.section)) map.set(f.section, []);
            map.get(f.section)!.push(f);
        });
        return Array.from(map.entries()).map(([name, fields]) => ({ name, fields }));
    }, [config]);

    // ─── Save ────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await admissionsApi.updateFormConfig({
                collegeName: config.collegeName,
                collegeAddress: config.collegeAddress || '',
                primaryColor: config.primaryColor,
                secondaryColor: config.secondaryColor,
                bgColor: config.bgColor,
                formTitle: config.formTitle,
                formFields: config.formFields,
                isPublished: config.isPublished,
            });
            const fresh = await admissionsApi.getFormConfig();
            setConfig(fresh);
            showToast('success', 'Form configuration saved!');
        } catch (err: any) {
            console.error('Form config save error:', err);
            showToast('error', err.response?.data?.error || err.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    // ─── Logo upload ─────────────────────────────────────────────────

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await admissionsApi.uploadFormLogo(file);
            setConfig(prev => prev ? { ...prev, logoUrl: result.logoUrl } : prev);
            showToast('success', 'Logo uploaded!');
        } catch (err: any) {
            showToast('error', err.response?.data?.error || 'Logo upload failed');
        }
    };

    // ─── Section Operations ──────────────────────────────────────────

    const addSection = () => {
        if (!addingSectionName.trim() || !config) return;
        // Section will exist once a field is added to it
        setAddToSection(addingSectionName.trim());
        setAddingSectionName('');
        setShowAddSection(false);
        // Open add field modal for this new section
        openAddFieldModal(addingSectionName.trim());
    };

    const renameSection = (oldName: string) => {
        if (!newSectionName.trim() || !config) return;
        const fields = config.formFields.map(f =>
            f.section === oldName ? { ...f, section: newSectionName.trim() } : f
        );
        setConfig({ ...config, formFields: fields });
        setEditingSectionName(null);
        setNewSectionName('');
    };

    const deleteSection = (sectionName: string) => {
        if (!config) return;
        if (!confirm(`Delete section "${sectionName}" and all its fields?`)) return;
        const fields = config.formFields.filter(f => f.section !== sectionName);
        // re-index
        fields.forEach((f, i) => f.order = i + 1);
        setConfig({ ...config, formFields: fields.map((f, i) => ({ ...f, order: i + 1 })) });
    };

    const moveSectionUp = (sectionName: string) => {
        if (!config) return;
        const sectionNames = sections.map(s => s.name);
        const idx = sectionNames.indexOf(sectionName);
        if (idx <= 0) return;
        // Swap the two sections' field orders
        const prevSection = sectionNames[idx - 1];
        const currentFields = config.formFields.filter(f => f.section === sectionName);
        const prevFields = config.formFields.filter(f => f.section === prevSection);
        const otherFields = config.formFields.filter(f => f.section !== sectionName && f.section !== prevSection);
        // Rebuild with swapped order
        const all = [
            ...otherFields.filter(f => {
                const si = sectionNames.indexOf(f.section);
                return si < idx - 1;
            }),
            ...currentFields,
            ...prevFields,
            ...otherFields.filter(f => {
                const si = sectionNames.indexOf(f.section);
                return si > idx;
            }),
        ];
        setConfig({ ...config, formFields: all.map((f, i) => ({ ...f, order: i + 1 })) });
    };

    const moveSectionDown = (sectionName: string) => {
        if (!config) return;
        const sectionNames = sections.map(s => s.name);
        const idx = sectionNames.indexOf(sectionName);
        if (idx >= sectionNames.length - 1) return;
        const nextSection = sectionNames[idx + 1];
        const currentFields = config.formFields.filter(f => f.section === sectionName);
        const nextFields = config.formFields.filter(f => f.section === nextSection);
        const otherFields = config.formFields.filter(f => f.section !== sectionName && f.section !== nextSection);
        const all = [
            ...otherFields.filter(f => {
                const si = sectionNames.indexOf(f.section);
                return si < idx;
            }),
            ...nextFields,
            ...currentFields,
            ...otherFields.filter(f => {
                const si = sectionNames.indexOf(f.section);
                return si > idx + 1;
            }),
        ];
        setConfig({ ...config, formFields: all.map((f, i) => ({ ...f, order: i + 1 })) });
    };

    const toggleSection = (name: string) => {
        setCollapsedSections(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    // ─── Field Operations ────────────────────────────────────────────

    const openAddFieldModal = (section: string) => {
        const newField: FormField = {
            id: '',
            label: '',
            type: 'text',
            required: false,
            section,
            order: config ? config.formFields.length + 1 : 1,
            width: 'half',
        };
        setEditingField(newField);
        setEditingFieldIndex(-1);
        setIsAddingField(true);
    };

    const openEditFieldModal = (field: FormField, globalIndex: number) => {
        setEditingField({ ...field });
        setEditingFieldIndex(globalIndex);
        setIsAddingField(false);
    };

    const saveField = () => {
        if (!editingField || !config) return;
        if (!editingField.label.trim()) {
            showToast('error', 'Field label is required');
            return;
        }
        // Auto-generate ID from label if new
        const field = { ...editingField };
        if (!field.id) {
            field.id = field.label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/(^_|_$)/g, '');
        }
        // Clean up options if not needed
        if (!NEEDS_OPTIONS.includes(field.type)) {
            delete field.options;
        }

        if (isAddingField) {
            setConfig({ ...config, formFields: [...config.formFields, field] });
        } else {
            const fields = config.formFields.map((f, i) =>
                i === editingFieldIndex ? field : f
            );
            setConfig({ ...config, formFields: fields });
        }
        setEditingField(null);
        setEditingFieldIndex(-1);
    };

    const deleteField = (globalIndex: number) => {
        if (!config) return;
        const fields = config.formFields
            .filter((_, i) => i !== globalIndex)
            .map((f, i) => ({ ...f, order: i + 1 }));
        setConfig({ ...config, formFields: fields });
    };

    const duplicateField = (field: FormField) => {
        if (!config) return;
        const dup: FormField = {
            ...field,
            id: field.id + '_copy',
            label: field.label + ' (Copy)',
            order: config.formFields.length + 1,
        };
        setConfig({ ...config, formFields: [...config.formFields, dup] });
    };

    const moveFieldUp = (globalIndex: number) => {
        if (!config || globalIndex <= 0) return;
        const fields = config.formFields.map(f => ({ ...f }));
        [fields[globalIndex], fields[globalIndex - 1]] = [fields[globalIndex - 1], fields[globalIndex]];
        setConfig({ ...config, formFields: fields.map((f, i) => ({ ...f, order: i + 1 })) });
    };

    const moveFieldDown = (globalIndex: number) => {
        if (!config || globalIndex >= config.formFields.length - 1) return;
        const fields = config.formFields.map(f => ({ ...f }));
        [fields[globalIndex], fields[globalIndex + 1]] = [fields[globalIndex + 1], fields[globalIndex]];
        setConfig({ ...config, formFields: fields.map((f, i) => ({ ...f, order: i + 1 })) });
    };

    // ─── Render ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!config) {
        return <div style={{ padding: '32px', color: '#ef4444' }}>Failed to load configuration.</div>;
    }

    const pc = config.primaryColor || '#6366f1';

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    color: toast.type === 'success' ? '#059669' : '#dc2626',
                    border: `1px solid ${toast.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    animation: 'slideIn 0.3s ease-out',
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        <Settings2 size={22} style={{ display: 'inline', verticalAlign: '-3px', marginRight: '8px', color: pc }} />
                        Form Builder
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
                        Configure your admission form — sections, fields, validation, and branding
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {slug && (
                        <a href={`/apply/${slug}`} target="_blank" rel="noopener noreferrer" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '10px', border: '1px solid #e2e8f0',
                            background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 500,
                            textDecoration: 'none', cursor: 'pointer',
                        }}>
                            <Eye size={14} /> Preview
                        </a>
                    )}
                    <button onClick={handleSave} disabled={saving} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 20px', borderRadius: '10px', border: 'none',
                        background: `linear-gradient(135deg, ${pc}, ${config.secondaryColor || pc})`,
                        color: '#fff', fontSize: '13px', fontWeight: 600,
                        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                        boxShadow: `0 4px 14px ${pc}40`,
                    }}>
                        <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Branding Panel */}
            <div style={{
                background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)', padding: '20px', marginBottom: '20px',
            }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Type size={16} /> Branding & Settings
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>College Name</label>
                        <input value={config.collegeName} onChange={e => setConfig({ ...config, collegeName: e.target.value })}
                            style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>College Address</label>
                        <input value={config.collegeAddress || ''} onChange={e => setConfig({ ...config, collegeAddress: e.target.value })}
                            style={inputStyle} placeholder="e.g. Campus Address, City" />
                    </div>
                    <div>
                        <label style={labelStyle}>Form Title</label>
                        <input value={config.formTitle} onChange={e => setConfig({ ...config, formTitle: e.target.value })}
                            style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Primary Color</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="color" value={config.primaryColor} onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '8px' }} />
                            <input value={config.primaryColor} onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                style={{ ...inputStyle, flex: 1 }} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Secondary Color</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="color" value={config.secondaryColor} onChange={e => setConfig({ ...config, secondaryColor: e.target.value })}
                                style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '8px' }} />
                            <input value={config.secondaryColor} onChange={e => setConfig({ ...config, secondaryColor: e.target.value })}
                                style={{ ...inputStyle, flex: 1 }} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Background Color</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="color" value={config.bgColor} onChange={e => setConfig({ ...config, bgColor: e.target.value })}
                                style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '8px' }} />
                            <input value={config.bgColor} onChange={e => setConfig({ ...config, bgColor: e.target.value })}
                                style={{ ...inputStyle, flex: 1 }} />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>Logo</label>
                        <label style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                            borderRadius: '10px', border: '1px dashed #cbd5e1', cursor: 'pointer',
                            fontSize: '13px', color: '#64748b', background: '#f8fafc',
                        }}>
                            <Upload size={14} /> {config.logoUrl ? 'Change Logo' : 'Upload Logo'}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                        </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label style={{ ...labelStyle, margin: 0 }}>Published</label>
                        <button onClick={() => setConfig({ ...config, isPublished: !config.isPublished })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: config.isPublished ? pc : '#cbd5e1', position: 'relative', transition: 'background 0.2s',
                            }}>
                            <div style={{
                                width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: '3px', transition: 'left 0.2s',
                                left: config.isPublished ? '22px' : '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Sections & Fields */}
            <div style={{
                background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)', padding: '20px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={16} /> Form Sections & Fields
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>
                            ({config.formFields.length} fields in {sections.length} sections)
                        </span>
                    </h2>
                    <button onClick={() => setShowAddSection(true)} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '6px 14px', borderRadius: '8px', border: '1px dashed #cbd5e1',
                        background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    }}>
                        <Plus size={14} /> Add Section
                    </button>
                </div>

                {/* Add Section Inline */}
                {showAddSection && (
                    <div style={{
                        display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px',
                        background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd',
                    }}>
                        <input placeholder="Section name (e.g. Emergency Contact)"
                            value={addingSectionName} onChange={e => setAddingSectionName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSection()}
                            style={{ ...inputStyle, flex: 1 }} autoFocus />
                        <button onClick={addSection} style={{ ...btnPrimary(pc), padding: '8px 16px', fontSize: '12px' }}>Add</button>
                        <button onClick={() => { setShowAddSection(false); setAddingSectionName(''); }}
                            style={{ ...btnSecondary, padding: '8px 12px', fontSize: '12px' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Section cards */}
                {sections.map((section, sIdx) => {
                    const isCollapsed = collapsedSections.has(section.name);
                    const globalStartIdx = config.formFields.findIndex(f => f.section === section.name);

                    return (
                        <div key={section.name} style={{
                            border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '12px',
                            overflow: 'hidden',
                        }}>
                            {/* Section Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 16px', background: '#f8fafc', borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                            }} onClick={() => toggleSection(section.name)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {isCollapsed ? <ChevronRight size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                                    {editingSectionName === section.name ? (
                                        <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                                            <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && renameSection(section.name)}
                                                style={{ ...inputStyle, padding: '4px 8px', fontSize: '13px', width: '200px' }} autoFocus />
                                            <button onClick={() => renameSection(section.name)} style={{ ...btnPrimary(pc), padding: '4px 10px', fontSize: '11px' }}>Save</button>
                                            <button onClick={() => setEditingSectionName(null)} style={{ ...btnSecondary, padding: '4px 8px', fontSize: '11px' }}><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                            {section.name}
                                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400, marginLeft: '8px' }}>
                                                {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                                    <IconBtn title="Move Up" onClick={() => moveSectionUp(section.name)} disabled={sIdx === 0}><ArrowUp size={13} /></IconBtn>
                                    <IconBtn title="Move Down" onClick={() => moveSectionDown(section.name)} disabled={sIdx === sections.length - 1}><ArrowDown size={13} /></IconBtn>
                                    <IconBtn title="Rename" onClick={() => { setEditingSectionName(section.name); setNewSectionName(section.name); }}><Edit3 size={13} /></IconBtn>
                                    <IconBtn title="Delete Section" onClick={() => deleteSection(section.name)} danger><Trash2 size={13} /></IconBtn>
                                </div>
                            </div>

                            {/* Fields */}
                            {!isCollapsed && (
                                <div style={{ padding: '8px' }}>
                                    {section.fields.map((field, fIdx) => {
                                        const globalIdx = config.formFields.findIndex(f => f === field);
                                        return (
                                            <FieldCard key={field.id || fIdx}
                                                field={field}
                                                onEdit={() => openEditFieldModal(field, globalIdx)}
                                                onDelete={() => deleteField(globalIdx)}
                                                onDuplicate={() => duplicateField(field)}
                                                onMoveUp={() => moveFieldUp(globalIdx)}
                                                onMoveDown={() => moveFieldDown(globalIdx)}
                                                isFirst={fIdx === 0}
                                                isLast={fIdx === section.fields.length - 1}
                                                pc={pc}
                                            />
                                        );
                                    })}
                                    <button onClick={() => openAddFieldModal(section.name)} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        width: '100%', padding: '10px', borderRadius: '8px',
                                        border: '1px dashed #cbd5e1', background: '#fafbfc',
                                        color: '#64748b', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = pc; e.currentTarget.style.color = pc; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}>
                                        <Plus size={14} /> Add Field
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {sections.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '14px' }}>
                        No sections yet. Click "Add Section" to get started.
                    </div>
                )}
            </div>

            {/* ─── Field Edit Modal ─────────────────────────────────── */}
            {editingField && (
                <FieldEditModal
                    field={editingField}
                    isNew={isAddingField}
                    pc={pc}
                    onChange={setEditingField}
                    onSave={saveField}
                    onCancel={() => { setEditingField(null); setEditingFieldIndex(-1); }}
                />
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────

function FieldCard({ field, onEdit, onDelete, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast, pc }: {
    field: FormField; onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
    onMoveUp: () => void; onMoveDown: () => void; isFirst: boolean; isLast: boolean; pc: string;
}) {
    const typeInfo = FIELD_TYPES.find(t => t.value === field.type);
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
            borderRadius: '8px', margin: '4px 0', background: '#fff', border: '1px solid #f1f5f9',
            transition: 'all 0.15s',
        }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none'; }}>
            <GripVertical size={14} color="#cbd5e1" />
            <div style={{
                width: '28px', height: '28px', borderRadius: '6px', background: `${pc}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', flexShrink: 0,
            }}>
                {typeInfo?.icon || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {field.label}
                    {field.required && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>Required</span>}
                    {field.width === 'half' && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#f0f9ff', color: '#0284c7', fontWeight: 500 }}>½</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {typeInfo?.label || field.type}
                    {field.placeholder && <> · <span style={{ fontStyle: 'italic' }}>{field.placeholder}</span></>}
                    {field.validation && (
                        <>
                            {field.validation.minLength !== undefined && ` · min:${field.validation.minLength}`}
                            {field.validation.maxLength !== undefined && ` · max:${field.validation.maxLength}`}
                            {field.validation.exactLength !== undefined && ` · exact:${field.validation.exactLength}`}
                        </>
                    )}
                    {field.options && ` · ${field.options.length} options`}
                </div>
            </div>
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                <IconBtn title="Move Up" onClick={onMoveUp} disabled={isFirst}><ArrowUp size={12} /></IconBtn>
                <IconBtn title="Move Down" onClick={onMoveDown} disabled={isLast}><ArrowDown size={12} /></IconBtn>
                <IconBtn title="Edit" onClick={onEdit}><Edit3 size={12} /></IconBtn>
                <IconBtn title="Duplicate" onClick={onDuplicate}><Copy size={12} /></IconBtn>
                <IconBtn title="Delete" onClick={onDelete} danger><Trash2 size={12} /></IconBtn>
            </div>
        </div>
    );
}

function IconBtn({ children, onClick, title, disabled, danger }: {
    children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean; danger?: boolean;
}) {
    return (
        <button title={title} onClick={onClick} disabled={disabled} style={{
            width: '26px', height: '26px', borderRadius: '6px', border: 'none',
            background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
            color: danger ? '#ef4444' : '#64748b', transition: 'background 0.15s',
        }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? '#fef2f2' : '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
            {children}
        </button>
    );
}

// ─── Field Edit Modal ────────────────────────────────────────────────

function FieldEditModal({ field, isNew, pc, onChange, onSave, onCancel }: {
    field: FormField; isNew: boolean; pc: string;
    onChange: (f: FormField) => void; onSave: () => void; onCancel: () => void;
}) {
    const [newOption, setNewOption] = useState('');
    const needsOptions = NEEDS_OPTIONS.includes(field.type);
    const showTextValidation = ['text', 'textarea'].includes(field.type);
    const showNumberValidation = field.type === 'number';
    const showExactLength = ['phone', 'text'].includes(field.type);

    const updateValidation = (key: keyof FieldValidation, value: any) => {
        const v = { ...(field.validation || {}) };
        if (value === '' || value === undefined) {
            delete v[key];
        } else {
            (v as any)[key] = value;
        }
        onChange({ ...field, validation: Object.keys(v).length > 0 ? v : undefined });
    };

    const addOption = () => {
        if (!newOption.trim()) return;
        const opts = [...(field.options || []), newOption.trim()];
        onChange({ ...field, options: opts });
        setNewOption('');
    };

    const removeOption = (idx: number) => {
        const opts = (field.options || []).filter((_, i) => i !== idx);
        onChange({ ...field, options: opts });
    };

    const moveOption = (idx: number, dir: -1 | 1) => {
        const opts = [...(field.options || [])];
        const target = idx + dir;
        if (target < 0 || target >= opts.length) return;
        [opts[idx], opts[target]] = [opts[target], opts[idx]];
        onChange({ ...field, options: opts });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out', padding: '16px',
        }} onClick={onCancel}>
            <div style={{
                background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '560px',
                maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {isNew ? 'Add Field' : 'Edit Field'}
                    </h3>
                    <button onClick={onCancel} style={{
                        width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                        background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><X size={16} color="#64748b" /></button>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    {/* Label & Type */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={labelStyle}>Field Label *</label>
                            <input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })}
                                placeholder="e.g. Father's Name" style={inputStyle} autoFocus />
                        </div>
                        <div>
                            <label style={labelStyle}>Field Type</label>
                            <select value={field.type} onChange={e => onChange({ ...field, type: e.target.value })}
                                style={{ ...inputStyle, cursor: 'pointer' }}>
                                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Width</label>
                            <select value={field.width || 'half'} onChange={e => onChange({ ...field, width: e.target.value as 'full' | 'half' })}
                                style={{ ...inputStyle, cursor: 'pointer' }}>
                                <option value="half">Half Width (½)</option>
                                <option value="full">Full Width</option>
                            </select>
                        </div>
                    </div>

                    {/* Placeholder & Help Text */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Placeholder</label>
                            <input value={field.placeholder || ''} onChange={e => onChange({ ...field, placeholder: e.target.value || undefined })}
                                placeholder="Hint text shown in input" style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Help Text</label>
                            <input value={field.helpText || ''} onChange={e => onChange({ ...field, helpText: e.target.value || undefined })}
                                placeholder="Shown below the field" style={inputStyle} />
                        </div>
                    </div>

                    {/* Required toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <button onClick={() => onChange({ ...field, required: !field.required })}
                            style={{
                                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                                background: field.required ? pc : '#cbd5e1', position: 'relative', transition: 'background 0.2s',
                            }}>
                            <div style={{
                                width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: '3px', transition: 'left 0.2s',
                                left: field.required ? '22px' : '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                        </button>
                        <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>Required field</span>
                    </div>

                    {/* Field ID (read-only for existing) */}
                    {!isNew && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Field ID</label>
                            <input value={field.id} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} />
                        </div>
                    )}

                    {/* ── Validation Rules ─────────────────────────── */}
                    {(showTextValidation || showNumberValidation || showExactLength) && (
                        <div style={{
                            padding: '14px', background: '#f8fafc', borderRadius: '12px',
                            border: '1px solid #e2e8f0', marginBottom: '16px',
                        }}>
                            <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Validation Rules
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                {showTextValidation && (
                                    <>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Min Length</label>
                                            <input type="number" min={0} value={field.validation?.minLength ?? ''}
                                                onChange={e => updateValidation('minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                                                placeholder="No min" style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Max Length</label>
                                            <input type="number" min={0} value={field.validation?.maxLength ?? ''}
                                                onChange={e => updateValidation('maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                                                placeholder="No max" style={inputStyle} />
                                        </div>
                                    </>
                                )}
                                {showNumberValidation && (
                                    <>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Min Value</label>
                                            <input type="number" value={field.validation?.minValue ?? ''}
                                                onChange={e => updateValidation('minValue', e.target.value ? parseInt(e.target.value) : undefined)}
                                                placeholder="No min" style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={{ ...labelStyle, fontSize: '11px' }}>Max Value</label>
                                            <input type="number" value={field.validation?.maxValue ?? ''}
                                                onChange={e => updateValidation('maxValue', e.target.value ? parseInt(e.target.value) : undefined)}
                                                placeholder="No max" style={inputStyle} />
                                        </div>
                                    </>
                                )}
                                {showExactLength && (
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '11px' }}>Exact Length</label>
                                        <input type="number" min={0} value={field.validation?.exactLength ?? ''}
                                            onChange={e => updateValidation('exactLength', e.target.value ? parseInt(e.target.value) : undefined)}
                                            placeholder="e.g. 10 for phone" style={inputStyle} />
                                    </div>
                                )}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ ...labelStyle, fontSize: '11px' }}>Regex Pattern</label>
                                    <input value={field.validation?.pattern ?? ''}
                                        onChange={e => updateValidation('pattern', e.target.value || undefined)}
                                        placeholder="e.g. ^[0-9]{10}$" style={inputStyle} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ ...labelStyle, fontSize: '11px' }}>Custom Error Message</label>
                                    <input value={field.validation?.customError ?? ''}
                                        onChange={e => updateValidation('customError', e.target.value || undefined)}
                                        placeholder="Shown when validation fails" style={inputStyle} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Options Editor ───────────────────────────── */}
                    {needsOptions && (
                        <div style={{
                            padding: '14px', background: '#f8fafc', borderRadius: '12px',
                            border: '1px solid #e2e8f0', marginBottom: '16px',
                        }}>
                            <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#475569', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Options ({(field.options || []).length})
                            </h4>
                            {(field.options || []).map((opt, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 0',
                                }}>
                                    <GripVertical size={12} color="#cbd5e1" />
                                    <span style={{ flex: 1, fontSize: '13px', color: '#334155' }}>{opt}</span>
                                    <IconBtn title="Move Up" onClick={() => moveOption(idx, -1)} disabled={idx === 0}><ArrowUp size={11} /></IconBtn>
                                    <IconBtn title="Move Down" onClick={() => moveOption(idx, 1)} disabled={idx === (field.options || []).length - 1}><ArrowDown size={11} /></IconBtn>
                                    <IconBtn title="Remove" onClick={() => removeOption(idx)} danger><X size={11} /></IconBtn>
                                </div>
                            ))}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                <input value={newOption} onChange={e => setNewOption(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addOption()}
                                    placeholder="Type option and press Enter" style={{ ...inputStyle, flex: 1 }} />
                                <button onClick={addOption} style={{ ...btnPrimary(pc), padding: '6px 14px', fontSize: '12px' }}>Add</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: '8px',
                }}>
                    <button onClick={onCancel} style={btnSecondary}>Cancel</button>
                    <button onClick={onSave} style={btnPrimary(pc)}>{isNew ? 'Add Field' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Shared styles ──────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
    fontSize: '13px', color: '#1e293b', outline: 'none', background: '#fff', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
};

const btnPrimary = (pc: string): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: '8px', border: 'none',
    background: pc, color: '#fff', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer',
});

const btnSecondary: React.CSSProperties = {
    padding: '8px 18px', borderRadius: '8px', border: '1px solid #e2e8f0',
    background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer',
};
