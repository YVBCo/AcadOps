'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

type CompanyProfile = {
    name: string;
    phone?: string | null;
    website?: string | null;
    industry?: string | null;
    description?: string | null;
    address?: string | null;
};

const emptyProfile: CompanyProfile = { name: '', phone: '', website: '', industry: '', description: '', address: '' };

export default function CompanyProfilePage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [form, setForm] = useState<CompanyProfile | null>(null);
    const { data: company, isLoading, error } = useQuery({
        queryKey: ['placement-my-company', user?.tenantId, user?.id],
        queryFn: placementApi.getMyCompany,
    });

    useEffect(() => {
        if (!isLoading) setForm(company ? { ...emptyProfile, ...company } : { ...emptyProfile });
    }, [company, isLoading]);

    const saveMutation = useMutation({
        mutationFn: (data: CompanyProfile) => company?.id
            ? placementApi.updateMyCompany(data)
            : placementApi.createMyCompany(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['placement-my-company', user?.tenantId, user?.id] });
            await queryClient.invalidateQueries({ queryKey: ['placement-companies', user?.tenantId, user?.id] });
        },
    });

    const setField = (key: keyof CompanyProfile, value: string) => {
        setForm(current => ({ ...(current || emptyProfile), [key]: value }));
    };

    return (
        <DashboardShell allowedRoles={['PLACEMENT_COMPANY']} portalName="Placement Portal" basePath="/dashboard/placement">
            <div className="mx-auto max-w-3xl space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Company Profile</h2>
                    <p className="text-slate-500">Add the company details students will see with your job postings.</p>
                </div>

                {isLoading || !form ? <Card className="p-8 text-slate-500">Loading company profile…</Card> : (
                    <Card className="p-6">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Building2 className="h-6 w-6" /></div>
                            <div>
                                <h3 className="font-semibold text-slate-900">{company ? 'Edit company details' : 'Register your company'}</h3>
                                <p className="text-sm text-slate-500">Your sign-in email is linked automatically.</p>
                            </div>
                        </div>
                        <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveMutation.mutate(form); }}>
                            <Field label="Company name" required value={form.name} onChange={value => setField('name', value)} />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Industry" value={form.industry || ''} onChange={value => setField('industry', value)} />
                                <Field label="Phone" value={form.phone || ''} onChange={value => setField('phone', value)} />
                                <Field label="Website" type="url" value={form.website || ''} onChange={value => setField('website', value)} />
                                <Field label="Address" value={form.address || ''} onChange={value => setField('address', value)} />
                            </div>
                            <label className="block text-sm font-medium text-slate-700">
                                Description
                                <textarea value={form.description || ''} onChange={event => setField('description', event.target.value)} rows={4} maxLength={5000} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal" />
                            </label>
                            {error && <p role="alert" className="text-sm text-rose-600">Could not load the company profile. Please retry.</p>}
                            {saveMutation.isError && <p role="alert" className="text-sm text-rose-600">{(saveMutation.error as any)?.response?.data?.error || 'Could not save the company profile.'}</p>}
                            {saveMutation.isSuccess && <p role="status" className="text-sm text-emerald-700">Company profile saved.</p>}
                            <button type="submit" disabled={saveMutation.isPending || !form.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                <Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save profile'}
                            </button>
                        </form>
                    </Card>
                )}
            </div>
        </DashboardShell>
    );
}

function Field({ label, value, onChange, required = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input type={type} required={required} value={value} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-normal" /></label>;
}
