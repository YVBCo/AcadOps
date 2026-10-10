import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from './config';
import { useAuthStore } from './auth-store';


export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30_000, // 30s timeout for Render cold starts
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ─── Retry interceptor for transient errors (502/503/504 from Render cold starts) ───
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000; // 2s base delay
let refreshInFlight: Promise<string> | null = null;

function redirectToTenantLogin() {
    if (typeof window === 'undefined') return;

    let tenantSlug = localStorage.getItem('tenant-slug');
    try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
            const parsed = JSON.parse(authStorage);
            tenantSlug = parsed?.state?.user?.tenantSlug || tenantSlug;
        }
    } catch { /* ignore malformed persisted state */ }

    useAuthStore.getState().logout();
    window.location.href = tenantSlug ? `/login?tenant=${encodeURIComponent(tenantSlug)}` : '/login';
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };
    if (!config) return Promise.reject(error);

    const status = error.response?.status;
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
    const isTransient = status === 502 || status === 503 || status === 504 || isNetworkError;

    config._retryCount = config._retryCount ?? 0;

    if (isTransient && config._retryCount < MAX_RETRIES) {
        config._retryCount += 1;
        const delay = RETRY_DELAY_MS * config._retryCount; // linear backoff: 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
        return api.request(config);
    }

    return Promise.reject(error);
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        // A bad login is expected to return 401. Keep it on the tenant login
        // page so the form can show the API error instead of clearing context
        // and sending the user back to the institution picker.
        const requestPath = error.config?.url?.split('?')[0].replace(/\/+$/, '');
        const isLoginRequest = requestPath?.endsWith('/auth/login');
        const isRefreshRequest = requestPath?.endsWith('/auth/refresh');

        if (error.response?.status === 401 && !isLoginRequest && typeof window !== 'undefined') {
            const config = error.config as (InternalAxiosRequestConfig & { _authRetryCount?: number }) | undefined;
            const refreshToken = localStorage.getItem('refresh-token');

            if (!isRefreshRequest && config && !config._authRetryCount && refreshToken) {
                config._authRetryCount = 1;
                try {
                    if (!refreshInFlight) {
                        refreshInFlight = api.post<{ accessToken: string; refreshToken: string }>(
                            '/auth/refresh',
                            { refreshToken }
                        ).then(({ data }) => {
                            if (!data.accessToken || !data.refreshToken) {
                                throw new Error('Token refresh response was incomplete');
                            }
                            localStorage.setItem('token', data.accessToken);
                            localStorage.setItem('refresh-token', data.refreshToken);
                            useAuthStore.getState().setAccessToken(data.accessToken);
                            return data.accessToken;
                        }).finally(() => {
                            refreshInFlight = null;
                        });
                    }

                    const accessToken = await refreshInFlight;
                    config.headers.Authorization = `Bearer ${accessToken}`;
                    return api.request(config);
                } catch {
                    redirectToTenantLogin();
                }
            } else if (!isRefreshRequest || refreshToken) {
                redirectToTenantLogin();
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    login: async (identifier: string, password: string, tenantSlug?: string) => {
        const response = await api.post('/auth/login', { identifier, password, tenantSlug });
        return response.data;
    },
    register: async (data: { email: string; password: string; name: string }) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    me: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },
    requestPasswordResetOtp: async (email: string, tenantSlug: string) => {
        const response = await api.post('/auth/forgot-password-otp', { email, tenantSlug });
        return response.data;
    },
    resetPasswordWithOtp: async (data: { email: string; tenantSlug: string; otp: string; newPassword: string }) => {
        const response = await api.post('/auth/reset-password-otp', data);
        return response.data;
    },
};

// Developer API (separate auth flow)
const devApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

devApi.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('dev-token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export const developerApi = {
    login: async (email: string, password: string) => {
        const response = await devApi.post('/dev/login', { email, password });
        return response.data;
    },
    getTenants: async () => {
        const response = await devApi.get('/dev/tenants');
        return response.data;
    },
    getActiveTenants: async () => {
        const response = await devApi.get('/dev/tenants/active');
        return response.data;
    },
    getTenantBranding: async (slug: string) => {
        const response = await devApi.get(`/dev/tenants/branding/${slug}`);
        return response.data;
    },
    createTenant: async (data: { name: string; slug: string; type: string; maxUsers?: number; contactEmail?: string; contactPhone?: string; address?: string }) => {
        const response = await devApi.post('/dev/tenants', data);
        return response.data;
    },
    getTenant: async (id: number) => {
        const response = await devApi.get(`/dev/tenants/${id}`);
        return response.data;
    },
    updateTenant: async (id: number, data: any) => {
        const response = await devApi.patch(`/dev/tenants/${id}`, data);
        return response.data;
    },
    deactivateTenant: async (id: number) => {
        const response = await devApi.post(`/dev/tenants/${id}/deactivate`);
        return response.data;
    },
    activateTenant: async (id: number) => {
        const response = await devApi.post(`/dev/tenants/${id}/activate`);
        return response.data;
    },
    getHealth: async () => {
        const response = await devApi.get('/dev/health');
        return response.data;
    },
    getStats: async () => {
        const response = await devApi.get('/dev/stats');
        return response.data;
    },
    getErrors: async (params?: { tenantId?: number; severity?: string; resolved?: string; limit?: number; offset?: number }) => {
        const response = await devApi.get('/dev/errors', { params });
        return response.data;
    },
    resolveError: async (id: number) => {
        const response = await devApi.patch(`/dev/errors/${id}/resolve`);
        return response.data;
    },
    resolveMany: async (ids: number[]) => {
        const response = await devApi.post('/dev/errors/resolve-many', { ids });
        return response.data;
    },
    getEmails: async (params?: { status?: string; to?: string; limit?: number; offset?: number }) => {
        const response = await devApi.get('/dev/emails', { params });
        return response.data;
    },
    getEmailStats: async () => {
        const response = await devApi.get('/dev/emails/stats');
        return response.data;
    },
    retryEmail: async (id: number) => {
        const response = await devApi.post(`/dev/emails/${id}/retry`);
        return response.data;
    },
    getModules: async (tenantId: number) => {
        const response = await devApi.get(`/dev/tenants/${tenantId}/modules`);
        return response.data;
    },
    updateModules: async (tenantId: number, modules: Record<string, any>) => {
        const response = await devApi.patch(`/dev/tenants/${tenantId}/modules`, modules);
        return response.data;
    },
};

