'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { developerApi } from '@/lib/api';
import { getServerBaseUrl } from '@/lib/config';
import ModuleTogglePanel from '@/components/dev/ModuleTogglePanel';

// ==========================================
// Types
// ==========================================
interface Tenant {
    id: number;
    name: string;
    slug: string;
    type: string;
    maxUsers: number;
    isActive: boolean;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    createdAt: string;
    _count: { users: number; departments: number; batches: number; systemErrors: number };
}

interface HealthData {
    status: string;
    timestamp: string;
    server: {
        uptime: number;
        uptimeFormatted: string;
        nodeVersion: string;
        platform: string;
        hostname: string;
        memory: { rss: number; heapUsed: number; heapTotal: number; external: number };
        cpuLoad: number[];
    };
    tenants: { totalTenants: number; activeTenants: number; totalUsers: number; totalErrors: number; recentErrors24h: number };
    errors: { total: number; unresolved: number; critical: number; last24h: number };
}

interface EmailLog {
    id: number;
    to: string;
    subject: string;
    status: string;
    provider: string;
    error: string | null;
    createdAt: string;
    tenantId: number | null;
}

interface EmailStats {
    total: number;
    sent: number;
    failed: number;
    last24h: number;
    failedLast24h: number;
}

interface SystemError {
    id: number;
    errorCode: string;
    message: string;
    endpoint: string | null;
    method: string | null;
    severity: string;
    resolved: boolean;
    createdAt: string;
    tenant: { name: string; slug: string } | null;
}

// ==========================================
// Styles (inline for self-contained component)
// ==========================================
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

const cardStyle: React.CSSProperties = {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: '16px',
    padding: '24px',
};

const btnPrimary: React.CSSProperties = {
    padding: '10px 20px',
    background: colors.accentGradient,
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none' as const,
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '32px',
};

