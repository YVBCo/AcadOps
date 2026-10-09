'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, FileText, Upload, Save, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DashboardShell from '@/components/layout/DashboardShell';
import { placementApi } from '@/lib/api';

type ProfileForm = {
    cgpa: string;
    tenthPct: string;
    twelfthPct: string;
    backlogs: string;
    activeBacklogs: string;
    linkedinUrl: string;
    githubUrl: string;
    portfolioUrl: string;
};

const toForm = (profile: any): ProfileForm => ({
    cgpa: profile?.cgpa ?? '',
    tenthPct: profile?.tenthPct ?? '',
    twelfthPct: profile?.twelfthPct ?? '',
    backlogs: String(profile?.backlogs ?? 0),
    activeBacklogs: String(profile?.activeBacklogs ?? 0),
    linkedinUrl: profile?.linkedinUrl ?? '',
    githubUrl: profile?.githubUrl ?? '',
    portfolioUrl: profile?.portfolioUrl ?? '',
});

export default function ProfilePage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<ProfileForm | null>(null);
    const { data: profile, isLoading, error } = useQuery({
        queryKey: ['placement-profile'],
        queryFn: placementApi.getProfile,
    });

    useEffect(() => { if (profile) setForm(toForm(profile)); }, [profile]);

    const saveMutation = useMutation({
        mutationFn: () => placementApi.updateProfile({
            cgpa: Number(form?.cgpa),
            tenthPct: Number(form?.tenthPct),
            twelfthPct: Number(form?.twelfthPct),
            backlogs: Number(form?.backlogs),
            activeBacklogs: Number(form?.activeBacklogs),
            linkedinUrl: form?.linkedinUrl || undefined,
            githubUrl: form?.githubUrl || undefined,
            portfolioUrl: form?.portfolioUrl || undefined,
        }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placement-profile'] }),
    });
    const uploadMutation = useMutation({
        mutationFn: placementApi.uploadCv,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placement-profile'] }),
    });
    const declarationMutation = useMutation({
        mutationFn: () => placementApi.submitDeclaration({ declarationType: 'available' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placement-profile'] }),
    });

    const setField = (key: keyof ProfileForm, value: string) => setForm(current => current ? { ...current, [key]: value } : current);
    const latestCv = profile?.cvs?.[0];

    return (
        <DashboardShell allowedRoles={['STUDENT']} portalName="Placement Portal" basePath="/dashboard/placement">
            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Placement Profile</h1>
                    <p className="text-slate-500">Manage your academic details, professional links, and CV.</p>
                </div>

                {isLoading || !form ? <Card className="p-8 text-slate-500">Loading placement profile…</Card> : error ? (
                    <Card className="p-8 text-rose-600">Could not load your placement profile. Please refresh and try again.</Card>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-6 md:col-span-2">
                            <Card className="p-6">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800"><User className="h-5 w-5 text-blue-500" />Academic Details</h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Current CGPA" value={form.cgpa} onChange={value => setField('cgpa', value)} min="0" max="10" step="0.01" />
                                    <Field label="Active Backlogs" value={form.activeBacklogs} onChange={value => setField('activeBacklogs', value)} min="0" step="1" />
                                    <Field label="10th Percentage" value={form.tenthPct} onChange={value => setField('tenthPct', value)} min="0" max="100" step="0.01" />
                                    <Field label="12th Percentage" value={form.twelfthPct} onChange={value => setField('twelfthPct', value)} min="0" max="100" step="0.01" />
                                    <Field label="Total Backlogs" value={form.backlogs} onChange={value => setField('backlogs', value)} min="0" step="1" />
                                </div>
                                <Feedback error={saveMutation.error} />
                                {saveMutation.isSuccess && <p role="status" className="mt-3 text-sm text-emerald-700">Profile saved.</p>}
                                <div className="mt-4 flex justify-end"><button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save Details'}</button></div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="mb-4 text-lg font-semibold text-slate-800">Professional Links</h3>
                                <div className="space-y-4">
                                    <Field label="LinkedIn URL" type="url" value={form.linkedinUrl} onChange={value => setField('linkedinUrl', value)} />
                                    <Field label="GitHub URL" type="url" value={form.githubUrl} onChange={value => setField('githubUrl', value)} />
                                    <Field label="Portfolio URL" type="url" value={form.portfolioUrl} onChange={value => setField('portfolioUrl', value)} />
                                </div>
                                <div className="mt-4 flex justify-end"><button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Save Links</button></div>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card className="p-6 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText className="h-8 w-8" /></div>
                                <h3 className="mb-2 font-semibold text-slate-900">Resume / CV</h3>
                                <p className="mb-4 text-sm text-slate-500">PDF only, up to 5 MB. Uploading a new CV saves a new version.</p>
                                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
                                    <Upload className="h-4 w-4" />{uploadMutation.isPending ? 'Uploading…' : 'Choose PDF'}
                                    <input className="sr-only" type="file" accept="application/pdf,.pdf" disabled={uploadMutation.isPending} onChange={event => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.currentTarget.value = ''; }} />
                                </label>
                                {latestCv && <a className="mt-3 block text-sm font-medium text-emerald-700 underline" href={latestCv.fileUrl} target="_blank" rel="noreferrer">View {latestCv.fileName}</a>}
                                <Feedback error={uploadMutation.error} />
                            </Card>

                            <Card className="p-6">
                                <h3 className="mb-3 font-semibold text-slate-900">Availability Declaration</h3>
                                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Confirm that your placement profile details are accurate and that you are available for campus recruitment.</div>
                                <button onClick={() => declarationMutation.mutate()} disabled={declarationMutation.isPending || profile?.declaration?.declarationType === 'available'} className="w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:text-emerald-700">
                                    {profile?.declaration?.declarationType === 'available' ? <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Declared</span> : declarationMutation.isPending ? 'Saving…' : 'Sign Declaration'}
                                </button>
                                <Feedback error={declarationMutation.error} />
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}

function Field({ label, value, onChange, type = 'number', min, max, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; min?: string; max?: string; step?: string }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input type={type} value={value} min={min} max={max} step={step} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" /></label>;
}

function Feedback({ error }: { error: unknown }) {
    if (!error) return null;
    return <p role="alert" className="mt-3 text-sm text-rose-600">{(error as any)?.response?.data?.error || 'The request failed. Please try again.'}</p>;
}
