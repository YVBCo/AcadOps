'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Briefcase, Building2, MapPin, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

export default function JobsPage() {
    const { user } = useAuthStore();
    const isAdmin = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ['placement-jobs'],
        queryFn: () => placementApi.getJobs(),
    });

    const filteredJobs = jobs.filter((job: any) => 
        job.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        job.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardShell 
            allowedRoles={['STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Job Openings</h1>
                        <p className="text-slate-500">Browse and apply for available positions</p>
                    </div>
                    {isAdmin && (
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                            Post New Job
                        </button>
                    )}
                </div>

                {/* Search and Filters */}
                <Card className="p-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by role or company..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </Card>

                {/* Jobs Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-xl"></div>
                        ))}
                    </div>
                ) : filteredJobs.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No jobs found</h3>
                        <p className="text-slate-500">Check back later for new opportunities.</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredJobs.map((job: any) => (
                            <Card key={job.id} className="p-5 flex flex-col hover:border-blue-300 transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-700">
                                        {job.company?.name?.charAt(0) || 'C'}
                                    </div>
                                    {job.isApproved && (
                                        <Badge variant="success" className="flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Approved
                                        </Badge>
                                    )}
                                </div>
                                
                                <h3 className="font-semibold text-lg text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                                <p className="text-slate-600 font-medium mb-4">{job.company?.name}</p>
                                
                                <div className="space-y-2 mb-6 flex-1">
                                    <div className="flex items-center text-sm text-slate-500 gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <span>{job.location || 'Not specified'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-slate-500 gap-2">
                                        <Briefcase className="w-4 h-4 text-slate-400" />
                                        <span>{job.type || 'Full Time'}</span>
                                    </div>
                                    <div className="flex items-center text-sm font-medium text-emerald-600 gap-2">
                                        <span className="font-bold">₹</span>
                                        <span>{job.ctc ? `${job.ctc} LPA` : 'Not Disclosed'}</span>
                                    </div>
                                </div>
                                
                                <button className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium">
                                    View Details
                                </button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
