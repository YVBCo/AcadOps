'use client';

import { useState, useEffect, useCallback } from 'react';
import { developerApi } from '@/lib/api';

// ─── Module tree definition ─────────────────────────────────
// Each node: { label, key, children?, dependsOn? }
interface ModuleNode {
    label: string;
    key: string;
    icon?: string;
    children?: ModuleNode[];
    dependsOn?: string; // dot-path of dependency
    info?: string;
}

const MODULE_TREE: ModuleNode[] = [
    {
        label: 'ERP Core', key: 'erp', icon: '📦',
        children: [
            {
                label: 'Admissions', key: 'admissions', icon: '📚',
                children: [
                    { label: 'Online Application Form', key: 'online_form' },
                    { label: 'Application Review & Approval', key: 'review' },
                    { label: 'Bulk Upload (Excel)', key: 'bulk_upload' },
                    { label: 'Dynamic Form Builder', key: 'form_builder' },
                    { label: 'Branch Change', key: 'branch_change' },
                ],
            },
            {
                label: 'Attendance', key: 'attendance', icon: '📋',
                children: [
                    { label: 'Daily Session Marking', key: 'daily_marking' },
                    { label: 'Bulk Marking', key: 'bulk_marking' },
                    { label: 'Attendance Locking', key: 'locking' },
                    { label: 'Edit Requests', key: 'edit_requests' },
                    { label: 'Parent: View Attendance', key: 'parent_view', info: 'Auto-enables Parent Portal' },
                    { label: 'Parent SMS Alerts', key: 'parent_sms', info: 'Requires Fast2SMS API key' },
                ],
            },
            {
                label: 'Internal Assessment', key: 'internal_assessment', icon: '📝',
                children: [
                    { label: 'IA Configuration', key: 'config' },
                    { label: 'Best-of-N Evaluation', key: 'best_of_n' },
                    { label: 'IA Marks Entry', key: 'marks_entry' },
                    { label: 'Mentor Review of IA', key: 'mentor_review', dependsOn: 'erp.mentorship', info: 'Auto-enables Mentor Pairing' },
                    { label: 'Submit IA to COE', key: 'submit_to_coe', info: 'Auto-enables COE Role' },
                    { label: 'Parent: View Marks', key: 'parent_view', info: 'Auto-enables Parent Portal' },
                ],
            },
            {
                label: 'Examinations & Results', key: 'examinations', icon: '🎓',
                children: [
                    { label: 'Course Catalogue', key: 'catalogue' },
                    { label: 'Semester Marks Upload', key: 'marks_upload' },
                    { label: 'Result Finalization', key: 'result_finalization' },
                    { label: 'Publish Results', key: 'publish_results' },
                    { label: 'Revaluation Workflow', key: 'revaluation' },
                    { label: 'COE Role', key: 'coe_role' },
                    { label: 'Clerk Role', key: 'clerk_role' },
                    { label: 'Parent: View Results', key: 'parent_view', info: 'Auto-enables Parent Portal' },
                ],
            },
            {
                label: 'Timetable', key: 'timetable', icon: '🗓️',
                children: [
                    { label: 'Manual Timetable Entry', key: 'manual_entry' },
                    { label: 'Auto Generator', key: 'auto_generator' },
                    { label: 'Classroom Management', key: 'classroom' },
                    { label: 'Teacher Substitution', key: 'substitution' },
                    { label: 'Academic Calendar', key: 'calendar' },
                ],
            },
            {
                label: 'Mentorship', key: 'mentorship', icon: '👥',
                children: [
                    { label: 'Mentor-Student Pairing', key: 'pairing' },
                    { label: 'Mentor Dashboard', key: 'dashboard' },
                    { label: 'Observation Cards', key: 'observation_cards' },
                    { label: 'Interaction Logs', key: 'interaction_logs' },
                    { label: 'Parent-Mentor Chat', key: 'chat', info: 'Auto-enables Parent Portal' },
                ],
            },
            {
                label: 'Parent Portal', key: 'parent_portal', icon: '👨‍👩‍👧',
                info: 'Auto-enabled when any parent feature is turned ON',
                children: [
                    { label: 'Parent Login & Dashboard', key: 'login' },
                ],
            },
            {
                label: 'First Year Coordinator', key: 'first_year_coordinator', icon: '🔄',
                children: [
                    { label: 'Physics/Chemistry Cycle', key: 'cycle_allocation' },
                    { label: 'Cycle Swap Management', key: 'cycle_swap' },
                    { label: 'Cross-Dept Teacher Import', key: 'cross_dept_import' },
                ],
            },
        ],
    },
    {
        label: 'No-Due Module', key: 'nodue', icon: '📄',
        children: [
            {
                label: 'Clearance Pipeline', key: 'clearance_pipeline', icon: '🔄',
                children: [
                    { label: 'Faculty Subject Clearance', key: 'faculty_clearance' },
                    { label: 'HOD/FYC Approval', key: 'hod_approval' },
                    { label: 'Principal Final', key: 'principal_final' },
                    { label: 'Clearance Demotion', key: 'demotion' },
                    { label: 'Certificate PDF', key: 'certificate_pdf' },
                ],
            },
            {
                label: 'Attendance Fines', key: 'attendance_fines', icon: '💰',
                info: 'If ERP Attendance is OFF, works in CSV upload mode',
                children: [
                    { label: 'Fine Slab Configuration', key: 'fine_slabs' },
                    { label: 'Mass Fine Calculation', key: 'mass_calculation' },
                    { label: 'Attendance Freeze', key: 'freeze' },
                ],
            },
            {
                label: 'Library Dues', key: 'library_dues', icon: '📚',
                children: [
                    { label: 'Fine Management', key: 'fine_management' },
                    { label: 'Bulk CSV Processing', key: 'bulk_csv' },
                    { label: 'Library Permit', key: 'permit' },
                ],
            },
            {
                label: 'Accounts & College Dues', key: 'accounts_dues', icon: '🏦',
                children: [
                    { label: 'Fee Verification', key: 'fee_verification' },
                    { label: 'Miscellaneous Dues', key: 'misc_dues' },
                    { label: 'Temporary Permit Windows', key: 'temp_permits' },
                ],
            },
            {
                label: 'AICTE Activity Compliance', key: 'aicte', icon: '🏅',
                children: [
                    { label: 'Coordinator Dashboard', key: 'coordinator' },
                    { label: 'Status Tracking', key: 'status_tracking' },
                    { label: 'Batch CSV Upload', key: 'batch_csv' },
                ],
            },
            {
                label: 'Payment Gateway (HDFC)', key: 'payment_gateway', icon: '💳',
                info: 'Requires HDFC API credentials',
                children: [
                    { label: 'Online Payment Collection', key: 'collection' },
                    { label: 'Payment Receipt PDF', key: 'receipt_pdf' },
                    { label: 'HMAC Verification', key: 'hmac_verify' },
                ],
            },
        ],
    },
    {
        label: 'PlacePro Module', key: 'placepro', icon: '🏢',
        children: [
            {
                label: 'Company Portal', key: 'company_portal', icon: '🏢',
                children: [
                    { label: 'Company Registration', key: 'registration' },
                    { label: 'Company Profile', key: 'profile' },
                    { label: 'Job Posting', key: 'job_posting' },
                    { label: 'Internship Posting', key: 'internship_posting' },
                ],
            },
            {
                label: 'Placement Drives', key: 'drives', icon: '📋',
                dependsOn: 'placepro.company_portal',
                children: [
                    { label: 'Drive Creation', key: 'creation' },
                    { label: 'Auto-Eligibility Engine', key: 'eligibility' },
                    { label: 'Interview Slot Scheduling', key: 'scheduling' },
                    { label: 'Round-wise Results', key: 'results' },
                    { label: 'Offer Letter Management', key: 'offers' },
                ],
            },
            {
                label: 'Student Placement Profile', key: 'student_profile', icon: '👤',
                children: [
                    { label: 'Academic Scores Entry', key: 'scores' },
                    { label: 'Skills & Tags', key: 'skills' },
                    { label: 'Multi-Version CV Upload', key: 'cv_upload' },
                    { label: 'Placement Declaration', key: 'declaration' },
                ],
            },
            {
                label: 'Assessments (Pre-Placement)', key: 'assessments', icon: '📝',
                children: [
                    { label: 'Assessment Creation', key: 'creation' },
                    { label: 'Assessment Scheduling', key: 'scheduling' },
                    { label: 'External Credentials', key: 'credentials' },
                    { label: 'Grading', key: 'grading' },
                ],
            },
            {
                label: 'Analytics & Reports', key: 'analytics', icon: '📊',
                children: [
                    { label: 'Dept-wise Stats', key: 'dept_stats' },
                    { label: 'Company Trends', key: 'trends' },
                    { label: 'CSV/Excel Export', key: 'export' },
                    { label: 'Principal Dashboard', key: 'principal' },
                ],
            },
        ],
    },
];