// ==========================================
// Dashboard Component
// ==========================================
export default function DevDashboard() {
    const router = useRouter();
    const [devUser, setDevUser] = useState<{ id: number; name: string; email: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'health' | 'errors' | 'emails'>('overview');
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [health, setHealth] = useState<HealthData | null>(null);
    const [errors, setErrors] = useState<{ errors: SystemError[]; total: number }>({ errors: [], total: 0 });
    const [emails, setEmails] = useState<{ emails: EmailLog[]; total: number }>({ emails: [], total: 0 });
    const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
    const [emailFilter, setEmailFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
    const [editForm, setEditForm] = useState({ name: '', maxUsers: 500, contactEmail: '', contactPhone: '', address: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [editBgFile, setEditBgFile] = useState<File | null>(null);
    const [editBgPreview, setEditBgPreview] = useState<string>('');
    const [editBgExisting, setEditBgExisting] = useState<string | null>(null);
    const [editBgRemoving, setEditBgRemoving] = useState(false);
    const [configuringModulesTenant, setConfiguringModulesTenant] = useState<Tenant | null>(null);

    // Create tenant form state
    const [newTenant, setNewTenant] = useState({
        name: '', slug: '', type: 'ENGINEERING', maxUsers: 500, contactEmail: '',
        adminName: '', adminEmail: '',
    });
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);
    const [createResult, setCreateResult] = useState<any>(null);
    const [copiedUrl, setCopiedUrl] = useState<number | null>(null);
    const [loginBgFile, setLoginBgFile] = useState<File | null>(null);
    const [loginBgPreview, setLoginBgPreview] = useState<string>('');

    // College type hints
    const typeHints: Record<string, string> = {
        ENGINEERING: 'Auto-creates: CSE, ECE, ME, CE, ISE + Physics, Chemistry, Maths',
        MEDICAL: 'Auto-creates: General Medicine, Surgery, Paediatrics, Orthopaedics, Anatomy, Pharmacology',
        DEGREE: 'Auto-creates: B.Com, BA, BSc departments',
        MBA: 'Auto-creates: Finance, Marketing, HR, Operations',
        MCA: 'Auto-creates: MCA department',
        LAW: 'Auto-creates: Constitutional Law, Criminal Law, Corporate Law',
        PHARMACY: 'Auto-creates: Pharmaceutics, Pharmacology, Pharmaceutical Chemistry',
        AYURVEDIC: 'Auto-creates: Kayachikitsa, Shalya Tantra, Panchakarma, Dravyaguna + 5 more',
        PARAMEDICAL: 'Auto-creates: Nursing, Physiotherapy, MLT, Radiology, Optometry + 2 more',
        OTHER: 'No default departments — create manually after setup',
    };

    const typeEmojis: Record<string, string> = {
        ENGINEERING: '🏗️', MEDICAL: '🏥', DEGREE: '🎓', MBA: '📊',
        MCA: '💻', LAW: '⚖️', PHARMACY: '💊', AYURVEDIC: '🌿',
        PARAMEDICAL: '🩺', OTHER: '🏛️',
    };

    // Check auth
    useEffect(() => {
        const user = localStorage.getItem('dev-user');
        const token = localStorage.getItem('dev-token');
        if (!user || !token) {
            router.push('/dev/login');
            return;
        }
        setDevUser(JSON.parse(user));
    }, [router]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tenantsData, healthData, errorsData] = await Promise.all([
                developerApi.getTenants(),
                developerApi.getHealth(),
                developerApi.getErrors({ limit: 20 }),
            ]);
            setTenants(tenantsData);
            setHealth(healthData);
            setErrors(errorsData);
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('dev-token');
                localStorage.removeItem('dev-user');
                router.push('/dev/login');
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        if (devUser) fetchData();
    }, [devUser, fetchData]);

    // Auto-refresh health every 30s
    useEffect(() => {
        if (activeTab !== 'health') return;
        const interval = setInterval(async () => {
            try {
                const h = await developerApi.getHealth();
                setHealth(h);
            } catch { }
        }, 30000);
        return () => clearInterval(interval);
    }, [activeTab]);

    // Fetch emails when tab switches to emails
    useEffect(() => {
        if (activeTab !== 'emails') return;
        const fetchEmails = async () => {
            try {
                const params: any = { limit: 50 };
                if (emailFilter !== 'all') params.status = emailFilter;
                const [emailData, stats] = await Promise.all([
                    developerApi.getEmails(params),
                    developerApi.getEmailStats(),
                ]);
                setEmails(emailData);
                setEmailStats(stats);
            } catch { }
        };
        fetchEmails();
    }, [activeTab, emailFilter]);

    const handleRetryEmail = async (id: number) => {
        try {
            await developerApi.retryEmail(id);
            // Refresh list
            const params: any = { limit: 50 };
            if (emailFilter !== 'all') params.status = emailFilter;
            const emailData = await developerApi.getEmails(params);
            setEmails(emailData);
        } catch { }
    };

    const handleLogout = () => {
        localStorage.removeItem('dev-token');
        localStorage.removeItem('dev-user');
        router.push('/dev/login');
    };

    const handleCreateTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreateLoading(true);
        setCreateResult(null);
        try {
            const result = await developerApi.createTenant(newTenant);
            // Upload login background image if selected
            if (loginBgFile && result.tenant?.id) {
                const formData = new FormData();
                formData.append('image', loginBgFile);
                try {
                    const token = localStorage.getItem('dev-token');
                    const serverBase = getServerBaseUrl();
                    await fetch(`${serverBase}/api/dev/tenants/${result.tenant.id}/login-bg`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData,
                    });
                } catch { /* non-critical */ }
            }
            setCreateResult(result);
            fetchData();
            setNewTenant({ name: '', slug: '', type: 'ENGINEERING', maxUsers: 500, contactEmail: '', adminName: '', adminEmail: '' });
            setLoginBgFile(null);
            setLoginBgPreview('');
        } catch (err: any) {
            setCreateError(err.response?.data?.error || 'Failed to create tenant');
        } finally {
            setCreateLoading(false);
        }
    };

    const copyLoginUrl = (tenantId: number, slug: string) => {
        const url = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'}/login?tenant=${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedUrl(tenantId);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const handleToggleTenant = async (id: number, isActive: boolean) => {
        try {
            if (isActive) await developerApi.deactivateTenant(id);
            else await developerApi.activateTenant(id);
            fetchData();
        } catch { }
    };

    const handleResolveError = async (id: number) => {
        try {
            await developerApi.resolveError(id);
            setErrors(prev => ({
                ...prev,
                errors: prev.errors.map(e => e.id === id ? { ...e, resolved: true } : e),
            }));
        } catch { }
    };

    const openEditModal = async (t: Tenant) => {
        setEditingTenant(t);
        setEditForm({
            name: t.name,
            maxUsers: t.maxUsers,
            contactEmail: t.contactEmail || '',
            contactPhone: t.contactPhone || '',
            address: t.address || '',
        });
        setEditError('');
        setEditBgFile(null);
        setEditBgPreview('');
        setEditBgRemoving(false);
        // Fetch current loginBgImage for this tenant
        try {
            const detail = await developerApi.getTenant(t.id);
            setEditBgExisting(detail?.loginBgImage || null);
        } catch {
            setEditBgExisting(null);
        }
    };

    const handleEditTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;
        setEditLoading(true);
        setEditError('');
        try {
            await developerApi.updateTenant(editingTenant.id, {
                name: editForm.name,
                maxUsers: editForm.maxUsers,
                contactEmail: editForm.contactEmail || undefined,
                contactPhone: editForm.contactPhone || undefined,
                address: editForm.address || undefined,
            });
            const serverBase = getServerBaseUrl();
            const token = localStorage.getItem('dev-token');
            // Handle login background image changes
            if (editBgRemoving && editBgExisting) {
                await fetch(`${serverBase}/api/dev/tenants/${editingTenant.id}/login-bg`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
            } else if (editBgFile) {
                const formData = new FormData();
                formData.append('image', editBgFile);
                await fetch(`${serverBase}/api/dev/tenants/${editingTenant.id}/login-bg`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData,
                });
            }
            setEditingTenant(null);
            fetchData();
        } catch (err: any) {
            setEditError(err.response?.data?.error || 'Failed to update tenant');
        } finally {
            setEditLoading(false);
        }
    };

    if (!devUser || loading) {
        return (
            <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: colors.text, fontSize: '18px' }}>Loading...</div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview' as const, label: '📊 Overview', icon: '📊' },
        { id: 'tenants' as const, label: '🏢 Tenants', icon: '🏢' },
        { id: 'health' as const, label: '💚 Health', icon: '💚' },
        { id: 'errors' as const, label: '🐛 Errors', icon: '🐛' },
        { id: 'emails' as const, label: '📧 Emails', icon: '📧' },
    ];

    return (
        <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: "'Inter', sans-serif", color: colors.text }}>
            {/* Header */}
            <header style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 32px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: colors.accentGradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px',
                    }}>🔑</div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Developer Portal</h1>
                        <p style={{ margin: 0, fontSize: '12px', color: colors.textMuted }}>{devUser.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout} style={{
                    padding: '8px 16px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                    color: '#f87171', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                }}>Logout</button>
            </header>

            {/* Tab Navigation */}
            <nav style={{
                display: 'flex', gap: '4px', padding: '16px 32px 0',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 20px',
                            background: activeTab === tab.id ? 'rgba(102,126,234,0.15)' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #667eea' : '2px solid transparent',
                            color: activeTab === tab.id ? '#667eea' : colors.textMuted,
                            fontSize: '14px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            borderRadius: '8px 8px 0 0',
                            transition: 'all 0.2s',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Content */}
            <main style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && health && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                            {[
                                { label: 'Total Tenants', value: health.tenants.totalTenants, icon: '🏢', color: '#667eea' },
                                { label: 'Active Tenants', value: health.tenants.activeTenants, icon: '✅', color: '#10b981' },
                                { label: 'Total Users', value: health.tenants.totalUsers, icon: '👥', color: '#8b5cf6' },
                                { label: 'Unresolved Errors', value: health.errors.unresolved, icon: '⚠️', color: health.errors.unresolved > 0 ? '#ef4444' : '#10b981' },
                                { label: 'Errors (24h)', value: health.errors.last24h, icon: '🕐', color: '#f59e0b' },
                            ].map((stat, i) => (
                                <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <span style={{ fontSize: '28px' }}>{stat.icon}</span>
                                    <div>
                                        <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                        <div style={{ fontSize: '12px', color: colors.textMuted }}>{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Server Info */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>🖥️ Server Info</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {[
                                        ['Uptime', health.server.uptimeFormatted],
                                        ['Node.js', health.server.nodeVersion],
                                        ['Platform', health.server.platform],
                                        ['Hostname', health.server.hostname],
                                    ].map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: colors.textMuted, fontSize: '13px' }}>{k}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Memory Usage */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>📊 Memory Usage</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {[
                                        ['RSS', `${health.server.memory.rss} MB`],
                                        ['Heap Used', `${health.server.memory.heapUsed} MB`],
                                        ['Heap Total', `${health.server.memory.heapTotal} MB`],
                                        ['External', `${health.server.memory.external} MB`],
                                    ].map(([k, v]) => (
                                        <div key={k}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: colors.textMuted, fontSize: '13px' }}>{k}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 500 }}>{v}</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: k === 'Heap Used' ? `${(health.server.memory.heapUsed / health.server.memory.heapTotal * 100)}%` : '40%',
                                                    background: colors.accentGradient,
                                                    borderRadius: '2px',
                                                    transition: 'width 0.5s',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Tenants Overview */}
                        <div style={{ ...cardStyle, marginTop: '20px' }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>🏢 Tenant Overview</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            {['Name', 'Type', 'Users', 'Departments', 'Status'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: colors.textMuted, fontWeight: 500 }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tenants.map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <td style={{ padding: '12px', fontSize: '14px', fontWeight: 500 }}>{t.name}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                                        background: 'rgba(102,126,234,0.15)', color: '#667eea',
                                                    }}>{t.type}</span>
                                                </td>
                                                <td style={{ padding: '12px', fontSize: '14px' }}>{t._count.users}</td>
                                                <td style={{ padding: '12px', fontSize: '14px' }}>{t._count.departments}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{
                                                        width: '8px', height: '8px', borderRadius: '50%',
                                                        background: t.isActive ? colors.success : colors.danger,
                                                        display: 'inline-block', marginRight: '6px',
                                                    }} />
                                                    <span style={{ fontSize: '13px' }}>{t.isActive ? 'Active' : 'Inactive'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TENANTS TAB */}
                {activeTab === 'tenants' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Tenant Management</h2>
                            <button onClick={() => { setShowCreateModal(true); setCreateResult(null); }} style={btnPrimary}>
                                + Create Tenant
                            </button>
                        </div>

                        {/* Create Modal */}
                        {showCreateModal && (
                            <div style={{
                                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                            }} onClick={() => !createResult && setShowCreateModal(false)}>
                                <div style={{
                                    width: '100%', maxWidth: '560px', ...cardStyle,
                                    background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
                                    maxHeight: '90vh', overflowY: 'auto',
                                }} onClick={e => e.stopPropagation()}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Create New Institution</h3>
                                            <button onClick={() => setShowCreateModal(false)} style={{
                                                background: 'none', border: 'none', color: colors.textMuted,
                                                fontSize: '20px', cursor: 'pointer',
                                            }}>✕</button>
                                        </div>
                                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.textMuted }}>
                                            A Super Admin account will be automatically created and credentials displayed.
                                        </p>
                                    </div>

                                    {createResult ? (
                                        <div>
                                            <div style={{
                                                padding: '20px', background: 'rgba(16,185,129,0.08)',
                                                border: '1px solid rgba(16,185,129,0.25)', borderRadius: '14px',
                                                marginBottom: '20px',
                                            }}>
                                                <h4 style={{ margin: '0 0 16px', color: '#10b981', fontSize: '16px' }}>✅ Institution Created!</h4>
                                                <div style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
                                                    <div><strong>Institution:</strong> {createResult.tenant.name}</div>
                                                    <div><strong>Departments:</strong> {createResult.departmentsCreated} auto-created</div>
                                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px' }}>
                                                        <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>ADMIN CREDENTIALS</div>
                                                        <div><strong>📧 Email:</strong> {createResult.adminUser.email}</div>
                                                        <div style={{
                                                            marginTop: '6px', padding: '10px 14px', background: 'rgba(255,255,255,0.06)',
                                                            borderRadius: '10px', fontFamily: 'monospace', fontSize: '15px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        }}>
                                                            <span>🔑 {createResult.adminPassword}</span>
                                                            <button onClick={() => navigator.clipboard.writeText(createResult.adminPassword)} style={{
                                                                background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '12px',
                                                            }}>Copy</button>
                                                        </div>
                                                    </div>
                                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px' }}>
                                                        <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px' }}>LOGIN URL</div>
                                                        <div style={{
                                                            padding: '10px 14px', background: 'rgba(255,255,255,0.06)',
                                                            borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                                                        }}>
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {typeof window !== 'undefined' ? window.location.origin : ''}/login?tenant={createResult.tenant.slug}
                                                            </span>
                                                            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/login?tenant=${createResult.tenant.slug}`)} style={{
                                                                background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
                                                            }}>Copy</button>
                                                        </div>
                                                    </div>
                                                    <p style={{ fontSize: '12px', color: '#f59e0b', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        ⚠️ Save these credentials — password won&apos;t be shown again.
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={() => setShowCreateModal(false)} style={{ ...btnPrimary, width: '100%' }}>Done</button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleCreateTenant}>
                                            <div style={{ display: 'grid', gap: '16px' }}>
                                                {/* Institution Name */}
                                                <div>
                                                    <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Institution Name *</label>
                                                    <input value={newTenant.name} onChange={e => setNewTenant(p => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))} required style={inputStyle} placeholder="e.g. Greenfield University" />
                                                </div>

                                                {/* Admin Name + Admin Email */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Admin Name *</label>
                                                        <input value={newTenant.adminName} onChange={e => setNewTenant(p => ({ ...p, adminName: e.target.value }))} required style={inputStyle} placeholder="e.g. Dr. Sharma" />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Admin Email *</label>
                                                        <input type="email" value={newTenant.adminEmail} onChange={e => setNewTenant(p => ({ ...p, adminEmail: e.target.value }))} required style={inputStyle} placeholder="admin@college.edu" />
                                                    </div>
                                                </div>

                                                {/* Plan + Max Users */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    <div>
                                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Max Users</label>
                                                        <input type="number" value={newTenant.maxUsers} onChange={e => setNewTenant(p => ({ ...p, maxUsers: parseInt(e.target.value) || 500 }))} style={inputStyle} min={1} />
                                                    </div>
                                                    <div>
                                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Slug</label>
                                                        <input value={newTenant.slug} onChange={e => setNewTenant(p => ({ ...p, slug: e.target.value }))} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '13px' }} placeholder="auto-generated" />
                                                    </div>
                                                </div>

                                                {/* College Type with auto-creates hint */}
                                                <div>
                                                    <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>College Type *</label>
                                                    <select value={newTenant.type} onChange={e => setNewTenant(p => ({ ...p, type: e.target.value }))} style={selectStyle}>
                                                        {Object.entries(typeEmojis).map(([type, emoji]) => (
                                                            <option key={type} value={type} style={{ background: '#1a1a2e', color: '#fff' }}>{emoji} {type}</option>
                                                        ))}
                                                    </select>
                                                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '6px 0 0' }}>
                                                        {typeHints[newTenant.type]}
                                                    </p>
                                                </div>

                                                {/* Login Background Image Upload */}
                                                <div>
                                                    <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Login Background Image</label>
                                                    <div style={{
                                                        border: `2px dashed ${loginBgPreview ? 'rgba(102,126,234,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                                        borderRadius: '14px', overflow: 'hidden',
                                                        cursor: 'pointer', position: 'relative',
                                                        height: loginBgPreview ? '140px' : '80px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: loginBgPreview ? `url(${loginBgPreview}) center/cover` : 'rgba(255,255,255,0.03)',
                                                        transition: 'all 0.2s',
                                                    }} onClick={() => document.getElementById('login-bg-upload')?.click()}>
                                                        {loginBgPreview && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />}
                                                        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                                                            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{loginBgPreview ? '✅' : '📷'}</div>
                                                            <p style={{ fontSize: '12px', color: loginBgPreview ? '#fff' : colors.textMuted, margin: 0 }}>
                                                                {loginBgPreview ? 'Click to change image' : 'Click to upload background image'}
                                                            </p>
                                                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>
                                                                JPG, PNG, WebP — max 5MB
                                                            </p>
                                                        </div>
                                                        <input
                                                            id="login-bg-upload" type="file" accept="image/jpeg,image/png,image/webp"
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setLoginBgFile(file);
                                                                    setLoginBgPreview(URL.createObjectURL(file));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    {loginBgFile && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                                            <span style={{ fontSize: '12px', color: colors.textMuted }}>{loginBgFile.name}</span>
                                                            <button type="button" onClick={() => { setLoginBgFile(null); setLoginBgPreview(''); }} style={{
                                                                background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px',
                                                            }}>Remove</button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Login Page Preview */}
                                                <div>
                                                    <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '8px', display: 'block' }}>Login Page Preview</label>
                                                    <div style={{
                                                        borderRadius: '14px', overflow: 'hidden',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        height: '160px', position: 'relative',
                                                        background: loginBgPreview
                                                            ? `url(${loginBgPreview}) center/cover`
                                                            : 'linear-gradient(135deg, rgba(102,126,234,0.15) 0%, rgba(118,75,162,0.1) 50%, rgba(102,126,234,0.08) 100%)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <div style={{
                                                            background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
                                                            borderRadius: '14px', padding: '16px 24px', width: '160px',
                                                            textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)',
                                                        }}>
                                                            <div style={{
                                                                width: '28px', height: '28px', borderRadius: '8px',
                                                                background: colors.accentGradient,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                margin: '0 auto 8px', fontSize: '14px', color: '#fff', fontWeight: 700,
                                                            }}>{typeEmojis[newTenant.type] || '🏛️'}</div>
                                                            <p style={{ fontSize: '11px', fontWeight: 600, margin: '0 0 8px', color: '#fff' }}>
                                                                {newTenant.name || 'Institution'}
                                                            </p>
                                                            <div style={{ display: 'grid', gap: '4px' }}>
                                                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px' }} />
                                                                <div style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px' }} />
                                                                <div style={{ height: '10px', background: colors.accentGradient, borderRadius: '5px', marginTop: '4px' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {createError && (
                                                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontSize: '13px' }}>
                                                    {createError}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                                <button type="button" onClick={() => setShowCreateModal(false)} style={{
                                                    flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)',
                                                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                                                    color: colors.text, fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                                                }}>Cancel</button>
                                                <button type="submit" disabled={createLoading} style={{ ...btnPrimary, flex: 1, padding: '12px', borderRadius: '12px' }}>
                                                    {createLoading ? 'Creating...' : 'Create Institution'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tenant Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
                            {tenants.map(t => (
                                <div key={t.id} style={{
                                    ...cardStyle,
                                    borderLeft: `3px solid ${t.isActive ? colors.success : colors.danger}`,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{t.name}</h4>
                                            <span style={{ fontSize: '12px', color: colors.textMuted }}>/{t.slug}</span>
                                        </div>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                            background: t.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: t.isActive ? '#10b981' : '#ef4444',
                                        }}>{t.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#667eea' }}>{t._count.users}</div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Users</div>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>{t._count.departments}</div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Depts</div>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>{t._count.batches}</div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted }}>Batches</div>
                                        </div>
                                    </div>

                                    {/* Login URL */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '8px 12px', background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px', marginBottom: '12px',
                                    }}>
                                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: colors.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            /login?tenant={t.slug}
                                        </span>
                                        <button onClick={() => copyLoginUrl(t.id, t.slug)} style={{
                                            padding: '4px 10px', fontSize: '11px', fontWeight: 500,
                                            background: copiedUrl === t.id ? 'rgba(16,185,129,0.15)' : 'rgba(102,126,234,0.1)',
                                            border: `1px solid ${copiedUrl === t.id ? 'rgba(16,185,129,0.3)' : 'rgba(102,126,234,0.2)'}`,
                                            borderRadius: '6px', cursor: 'pointer',
                                            color: copiedUrl === t.id ? '#10b981' : '#667eea',
                                            transition: 'all 0.2s',
                                        }}>
                                            {copiedUrl === t.id ? '✓ Copied' : '📋 Copy URL'}
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                        <span style={{ color: colors.textMuted }}>
                                            {typeEmojis[t.type] || '🏛️'} <strong style={{ color: colors.text }}>{t.type}</strong>
                                        </span>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <button onClick={() => openEditModal(t)} style={{
                                                padding: '6px 12px', fontSize: '12px',
                                                background: 'rgba(102,126,234,0.1)',
                                                border: '1px solid rgba(102,126,234,0.3)',
                                                borderRadius: '6px', cursor: 'pointer',
                                                color: '#667eea',
                                            }}>✏️ Edit</button>
                                            <button onClick={() => setConfiguringModulesTenant(t)} style={{
                                                padding: '6px 12px', fontSize: '12px',
                                                background: 'rgba(139,92,246,0.1)',
                                                border: '1px solid rgba(139,92,246,0.3)',
                                                borderRadius: '6px', cursor: 'pointer',
                                                color: '#a78bfa',
                                            }}>🎛️ Modules</button>
                                            <button onClick={() => handleToggleTenant(t.id, t.isActive)} style={{
                                                padding: '6px 12px', fontSize: '12px',
                                                background: t.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                                                border: `1px solid ${t.isActive ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                                borderRadius: '6px', cursor: 'pointer',
                                                color: t.isActive ? '#f87171' : '#10b981',
                                            }}>
                                                {t.isActive ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Edit Tenant Modal */}
                {editingTenant && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }} onClick={() => setEditingTenant(null)}>
                        <div style={{
                            width: '100%', maxWidth: '500px', ...cardStyle,
                            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
                            maxHeight: '90vh', overflowY: 'auto',
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Tenant: {editingTenant.name}</h3>
                                <button onClick={() => setEditingTenant(null)} style={{
                                    background: 'none', border: 'none', color: colors.textMuted,
                                    fontSize: '20px', cursor: 'pointer',
                                }}>✕</button>
                            </div>
                            <form onSubmit={handleEditTenant}>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Institution Name *</label>
                                        <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required style={inputStyle} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Max Users</label>
                                            <input type="number" value={editForm.maxUsers} onChange={e => setEditForm(p => ({ ...p, maxUsers: parseInt(e.target.value) || 500 }))} style={inputStyle} min={1} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Contact Email</label>
                                            <input type="email" value={editForm.contactEmail} onChange={e => setEditForm(p => ({ ...p, contactEmail: e.target.value }))} style={inputStyle} placeholder="contact@college.edu" />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Contact Phone</label>
                                            <input value={editForm.contactPhone} onChange={e => setEditForm(p => ({ ...p, contactPhone: e.target.value }))} style={inputStyle} placeholder="+91 98765 43210" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Slug</label>
                                            <input value={editingTenant.slug} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Address</label>
                                        <textarea value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Full institution address" />
                                    </div>

                                    {/* Login Background Image */}
                                    <div>
                                        <label style={{ fontSize: '13px', color: colors.textMuted, marginBottom: '6px', display: 'block' }}>Login Background Image</label>
                                        {editBgRemoving ? (
                                            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px dashed rgba(239,68,68,0.3)', textAlign: 'center' }}>
                                                <p style={{ fontSize: '13px', color: '#f87171', margin: '0 0 8px' }}>Image will be removed on save</p>
                                                <button type="button" onClick={() => setEditBgRemoving(false)} style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: '12px' }}>Undo</button>
                                            </div>
                                        ) : editBgPreview || editBgExisting ? (
                                            <div>
                                                <div style={{
                                                    height: '120px', borderRadius: '12px', overflow: 'hidden',
                                                    backgroundImage: `url(${editBgPreview || `${getServerBaseUrl()}${editBgExisting}`})`,
                                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                                    border: '1px solid rgba(255,255,255,0.12)', position: 'relative',
                                                }}>
                                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                                    <button type="button" onClick={() => document.getElementById('edit-bg-upload')?.click()} style={{
                                                        padding: '4px 10px', fontSize: '12px', background: 'rgba(102,126,234,0.1)',
                                                        border: '1px solid rgba(102,126,234,0.3)', borderRadius: '6px', cursor: 'pointer', color: '#667eea',
                                                    }}>Change</button>
                                                    <button type="button" onClick={() => { setEditBgFile(null); setEditBgPreview(''); setEditBgRemoving(true); }} style={{
                                                        padding: '4px 10px', fontSize: '12px', background: 'rgba(239,68,68,0.1)',
                                                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', cursor: 'pointer', color: '#f87171',
                                                    }}>Remove</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '12px',
                                                    height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', background: 'rgba(255,255,255,0.03)', transition: 'all 0.2s',
                                                }}
                                                onClick={() => document.getElementById('edit-bg-upload')?.click()}
                                            >
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>📷</div>
                                                    <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>Click to upload background image</p>
                                                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>JPG, PNG, WebP — max 5MB</p>
                                                </div>
                                            </div>
                                        )}
                                        <input id="edit-bg-upload" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setEditBgFile(file);
                                                    setEditBgPreview(URL.createObjectURL(file));
                                                    setEditBgRemoving(false);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                {editError && (
                                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontSize: '13px' }}>
                                        {editError}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                    <button type="button" onClick={() => setEditingTenant(null)} style={{
                                        flex: 1, padding: '12px', background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                                        color: colors.text, fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                                    }}>Cancel</button>
                                    <button type="submit" disabled={editLoading} style={{ ...btnPrimary, flex: 1, padding: '12px', borderRadius: '12px' }}>
                                        {editLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Module Configuration Modal */}
                {configuringModulesTenant && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }} onClick={() => setConfiguringModulesTenant(null)}>
                        <div style={{
                            width: '100%', maxWidth: '700px',
                            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '16px', padding: '24px',
                            maxHeight: '90vh', overflowY: 'auto',
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                                    🎛️ Module Configuration
                                </h3>
                                <button onClick={() => setConfiguringModulesTenant(null)} style={{
                                    background: 'none', border: 'none', color: colors.textMuted,
                                    fontSize: '20px', cursor: 'pointer',
                                }}>✕</button>
                            </div>
                            <ModuleTogglePanel
                                tenantId={configuringModulesTenant.id}
                                tenantName={configuringModulesTenant.name}
                            />
                        </div>
                    </div>
                )}

                {/* HEALTH TAB */}
                {activeTab === 'health' && health && (
                    <div>
                        <h2 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700 }}>System Health</h2>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <span style={{
                                width: '12px', height: '12px', borderRadius: '50%',
                                background: health.status === 'ok' ? '#10b981' : '#ef4444',
                                boxShadow: `0 0 12px ${health.status === 'ok' ? '#10b981' : '#ef4444'}`,
                            }} />
                            <span style={{ fontSize: '18px', fontWeight: 600, color: health.status === 'ok' ? '#10b981' : '#ef4444' }}>
                                {health.status === 'ok' ? 'All Systems Operational' : 'Issues Detected'}
                            </span>
                            <span style={{ fontSize: '12px', color: colors.textMuted }}>
                                Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            {/* Server Stats */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>🖥️ Server</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {[
                                        ['Uptime', health.server.uptimeFormatted, '⏱️'],
                                        ['Node Version', health.server.nodeVersion, '📦'],
                                        ['Platform', `${health.server.platform} (${health.server.hostname})`, '💻'],
                                        ['CPU Load (1m)', health.server.cpuLoad[0].toFixed(2), '⚡'],
                                        ['CPU Load (5m)', health.server.cpuLoad[1].toFixed(2), '⚡'],
                                    ].map(([k, v, icon]) => (
                                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: colors.textMuted, fontSize: '13px' }}>{icon} {k}</span>
                                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Memory */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>🧠 Memory</h3>
                                <div style={{ display: 'grid', gap: '16px' }}>
                                    {[
                                        { label: 'RSS', value: health.server.memory.rss, max: 512 },
                                        { label: 'Heap Used', value: health.server.memory.heapUsed, max: health.server.memory.heapTotal },
                                        { label: 'External', value: health.server.memory.external, max: 100 },
                                    ].map(m => (
                                        <div key={m.label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '13px', color: colors.textMuted }}>{m.label}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.value} MB</span>
                                            </div>
                                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${Math.min(100, (m.value / m.max) * 100)}%`,
                                                    background: m.value / m.max > 0.8 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : colors.accentGradient,
                                                    borderRadius: '4px',
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Error Summary */}
                            <div style={cardStyle}>
                                <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>⚠️ Error Summary</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    {[
                                        { label: 'Total Errors', value: health.errors.total, color: colors.text },
                                        { label: 'Unresolved', value: health.errors.unresolved, color: health.errors.unresolved > 0 ? '#ef4444' : '#10b981' },
                                        { label: 'Critical', value: health.errors.critical, color: health.errors.critical > 0 ? '#ef4444' : '#10b981' },
                                        { label: 'Last 24h', value: health.errors.last24h, color: '#f59e0b' },
                                    ].map(s => (
                                        <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                            <div style={{ fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '4px' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ERRORS TAB */}
                {activeTab === 'errors' && (
                    <div>
                        <h2 style={{ margin: '0 0 24px', fontSize: '22px', fontWeight: 700 }}>Error Tracker</h2>

                        {errors.errors.length === 0 ? (
                            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
                                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎉</span>
                                <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>No Errors!</p>
                                <p style={{ color: colors.textMuted, fontSize: '14px', margin: 0 }}>System is running smoothly.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {errors.errors.map(err => (
                                    <div key={err.id} style={{
                                        ...cardStyle,
                                        opacity: err.resolved ? 0.5 : 1,
                                        borderLeft: `3px solid ${err.severity === 'CRITICAL' ? '#ef4444' : err.severity === 'WARNING' ? '#f59e0b' : '#667eea'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                                        background: err.severity === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : err.severity === 'WARNING' ? 'rgba(245,158,11,0.15)' : 'rgba(102,126,234,0.15)',
                                                        color: err.severity === 'CRITICAL' ? '#ef4444' : err.severity === 'WARNING' ? '#f59e0b' : '#667eea',
                                                    }}>{err.severity}</span>
                                                    <span style={{ fontSize: '12px', color: colors.textMuted, fontFamily: 'monospace' }}>{err.errorCode}</span>
                                                    {err.tenant && <span style={{ fontSize: '11px', color: colors.textMuted }}>• {err.tenant.name}</span>}
                                                </div>
                                                <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500 }}>{err.message}</p>
                                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: colors.textMuted }}>
                                                    {err.method && err.endpoint && <span>{err.method} {err.endpoint}</span>}
                                                    <span>{new Date(err.createdAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            {!err.resolved && (
                                                <button onClick={() => handleResolveError(err.id)} style={{
                                                    padding: '6px 12px', fontSize: '12px',
                                                    background: 'rgba(16,185,129,0.1)',
                                                    border: '1px solid rgba(16,185,129,0.3)',
                                                    borderRadius: '6px', cursor: 'pointer',
                                                    color: '#10b981', whiteSpace: 'nowrap',
                                                }}>✓ Resolve</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* EMAILS TAB */}
                {activeTab === 'emails' && (
                    <div>
                        <h2 style={{ margin: '0 0 20px', fontSize: '22px', fontWeight: 700 }}>📧 Email Delivery Monitor</h2>

                        {/* Email Stats */}
                        {emailStats && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                                {[
                                    { label: 'Total Sent', value: emailStats.sent, icon: '✅', color: '#10b981' },
                                    { label: 'Failed', value: emailStats.failed, icon: '❌', color: emailStats.failed > 0 ? '#ef4444' : '#10b981' },
                                    { label: 'Last 24h', value: emailStats.last24h, icon: '📤', color: '#667eea' },
                                    { label: 'Failed (24h)', value: emailStats.failedLast24h, icon: '⚠️', color: emailStats.failedLast24h > 0 ? '#f59e0b' : '#10b981' },
                                    { label: 'Total Logged', value: emailStats.total, icon: '📊', color: '#8b5cf6' },
                                ].map((stat, i) => (
                                    <div key={i} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '24px' }}>{stat.icon}</span>
                                        <div>
                                            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                            <div style={{ fontSize: '11px', color: colors.textMuted }}>{stat.label}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Filter Bar */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            {['all', 'SENT', 'FAILED'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setEmailFilter(status)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: emailFilter === status ? 'rgba(102,126,234,0.2)' : 'rgba(255,255,255,0.04)',
                                        color: emailFilter === status ? '#667eea' : colors.textMuted,
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {status === 'all' ? '📋 All' : status === 'SENT' ? '✅ Sent' : '❌ Failed'}
                                </button>
                            ))}
                        </div>

                        {/* Email List */}
                        {emails.emails.length === 0 ? (
                            <div style={{ ...cardStyle, textAlign: 'center', padding: '48px' }}>
                                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📭</span>
                                <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>No emails found</p>
                                <p style={{ color: colors.textMuted, fontSize: '14px', margin: 0 }}>Email logs will appear here once emails are sent.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {emails.emails.map((email: EmailLog) => (
                                    <div key={email.id} style={{
                                        ...cardStyle,
                                        padding: '16px 20px',
                                        borderLeft: `3px solid ${email.status === 'SENT' ? '#10b981' : '#ef4444'}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                                        background: email.status === 'SENT' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                        color: email.status === 'SENT' ? '#10b981' : '#ef4444',
                                                    }}>{email.status}</span>
                                                    <span style={{ fontSize: '11px', color: colors.textMuted }}>{email.provider}</span>
                                                </div>
                                                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {email.subject}
                                                </p>
                                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: colors.textMuted }}>
                                                    <span>📧 {email.to}</span>
                                                    <span>{new Date(email.createdAt).toLocaleString()}</span>
                                                </div>
                                                {email.error && (
                                                    <p style={{
                                                        margin: '6px 0 0', fontSize: '12px', color: '#f87171',
                                                        padding: '6px 10px', background: 'rgba(239,68,68,0.08)',
                                                        borderRadius: '6px', fontFamily: 'monospace',
                                                    }}>
                                                        {email.error}
                                                    </p>
                                                )}
                                            </div>
                                            {email.status === 'FAILED' && (
                                                <button onClick={() => handleRetryEmail(email.id)} style={{
                                                    padding: '6px 14px', fontSize: '12px',
                                                    background: 'rgba(102,126,234,0.1)',
                                                    border: '1px solid rgba(102,126,234,0.3)',
                                                    borderRadius: '6px', cursor: 'pointer',
                                                    color: '#667eea', whiteSpace: 'nowrap',
                                                }}>🔄 Retry</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
