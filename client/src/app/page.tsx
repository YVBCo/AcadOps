'use client';

import { useAuthStore } from '@/lib/auth-store';
import { GraduationCap, ArrowRight, Shield, BarChart3, Users, FileEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  const { isHydrated } = useAuthStore();

  // Removed auto-redirect - users can manually navigate via Sign In button

  // Show loading only while hydrating
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-primary-50/30 to-secondary-50/30">
      {/* Hero section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-300/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-secondary-300/30 rounded-full blur-3xl" />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-neutral-900">
              AcadOps
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/apply">
              <Button variant="outline" leftIcon={FileEdit}>
                Apply Now
              </Button>
            </Link>
            <Link href="/dev/login">
              <Button variant="primary" rightIcon={ArrowRight}>
                Sign In
              </Button>
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-8">
              <Shield className="h-4 w-4" />
              Governance-First Architecture
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 leading-tight">
              Academic Operations
              <br />
              <span className="text-gradient">Simplified & Secured</span>
            </h1>

            <p className="mt-6 text-lg text-neutral-600 max-w-2xl mx-auto">
              A comprehensive platform for managing academic operations with strict role-based access control,
              immutable audit logs, and semester lifecycle management.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dev/login">
                <Button size="lg" rightIcon={ArrowRight}>
                  Get Started
                </Button>
              </Link>
              <Link href="/apply">
                <Button size="lg" variant="outline" leftIcon={FileEdit}>
                  Apply for Admission
                </Button>
              </Link>
            </div>
          </div>

          {/* Feature cards */}
          <div className="mt-24 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="card-premium p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-neutral-900">
                Role-Based Access
              </h3>
              <p className="text-sm text-neutral-500 mt-2">
                Granular permissions for Students, Teachers, Dept Admins, and Super Admins
              </p>
            </div>

            <div className="card-premium p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-secondary-100 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-secondary-600" />
              </div>
              <h3 className="font-semibold text-neutral-900">
                Audit Logging
              </h3>
              <p className="text-sm text-neutral-500 mt-2">
                Immutable logs tracking every action for complete transparency
              </p>
            </div>

            <div className="card-premium p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-accent-100 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-accent-600" />
              </div>
              <h3 className="font-semibold text-neutral-900">
                Multi-Department
              </h3>
              <p className="text-sm text-neutral-500 mt-2">
                Manage multiple departments with isolated data and admins
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-neutral-500">
          <p>© 2024 Academic Operations Platform. Built with governance in mind.</p>
        </div>
      </footer>
    </div>
  );
}
