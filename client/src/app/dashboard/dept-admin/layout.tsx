'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function DeptAdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['DEPARTMENT_ADMIN']}
            portalName="Department Admin"
            basePath="/dashboard/dept-admin"
            badgeClasses="bg-indigo-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
