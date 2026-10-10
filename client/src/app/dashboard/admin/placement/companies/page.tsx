'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, UserPlus } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

type CompanyInvite = {
    contactName: string;
    email: string;
    companyName: string;
    phone: string;
    website: string;
    industry: string;
};

const emptyForm: CompanyInvite = {
    contactName: '', email: '', companyName: '', phone: '', website: '', industry: '',
};

export default function CompanyAccountsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(emptyForm);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const companiesQuery = useQuery({
        queryKey: ['placement-companies', user?.tenantId, user?.id],
        queryFn: placementApi.getCompanies,
    });
    const createMutation = useMutation({
        mutationFn: placementApi.createCompanyAccount,
        onSuccess: async (result: any) => {
            setMessage(result.message || 'Company account created.');
            setError('');
            setForm(emptyForm);
            await queryClient.invalidateQueries({ queryKey: ['placement-companies', user?.tenantId, user?.id] });
        },
        onError: (err: any) => {
            setMessage('');
            setError(err?.response?.data?.error || 'Could not create the company account. Please try again.');
        },
    });

    const updateField = (field: keyof CompanyInvite, value: string) => setForm(current => ({ ...current, [field]: value }));

    return (
        <DashboardShell allowedRoles={['SUPER_ADMIN']} portalName="Company Accounts" basePath="/dashboard/admin">
            <div className="mx-auto max-w-5xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Placement Company Accounts</h1>
                    <p className="mt-1 text-slate-600">Invite a company contact. We’ll create their sign-in account, link the company profile, and email their credentials.</p>
                </div>

                <Card className="p-6">
                    <div className="mb-5 flex items-center gap-3">
                        <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserPlus className="h-5 w-5" /></span>
                        <div>
                            <h2 className="font-semibold text-slate-900">Invite company representative</h2>
                            <p className="text-sm text-slate-500">Company users can post jobs and review applicants for their company.</p>
                        </div>
                    </div>

                    <form className="grid gap-4 sm:grid-cols-2" onSubmit={event => {
                        event.preventDefault();
                        setMessage('');
                        setError('');
                        createMutation.mutate({ ...form, phone: form.phone || undefined, website: form.website || undefined, industry: form.industry || undefined });
                    }}>
                        <Field label="Company name" required value={form.companyName} onChange={value => updateField('companyName', value)} />
                        <Field label="Contact person" required value={form.contactName} onChange={value => updateField('contactName', value)} />
                        <Field label="Sign-in email" type="email" required value={form.email} onChange={value => updateField('email', value)} />
                        <Field label="Phone" type="tel" value={form.phone} onChange={value => updateField('phone', value)} />
                        <Field label="Website" type="url" value={form.website} onChange={value => updateField('website', value)} />
                        <Field label="Industry" value={form.industry} onChange={value => updateField('industry', value)} />
                        <div className="sm:col-span-2 space-y-3">
                            {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
                            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
                            <button type="submit" disabled={createMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                                <UserPlus className="h-4 w-4" />{createMutation.isPending ? 'Creating account…' : 'Create account and send invitation'}
                            </button>
                        </div>
                    </form>
                </Card>

                <Card className="overflow-hidden">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <h2 className="font-semibold text-slate-900">Companies in this tenant</h2>
                    </div>
                    {companiesQuery.isLoading ? <p className="p-6 text-slate-500">Loading companies…</p> : companiesQuery.isError ? <p role="alert" className="p-6 text-rose-700">Could not load companies.</p> : (companiesQuery.data || []).length === 0 ? (
                        <div className="p-10 text-center text-slate-500"><Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />No companies have been added yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-6 py-3 font-medium">Company</th><th className="px-6 py-3 font-medium">Login email</th><th className="px-6 py-3 font-medium">Account</th><th className="px-6 py-3 font-medium">Verification</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(companiesQuery.data || []).map((company: any) => (
                                        <tr key={company.id}>
                                            <td className="px-6 py-4 font-medium text-slate-900">{company.name}</td>
                                            <td className="px-6 py-4 text-slate-600">{company.email}</td>
                                            <td className="px-6 py-4">{company.userId ? <span className="text-emerald-700">Login linked</span> : <span className="text-amber-700">Profile only</span>}</td>
                                            <td className="px-6 py-4">{company.isVerified ? 'Verified' : 'Pending'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </DashboardShell>
    );
}

function Field({ label, value, onChange, required = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input type={type} required={required} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" /></label>;
}
