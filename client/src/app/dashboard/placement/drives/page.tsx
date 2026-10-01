'use client';

import { useQuery } from '@tanstack/react-query';
import { Calendar, Building2, Users, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

export default function DrivesPage() {
    const { user } = useAuthStore();
    const isAdmin = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');

    const { data: drives = [], isLoading } = useQuery({
        queryKey: ['placement-drives'],
        queryFn: () => placementApi.getDrives(),
    });

    const getStatusColor = (status: string) => {
        switch(status?.toUpperCase()) {
            case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
            case 'COMPLETED': return 'bg-slate-100 text-slate-700';
            case 'SCHEDULED': return 'bg-blue-100 text-blue-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <DashboardShell 
            allowedRoles={['STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Placement Drives</h1>
                        <p className="text-slate-500">Upcoming and ongoing campus recruitment drives</p>
                    </div>
                    {isAdmin && (
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
                            Schedule Drive
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-xl"></div>
                        ))}
                    </div>
                ) : drives.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No drives scheduled</h3>
                        <p className="text-slate-500">There are no upcoming drives at the moment.</p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {drives.map((drive: any) => (
                            <Card key={drive.id} className="p-0 overflow-hidden group hover:border-indigo-300 transition-colors">
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                            <Building2 className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-semibold text-lg text-slate-900">{drive.company?.name || 'Company'}</h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(drive.status)}`}>
                                                    {drive.status || 'SCHEDULED'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{new Date(drive.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 md:border-l md:pl-6 border-slate-100">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-sm font-medium text-slate-900">{drive.rounds?.length || 0} Rounds</p>
                                            <p className="text-xs text-slate-500">Scheduled</p>
                                        </div>
                                        <button className="p-2 bg-slate-50 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                            <ArrowRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
