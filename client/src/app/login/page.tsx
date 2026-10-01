'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, GraduationCap, Lock, Mail, Building2, KeyRound, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { authApi, developerApi } from '@/lib/api';
import { getServerBaseUrl } from '@/lib/config';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';

interface TenantBranding {
    name: string;
    slug: string;
    type: string;
    logo: string | null;
    loginBgImage: string | null;
}

// ── Login Form (requires ?tenant=slug in URL) ─────────────────
function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tenantSlug = searchParams.get('tenant');
    const setAuth = useAuthStore((state) => state.setAuth);

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ─── Forgot Password States ──────────────────────────────────
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOtp, setForgotOtp] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
    const [forgotStep, setForgotStep] = useState(1); // 1 = Request, 2 = Verify & Reset, 3 = Success
    const [isForgotLoading, setIsForgotLoading] = useState(false);
    const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) {
            toast.error('Please enter a valid email address.');
            return;
        }
        if (!tenantSlug) {
            toast.error('No institution context selected.');
            return;
        }
        setIsForgotLoading(true);
        try {
            await authApi.requestPasswordResetOtp(forgotEmail, tenantSlug);
            toast.success('Verification code sent! Please check your email.');
            setForgotStep(2);
        } catch (err: any) {
            const errMsg = err.response?.data?.error || 'Failed to send verification code. Please try again.';
            toast.error(errMsg);
        } finally {
            setIsForgotLoading(false);
        }
    };

    const handleVerifyAndReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotOtp || forgotOtp.length !== 6) {
            toast.error('Please enter a valid 6-digit verification code.');
            return;
        }
        if (forgotNewPassword.length < 8) {
            toast.error('New password must be at least 8 characters long.');
            return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }
        if (!tenantSlug) {
            toast.error('No institution context selected.');
            return;
        }

        setIsForgotLoading(true);
        try {
            await authApi.resetPasswordWithOtp({
                email: forgotEmail,
                tenantSlug,
                otp: forgotOtp,
                newPassword: forgotNewPassword,
            });
            toast.success('Password reset successfully!');
            setForgotStep(3);
        } catch (err: any) {
            const errMsg = err.response?.data?.error || 'Failed to reset password. Please check the code and try again.';
            toast.error(errMsg);
        } finally {
            setIsForgotLoading(false);
        }
    };

    // Tenant branding
    const [branding, setBranding] = useState<TenantBranding | null>(null);
    const [brandingLoaded, setBrandingLoaded] = useState(false);
    const [brandingError, setBrandingError] = useState(false);

    // If no tenant slug, show institution picker
    const [tenants, setTenants] = useState<Array<{ id: number; name: string; slug: string; type: string; logoUrl?: string }>>([]);
    const [tenantsLoading, setTenantsLoading] = useState(true);

    useEffect(() => {
        if (tenantSlug) {
            // Fetch branding for specific tenant
            developerApi.getTenantBranding(tenantSlug)
                .then((data: TenantBranding) => setBranding(data))
                .catch(() => setBrandingError(true))
                .finally(() => setBrandingLoaded(true));
        } else {
            // No slug — fetch all tenants to show institution picker
            developerApi.getActiveTenants()
                .then((data: any[]) => setTenants(data))
                .catch(() => { })
                .finally(() => { setTenantsLoading(false); setBrandingLoaded(true); });
        }
    }, [tenantSlug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { user, token } = await authApi.login(identifier, password, tenantSlug || undefined);
            setAuth(user, token);

            const roleRoutes: Record<string, string> = {
                SUPER_ADMIN: '/dashboard/admin',
                DEPARTMENT_ADMIN: '/dashboard/dept-admin',
                COE: '/dashboard/coe',
                TEACHER: '/dashboard/teacher',
                CLERK: '/dashboard/clerk',
                FIRST_YEAR_COORDINATOR: '/dashboard/first-year-coordinator',
                ADMISSIONS_ADMIN: '/dashboard/admissions',
                ADMIN_CLERK: '/dashboard/admissions',
                PARENT: '/dashboard/parent',
            };
            router.push(roleRoutes[user.role] || '/dashboard/student');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setError(error.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    // Loading
    if (!brandingLoaded) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)' }}>
                <div style={{
                    width: '40px', height: '40px',
                    border: '4px solid rgba(99,102,241,0.2)',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ── No tenant slug → Show institution picker ─────────────────
    if (!tenantSlug) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4"
                style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)' }}>
                <div style={{ width: '100%', maxWidth: '480px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '56px', height: '56px', borderRadius: '14px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            boxShadow: '0 8px 20px rgba(99,102,241,0.3)', marginBottom: '16px',
                        }}>
                            <Building2 style={{ width: '28px', height: '28px', color: '#fff' }} />
                        </div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
                            Select Your Institution
                        </h1>
                        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                            Choose your institution to sign in
                        </p>
                    </div>

                    <div style={{
                        padding: '24px', borderRadius: '20px',
                        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                        border: '1px solid rgba(255,255,255,0.6)',
                    }}>
                        {tenantsLoading ? (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <div style={{
                                    width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.2)',
                                    borderTopColor: '#6366f1', borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite', margin: '0 auto',
                                }} />
                            </div>
                        ) : tenants.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '16px 0' }}>
                                No institutions available.
                            </p>
                        ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {tenants.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => router.push(`/login?tenant=${t.slug}`)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 16px', borderRadius: '14px',
                                            border: '1px solid #e5e7eb', background: '#fff',
                                            cursor: 'pointer', textAlign: 'left', width: '100%',
                                            transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                                            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(99,102,241,0.15)';
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb';
                                            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                        }}
                                    >
                                        <div style={{
                                            width: '40px', height: '40px', borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <GraduationCap style={{ width: '20px', height: '20px', color: '#fff' }} />
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{t.name}</div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>{t.type}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ── Tenant not found ──────────────────────────────────────────
    if (brandingError) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4"
                style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)' }}>
                <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
                    <div style={{
                        width: '64px', height: '64px', background: '#fef2f2', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                    }}>
                        <span style={{ fontSize: '28px' }}>😕</span>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Institution Not Found</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
                        No institution found with code <strong>"{tenantSlug}"</strong>. Please check the URL.
                    </p>
                    <button onClick={() => router.push('/login')} style={{
                        padding: '10px 24px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    }}>
                        View All Institutions
                    </button>
                </div>
            </div>
        );
    }

    // ── Tenant-Specific Login ─────────────────────────────────────
    const institutionName = branding?.name || tenantSlug;
    const hasBg = branding?.loginBgImage;
    // Data URIs (data:image/...) are used directly; legacy file paths need server base URL
    const bgUrl = hasBg
        ? (branding!.loginBgImage!.startsWith('data:') ? branding!.loginBgImage! : `${getServerBaseUrl()}${branding!.loginBgImage}`)
        : null;

    return (
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
            style={bgUrl
                ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)' }
            }>

            {/* Dark overlay for custom background */}
            {bgUrl && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />}

            {/* Decorative blobs (default bg only) */}
            {!bgUrl && (<>
                <div style={{
                    position: 'absolute', top: '-10%', left: '-5%',
                    width: '500px', height: '500px', borderRadius: '50%', opacity: 0.15,
                    background: 'radial-gradient(circle, #818cf8, transparent 70%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: '-10%', right: '-5%',
                    width: '600px', height: '600px', borderRadius: '50%', opacity: 0.1,
                    background: 'radial-gradient(circle, #2dd4bf, transparent 70%)',
                    pointerEvents: 'none',
                }} />
            </>)}

            <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
                {/* Logo & Brand */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '64px', height: '64px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        boxShadow: '0 10px 25px rgba(99,102,241,0.3)',
                        marginBottom: '16px',
                    }}>
                        {branding?.logo ? (
                            <img src={branding.logo.startsWith('data:') ? branding.logo : (branding.logo.startsWith('http') ? branding.logo : `${getServerBaseUrl()}${branding.logo}`)}
                                alt="" style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '4px' }} />
                        ) : (
                            <GraduationCap style={{ width: '32px', height: '32px', color: '#fff' }} />
                        )}
                    </div>
                    <h1 style={{
                        fontSize: '26px', fontWeight: 800, color: bgUrl ? '#fff' : '#111827',
                        letterSpacing: '-0.025em', margin: 0,
                    }}>
                        {institutionName}
                    </h1>
                    <p style={{ color: bgUrl ? 'rgba(255,255,255,0.8)' : '#6b7280', marginTop: '6px', fontSize: '14px' }}>
                        Student & Faculty Portal
                    </p>
                </div>

                {/* Login Card */}
                <div style={{
                    padding: '32px', borderRadius: '20px',
                    background: bgUrl ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(255,255,255,0.6)',
                }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', margin: 0 }}>Welcome back</h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                            Sign in to your account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
                        {error && (
                            <div style={{
                                padding: '12px 16px', borderRadius: '12px',
                                background: '#fef2f2', border: '1px solid #fecaca',
                                fontSize: '14px', color: '#dc2626',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Email / Roll Number */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                                Email or Roll Number
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Enter email or roll number"
                                    required
                                    autoComplete="email"
                                    style={{
                                        width: '100%', height: '44px', padding: '0 40px 0 14px',
                                        borderRadius: '12px', border: '1px solid #e5e7eb',
                                        background: '#fff', fontSize: '14px', color: '#111827',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                />
                                <Mail style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                    style={{
                                        width: '100%', height: '44px', padding: '0 40px 0 14px',
                                        borderRadius: '12px', border: '1px solid #e5e7eb',
                                        background: '#fff', fontSize: '14px', color: '#111827',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#6366f1'}
                                    onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                        color: '#9ca3af',
                                    }}
                                    tabIndex={-1}
                                >
                                    {showPassword
                                        ? <EyeOff style={{ width: '18px', height: '18px' }} />
                                        : <Eye style={{ width: '18px', height: '18px' }} />
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Remember + Forgot */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: '#6366f1' }} />
                                <span style={{ fontSize: '14px', color: '#6b7280' }}>Remember me</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsForgotModalOpen(true)}
                                style={{
                                    fontSize: '14px', fontWeight: 500, color: '#6366f1',
                                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                    textDecoration: 'none'
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            style={{
                                width: '100%', height: '48px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                border: 'none', color: '#fff', fontSize: '15px', fontWeight: 600,
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.7 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                                transition: 'all 0.2s',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <Lock style={{ width: '16px', height: '16px' }} />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>


                </div>

                {/* Footer */}
                <p style={{ textAlign: 'center', fontSize: '12px', color: bgUrl ? 'rgba(255,255,255,0.6)' : '#9ca3af', marginTop: '24px' }}>
                    © {new Date().getFullYear()} {institutionName}. Powered by Academic Operations
                </p>
            </div>

            {/* ─── Forgot Password OTP Modal ─── */}
            {isForgotModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.2s ease-out',
                }}>
                    <div style={{
                        width: '100%', maxWidth: '440px',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.7)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        padding: '32px',
                        position: 'relative',
                        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        {/* Close button */}
                        {forgotStep !== 3 && (
                            <button
                                onClick={() => {
                                    setIsForgotModalOpen(false);
                                    setForgotStep(1);
                                    setForgotEmail('');
                                    setForgotOtp('');
                                    setForgotNewPassword('');
                                    setForgotConfirmPassword('');
                                }}
                                style={{
                                    position: 'absolute', right: '20px', top: '20px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#6b7280', padding: '4px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background-color 0.2s',
                                }}
                            >
                                <X style={{ width: '20px', height: '20px' }} />
                            </button>
                        )}

                        {forgotStep === 1 && (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '48px', height: '48px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                        color: 'white', marginBottom: '16px',
                                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)',
                                    }}>
                                        <KeyRound style={{ width: '24px', height: '24px' }} />
                                    </div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
                                        Reset Password
                                    </h2>
                                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                        Enter your email to receive a 6-digit verification code.
                                    </p>
                                </div>

                                <form onSubmit={handleRequestOtp}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                                            Email Address
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                                                <Mail style={{ width: '18px', height: '18px' }} />
                                            </span>
                                            <input
                                                type="email"
                                                required
                                                placeholder="Enter your email"
                                                value={forgotEmail}
                                                onChange={e => setForgotEmail(e.target.value)}
                                                style={{
                                                    width: '100%', height: '44px', borderRadius: '10px',
                                                    border: '1px solid #e5e7eb', paddingLeft: '40px', paddingRight: '12px',
                                                    fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isForgotLoading}
                                        style={{
                                            width: '100%', height: '44px', borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                            border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600,
                                            cursor: isForgotLoading ? 'not-allowed' : 'pointer',
                                            opacity: isForgotLoading ? 0.7 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                                        }}
                                    >
                                        {isForgotLoading ? (
                                            <>
                                                <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Sending Code...
                                            </>
                                        ) : 'Send Verification Code'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {forgotStep === 2 && (
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '48px', height: '48px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: 'white', marginBottom: '16px',
                                        boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
                                    }}>
                                        <ShieldCheck style={{ width: '24px', height: '24px' }} />
                                    </div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
                                        Verify Code
                                    </h2>
                                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                                        We sent a 6-digit code to <strong style={{ color: '#374151' }}>{forgotEmail}</strong>.
                                    </p>
                                </div>

                                <form onSubmit={handleVerifyAndReset}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                                            Verification Code (OTP)
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={6}
                                            placeholder="Enter 6-digit code"
                                            value={forgotOtp}
                                            onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                            style={{
                                                width: '100%', height: '44px', borderRadius: '10px',
                                                border: '1px solid #e5e7eb', textAlign: 'center',
                                                fontSize: '18px', fontWeight: 700, letterSpacing: '4px',
                                                boxSizing: 'border-box', outline: 'none',
                                            }}
                                        />
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                                            New Password
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showForgotNewPassword ? 'text' : 'password'}
                                                required
                                                placeholder="Minimum 8 characters"
                                                value={forgotNewPassword}
                                                onChange={e => setForgotNewPassword(e.target.value)}
                                                style={{
                                                    width: '100%', height: '44px', borderRadius: '10px',
                                                    border: '1px solid #e5e7eb', paddingLeft: '12px', paddingRight: '40px',
                                                    fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                                                style={{
                                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0
                                                }}
                                            >
                                                {showForgotNewPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                                            Confirm Password
                                        </label>
                                        <input
                                            type="password"
                                            required
                                            placeholder="Re-enter new password"
                                            value={forgotConfirmPassword}
                                            onChange={e => setForgotConfirmPassword(e.target.value)}
                                            style={{
                                                width: '100%', height: '44px', borderRadius: '10px',
                                                border: '1px solid #e5e7eb', paddingLeft: '12px', paddingRight: '12px',
                                                fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                                            }}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isForgotLoading}
                                        style={{
                                            width: '100%', height: '44px', borderRadius: '10px',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600,
                                            cursor: isForgotLoading ? 'not-allowed' : 'pointer',
                                            opacity: isForgotLoading ? 0.7 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                                        }}
                                    >
                                        {isForgotLoading ? (
                                            <>
                                                <svg style={{ width: '16px', height: '16px', animation: 'spin 0.8s linear infinite' }} fill="none" viewBox="0 0 24 24">
                                                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Resetting Password...
                                            </>
                                        ) : 'Reset Password'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setForgotStep(1)}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'center', background: 'none',
                                            border: 'none', color: '#6b7280', fontSize: '13px', marginTop: '14px',
                                            cursor: 'pointer', textDecoration: 'underline'
                                        }}
                                    >
                                        Change email address
                                    </button>
                                </form>
                            </div>
                        )}

                        {forgotStep === 3 && (
                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '56px', height: '56px', borderRadius: '50%',
                                    backgroundColor: '#ecfdf5', color: '#10b981', marginBottom: '20px',
                                }}>
                                    <CheckCircle2 style={{ width: '32px', height: '32px' }} />
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
                                    Password Reset Success!
                                </h2>
                                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px', lineHeight: '20px' }}>
                                    Your password has been successfully reset. You can now log in to the portal with your new password.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsForgotModalOpen(false);
                                        setForgotStep(1);
                                        setForgotEmail('');
                                        setForgotOtp('');
                                        setForgotNewPassword('');
                                        setForgotConfirmPassword('');
                                    }}
                                    style={{
                                        width: '100%', height: '44px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                        border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600,
                                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                                    }}
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
}

export default function LoginPage() {
    return (
        <React.Suspense fallback={
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 30%, #f8fafc 60%, #eef2ff 100%)',
            }}>
                <div style={{
                    width: '40px', height: '40px',
                    border: '4px solid rgba(99,102,241,0.2)',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        }>
            <LoginForm />
        </React.Suspense>
    );
}
