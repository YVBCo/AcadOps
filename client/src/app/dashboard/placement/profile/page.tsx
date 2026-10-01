'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, FileText, Upload, Save, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DashboardShell from '@/components/layout/DashboardShell';
import { placementApi } from '@/lib/api';

export default function ProfilePage() {
    const { data: profile, isLoading } = useQuery({
        queryKey: ['placement-profile'],
        queryFn: () => placementApi.getProfile(),
    });

    return (
        <DashboardShell 
            allowedRoles={['STUDENT']}
            portalName="Placement Portal"
            basePath="/dashboard/placement"
        >
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Placement Profile</h1>
                    <p className="text-slate-500">Manage your academic details and CV</p>
                </div>

                {isLoading ? (
                    <div className="space-y-6">
                        <div className="h-64 bg-slate-100 animate-pulse rounded-xl"></div>
                        <div className="h-48 bg-slate-100 animate-pulse rounded-xl"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            {/* Academic Details */}
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <User className="w-5 h-5 text-blue-500" />
                                    Academic Details
                                </h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Current CGPA</label>
                                        <input type="text" className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" defaultValue={profile?.cgpa || ''} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Active Backlogs</label>
                                        <input type="text" className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900" defaultValue={profile?.activeBacklogs || '0'} readOnly />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">10th Percentage</label>
                                        <input type="text" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" defaultValue={profile?.tenthMarks || ''} placeholder="e.g. 95.5" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">12th Percentage</label>
                                        <input type="text" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" defaultValue={profile?.twelfthMarks || ''} placeholder="e.g. 92.0" />
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors">
                                        <Save className="w-4 h-4" /> Save Details
                                    </button>
                                </div>
                            </Card>

                            {/* Links */}
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Professional Links</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                                        <input type="url" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" defaultValue={profile?.linkedinUrl || ''} placeholder="https://linkedin.com/in/..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">GitHub URL</label>
                                        <input type="url" className="w-full p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" defaultValue={profile?.githubUrl || ''} placeholder="https://github.com/..." />
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition-colors">
                                        Save Links
                                    </button>
                                </div>
                            </Card>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* CV Upload */}
                            <Card className="p-6 text-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-2">Resume / CV</h3>
                                <p className="text-sm text-slate-500 mb-4">Upload your latest resume in PDF format (Max 2MB)</p>
                                
                                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium text-sm">
                                    <Upload className="w-4 h-4" /> Upload CV
                                </button>
                                
                                {profile?.cvUrl && (
                                    <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-emerald-600 font-medium">
                                        <CheckCircle2 className="w-4 h-4" /> CV Uploaded
                                    </div>
                                )}
                            </Card>

                            {/* Declaration */}
                            <Card className="p-6">
                                <h3 className="font-semibold text-slate-900 mb-3">Declaration</h3>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
                                    I hereby declare that the details furnished above are true and correct to the best of my knowledge.
                                </div>
                                <button 
                                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                                        profile?.isVerified 
                                            ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed' 
                                            : 'bg-slate-800 text-white hover:bg-slate-900'
                                    }`}
                                    disabled={profile?.isVerified}
                                >
                                    {profile?.isVerified ? 'Verified' : 'Sign Declaration'}
                                </button>
                            </Card>
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
