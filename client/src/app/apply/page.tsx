'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, ArrowRight } from 'lucide-react';

import { API_URL } from '@/lib/config';

export default function ApplyLandingPage() {
    const router = useRouter();
    const [tenants, setTenants] = useState<Array<{ id: number; name: string; slug: string; type: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/dev/tenants/active`)
            .then(r => r.json())
            .then(data => setTenants(Array.isArray(data) ? data : []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)',
            padding: '24px',
        }}>
            <div style={{ maxWidth: '600px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex', width: '64px', height: '64px', borderRadius: '18px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 10px 30px rgba(99,102,241,0.3)', marginBottom: '16px',
                    }}>
                        <GraduationCap style={{ width: '32px', height: '32px', color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                        Apply for Admission
                    </h1>
                    <p style={{ fontSize: '15px', color: '#64748b' }}>
                        Select your institution to begin the application process
                    </p>
                </div>

                <div style={{
                    background: 'rgba(255,255,255,0.9)', borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(16px)', padding: '28px',
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                            <p style={{ color: '#94a3b8', marginTop: '12px', fontSize: '14px' }}>Loading institutions...</p>
                        </div>
                    ) : tenants.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No institutions are currently accepting applications.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {tenants.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => router.push(`/apply/${t.slug}`)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        width: '100%', padding: '16px 20px', borderRadius: '14px',
                                        border: '1px solid #e2e8f0', background: '#fff',
                                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.1)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <div>
                                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{t.name}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{t.type} • {t.slug}</div>
                                    </div>
                                    <ArrowRight style={{ width: '18px', height: '18px', color: '#94a3b8' }} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
                    Secure, multi-tenant platform for educational institutions
                </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