export const nodueApi = {
    getClearanceStatus: async () => { const r = await api.get('/nodue/clearance/status'); return r.data; },
    applyClearance: async () => { const r = await api.post('/nodue/clearance/apply'); return r.data; },
    getAllClearances: async (params?: any) => { const r = await api.get('/nodue/clearance/all', { params }); return r.data; },
    hodApprove: async (id: number) => { const r = await api.patch(`/nodue/clearance/${id}/hod-approve`); return r.data; },
    rejectEmptyClearance: async (id: number) => { const r = await api.patch(`/nodue/clearance/${id}/reject-empty`); return r.data; },
    principalApprove: async (id: number) => { const r = await api.patch(`/nodue/clearance/${id}/principal-approve`); return r.data; },
    getMyStudents: async () => { const r = await api.get('/nodue/enrollment/my-students'); return r.data; },
    clearEnrollment: async (id: number, data: any) => { const r = await api.patch(`/nodue/enrollment/${id}/clear`, data); return r.data; },
    rejectEnrollment: async (id: number, data: any) => { const r = await api.patch(`/nodue/enrollment/${id}/reject`, data); return r.data; },
    getStudentDues: async () => { const r = await api.get('/nodue/dues/student'); return r.data; },
    getAllDues: async () => { const r = await api.get('/nodue/dues/all'); return r.data; },
    createDue: async (data: any) => { const r = await api.post('/nodue/dues', data); return r.data; },
    updateDue: async (id: number, data: any) => { const r = await api.patch(`/nodue/dues/${id}`, data); return r.data; },
    getLibraryDues: async () => { const r = await api.get('/nodue/dues/library'); return r.data; },
    getLibraryQueue: async () => { const r = await api.get('/nodue/dues/library/queue'); return r.data; },
    approveLibraryClearance: async (studentId: number) => { const r = await api.post(`/nodue/dues/library/${studentId}/approve`); return r.data; },
    createLibraryDue: async (data: any) => { const r = await api.post('/nodue/dues/library', data); return r.data; },
    updateLibraryDue: async (id: number, data: any) => { const r = await api.patch(`/nodue/dues/library/${id}`, data); return r.data; },
    getCategories: async () => { const r = await api.get('/nodue/fines/categories'); return r.data; },
    createCategory: async (data: any) => { const r = await api.post('/nodue/fines/categories', data); return r.data; },
    deleteCategory: async (id: number) => { await api.delete(`/nodue/fines/categories/${id}`); },
    getAttendanceSubjects: async () => { const r = await api.get('/nodue/fines/subjects'); return r.data; },
    updateSubjectAttendanceMinimum: async (id: number, minimumAttendancePct: number) => { const r = await api.patch(`/nodue/fines/subjects/${id}/minimum`, { minimumAttendancePct }); return r.data; },
    calculateFines: async (data: any) => { const r = await api.post('/nodue/fines/calculate', data); return r.data; },
    createPaymentOrder: async (data: any) => { const r = await api.post('/nodue/payment/create-order', data); return r.data; },
    getPaymentOrders: async () => { const r = await api.get('/nodue/payment/orders'); return r.data; },
    getClearanceStats: async () => { const r = await api.get('/nodue/clearance/stats'); return r.data; },
};

// Department API
export const departmentApi = {
    getAll: async () => {
        const response = await api.get('/departments');
        return response.data;
    },
    getOpted: async () => {
        const response = await api.get('/departments/opted');
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/departments/${id}`);
        return response.data;
    },
    create: async (data: { name: string; code: string; description?: string }) => {
        const response = await api.post('/departments', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; code?: string; description?: string }) => {
        const response = await api.put(`/departments/${id}`, data);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/departments/${id}`);
    },
};

// Semester API
export const semesterApi = {
    getAll: async (status?: string) => {
        const response = await api.get('/semesters', { params: { status } });
        return response.data;
    },
    getActive: async () => {
        const response = await api.get('/semesters/active');
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/semesters/${id}`);
        return response.data;
    },
    create: async (data: { name: string; startDate: string; endDate: string }) => {
        const response = await api.post('/semesters', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; startDate?: string; endDate?: string }) => {
        const response = await api.put(`/semesters/${id}`, data);
        return response.data;
    },
    open: async (id: number) => {
        const response = await api.post(`/semesters/${id}/open`);
        return response.data;
    },
    close: async (id: number, transitions?: Array<{ batchId: number; type: 'ROTATE_CYCLES' | 'RESTORE_BRANCHES' }>) => {
        const response = await api.post(`/semesters/${id}/close`, { transitions });
        return response.data;
    },
    archive: async (id: number) => {
        const response = await api.post(`/semesters/${id}/archive`);
        return response.data;
    },
};

// Batch API
export const batchApi = {
    getAll: async () => {
        const response = await api.get('/batches');
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/batches/${id}`);
        return response.data;
    },
    getStudents: async (id: number) => {
        const response = await api.get(`/batches/${id}/students`);
        return response.data;
    },
    create: async (data: { name: string; startYear: number }) => {
        const response = await api.post('/batches', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; startYear?: number }) => {
        const response = await api.put(`/batches/${id}`, data);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/batches/${id}`);
    },
    assignCycle: async (id: number, cycle: 'PHYSICS' | 'CHEMISTRY') => {
        const response = await api.post(`/batches/${id}/assign-cycle`, { cycle });
        return response.data;
    },
    migrateToBranches: async (id: number) => {
        const response = await api.post(`/batches/${id}/migrate-to-branches`);
        return response.data;
    },
    progressSemester: async (id: number) => {
        const response = await api.post(`/batches/${id}/progress-semester`);
        return response.data;
    }
};

// Users API
export const userApi = {
    getAll: async (params?: { skip?: number; take?: number; role?: string; departmentId?: number }) => {
        const response = await api.get('/users', { params });
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },
    create: async (data: { email: string; password: string; name: string; role: string; departmentId?: number; rollNumber?: string; admissionYear?: number; currentSemester?: number }) => {
        const response = await api.post('/users', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; email?: string; role?: string; departmentId?: number }) => {
        const response = await api.put(`/users/${id}`, data);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/users/${id}`);
    },
    createDepartmentAdmin: async (data: { name: string; email: string; departmentId: number }) => {
        const response = await api.post('/users/department-admin', data);
        return response.data;
    },
    toggleActivation: async (id: number, isActive: boolean) => {
        const response = await api.put(`/users/${id}/activation`, { isActive });
        return response.data;
    },
    createAdmissionsAdmin: async (data: { name: string; email: string }) => {
        const response = await api.post('/users/admissions-admin', data);
        return response.data;
    },
    createFirstYearCoordinator: async (data: { name: string; email: string }) => {
        const response = await api.post('/users/first-year-coordinator', data);
        return response.data;
    },
    createLibrarian: async (data: { name: string; email: string }) => {
        const response = await api.post('/users/librarian', data);
        return response.data;
    },
};

// Course API
export const courseApi = {
    getAll: async (params?: { departmentId?: number; programId?: number }) => {
        const response = await api.get('/courses', { params });
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/courses/${id}`);
        return response.data;
    },
    create: async (data: { name: string; code: string; credits: number; departmentId: number; programId?: number; semesterNumber?: number; targetBatchId?: number; internalMarks?: number; externalMarks?: number; description?: string }) => {
        const response = await api.post('/courses', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; code?: string; credits?: number; description?: string }) => {
        const response = await api.put(`/courses/${id}`, data);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/courses/${id}`);
    },
    lock: async (id: number) => {
        const response = await api.put(`/courses/${id}/lock`);
        return response.data;
    },
    getMaxSemesters: async (): Promise<{ maxSemesters: number; tenantType: string }> => {
        const response = await api.get('/courses/config/max-semesters');
        return response.data;
    },
};

// Course Allocation API (for Dept Admin)
export const courseAllocationApi = {
    // Allocate course to ALL sections of a batch
    allocateToBatch: async (data: { courseId: number; batchId: number; semesterNumber: number }) => {
        const response = await api.post('/dept-admin/courses/allocate-batch', data);
        return response.data;
    },
    // Get allocations for a batch (with section teacher info)
    getByBatch: async (batchId: number, semesterNumber: number) => {
        const response = await api.get(`/dept-admin/batches/${batchId}/allocations`, {
            params: { semesterNumber }
        });
        return response.data;
    },
    // Assign teacher to a specific section's allocation
    assignTeacher: async (allocationId: number, teacherId: number) => {
        const response = await api.post(`/dept-admin/allocations/${allocationId}/assign-teacher`, { teacherId });
        return response.data;
    },
    // Remove allocation
    remove: async (allocationId: number) => {
        await api.delete(`/dept-admin/allocations/${allocationId}`);
    },
};

