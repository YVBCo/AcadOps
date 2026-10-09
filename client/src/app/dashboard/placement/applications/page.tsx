'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle2, XCircle, Clock, Search, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

export default function ApplicationsPage() {
    const { user } = useAuthStore();
    const isStudent = user?.role === 'STUDENT';
    const isCompany = user?.role === 'PLACEMENT_COMPANY';
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('ALL');

    const { data: applications = [], isLoading } = useQuery({
        queryKey: ['placement-applications'],
        queryFn: () => placementApi.getApplications(),
    });

    const updateStatus = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => placementApi.updateApplicationStatus(id, { status }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['placement-applications'] }),
    });

    const getStatusIcon = (status: string) => {
        switch(status?.toUpperCase()) {
            case 'SELECTED': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
            case 'REJECTED': return <XCircle className="w-5 h-5 text-rose-500" />;
            case 'SHORTLISTED': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
            default: return <Clock className="w-5 h-5 text-amber-500" />;
        }
    };

    const getStatusStyle = (status: string) => {
        switch(status?.toUpperCase()) {
            case 'SELECTED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'SHORTLISTED': return 'bg-blue-50 text-blue-700 border-blue-200';
            default: return 'bg-amber-50 text-amber-700 border-amber-200';
        }
    };

    const filteredApps = applications.filter((app: any) => 
        statusFilter === 'ALL' || app.status?.toUpperCase() === statusFilter
    );

    return (
        <DashboardShell 
            allowedRoles={['STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {isStudent ? 'My Applications' : 'All Applications'}
                        </h1>
                        <p className="text-slate-500">Track application statuses and updates</p>
                    </div>
                    
                    <div className="flex gap-2">
                        {['ALL', 'APPLIED', 'SHORTLISTED', 'SELECTED'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                    statusFilter === status 
                                        ? 'bg-slate-800 text-white' 
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {status.charAt(0) + status.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <Card className="overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 text-center text-slate-500">Loading applications...</div>
                    ) : filteredApps.length === 0 ? (
                        <div className="p-12 text-center">
                            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-1">No applications found</h3>
                            <p className="text-slate-500">Applications will appear here once submitted.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                                        {!isStudent && <th className="p-4">Student</th>}
                                        <th className="p-4">Company</th>
                                        <th className="p-4">Role</th>
                                        <th className="p-4">Applied On</th>
                                        <th className="p-4">Status</th>
                                        {!isStudent && <th className="p-4">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredApps.map((app: any) => (
                                        <tr key={app.id} className="hover:bg-slate-50/50">
                                            {!isStudent && (
                                                <td className="p-4 font-medium text-slate-900">
                                                    {app.student?.user?.name || 'Unknown'}
                                                </td>
                                            )}
                                            <td className="p-4 font-medium text-slate-900">
                                                {app.job?.company?.name || 'Company'}
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {app.job?.title || 'Role'}
                                            </td>
                                            <td className="p-4 text-slate-500 text-sm">
                                                {new Date(app.appliedAt || Date.now()).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(app.status)}`}>
                                                    {getStatusIcon(app.status)}
                                                    {app.status || 'APPLIED'}
                                                </div>
                                            </td>
                                            {!isStudent && (
                                                <td className="p-4">
                                                    {isCompany ? (
                                                        <select aria-label={`Update status for ${app.student?.user?.name || 'student'}`} value={app.status} disabled={updateStatus.isPending} onChange={event => updateStatus.mutate({ id: app.id, status: event.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                                                            {['APPLIED', 'SHORTLISTED', 'ON_HOLD', 'SELECTED', 'REJECTED'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                                                        </select>
                                                    ) : <span className="text-sm text-slate-400">Read only</span>}
                                                </td>
                                            )}
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
