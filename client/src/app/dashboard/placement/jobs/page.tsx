'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Briefcase, Building2, MapPin, CheckCircle2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DashboardShell from '@/components/layout/DashboardShell';
import { useAuthStore } from '@/lib/auth-store';
import { placementApi } from '@/lib/api';

export default function JobsPage() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const isAdmin = ['SUPER_ADMIN', 'DEPARTMENT_ADMIN'].includes(user?.role || '');
    const isStudent = user?.role === 'STUDENT';
    const [searchTerm, setSearchTerm] = useState('');
    const [showPostModal, setShowPostModal] = useState(false);
    
    // Form state
    const [title, setTitle] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [location, setLocation] = useState('');
    const [ctc, setCtc] = useState('');

    const { data: jobs = [], isLoading } = useQuery({
        queryKey: ['placement-jobs'],
        queryFn: () => placementApi.getJobs(),
    });

    // We fetch companies for the Post Job dropdown
    const { data: companies = [] } = useQuery({
        queryKey: ['placement-companies'],
        queryFn: () => placementApi.getCompanies(),
        enabled: isAdmin,
    });

    const createJobMutation = useMutation({
        mutationFn: (data: any) => placementApi.createJob(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['placement-jobs'] });
            setShowPostModal(false);
            setTitle('');
            setCompanyId('');
            setLocation('');
            setCtc('');
            alert('Job posted successfully!');
        },
        onError: (err: any) => alert(err.response?.data?.error || err.message)
    });

    const applyMutation = useMutation({
        mutationFn: (data: any) => placementApi.apply(data),
        onSuccess: () => alert('Successfully applied for this job!'),
        onError: (err: any) => alert(err.response?.data?.error || err.message)
    });

    const handlePostJob = (e: React.FormEvent) => {
        e.preventDefault();
        createJobMutation.mutate({
            title,
            companyId: parseInt(companyId),
            location,
            ctc: parseFloat(ctc) || null,
            type: 'FULL_TIME',
            description: 'Created from UI'
        });
    };

    const handleJobAction = (jobId: number) => {
        if (isStudent) {
            if (confirm('Do you want to apply for this position?')) {
                applyMutation.mutate({ jobId });
            }
        } else {
            alert(`Job ID: ${jobId}\nNavigating to details page...`);
        }
    };

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
            <div className="space-y-6 relative">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Job Openings</h1>
                        <p className="text-slate-500">Browse and apply for available positions</p>
                    </div>
                    {isAdmin && (
                        <button 
                            onClick={() => setShowPostModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
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
                                
                                <button 
                                    onClick={() => handleJobAction(job.id)}
                                    className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors font-medium">
                                    {isStudent ? 'Apply Now' : 'View Details'}
                                </button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Post Job Modal */}
            {showPostModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md p-6 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Post New Job</h2>
                            <button onClick={() => setShowPostModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handlePostJob} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Software Engineer" />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-slate-700">Company</label>
                                    <button type="button" onClick={() => {
                                        const name = prompt('Enter new company name:');
                                        if (name) {
                                            placementApi.createCompany({ name, website: 'https://example.com', industry: 'IT' })
                                                .then(() => {
                                                    queryClient.invalidateQueries({ queryKey: ['placement-companies'] });
                                                    alert('Company created! Please select it from the dropdown.');
                                                })
                                                .catch(err => alert('Error: ' + err.message));
                                        }
                                    }} className="text-xs text-blue-600 font-medium hover:underline">
                                        + Quick Add
                                    </button>
                                </div>
                                <select required value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select a company</option>
                                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                                <input required type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Bangalore, India" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">CTC (LPA)</label>
                                <input type="number" step="0.1" value={ctc} onChange={e => setCtc(e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 12.5" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowPostModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" disabled={createJobMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                                    {createJobMutation.isPending ? 'Posting...' : 'Post Job'}
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </DashboardShell>
    );
}
