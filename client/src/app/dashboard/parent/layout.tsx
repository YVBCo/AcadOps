'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['PARENT']}
            portalName="Parent Portal"
            basePath="/dashboard/parent"
            badgeClasses="bg-emerald-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