// Internal Marks API (for Dept Admin - viewing marks)
export const internalMarksApi = {
    // Get internal marks for a section and course (detailed view)
    getBySection: async (sectionId: number, courseId: number) => {
        const response = await api.get(`/dept-admin/internal-marks/${sectionId}/${courseId}`);
        return response.data;
    },
    // Get sections for department
    getSections: async (batchId?: number) => {
        const response = await api.get('/dept-admin/sections', { params: { batchId } });
        return response.data;
    },
    // Get semester end marks (view only for dept admin)
    getSemesterMarks: async (params: { departmentId?: number; batchId?: number; courseId?: number }) => {
        const response = await api.get('/dept-admin/semester-marks', { params });
        return response.data;
    },
};

// Subject API
export const subjectApi = {
    getAll: async (semesterId: number, departmentId?: number) => {
        const response = await api.get('/subjects', { params: { semesterId, departmentId } });
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/subjects/${id}`);
        return response.data;
    },
    create: async (data: { courseId: number; semesterId: number; section: string }) => {
        const response = await api.post('/subjects', data);
        return response.data;
    },
    assignTeacher: async (subjectId: number, teacherId: number, isPrimary: boolean) => {
        const response = await api.post(`/subjects/${subjectId}/teachers`, { teacherId, isPrimary });
        return response.data;
    },
    enrollStudent: async (subjectId: number, studentId: number) => {
        const response = await api.post(`/subjects/${subjectId}/students`, { studentId });
        return response.data;
    },
    getEnrolledStudents: async (subjectId: number) => {
        const response = await api.get(`/subjects/${subjectId}/students`);
        return response.data;
    },
    removeStudent: async (subjectId: number, studentId: number) => {
        await api.delete(`/subjects/${subjectId}/students/${studentId}`);
    },
    getTeachers: async (subjectId: number) => {
        const response = await api.get(`/subjects/${subjectId}/teachers`);
        return response.data;
    },
    removeTeacher: async (subjectId: number, teacherId: number) => {
        await api.delete(`/subjects/${subjectId}/teachers/${teacherId}`);
    },
    getMySubjects: async () => {
        const response = await api.get('/subjects/my-subjects');
        return response.data;
    },
    // Student 4-year academic history
    getStudentHistory: async () => {
        const response = await api.get('/subjects/student/history');
        return response.data;
    },
};

// Program API
export const programApi = {
    getAll: async (departmentId?: number) => {
        const response = await api.get('/programs', { params: { departmentId } });
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get(`/programs/${id}`);
        return response.data;
    },
    create: async (data: { name: string; code: string; departmentIds: number[]; durationYears?: number }) => {
        const response = await api.post('/programs', data);
        return response.data;
    },
    update: async (id: number, data: { name?: string; code?: string; durationYears?: number; departmentIds?: number[] }) => {
        const response = await api.put(`/programs/${id}`, data);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/programs/${id}`);
    },
};

// Attendance API
export const attendanceApi = {
    // Get attendance sheet for a subject on a specific date
    getAttendanceSheet: async (subjectId: number, date?: string) => {
        const response = await api.get(`/attendance/subject/${subjectId}`, {
            params: { date },
        });
        return response.data;
    },
    // Get attendance summary for a subject
    getSummary: async (subjectId: number) => {
        const response = await api.get(`/attendance/subject/${subjectId}/summary`);
        return response.data;
    },
    // Get current student's attendance
    getMyAttendance: async (subjectId?: number) => {
        const response = await api.get('/attendance/my', {
            params: { subjectId },
        });
        return response.data;
    },
    // Mark attendance for a single student
    markAttendance: async (subjectId: number, data: {
        studentId: number;
        date: string;
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        remarks?: string;
    }) => {
        const response = await api.post(`/attendance/subject/${subjectId}`, data);
        return response.data;
    },
    // Bulk mark attendance
    bulkMarkAttendance: async (subjectId: number, data: {
        date: string;
        entries: Array<{
            studentId: number;
            status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
            remarks?: string;
        }>;
    }) => {
        const response = await api.post(`/attendance/subject/${subjectId}/bulk`, data);
        return response.data;
    },
    // Get attendance report for date range
    getReport: async (subjectId: number, startDate?: string, endDate?: string) => {
        const response = await api.get(`/attendance/subject/${subjectId}/report`, {
            params: { startDate, endDate },
        });
        return response.data;
    },
};

// Assignment API
export const assignmentApi = {
    // Get assignments by subject
    getBySubject: async (subjectId: number) => {
        const response = await api.get(`/assignments/subject/${subjectId}`);
        return response.data;
    },
    // Get assignment by ID
    getById: async (id: number) => {
        const response = await api.get(`/assignments/${id}`);
        return response.data;
    },
    // Get assignment stats
    getStats: async (id: number) => {
        const response = await api.get(`/assignments/${id}/stats`);
        return response.data;
    },
    // Create assignment
    create: async (data: {
        subjectId: number;
        title: string;
        description?: string;
        dueDate: string;
        maxScore?: number;
    }) => {
        const response = await api.post('/assignments', data);
        return response.data;
    },
    // Update assignment
    update: async (id: number, data: {
        title?: string;
        description?: string;
        dueDate?: string;
        maxScore?: number;
    }) => {
        const response = await api.put(`/assignments/${id}`, data);
        return response.data;
    },
    // Delete assignment
    delete: async (id: number) => {
        await api.delete(`/assignments/${id}`);
    },
    // Submit assignment (students)
    submit: async (assignmentId: number, data: { fileUrl?: string; content?: string }) => {
        const response = await api.post(`/assignments/${assignmentId}/submit`, data);
        return response.data;
    },
    // Get submissions for an assignment
    getSubmissions: async (assignmentId: number) => {
        const response = await api.get(`/assignments/${assignmentId}/submissions`);
        return response.data;
    },
    // Grade a submission
    gradeSubmission: async (submissionId: number, data: { score: number; feedback?: string }) => {
        const response = await api.post(`/assignments/submissions/${submissionId}/grade`, data);
        return response.data;
    },
    // Get my submissions (students)
    getMySubmissions: async () => {
        const response = await api.get('/assignments/my/submissions');
        return response.data;
    },
};

