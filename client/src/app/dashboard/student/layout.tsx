'use client';

import DashboardShell from '@/components/layout/DashboardShell';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell
            allowedRoles={['STUDENT']}
            portalName="Student Portal"
            basePath="/dashboard/student"
            badgeClasses="bg-indigo-500 text-white"
        >
            {children}
        </DashboardShell>
    );
}