// ─── Styles ─────────────────────────────────────────────────
const colors = {
    bg: '#0a0a1a',
    card: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    text: '#e0e0e0',
    textMuted: 'rgba(255,255,255,0.45)',
    accent: '#667eea',
    accentGradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
};

// ─── Helper: get/set value at dot-path in nested object ─────
function getNestedValue(obj: Record<string, any>, path: string[]): any {
    let current = obj;
    for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return undefined;
        }
    }
    return current;
}

function setNestedValue(obj: Record<string, any>, path: string[], value: any): Record<string, any> {
    const result = JSON.parse(JSON.stringify(obj));
    let current = result;
    for (let i = 0; i < path.length - 1; i++) {
        if (!(path[i] in current) || typeof current[path[i]] !== 'object') {
            current[path[i]] = {};
        }
        current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    return result;
}

function isEnabled(modules: Record<string, any>, path: string[]): boolean {
    if (!modules || Object.keys(modules).length === 0) return true;
    const val = getNestedValue(modules, path);
    if (val === false) return false;
    if (val && typeof val === 'object' && val._enabled === false) return false;
    // Check parent
    for (let i = 1; i < path.length; i++) {
        const parentVal = getNestedValue(modules, path.slice(0, i));
        if (parentVal === false) return false;
        if (parentVal && typeof parentVal === 'object' && parentVal._enabled === false) return false;
    }
    return true;
}

// ─── Toggle Switch Component ────────────────────────────────
function Toggle({ enabled, onChange, size = 'md' }: { enabled: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
    const w = size === 'sm' ? 36 : 44;
    const h = size === 'sm' ? 20 : 24;
    const dot = size === 'sm' ? 16 : 20;
    return (
        <button
            onClick={() => onChange(!enabled)}
            style={{
                width: `${w}px`, height: `${h}px`, borderRadius: `${h}px`,
                background: enabled ? colors.success : 'rgba(255,255,255,0.12)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s', flexShrink: 0,
            }}
        >
            <div style={{
                width: `${dot}px`, height: `${dot}px`, borderRadius: '50%',
                background: '#fff', position: 'absolute', top: '2px',
                left: enabled ? `${w - dot - 2}px` : '2px',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </button>
    );
}

// ─── Module Tree Renderer ───────────────────────────────────
function ModuleTreeNode({
    node, modules, path, onToggle, depth = 0,
}: {
    node: ModuleNode; modules: Record<string, any>; path: string[];
    onToggle: (path: string[], value: boolean) => void; depth?: number;
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const currentPath = [...path, node.key];
    const enabled = isEnabled(modules, currentPath);
    const hasChildren = node.children && node.children.length > 0;
    const parentEnabled = path.length === 0 || isEnabled(modules, path);

    return (
        <div style={{ marginLeft: depth > 0 ? '16px' : '0' }}>
            {/* Node header */}
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: depth === 0 ? '14px 16px' : '8px 12px',
                    background: depth === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderRadius: '10px', marginBottom: '2px',
                    opacity: parentEnabled ? 1 : 0.4,
                    borderLeft: depth > 0 ? '2px solid rgba(255,255,255,0.06)' : 'none',
                }}
            >
                {/* Expand/Collapse arrow */}
                {hasChildren ? (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: colors.textMuted, fontSize: '12px', padding: '4px',
                            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                        }}
                    >▶</button>
                ) : (
                    <span style={{ width: '24px' }} />
                )}

                {/* Icon + Label */}
                {node.icon && <span style={{ fontSize: depth === 0 ? '20px' : '16px' }}>{node.icon}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: depth === 0 ? '15px' : '13px',
                        fontWeight: depth === 0 ? 600 : 500,
                        color: enabled ? colors.text : 'rgba(255,255,255,0.35)',
                    }}>
                        {node.label}
                    </div>
                    {node.info && (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                            ℹ️ {node.info}
                        </div>
                    )}
                    {node.dependsOn && (
                        <div style={{ fontSize: '11px', color: colors.warning, marginTop: '2px' }}>
                            ⚡ Requires: {node.dependsOn}
                        </div>
                    )}
                </div>

                {/* Toggle */}
                <Toggle
                    enabled={enabled}
                    onChange={(val) => onToggle(currentPath, val)}
                    size={depth === 0 ? 'md' : 'sm'}
                />
            </div>

            {/* Children */}
            {hasChildren && expanded && enabled && (
                <div style={{ paddingLeft: '8px' }}>
                    {node.children!.map((child) => (
                        <ModuleTreeNode
                            key={child.key}
                            node={child}
                            modules={modules}
                            path={currentPath}
                            onToggle={onToggle}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────
export default function ModuleTogglePanel({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
    const [modules, setModules] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [lastResult, setLastResult] = useState<{ autoDisabled: string[]; warnings: string[] } | null>(null);
    const [error, setError] = useState('');

    const fetchModules = useCallback(async () => {
        setLoading(true);
        try {
            const data = await developerApi.getModules(tenantId);
            setModules(data.modules || {});
        } catch {
            setError('Failed to load modules');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchModules();
    }, [fetchModules]);

    const handleToggle = (path: string[], value: boolean) => {
        let newModules = { ...modules };
        // For leaf nodes, set directly
        // For parent nodes, set _enabled
        const currentVal = getNestedValue(newModules, path);
        if (currentVal && typeof currentVal === 'object') {
            newModules = setNestedValue(newModules, [...path, '_enabled'], value);
        } else {
            newModules = setNestedValue(newModules, path, value ? {} : false);
        }
        setModules(newModules);
        setDirty(true);
        setLastResult(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const result = await developerApi.updateModules(tenantId, modules);
            setModules(result.modules || {});
            setLastResult({ autoDisabled: result.autoDisabled || [], warnings: result.warnings || [] });
            setDirty(false);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save modules');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setModules({});
        setDirty(true);
        setLastResult(null);
    };

    // Count enabled features
    const countEnabled = (obj: Record<string, any>, depth = 0): { on: number; total: number } => {
        let on = 0, total = 0;
        if (!obj || Object.keys(obj).length === 0) return { on: 0, total: 0 };
        for (const [key, val] of Object.entries(obj)) {
            if (key === '_enabled') continue;
            if (typeof val === 'boolean') {
                total++;
                if (val !== false) on++;
            } else if (typeof val === 'object' && val !== null) {
                total++;
                if (val._enabled !== false) on++;
                const sub = countEnabled(val, depth + 1);
                on += sub.on;
                total += sub.total;
            }
        }
        return { on, total };
    };

    const counts = countEnabled(modules);

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: colors.textMuted }}>
                Loading module configuration...
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '24px',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                        🎛️ Module Configuration
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textMuted }}>
                        {tenantName} — Toggle features ON/OFF for this institution
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {counts.total > 0 && (
                        <span style={{
                            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            background: 'rgba(102,126,234,0.15)', color: '#667eea',
                        }}>
                            {counts.on}/{counts.total} configured
                        </span>
                    )}
                    {Object.keys(modules).length === 0 && (
                        <span style={{
                            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                            background: 'rgba(16,185,129,0.15)', color: '#10b981',
                        }}>
                            ✅ All features ON (default)
                        </span>
                    )}
                </div>
            </div>

            {/* Info banner */}
            {Object.keys(modules).length === 0 && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                    fontSize: '13px', color: 'rgba(16,185,129,0.8)',
                }}>
                    💡 Empty configuration = everything is ON. Toggle OFF features this college doesn&apos;t need.
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    fontSize: '13px', color: '#f87171',
                }}>
                    ❌ {error}
                </div>
            )}

            {/* Auto-disabled notification */}
            {lastResult && lastResult.autoDisabled.length > 0 && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                    fontSize: '13px', color: '#fbbf24',
                }}>
                    ⚡ Auto-disabled dependent features: {lastResult.autoDisabled.join(', ')}
                </div>
            )}

            {/* Module tree */}
            <div style={{ display: 'grid', gap: '8px' }}>
                {MODULE_TREE.map((node) => (
                    <ModuleTreeNode
                        key={node.key}
                        node={node}
                        modules={modules}
                        path={[]}
                        onToggle={handleToggle}
                    />
                ))}
            </div>

            {/* Action buttons */}
            <div style={{
                display: 'flex', gap: '12px', marginTop: '24px',
                justifyContent: 'space-between', alignItems: 'center',
                paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
                <button
                    onClick={handleReset}
                    style={{
                        padding: '10px 20px', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                        color: colors.textMuted, fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                    }}
                >
                    🔄 Reset to All ON
                </button>
                <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    style={{
                        padding: '10px 24px',
                        background: dirty ? colors.accentGradient : 'rgba(255,255,255,0.06)',
                        border: 'none', borderRadius: '10px',
                        color: dirty ? '#fff' : colors.textMuted,
                        fontSize: '14px', fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed',
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    {saving ? '💾 Saving...' : dirty ? '💾 Save Changes' : '✅ Saved'}
                </button>
            </div>
        </div>
    );
}