// Marks API
export const marksApi = {
    // Get marks by subject
    getBySubject: async (subjectId: number, examType?: string) => {
        const response = await api.get(`/marks/subject/${subjectId}`, {
            params: { examType },
        });
        return response.data;
    },
    // Get subject grade summary
    getSummary: async (subjectId: number) => {
        const response = await api.get(`/marks/subject/${subjectId}/summary`);
        return response.data;
    },
    // Get enrolled students for grading
    getStudentsForGrading: async (subjectId: number, examType: string) => {
        const response = await api.get(`/marks/subject/${subjectId}/students`, {
            params: { examType },
        });
        return response.data;
    },
    // Get my marks (students)
    getMyMarks: async (subjectId?: number) => {
        const response = await api.get('/marks/my', {
            params: { subjectId },
        });
        return response.data;
    },
    // Record marks for a single student
    record: async (data: {
        studentId: number;
        subjectId: number;
        examType: 'MIDTERM' | 'FINAL' | 'QUIZ' | 'PRACTICAL' | 'INTERNAL';
        score: number;
        maxScore?: number;
        remarks?: string;
    }) => {
        const response = await api.post('/marks', data);
        return response.data;
    },
    // Bulk record marks
    bulkRecord: async (subjectId: number, data: {
        examType: 'MIDTERM' | 'FINAL' | 'QUIZ' | 'PRACTICAL' | 'INTERNAL';
        maxScore: number;
        entries: Array<{ studentId: number; score: number; remarks?: string }>;
    }) => {
        const response = await api.post(`/marks/subject/${subjectId}/bulk`, data);
        return response.data;
    },
    // Update marks
    update: async (id: number, data: { score?: number; maxScore?: number; remarks?: string }) => {
        const response = await api.put(`/marks/${id}`, data);
        return response.data;
    },
    // Delete marks
    delete: async (id: number) => {
        await api.delete(`/marks/${id}`);
    },
};

