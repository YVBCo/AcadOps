import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'STUDENT' | 'TEACHER' | 'DEPARTMENT_ADMIN' | 'SUPER_ADMIN' | 'COE' | 'CLERK' | 'ADMISSIONS_ADMIN' | 'ADMIN_CLERK' | 'FIRST_YEAR_COORDINATOR' | 'PARENT';

export interface User {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: number;
    tenantId?: number;
    tenantSlug?: string;
    tenantType?: string;
    department?: {
        id: number;
        name: string;
        code: string;
    };
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isHydrated: boolean;
    setAuth: (user: User, token: string) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
    setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true,
            isHydrated: false,

            setAuth: (user, token) => {
                localStorage.setItem('token', token);
                set({ user, token, isAuthenticated: true, isLoading: false });
            },

            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            },

            setLoading: (loading) => set({ isLoading: loading }),

            setHydrated: () => set({ isHydrated: true, isLoading: false }),
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated
            }),
            onRehydrateStorage: () => (state) => {
                // Once hydration is complete, set isLoading to false
                state?.setHydrated();
            },
        }
    )
);

// Role-based access helpers
export const roleLabels: Record<UserRole, string> = {
    STUDENT: 'Student',
    TEACHER: 'Teacher',
    DEPARTMENT_ADMIN: 'Department Admin',
    SUPER_ADMIN: 'Super Admin',
    COE: 'Controller of Examinations',
    CLERK: 'Clerk',
    ADMISSIONS_ADMIN: 'Admissions Administrator',
    ADMIN_CLERK: 'Administration Clerk',
    FIRST_YEAR_COORDINATOR: 'First Year Coordinator',
    PARENT: 'Parent',
};


export const roleColors: Record<UserRole, string> = {
    STUDENT: 'badge-primary',
    TEACHER: 'badge-success',
    DEPARTMENT_ADMIN: 'badge-warning',
    SUPER_ADMIN: 'badge-error',
    COE: 'badge-accent',
    CLERK: 'badge-neutral',
    ADMISSIONS_ADMIN: 'badge-info',
    ADMIN_CLERK: 'badge-neutral',
    FIRST_YEAR_COORDINATOR: 'badge-primary',
    PARENT: 'badge-success',
};


export const roleVariants: Record<UserRole, "primary" | "success" | "warning" | "error" | "neutral" | "outline"> = {
    STUDENT: 'neutral',
    TEACHER: 'success',
    DEPARTMENT_ADMIN: 'warning',
    SUPER_ADMIN: 'error',
    COE: 'primary',
    CLERK: 'outline',
    ADMISSIONS_ADMIN: 'primary',
    ADMIN_CLERK: 'outline',
    FIRST_YEAR_COORDINATOR: 'primary',
    PARENT: 'success',
};

export const canAccessAdminPanel = (role?: UserRole): boolean => {
    return role === 'DEPARTMENT_ADMIN' || role === 'SUPER_ADMIN' || role === 'COE' || role === 'ADMISSIONS_ADMIN';
};

export const canAccessAdmissionsPanel = (role?: UserRole): boolean => {
    return role === 'ADMISSIONS_ADMIN' || role === 'ADMIN_CLERK';
};

export const canManageSemesters = (role?: UserRole): boolean => {
    return role === 'SUPER_ADMIN';
};

export const canManageDepartments = (role?: UserRole): boolean => {
    return role === 'SUPER_ADMIN';
};
