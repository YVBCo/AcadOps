'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Building2,
    Users,
    BookOpen,
    Calendar,
    Activity,
    GraduationCap,
    ArrowRight,
    Shield,
    UserCog,
    Layers3,
    ClipboardList,
    Layers,
    FileText,
    ArrowUpDown,
    CheckSquare,
    BarChart3,
    UserCheck,
    ScrollText,
    Briefcase,
    FileCheck2,
    Library,
    Percent,
} from 'lucide-react';
import { StatCard, Card } from '@/components/ui/card';
import { Badge, SemesterStatusBadge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/auth-store';
import { departmentApi, semesterApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { QuickActionCard, QuickActionsGrid } from '@/components/layout/QuickActionCard';

export default function AdminDashboard() {
    const { user } = useAuthStore();
    const router = useRouter();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isEngineering = user?.tenantType === 'ENGINEERING';

    useEffect(() => {
        if (user?.role === 'DEPARTMENT_ADMIN') {
            router.replace('/dashboard/dept-admin');
        }
    }, [router, user?.role]);

    const { data: departments = [], isLoading: deptLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentApi.getAll,
    });

    const { data: semesters = [], isLoading: semLoading } = useQuery({
        queryKey: ['semesters'],
        queryFn: () => semesterApi.getAll(),
    });

    const activeSemester = semesters.find((s: { status: string }) => s.status === 'ACTIVE');
    const isLoading = deptLoading || semLoading;

    if (user?.role === 'DEPARTMENT_ADMIN') return null;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-700 via-slate-800 to-violet-700 p-6 lg:p-8 text-white shadow-xl shadow-slate-500/20">
                <div className="absolute inset-0 bg-grid-white/10"></div>
                <div className="relative">
                    <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                        Welcome back, {user?.name?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-slate-300 text-sm lg:text-base">
                        Here's what's happening with your academic operations today.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                            <Shield className="w-4 h-4" />
                            Super Admin
                        </span>
                        {activeSemester && (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                                <Activity className="w-4 h-4" />
                                Active: {activeSemester.name}
                            </span>
                        )}
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-violet-400/20 rounded-full blur-2xl"></div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Departments"
                    value={departments.length.toString()}
                    icon={Building2}
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
                <StatCard
                    title="Active Semesters"
                    value={semesters.filter((s: { status: string }) => s.status === 'ACTIVE').length.toString()}
                    icon={Calendar}
                    iconColor="text-violet-600"
                    iconBgColor="bg-violet-100"
                />
                <StatCard
                    title="Total Courses"
                    value={departments.reduce((acc: number, d: { _count?: { courses?: number } }) => acc + (d._count?.courses || 0), 0).toString()}
                    icon={BookOpen}
                    iconColor="text-indigo-600"
                    iconBgColor="bg-indigo-100"
                />
                <StatCard
                    title="Total Users"
                    value={departments.reduce((acc: number, d: { _count?: { users?: number } }) => acc + (d._count?.users || 0), 0).toString()}
                    icon={Users}
                    iconColor="text-purple-600"
                    iconBgColor="bg-purple-100"
                />
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Departments overview */}
                <Card className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Departments Overview</h3>
                        <Badge variant="primary">{departments.length} Total</Badge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Department</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Code</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Programs</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Courses</th>
                                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">Users</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {departments.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-slate-500">
                                            No departments found. Create your first department to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    departments.map((dept: {
                                        id: number;
                                        name: string;
                                        code: string;
                                        programs?: string[];
                                        _count?: { courses?: number; users?: number }
                                    }) => (
                                        <tr key={dept.id} className="hover:bg-slate-50">
                                            <td className="py-3 px-4 font-medium text-slate-800">{dept.name}</td>
                                            <td className="py-3 px-4">
                                                <Badge variant="neutral">{dept.code}</Badge>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">{dept.programs?.length || 0}</td>
                                            <td className="py-3 px-4 text-slate-600">{dept._count?.courses || 0}</td>
                                            <td className="py-3 px-4 text-slate-600">{dept._count?.users || 0}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Semester lifecycle */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Semester Lifecycle</h3>
                        <Link href="/dashboard/admin/semesters" className="text-violet-600 hover:text-violet-700 text-sm font-medium">
                            View All
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {semesters.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">
                                No semesters found
                            </p>
                        ) : (
                            semesters.slice(0, 5).map((semester: {
                                id: number;
                                name: string;
                                status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
                                startDate: string;
                                endDate: string;
                            }) => (
                                <div
                                    key={semester.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
                                >
                                    <div>
                                        <p className="font-medium text-slate-800">{semester.name}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {formatDate(semester.startDate)} - {formatDate(semester.endDate)}
                                        </p>
                                    </div>
                                    <SemesterStatusBadge status={semester.status} />
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Quick Actions */}
            <QuickActionsGrid>
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/departments"
                        icon={Building2}
                        label="Departments"
                        subtitle="Manage academic departments"
                        iconColor="text-blue-600"
                        iconBgColor="bg-blue-50"
                    />
                )}
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/academic-programs"
                        icon={GraduationCap}
                        label="Programs"
                        subtitle="Create degree programs and link departments"
                        iconColor="text-indigo-600"
                        iconBgColor="bg-indigo-50"
                    />
                )}
                <QuickActionCard
                    href="/dashboard/admin/batches"
                    icon={Calendar}
                    label="Batches"
                    subtitle="View and manage student batches"
                    iconColor="text-green-600"
                    iconBgColor="bg-green-50"
                />
                <QuickActionCard
                    href="/dashboard/admin/users"
                    icon={Users}
                    label="Users"
                    subtitle="Manage all platform users"
                    iconColor="text-cyan-600"
                    iconBgColor="bg-cyan-50"
                />
                {isSuperAdmin && isEngineering && (
                    <QuickActionCard
                        href="/dashboard/admin/first-year-coordinator"
                        icon={Layers3}
                        label="FYC"
                        subtitle="First Year Coordinator management"
                        iconColor="text-emerald-600"
                        iconBgColor="bg-emerald-50"
                    />
                )}
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/admissions-admin"
                        icon={ClipboardList}
                        label="Admission"
                        subtitle="Manage student admissions"
                        iconColor="text-rose-600"
                        iconBgColor="bg-rose-50"
                    />
                )}
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/librarians"
                        icon={Library}
                        label="Librarians"
                        subtitle="Create library accounts and manage access"
                        iconColor="text-amber-600"
                        iconBgColor="bg-amber-50"
                    />
                )}
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/nodue-attendance"
                        icon={Percent}
                        label="No-Due Attendance Rules"
                        subtitle="Set subject attendance minimums and fine bands"
                        iconColor="text-orange-600"
                        iconBgColor="bg-orange-50"
                    />
                )}
                <QuickActionCard
                    href="/dashboard/admin/users"
                    icon={ArrowUpDown}
                    label="Transfers"
                    subtitle="Handle student transfers"
                    iconColor="text-indigo-600"
                    iconBgColor="bg-indigo-50"
                />
                <QuickActionCard
                    href="/dashboard/admin/edit-requests"
                    icon={CheckSquare}
                    label="Approvals"
                    subtitle="Review pending upload approvals"
                    iconColor="text-teal-600"
                    iconBgColor="bg-teal-50"
                />
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/semesters"
                        icon={BarChart3}
                        label="Semesters"
                        subtitle="View platform semesters"
                        iconColor="text-purple-600"
                        iconBgColor="bg-purple-50"
                    />
                )}
                {isSuperAdmin && isEngineering && (
                    <QuickActionCard
                        href="/dashboard/admin/coe"
                        icon={UserCog}
                        label="COE"
                        subtitle="Controller of Examinations"
                        iconColor="text-amber-600"
                        iconBgColor="bg-amber-50"
                    />
                )}
                <QuickActionCard
                    href="/dashboard/admin/audit-logs"
                    icon={ScrollText}
                    label="Audit Logs"
                    subtitle="View system audit trail"
                    iconColor="text-slate-600"
                    iconBgColor="bg-slate-100"
                />
                <QuickActionCard
                    href="/dashboard/nodue"
                    icon={FileCheck2}
                    label="No-Due Portal"
                    subtitle="Clearance & dues management"
                    iconColor="text-orange-600"
                    iconBgColor="bg-orange-50"
                />
                <QuickActionCard
                    href="/dashboard/placement"
                    icon={Briefcase}
                    label="PlacePro"
                    subtitle="Placement & recruitment portal"
                    iconColor="text-violet-600"
                    iconBgColor="bg-violet-50"
                />
                {isSuperAdmin && (
                    <QuickActionCard
                        href="/dashboard/admin/placement/companies"
                        icon={Building2}
                        label="Company Accounts"
                        subtitle="Invite placement company representatives"
                        iconColor="text-blue-600"
                        iconBgColor="bg-blue-50"
                    />
                )}
            </QuickActionsGrid>
        </div>
    );
}
