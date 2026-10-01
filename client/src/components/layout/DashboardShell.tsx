'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore, roleLabels, type UserRole } from '@/lib/auth-store';
import {
    Bell,
    LogOut,
    Search,
    ArrowLeft,
} from 'lucide-react';

interface DashboardShellProps {
    children: React.ReactNode;
    /** Role(s) allowed to access this dashboard */
    allowedRoles: UserRole[];
    /** Title shown in header when on a sub-page */
    portalName: string;
    /** The base dashboard path (e.g. '/dashboard/admin') */
    basePath: string;
    /** Badge color classes */
    badgeClasses?: string;
}

export default function DashboardShell({
    children,
    allowedRoles,
    portalName,
    basePath,
    badgeClasses = 'bg-slate-800 text-white',
}: DashboardShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout, isAuthenticated, isLoading } = useAuthStore();

    // Persist tenantSlug in a ref so it survives logout (which sets user to null)
    const tenantSlugRef = useRef<string | undefined>(user?.tenantSlug);
    useEffect(() => {
        if (user?.tenantSlug) {
            tenantSlugRef.current = user.tenantSlug;
        }
    }, [user?.tenantSlug]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            const slug = tenantSlugRef.current;
            router.push(slug ? `/login?tenant=${slug}` : '/login');
        }
        if (!isLoading && user && !allowedRoles.includes(user.role)) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, isLoading, user, router, allowedRoles]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user || !allowedRoles.includes(user.role)) return null;

    const handleLogout = () => {
        const slug = tenantSlugRef.current;
        logout();
        router.push(slug ? `/login?tenant=${slug}` : '/login');
    };

    const isSubPage = pathname !== basePath;
    const roleLabel = roleLabels[user.role] || user.role;

    return (
        <div className="min-h-screen bg-[#fafafa]">
            {/* Top Header Bar */}
            <header className="sticky top-0 z-30 bg-white border-b border-neutral-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left: Welcome or Back */}
                        <div className="flex items-center gap-3 min-w-0">
                            {isSubPage && (
                                <Link
                                    href={basePath}
                                    className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors mr-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="hidden sm:inline">Back</span>
                                </Link>
                            )}
                            <div className="min-w-0">
                                <h1 className="text-base font-semibold text-neutral-900 truncate">
                                    Welcome, {user.name?.split(' ')[0]}
                                </h1>
                                <p className="text-xs text-neutral-400 truncate">
                                    {user.tenantSlug || portalName}
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Search */}
                            <button className="p-2 rounded-lg hover:bg-neutral-100 transition-colors hidden sm:flex">
                                <Search className="w-5 h-5 text-neutral-400" />
                            </button>

                            {/* Notifications */}
                            <button className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors">
                                <Bell className="w-5 h-5 text-neutral-400" />
                            </button>

                            {/* Role Badge */}
                            <span className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${badgeClasses}`}>
                                {roleLabel}
                            </span>

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                                title="Sign Out"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Page Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {children}
            </main>
        </div>
    );
}