// Audit Log API
export const auditLogApi = {
    // Get all audit logs with filters
    getAll: async (params?: {
        page?: number;
        limit?: number;
        actorId?: number;
        entityType?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const response = await api.get('/audit-logs', { params });
        return response.data;
    },
    // Get logs for a specific entity
    getByEntity: async (entityType: string, entityId: number) => {
        const response = await api.get(`/audit-logs/entity/${entityType}/${entityId}`);
        return response.data;
    },
    // Get logs by actor
    getByActor: async (actorId: number, page?: number, limit?: number) => {
        const response = await api.get(`/audit-logs/actor/${actorId}`, {
            params: { page, limit },
        });
        return response.data;
    },
    // Get department logs
    getByDepartment: async (departmentId: number, page?: number, limit?: number) => {
        const response = await api.get(`/audit-logs/department/${departmentId}`, {
            params: { page, limit },
        });
        return response.data;
    },
    // Get audit stats
    getStats: async () => {
        const response = await api.get('/audit-logs/stats');
        return response.data;
    },
};

// Edit Request API
export const editRequestApi = {
    // Create edit request (teacher)
    create: async (data: {
        type: 'ATTENDANCE' | 'MARKS';
        subjectId: number;
        entityType: string;
        entityId: number;
        oldValue: object;
        newValue: object;
        reason?: string;
    }) => {
        const response = await api.post('/edit-requests', data);
        return response.data;
    },
    // Get all edit requests (admin)
    getAll: async (params?: { page?: number; limit?: number; status?: string; type?: string }) => {
        const response = await api.get('/edit-requests', { params });
        return response.data;
    },
    // Get pending requests
    getPending: async () => {
        const response = await api.get('/edit-requests/pending');
        return response.data;
    },
    // Get pending count
    getPendingCount: async () => {
        const response = await api.get('/edit-requests/pending/count');
        return response.data;
    },
    // Get my requests (teacher)
    getMyRequests: async () => {
        const response = await api.get('/edit-requests/my');
        return response.data;
    },
    // Get single request
    getById: async (id: number) => {
        const response = await api.get(`/edit-requests/${id}`);
        return response.data;
    },
    // Approve request
    approve: async (id: number, reviewNote?: string) => {
        const response = await api.put(`/edit-requests/${id}/approve`, { reviewNote });
        return response.data;
    },
    // Reject request
    reject: async (id: number, reviewNote?: string) => {
        const response = await api.put(`/edit-requests/${id}/reject`, { reviewNote });
        return response.data;
    },
};

// Enhanced Department API
export const departmentAdminApi = {
    // Create department with admin
    createWithAdmin: async (data: {
        department: { name: string; code: string; description?: string };
        admin: { name: string; email: string };
    }) => {
        const response = await api.post('/departments/with-admin', data);
        return response.data;
    },
};

// Section API
export const sectionApi = {
    // Get all sections or by department/batch
    getAll: async (departmentId?: number, batchId?: number) => {
        const response = await api.get('/sections', { params: { departmentId, batchId } });
        return response.data;
    },
    // Get section by ID
    getById: async (id: number) => {
        const response = await api.get(`/sections/${id}`);
        return response.data;
    },
    // Get students in section
    getStudents: async (sectionId: number) => {
        const response = await api.get(`/sections/${sectionId}/students`);
        return response.data;
    },
    // Create section
    create: async (data: { name: string; departmentId: number; batchId: number }) => {
        const response = await api.post('/sections', data);
        return response.data;
    },
    // Toggle lock
    toggleLock: async (id: number) => {
        const response = await api.patch(`/sections/${id}/toggle-lock`);
        return response.data;
    },
    // Delete section
    delete: async (id: number) => {
        await api.delete(`/sections/${id}`);
    },
    // Assign students to section
    assignStudents: async (sectionId: number, studentProfileIds: number[]) => {
        const response = await api.post('/sections/assign-students', {
            sectionId,
            studentProfileIds,
        });
        return response.data;
    },
    // Remove students from section
    removeStudents: async (studentProfileIds: number[]) => {
        const response = await api.post('/sections/remove-students', {
            studentProfileIds,
        });
        return response.data;
    },
};

// Extended User API for bulk operations
export const studentApi = {
    // Get students for section assignment
    getStudents: async (params?: {
        departmentId?: number;
        programId?: number;
        sectionId?: number;
        batchId?: number;
        unassignedOnly?: boolean;
        skip?: number;
        take?: number;
    }) => {
        const response = await api.get('/users/students', { params });
        return response.data;
    },
    // Bulk create students - programId resolved from department, batchId from admissionYear
    bulkCreate: async (data: {
        rollNumberPrefix: string;
        startNumber: number;
        endNumber: number;
        admissionYear: number;
        departmentId: number;
        emailDomain?: string;
        currentSemester: number;
        cycle?: 'PHYSICS' | 'CHEMISTRY';
    }) => {
        const response = await api.post('/users/bulk-students', data);
        return response.data;
    },
    // Get student counts per department for a batch
    getCountsByBatch: async (batchId: number): Promise<{ departmentId: number; count: number }[]> => {
        const response = await api.get(`/users/student-counts/${batchId}`);
        return response.data;
    },
    // Get student's complete academic history
    getAcademicHistory: async (userId: number): Promise<{
        student: {
            id: number;
            name: string;
            email: string;
            rollNumber: string;
            department: string;
            program: string | null;
            batch: string | null;
            admissionYear: number;
            currentSemester: number;
        };
        semesters: {
            semesterNumber: number;
            courses: {
                courseId: number;
                courseName: string;
                courseCode: string;
                credits: number;
                internalMarks: number | null;
                internalMaxMarks: number;
                semesterMarks: number | null;
                semesterMaxMarks: number;
                totalMarks: number | null;
                totalMaxMarks: number;
                status: string;
            }[];
        }[];
    }> => {
        const response = await api.get(`/users/${userId}/academic-history`);
        return response.data;
    },
};

// Clerk API (COE only)
export const clerkApi = {
    getAll: async () => {
        const response = await api.get('/clerks');
        return response.data;
    },
    create: async (data: { name: string; email: string }) => {
        const response = await api.post('/clerks', data);
        return response.data;
    },
    toggle: async (id: number) => {
        const response = await api.put(`/clerks/${id}/toggle`);
        return response.data;
    },
    delete: async (id: number) => {
        await api.delete(`/clerks/${id}`);
    },
};

// Clerk Marks API (Clerk dashboard)
export const clerkMarksApi = {
    // Get assigned departments and batches
    getAssignments: async () => {
        const response = await api.get('/clerk-marks/assignments');
        return response.data;
    },
    // Get courses for a department
    getCourses: async (departmentId: number) => {
        const response = await api.get('/clerk-marks/courses', { params: { departmentId } });
        return response.data;
    },
    // Get students for marks entry (only those with internal marks)
    getStudents: async (departmentId: number, batchId: number, courseId: number) => {
        const response = await api.get('/clerk-marks/students', {
            params: { departmentId, batchId, courseId },
        });
        return response.data;
    },
    // Submit semester marks
    submitSemesterMarks: async (data: {
        departmentId: number;
        batchId: number;
        courseId: number;
        entries: Array<{ studentUsn: string; marks: number; examType?: 'REGULAR' | 'MAKEUP' | 'REWRITE' }>;
    }) => {
        const response = await api.post('/clerk-marks/semester-marks', data);
        return response.data;
    },
    // Get own submitted semester marks
    getSemesterMarks: async (params?: { status?: string; departmentId?: number; batchId?: number; courseId?: number }) => {
        const response = await api.get('/clerk-marks/semester-marks', { params });
        return response.data;
    },
    // Submit revaluation
    submitRevaluation: async (data: { resultId: number; newMarks: number }) => {
        const response = await api.post('/clerk-marks/revaluations', data);
        return response.data;
    },
    // Get own submitted revaluations
    getRevaluations: async (status?: string) => {
        const response = await api.get('/clerk-marks/revaluations', { params: { status } });
        return response.data;
    },
    // Search for published results (for revaluation)
    getResults: async (params: { studentUsn?: string; departmentId?: number; batchId?: number; courseId?: number }) => {
        const response = await api.get('/clerk-marks/results', { params });
        return response.data;
    },
    // Get clerk's submission statistics
    getStats: async () => {
        const response = await api.get('/clerk-marks/stats');
        return response.data;
    },
};

// Teacher API
export const teacherApi = {
    // Get assigned course allocations
    getMyAllocations: async () => {
        const response = await api.get('/teacher/allocations');
        return response.data;
    },
    // Get students for a specific allocation
    getStudentsForAllocation: async (allocationId: number) => {
        const response = await api.get(`/teacher/allocations/${allocationId}/students`);
        return response.data;
    },
    // Get timetable for section
    getSectionTimetable: async (sectionId: number) => {
        const response = await api.get(`/teacher/sections/${sectionId}/timetable`);
        return response.data;
    },
    // Get internal marks for section/course
    getInternalMarks: async (sectionId: number, courseId: number) => {
        const response = await api.get(`/teacher/internal-marks/${sectionId}/${courseId}`);
        return response.data;
    },
    // Record single student marks
    recordMarks: async (data: {
        studentUsn: string;
        courseId: number;
        batchId: number;
        sectionId: number;
        semesterNumber: number;
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
    }) => {
        const response = await api.post('/teacher/internal-marks', data);
        return response.data;
    },
    // Bulk record marks
    bulkRecordMarks: async (entries: Array<{
        studentUsn: string;
        courseId: number;
        batchId: number;
        sectionId: number;
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
    }>, semesterNumber: number) => {
        const response = await api.post('/teacher/internal-marks/bulk', { entries, semesterNumber });
        return response.data;
    },
    // Submit/finalize marks
    submitMarks: async (sectionId: number, courseId: number) => {
        const response = await api.post('/teacher/internal-marks/submit', { sectionId, courseId });
        return response.data;
    },
    // Get students for attendance
    getStudentsForAttendance: async (sectionId: number, courseId: number, date: string) => {
        const response = await api.get(`/teacher/attendance/${sectionId}/${courseId}`, {
            params: { date }
        });
        return response.data;
    },
    // Get attendance records
    getAttendanceRecords: async (sectionId: number, courseId: number, startDate?: string, endDate?: string) => {
        const response = await api.get(`/teacher/attendance/${sectionId}/${courseId}/records`, {
            params: { startDate, endDate }
        });
        return response.data;
    },
    // Mark attendance
    markAttendance: async (sectionId: number, courseId: number, date: string, entries: Array<{
        studentUsn: string;
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        remarks?: string;
    }>) => {
        const response = await api.post('/teacher/attendance', { sectionId, courseId, date, entries });
        return response.data;
    },
    // Submit/lock attendance
    submitAttendance: async (sectionId: number, courseId: number, date: string) => {
        const response = await api.post('/teacher/attendance/submit', { sectionId, courseId, date });
        return response.data;
    },
    // Get attendance history
    getAttendanceHistory: async (sectionId: number, courseId: number, startDate?: string, endDate?: string) => {
        const response = await api.get(`/teacher/attendance/${sectionId}/${courseId}/history`, {
            params: { startDate, endDate }
        });
        return response.data;
    },
    // Create marks edit request
    createMarksEditRequest: async (marksId: number, newValues: {
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
    }, reason: string) => {
        const response = await api.post('/teacher/edit-requests/marks', { marksId, newValues, reason });
        return response.data;
    },
    // Create attendance edit request
    createAttendanceEditRequest: async (attendanceId: number, newStatus: string, reason: string) => {
        const response = await api.post('/teacher/edit-requests/attendance', { attendanceId, newStatus, reason });
        return response.data;
    },
    // Get my edit requests
    getMyEditRequests: async () => {
        const response = await api.get('/teacher/edit-requests');
        return response.data;
    },
};

// Student Dashboard API (Read-only)
export const studentDashboardApi = {
    // Get student profile
    getProfile: async () => {
        const response = await api.get('/student/profile');
        return response.data;
    },
    // Get enrolled courses
    getCourses: async () => {
        const response = await api.get('/student/courses');
        return response.data;
    },
    // Get section timetable
    getTimetable: async () => {
        const response = await api.get('/student/timetable');
        return response.data;
    },
    // Get internal marks (finalized only)
    getInternalMarks: async () => {
        const response = await api.get('/student/internal-marks');
        return response.data;
    },
    // Get attendance summary and records
    getAttendance: async (courseId?: number) => {
        const params = courseId ? { courseId } : {};
        const response = await api.get('/student/attendance', { params });
        return response.data;
    },
    // Get published results
    getResults: async () => {
        const response = await api.get('/student/results');
        return response.data;
    },
    // Get academic history (4-year view)
    getHistory: async () => {
        const response = await api.get('/student/history');
        return response.data;
    },
    // Get full profile with admission data
    getFullProfile: async () => {
        const response = await api.get('/student/profile');
        return response.data;
    },
    // Update student profile
    updateProfile: async (data: any) => {
        const response = await api.put('/student/profile', data);
        return response.data;
    },
    submitEditRequest: async (data: { proposedChanges: Record<string, unknown>; reason: string }) => {
        const response = await api.post('/student/profile/edit-request', data);
        return response.data;
    },
    getEditRequests: async () => {
        const response = await api.get('/student/profile/edit-requests');
        return response.data;
    },
};

// Mentor API (for Teachers who are Mentors)
export const mentorApi = {
    // Check if current user is a mentor
    getStatus: async () => {
        const response = await api.get('/teacher/mentor/status');
        return response.data;
    },
    // Get mentor profile with stats
    getProfile: async () => {
        const response = await api.get('/teacher/mentor/profile');
        return response.data;
    },
    // Get assigned students
    getStudents: async () => {
        const response = await api.get('/teacher/mentor/students');
        return response.data;
    },
    // Get detailed student profile
    getStudentProfile: async (usn: string) => {
        const response = await api.get(`/teacher/mentor/students/${usn}`);
        return response.data;
    },
    // Get student academic performance
    getStudentAcademic: async (usn: string) => {
        const response = await api.get(`/teacher/mentor/students/${usn}/academic`);
        return response.data;
    },
    // Get student attendance
    getStudentAttendance: async (usn: string) => {
        const response = await api.get(`/teacher/mentor/students/${usn}/attendance`);
        return response.data;
    },
    // Get pending approvals
    getPendingApprovals: async () => {
        const response = await api.get('/teacher/mentor/approvals');
        return response.data;
    },
    // Approve marks
    approveMarks: async (marksIds: number[]) => {
        const response = await api.post('/teacher/mentor/approvals/approve', { marksIds });
        return response.data;
    },
    // Reject marks
    rejectMarks: async (marksId: number, reason: string) => {
        const response = await api.post(`/teacher/mentor/approvals/${marksId}/reject`, { reason });
        return response.data;
    },
    // Update marks as mentor
    updateMarks: async (marksId: number, updates: {
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
    }) => {
        const response = await api.put(`/teacher/mentor/marks/${marksId}`, updates);
        return response.data;
    },
    // Record observation for student
    recordObservation: async (usn: string, data: {
        personalityCommunication?: string;
        curricularResponse?: string;
        coCurricularResponse?: string;
        extraCurricularResponse?: string;
        overallAssessment: 'SATISFACTORY' | 'MODERATE' | 'NEEDS_IMPROVEMENT';
        mentorRemarks?: string;
    }) => {
        const response = await api.post(`/teacher/mentor/students/${usn}/observations`, data);
        return response.data;
    },
    // Get observations for student
    getObservations: async (usn: string) => {
        const response = await api.get(`/teacher/mentor/students/${usn}/observations`);
        return response.data;
    },
    // Log student interaction
    logStudentInteraction: async (usn: string, data: {
        personalAspects?: string;
        academicAspects?: string;
        careerAspects?: string;
        otherAspects?: string;
        interactionDate: string;
    }) => {
        const response = await api.post(`/teacher/mentor/students/${usn}/interactions/student`, data);
        return response.data;
    },
    // Log parent interaction
    logParentInteraction: async (usn: string, data: {
        interactionDate: string;
        mode: 'CALL' | 'MEETING';
        purpose: 'ATTENDANCE' | 'IA_MARKS' | 'BEHAVIOR' | 'OTHER';
        summary: string;
    }) => {
        const response = await api.post(`/teacher/mentor/students/${usn}/interactions/parent`, data);
        return response.data;
    },
    // Get all interactions for student
    getInteractions: async (usn: string) => {
        const response = await api.get(`/teacher/mentor/students/${usn}/interactions`);
        return response.data;
    },
    // Change parent password (mentor only)
    changeParentPassword: async (usn: string, newPassword: string) => {
        const response = await api.put(`/teacher/mentor/students/${usn}/parent-password`, { newPassword });
        return response.data;
    },
};

// Mentor Assignment API (for Dept Admin)
export const mentorAssignmentApi = {
    // Get mentor assignments for department
    getAssignments: async (batchId?: number) => {
        const response = await api.get('/dept-admin/mentor-assignments', {
            params: { batchId }
        });
        return response.data;
    },
    // Assign mentor to students
    assign: async (data: {
        teacherProfileId: number;
        studentUsns: string[];
        semesterNumber: number;
        academicYear: string;
    }) => {
        const response = await api.post('/dept-admin/mentor-assignments', data);
        return response.data;
    },
    // Expire specific assignment
    expire: async (assignmentId: number) => {
        const response = await api.post(`/dept-admin/mentor-assignments/${assignmentId}/expire`);
        return response.data;
    },
    // Bulk expire for semester
    expireSemester: async (semesterNumber: number) => {
        const response = await api.post('/dept-admin/mentor-assignments/expire-semester', { semesterNumber });
        return response.data;
    },
    // Get assignment history
    getHistory: async () => {
        const response = await api.get('/dept-admin/mentor-assignments/history');
        return response.data;
    },
    // Get teachers for mentor assignment
    getTeachers: async () => {
        const response = await api.get('/dept-admin/teachers');
        return response.data;
    },
    // Get mentor tracking summary (interaction completion status)
    getMentorTracking: async (params?: { batchId?: number; sectionId?: number }) => {
        const response = await api.get('/dept-admin/mentor-tracking', { params });
        return response.data;
    },
};

// Admissions API (Admissions Admin / Admin Clerk)
export const admissionsApi = {
    // Get dashboard stats
    getStats: async () => {
        const response = await api.get('/admissions/stats');
        return response.data;
    },
    // Get admissions list with filters
    getAll: async (params?: { status?: string; search?: string; skip?: number; take?: number }) => {
        const response = await api.get('/admissions', { params });
        return response.data;
    },
    // Get single admission
    getById: async (id: number) => {
        const response = await api.get(`/admissions/${id}`);
        return response.data;
    },
    // Create admission
    create: async (data: Record<string, unknown>) => {
        const response = await api.post('/admissions', data);
        return response.data;
    },
    // Update admission
    update: async (id: number, data: Record<string, unknown>) => {
        const response = await api.put(`/admissions/${id}`, data);
        return response.data;
    },
    // Submit admission for review
    submit: async (id: number) => {
        const response = await api.post(`/admissions/${id}/submit`);
        return response.data;
    },
    // Review admission (approve/reject)
    review: async (id: number, data: { status: 'APPROVED' | 'REJECTED'; reason?: string; batchSemester?: number; isLateralEntry?: boolean }) => {
        const response = await api.post(`/admissions/${id}/review`, data);
        return response.data;
    },
    // Assign permanent USN
    assignUsn: async (studentProfileId: number, permanentUsn: string) => {
        const response = await api.post('/admissions/assign-usn', { studentProfileId, permanentUsn });
        return response.data;
    },
    // Get admin clerks
    getClerks: async () => {
        const response = await api.get('/admissions/clerks');
        return response.data;
    },
    // Create admin clerk
    createClerk: async (data: { name: string; email: string }) => {
        const response = await api.post('/admissions/clerks', data);
        return response.data;
    },
    // Admin directly updates student info
    updateStudentInfo: async (userId: number, data: Record<string, unknown>) => {
        const response = await api.put(`/admissions/student/${userId}`, data);
        return response.data;
    },
    // Clerk submits edit request
    createEditRequest: async (userId: number, data: Record<string, unknown>) => {
        const response = await api.post(`/admissions/student/${userId}/edit-request`, data);
        return response.data;
    },
    // Get edit requests (admin)
    getEditRequests: async (status?: string) => {
        const response = await api.get('/admissions/edit-requests', { params: { status } });
        return response.data;
    },
    // Get department admission status
    getDepartmentStatus: async () => {
        const response = await api.get('/admissions/department-status');
        return response.data;
    },
    // Close department admissions (allocate temporary USNs)
    closeAdmissions: async (departmentId: number) => {
        const response = await api.post(`/admissions/close-admissions/${departmentId}`);
        return response.data;
    },
    // Reopen department admissions
    reopenAdmissions: async (departmentId: number) => {
        const response = await api.post(`/admissions/reopen-admissions/${departmentId}`);
        return response.data;
    },
    // Approve edit request (admin)
    approveEditRequest: async (id: number, reviewNote?: string) => {
        const response = await api.post(`/admissions/edit-requests/${id}/approve`, { reviewNote });
        return response.data;
    },
    // Reject edit request (admin)
    rejectEditRequest: async (id: number, reviewNote?: string) => {
        const response = await api.post(`/admissions/edit-requests/${id}/reject`, { reviewNote });
        return response.data;
    },
    // Change student branch (Admissions Admin only)
    changeBranch: async (userId: number, newBranch: string) => {
        const response = await api.put(`/admissions/student/${userId}/branch`, { newBranch });
        return response.data;
    },
    // Get approved students
    getStudents: async () => {
        const response = await api.get('/admissions/students');
        return response.data;
    },
    // Form Config
    getFormConfig: async () => {
        const response = await api.get('/admissions/form-config');
        return response.data;
    },
    updateFormConfig: async (data: Record<string, unknown>) => {
        const response = await api.put('/admissions/form-config', data);
        return response.data;
    },
    uploadFormLogo: async (file: File) => {
        const formData = new FormData();
        formData.append('logo', file);
        const response = await api.post('/admissions/form-config/logo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
    // Bulk Upload
    downloadTemplate: async () => {
        const response = await api.get('/admissions/bulk-upload/template', {
            responseType: 'blob',
        });
        return response.data;
    },
    bulkUploadParse: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/admissions/bulk-upload/parse', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
    bulkUploadConfirm: async (rows: any[]) => {
        const response = await api.post('/admissions/bulk-upload/confirm', { rows });
        return response.data;
    },
};

// COE API
export const coeApi = {
    // Get students awaiting permanent USN
    getStudentsAwaitingUsn: async () => {
        const response = await api.get('/coe/students');
        return response.data;
    },
    // Assign permanent USN to a student
    assignPermanentUsn: async (studentProfileId: number, permanentUsn: string) => {
        const response = await api.post('/coe/assign-permanent-usn', { studentProfileId, permanentUsn });
        return response.data;
    },
};

// USN Request API
export const usnRequestApi = {
    // Create USN request (teacher)
    create: async (studentProfileId: number, justification?: string) => {
        const response = await api.post('/usn-requests', { studentProfileId, justification });
        return response.data;
    },
    // Get USN requests (filtered)
    getAll: async (params?: { status?: string; skip?: number; take?: number }) => {
        const response = await api.get('/usn-requests', { params });
        return response.data;
    },
    // Review USN request (admin)
    review: async (id: number, data: { status: 'APPROVED' | 'REJECTED'; permanentUsn?: string; rejectionReason?: string }) => {
        const response = await api.post(`/usn-requests/${id}/review`, data);
        return response.data;
    },
    // Get my requests (teacher)
    getMyRequests: async () => {
        const response = await api.get('/usn-requests/my');
        return response.data;
    },
};

// Semester Marks API
export const semesterMarksApi = {
    // Upload marks (Clerk/Admin)
    uploadMarks: async (file: File, context: { batchId: number; departmentId: number; semesterNumber: number; courseId: number }) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('batchId', context.batchId.toString());
        formData.append('departmentId', context.departmentId.toString());
        formData.append('semesterNumber', context.semesterNumber.toString());
        formData.append('courseId', context.courseId.toString());

        const response = await api.post('/semester-marks/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    // Get my uploads
    getMyUploads: async () => {
        const response = await api.get('/semester-marks/my-uploads');
        return response.data;
    },

    // Get upload by ID
    getUploadById: async (id: number) => {
        const response = await api.get(`/semester-marks/${id}`);
        return response.data;
    },

    // COE: Get pending uploads
    getPendingUploads: async () => {
        const response = await api.get('/semester-marks/pending-review');
        return response.data;
    },

    // COE: Approve upload
    approveUpload: async (id: number, reviewNotes?: string) => {
        const response = await api.post(`/semester-marks/${id}/approve`, { reviewNotes });
        return response.data;
    },

    // COE: Reject upload
    rejectUpload: async (id: number, reviewNotes: string) => {
        const response = await api.post(`/semester-marks/${id}/reject`, { reviewNotes });
        return response.data;
    },

    // COE: Post results
    postResults: async (id: number) => {
        const response = await api.post(`/semester-marks/${id}/post`);
        return response.data;
    },

    // COE: Edit marks entry
    editMarksEntry: async (entryId: number, marks: number) => {
        const response = await api.put(`/semester-marks/entry/${entryId}`, { marks });
        return response.data;
    },
};

// ─── Parent Portal API ───────────────────────────────────────
export const parentApi = {
    getDashboard: async () => {
        const response = await api.get('/parent/dashboard');
        return response.data;
    },

    getStudentProfile: async (studentProfileId: number) => {
        const response = await api.get(`/parent/student/${studentProfileId}`);
        return response.data;
    },

    getStudentAttendance: async (studentProfileId: number) => {
        const response = await api.get(`/parent/student/${studentProfileId}/attendance`);
        return response.data;
    },

    getStudentMarks: async (studentProfileId: number) => {
        const response = await api.get(`/parent/student/${studentProfileId}/marks`);
        return response.data;
    },
};

// ─── Chat API ────────────────────────────────────────────────
export const chatApi = {
    getConversations: async () => {
        const response = await api.get('/chat/conversations');
        return response.data;
    },

    startConversation: async (studentProfileId: number) => {
        const response = await api.post(`/chat/conversations/${studentProfileId}`);
        return response.data;
    },

    startConversationAsTeacher: async (studentProfileId: number) => {
        const response = await api.post(`/chat/teacher-conversations/${studentProfileId}`);
        return response.data;
    },

    getMessages: async (conversationId: number, cursor?: number, limit = 50) => {
        const params = new URLSearchParams();
        if (cursor) params.set('cursor', String(cursor));
        params.set('limit', String(limit));
        const response = await api.get(`/chat/conversations/${conversationId}/messages?${params}`);
        return response.data;
    },

    sendMessage: async (conversationId: number, content: string) => {
        const response = await api.post(`/chat/conversations/${conversationId}/messages`, { content });
        return response.data;
    },

    markAsRead: async (conversationId: number) => {
        const response = await api.post(`/chat/conversations/${conversationId}/read`);
        return response.data;
    },

    canEscalate: async (conversationId: number) => {
        const response = await api.get(`/chat/conversations/${conversationId}/can-escalate`);
        return response.data;
    },

    escalate: async (conversationId: number) => {
        const response = await api.post(`/chat/conversations/${conversationId}/escalate`);
        return response.data;
    },

    resolve: async (conversationId: number) => {
        const response = await api.post(`/chat/conversations/${conversationId}/resolve`);
        return response.data;
    },

    getUnreadCount: async () => {
        const response = await api.get('/chat/unread-count');
        return response.data;
    },

    editMessage: async (messageId: number, content: string) => {
        const response = await api.put(`/chat/messages/${messageId}`, { content });
        return response.data;
    },

    getMenteeStudents: async () => {
        const response = await api.get('/chat/mentee-students');
        return response.data;
    },
};

// ============================================
// TIMETABLE GENERATOR API
// ============================================
export const timetableApi = {
    // Config
    saveConfig: async (data: any) => {
        const response = await api.post('/dept-admin/timetable-generator/config', data);
        return response.data;
    },
    getConfig: async (sectionId: number, semesterId: number) => {
        const response = await api.get(`/dept-admin/timetable-generator/config/${sectionId}/${semesterId}`);
        return response.data;
    },
    // Teacher Load Summary (cross-section visibility)
    getTeacherLoad: async (semesterId: number) => {
        const response = await api.get(`/dept-admin/timetable-generator/teacher-load/${semesterId}`);
        return response.data;
    },
    // Pre-generation validation
    validate: async (sectionIds: number[], semesterId: number) => {
        const response = await api.post('/dept-admin/timetable-generator/validate', { sectionIds, semesterId });
        return response.data;
    },
    // Generate (batch-wise: accepts array of sectionIds)
    generate: async (sectionIds: number[], semesterId: number, allowExceedLimits = false) => {
        const response = await api.post('/dept-admin/timetable-generator/generate', { sectionIds, semesterId, allowExceedLimits });
        return response.data;
    },
    // Grid
    getGrid: async (sectionId: number, semesterId: number) => {
        const response = await api.get(`/dept-admin/timetable-generator/grid/${sectionId}/${semesterId}`);
        return response.data;
    },
    // Swap
    swapSlots: async (slotId1: number, slotId2: number) => {
        const response = await api.post('/dept-admin/timetable-generator/swap', { slotId1, slotId2 });
        return response.data;
    },
    // Clear
    clear: async (sectionId: number, semesterId: number) => {
        const response = await api.delete(`/dept-admin/timetable-generator/clear/${sectionId}/${semesterId}`);
        return response.data;
    },
};

// ============================================
// SUBSTITUTION API
// ============================================
export const substitutionApi = {
    getAvailableTeachers: async (params: { semesterId: number; dayOfWeek: number; periodNumber: number; date: string; departmentId?: number }) => {
        const response = await api.get('/dept-admin/substitutions/available-teachers', { params });
        return response.data;
    },
    assign: async (data: any) => {
        const response = await api.post('/dept-admin/substitutions/assign', data);
        return response.data;
    },
    getForDate: async (date: string, departmentId?: number) => {
        const response = await api.get(`/dept-admin/substitutions/date/${date}`, { params: { departmentId } });
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete(`/dept-admin/substitutions/${id}`);
        return response.data;
    },
};

// ============================================
// ACADEMIC CALENDAR API
// ============================================
export const calendarApi = {
    declareDay: async (data: { date: string; type: string; label?: string; overrideDay?: number; departmentId?: number }) => {
        const response = await api.post('/dept-admin/calendar/day', data);
        return response.data;
    },
    getMonth: async (year: number, month: number, departmentId?: number) => {
        const response = await api.get(`/dept-admin/calendar/month/${year}/${month}`, { params: { departmentId } });
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete(`/dept-admin/calendar/${id}`);
        return response.data;
    },
};

// ============================================
// CLASSROOM API
// ============================================
export const classroomApi = {
    create: async (data: { name: string; building?: string; capacity?: number; type?: string }) => {
        const response = await api.post('/dept-admin/classrooms', data);
        return response.data;
    },
    list: async (type?: string) => {
        const response = await api.get('/dept-admin/classrooms', { params: { type } });
        return response.data;
    },
    getFree: async (params: { dayOfWeek: number; periodNumber: number; semesterId: number; type?: string }) => {
        const response = await api.get('/dept-admin/classrooms/free', { params });
        return response.data;
    },
    update: async (id: number, data: any) => {
        const response = await api.put(`/dept-admin/classrooms/${id}`, data);
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete(`/dept-admin/classrooms/${id}`);
        return response.data;
    },
};

// ============================================
// TEACHER TIMETABLE API
// ============================================
export const teacherTimetableApi = {
    getGrid: async () => {
        const response = await api.get('/teacher/timetable/grid');
        return response.data;
    },
};

// ============================================
// STUDENT TIMETABLE API
// ============================================
export const studentTimetableApi = {
    getGrid: async () => {
        const response = await api.get('/student/timetable/grid');
        return response.data;
    },
};
// ============================================
// PLACEMENT API
// ============================================
export const placementApi = {
      createCompanyAccount: async (data: any) => { const r = await api.post('/placement/companies/accounts', data); return r.data; },
    getMyCompany: async () => { const r = await api.get('/placement/companies/me'); return r.data; },
    createMyCompany: async (data: any) => { const r = await api.post('/placement/companies', data); return r.data; },
    updateMyCompany: async (data: any) => { const r = await api.patch('/placement/companies/me', data); return r.data; },
    getCompanies: async (params?: any) => { const r = await api.get('/placement/companies', { params }); return r.data; },
    getCompany: async (id: number) => { const r = await api.get(`/placement/companies/${id}`); return r.data; },
    createCompany: async (data: any) => { const r = await api.post('/placement/companies', data); return r.data; },
    updateCompany: async (id: number, data: any) => { const r = await api.patch(`/placement/companies/${id}`, data); return r.data; },
    verifyCompany: async (id: number) => { const r = await api.post(`/placement/companies/${id}/verify`); return r.data; },
    getJobs: async (params?: any) => { const r = await api.get('/placement/jobs', { params }); return r.data; },
    getJob: async (id: number) => { const r = await api.get(`/placement/jobs/${id}`); return r.data; },
    createJob: async (data: any) => { const r = await api.post('/placement/jobs', data); return r.data; },
    updateJob: async (id: number, data: any) => { const r = await api.patch(`/placement/jobs/${id}`, data); return r.data; },
    approveJob: async (id: number) => { const r = await api.post(`/placement/jobs/${id}/approve`); return r.data; },
    getDrives: async (params?: any) => { const r = await api.get('/placement/drives', { params }); return r.data; },
    getDrive: async (id: number) => { const r = await api.get(`/placement/drives/${id}`); return r.data; },
    createDrive: async (data: any) => { const r = await api.post('/placement/drives', data); return r.data; },
    addRound: async (driveId: number, data: any) => { const r = await api.post(`/placement/drives/${driveId}/rounds`, data); return r.data; },
    getApplications: async (params?: any) => { const r = await api.get('/placement/applications', { params }); return r.data; },
    getApplication: async (id: number) => { const r = await api.get(`/placement/applications/${id}`); return r.data; },
    apply: async (data: any) => { const r = await api.post('/placement/applications', data); return r.data; },
    updateApplicationStatus: async (id: number, data: any) => { const r = await api.patch(`/placement/applications/${id}/status`, data); return r.data; },
    withdrawApplication: async (id: number) => { const r = await api.patch(`/placement/applications/${id}/withdraw`); return r.data; },
    getProfile: async () => { const r = await api.get('/placement/profile'); return r.data; },
    updateProfile: async (data: any) => { const r = await api.patch('/placement/profile', data); return r.data; },
    uploadCv: async (file: File) => {
        const form = new FormData();
        form.append('file', file);
        const r = await api.post('/placement/profile/cv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return r.data;
    },
    submitDeclaration: async (data: any) => { const r = await api.post('/placement/profile/declaration', data); return r.data; },
    getStats: async () => { const r = await api.get('/placement/analytics/stats'); return r.data; },
    getDeptWiseStats: async () => { const r = await api.get('/placement/analytics/dept-wise'); return r.data; },
};

export default api;
