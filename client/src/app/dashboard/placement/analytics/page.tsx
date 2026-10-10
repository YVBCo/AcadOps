'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, Building2, Award } from 'lucide-react';
import { StatCard, Card } from '@/components/ui/card';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

export default function AnalyticsPage() {
    const { user } = useAuthStore();
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['placement-stats', user?.tenantId, user?.id],
        queryFn: () => placementApi.getStats(),
    });

    const { data: deptStats = [], isLoading: deptLoading } = useQuery({
        queryKey: ['placement-dept-stats', user?.tenantId, user?.id],
        queryFn: () => placementApi.getDeptWiseStats(),
    });

    const isLoading = statsLoading || deptLoading;

    return (
        <DashboardShell 
            allowedRoles={['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Placement Analytics</h1>
                    <p className="text-slate-500">Comprehensive view of placement performance</p>
                </div>

                {isLoading ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl"></div>)}
                        </div>
                        <div className="h-64 bg-slate-100 animate-pulse rounded-xl"></div>
                    </div>
                ) : (
                    <>
                        {/* Top Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Total Placed"
                                value={stats?.placedStudents?.toString() || '0'}
                                icon={Users}
                                iconColor="text-emerald-600"
                                iconBgColor="bg-emerald-100"
                            />
                            <StatCard
                                title="Total Offers"
                                value={stats?.totalOffers?.toString() || '0'}
                                icon={Award}
                                iconColor="text-blue-600"
                                iconBgColor="bg-blue-100"
                            />
                            <StatCard
                                title="Companies Visited"
                                value={stats?.totalCompanies?.toString() || '0'}
                                icon={Building2}
                                iconColor="text-indigo-600"
                                iconBgColor="bg-indigo-100"
                            />
                            <StatCard
                                title="Highest CTC"
                                value={stats?.highestCtc ? `₹${stats.highestCtc}L` : 'N/A'}
                                icon={TrendingUp}
                                iconColor="text-purple-600"
                                iconBgColor="bg-purple-100"
                            />
                        </div>

                        {/* Department Wise Table */}
                        <Card className="overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-800">Department Wise Placement</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50">
                                            <th className="p-4 text-sm font-medium text-slate-500">Department</th>
                                            <th className="p-4 text-sm font-medium text-slate-500 text-right">Eligible Students</th>
                                            <th className="p-4 text-sm font-medium text-slate-500 text-right">Placed</th>
                                            <th className="p-4 text-sm font-medium text-slate-500 text-right">Placement %</th>
                                            <th className="p-4 text-sm font-medium text-slate-500 text-right">Avg CTC (LPA)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {deptStats.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-slate-500">No data available</td>
                                            </tr>
                                        ) : (
                                            deptStats.map((dept: any) => {
                                                const percentage = dept.eligible > 0 ? Math.round((dept.placed / dept.eligible) * 100) : 0;
                                                return (
                                                    <tr key={dept.department} className="hover:bg-slate-50/50">
                                                        <td className="p-4 font-medium text-slate-800">{dept.department}</td>
                                                        <td className="p-4 text-right text-slate-600">{dept.eligible}</td>
                                                        <td className="p-4 text-right font-medium text-emerald-600">{dept.placed}</td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className="font-medium text-slate-700">{percentage}%</span>
                                                                <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-right text-slate-600">{dept.avgCtc || '-'}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
