'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['ADMISSIONS_ADMIN', 'ADMIN_CLERK']}
            portalName="Admissions Portal"
            basePath="/dashboard/admissions"
            badgeClasses="bg-sky-600 text-white"
        >
            {children}
        </DashboardShell>
    );
}
