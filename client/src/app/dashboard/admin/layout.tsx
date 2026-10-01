'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['SUPER_ADMIN', 'DEPARTMENT_ADMIN']}
            portalName="Admin Portal"
            basePath="/dashboard/admin"
            badgeClasses="bg-neutral-800 text-white"
        >
            {children}
        </DashboardShell>
    );
}
