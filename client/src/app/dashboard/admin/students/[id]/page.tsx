'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { userApi, batchApi, studentApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import {
    ArrowLeft,
    Mail,
    Phone,
    MapPin,
    Calendar,
    BookOpen,
    GraduationCap,
    Award,
    Clock,
    FileText,
    Shield,
    CheckCircle,
    XCircle
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StudentProfile {
    id: number; // StudentProfile ID
    rollNumber: string;
    program?: { name: string; code: string };
    batch?: { name: string };
    section?: { name: string };
    currentSemester: number;
    admissionData?: any;
    user: {
        id: number; // User ID
        name: string;
        email: string;
        role: string;
        department?: { name: string };
    };
}

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { user: currentUser } = useAuthStore();
    // Verify if ID is user ID or profile ID. Assuming User ID for consistency with User Management link
    const userId = parseInt(params.id as string);

    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSemester, setSelectedSemester] = useState<number>(1);

    // Fetch academic history with marks
    const { data: academicData } = useQuery({
        queryKey: ['studentAcademicHistory', userId],
        queryFn: () => studentApi.getAcademicHistory(userId),
        enabled: !!userId,
    });

    useEffect(() => {
        const loadStudent = async () => {
            try {
                setLoading(true);

                // Check if current user is viewing their own profile
                const isOwnProfile = currentUser?.id === userId;

                let userData;
                if (isOwnProfile) {
                    // Students viewing their own profile - use current user data
                    userData = currentUser;
                } else {
                    // Admins/staff viewing another user's profile
                    userData = await userApi.getById(userId);
                }

                // Construct profile object from user data structure
                if (userData && userData.studentProfile) {
                    setStudent({
                        id: userData.studentProfile.id,
                        rollNumber: userData.studentProfile.rollNumber,
                        program: userData.studentProfile.program,
                        batch: userData.studentProfile.batch,
                        section: userData.studentProfile.section,
                        currentSemester: userData.studentProfile.currentSemester,
                        admissionData: userData.studentProfile.admissionData,
                        user: {
                            id: userData.id,
                            name: userData.name,
                            email: userData.email,
                            role: userData.role,
                            department: userData.department
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to load student:', error);
            } finally {
                setLoading(false);
            }
        };

        if (userId && currentUser) {
            loadStudent();
        }
    }, [userId, currentUser]);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-neutral-900">Student Not Found</h1>
                <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 animate-fade-in min-h-screen bg-neutral-50/50">
            {/* Navigation Header */}
            <div>
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="mb-4 pl-0 hover:pl-2 transition-all text-neutral-500"
                    leftIcon={ArrowLeft}
                >
                    Back to List
                </Button>
            </div>

            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden relative">
                {/* Decorative Background */}
                <div className="h-32 bg-gradient-to-r from-primary-600 to-accent-600"></div>

                <div className="px-8 pb-8">
                    <div className="flex flex-col md:flex-row gap-6 items-start -mt-12">
                        {/* Avatar */}
                        <div className="h-24 w-24 rounded-2xl bg-white p-1 shadow-lg">
                            <div className="h-full w-full rounded-xl bg-neutral-100 flex items-center justify-center text-4xl font-bold text-neutral-400 uppercase">
                                {student.user.name.charAt(0)}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 pt-2 md:pt-14">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-neutral-900">{student.user.name}</h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="neutral" className="font-mono text-sm px-2 py-0.5 border-neutral-300">
                                            {student.rollNumber}
                                        </Badge>
                                        <span className="text-neutral-300">•</span>
                                        <span className="text-neutral-500 font-medium">{student.user.department?.name || 'No Department'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats / Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-neutral-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-neutral-500 uppercase font-semibold">Email</p>
                                <p className="text-sm font-medium text-neutral-900 truncate" title={student.user.email}>
                                    {student.user.email}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                <GraduationCap className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-neutral-500 uppercase font-semibold">Program</p>
                                <p className="text-sm font-medium text-neutral-900">
                                    {student.program?.code || 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-neutral-500 uppercase font-semibold">Batch</p>
                                <p className="text-sm font-medium text-neutral-900">
                                    {student.batch?.name || 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                                <BookOpen className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-neutral-500 uppercase font-semibold">Current Sem</p>
                                <p className="text-sm font-medium text-neutral-900">
                                    Semester {student.currentSemester}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-white p-1 border border-neutral-200 rounded-xl shadow-sm w-full md:w-auto flex overflow-x-auto">
                    <TabsTrigger value="overview" className="flex-1 md:flex-none">Overview</TabsTrigger>
                    <TabsTrigger value="academics" className="flex-1 md:flex-none">Academics</TabsTrigger>
                    <TabsTrigger value="attendance" className="flex-1 md:flex-none">Attendance</TabsTrigger>
                    <TabsTrigger value="marks" className="flex-1 md:flex-none">Marks</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <Card className="p-6">
                            <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                                <Shield className="h-5 w-5 text-neutral-400" />
                                Personal Information
                            </h3>
                            <dl className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Full Name</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.user.name}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Email Address</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.emailId || student.user.email}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Phone</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.mobileNumber || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Date of Birth</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">
                                        {student.admissionData?.dateOfBirth ? new Date(student.admissionData.dateOfBirth).toLocaleDateString('en-IN') : '--'}
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Gender</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.gender || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Category</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.category || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Blood Group</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.bloodGroup || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <dt className="text-sm font-medium text-neutral-500">Address</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">
                                        {student.admissionData?.permanentAddress
                                            ? `${student.admissionData.permanentAddress.address || ''}, ${student.admissionData.permanentAddress.state || ''} - ${student.admissionData.permanentAddress.pin || ''}`
                                            : '--'}
                                    </dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Father&apos;s Name</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.fatherDetails?.name || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Father&apos;s Phone</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.fatherDetails?.mobile || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                    <dt className="text-sm font-medium text-neutral-500">Mother&apos;s Name</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.motherDetails?.name || '--'}</dd>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <dt className="text-sm font-medium text-neutral-500">Mother&apos;s Phone</dt>
                                    <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.admissionData?.motherDetails?.mobile || '--'}</dd>
                                </div>
                            </dl>
                        </Card>

                    </div>
                </TabsContent>

                <TabsContent value="academics" className="space-y-6">
                    <Card className="p-6">
                        <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                            <Award className="h-5 w-5 text-neutral-400" />
                            Academic Details
                        </h3>
                        <dl className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                <dt className="text-sm font-medium text-neutral-500">Roll Number (USN)</dt>
                                <dd className="text-sm font-mono font-medium text-neutral-900 col-span-2">{student.rollNumber}</dd>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                <dt className="text-sm font-medium text-neutral-500">Section</dt>
                                <dd className="text-sm font-medium text-neutral-900 col-span-2">
                                    {student.section ? `Section ${student.section.name}` : 'Unassigned'}
                                </dd>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                <dt className="text-sm font-medium text-neutral-500">Program</dt>
                                <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.program?.name || 'Not assigned'}</dd>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                <dt className="text-sm font-medium text-neutral-500">Batch</dt>
                                <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.batch?.name || 'Not assigned'}</dd>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pb-4 border-b border-neutral-100">
                                <dt className="text-sm font-medium text-neutral-500">Current Semester</dt>
                                <dd className="text-sm font-medium text-neutral-900 col-span-2">Semester {student.currentSemester}</dd>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <dt className="text-sm font-medium text-neutral-500">Department</dt>
                                <dd className="text-sm font-medium text-neutral-900 col-span-2">{student.user.department?.name || 'Not assigned'}</dd>
                            </div>
                        </dl>
                    </Card>
                    <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-neutral-200">
                        <BookOpen className="h-10 w-10 text-neutral-300 mb-3" />
                        <h3 className="text-lg font-medium text-neutral-900">Course History</h3>
                        <p className="text-neutral-500 mt-1">Subject enrollment and course history will appear here.</p>
                    </div>
                </TabsContent>

                <TabsContent value="marks" className="space-y-6">
                    {/* Semester Cards Grid */}
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Select Semester</h3>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
                                const semData = academicData?.semesters.find(s => s.semesterNumber === semNum);
                                const hasCourses = semData && semData.courses.length > 0;
                                const isSelected = selectedSemester === semNum;
                                const isCurrent = student?.currentSemester === semNum;

                                return (
                                    <button
                                        key={semNum}
                                        onClick={() => setSelectedSemester(semNum)}
                                        className={`relative p-4 rounded-xl text-center transition-all duration-200 ${isSelected
                                            ? 'bg-primary-600 text-white shadow-lg scale-105'
                                            : hasCourses
                                                ? 'bg-white border-2 border-primary-200 text-primary-700 hover:border-primary-400'
                                                : 'bg-neutral-100 text-neutral-400 border-2 border-transparent hover:bg-neutral-200'
                                            }`}
                                    >
                                        {isCurrent && (
                                            <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${isSelected ? 'bg-secondary-400' : 'bg-secondary-500'} ring-2 ring-white`} />
                                        )}
                                        <div className="text-2xl font-bold">{semNum}</div>
                                        <div className="text-xs mt-1 opacity-75">{semData?.courses.length || 0} Courses</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Marks Table */}
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Semester {selectedSemester} - Course Marks</h3>
                        {(() => {
                            const semData = academicData?.semesters.find(s => s.semesterNumber === selectedSemester);
                            const courses = semData?.courses || [];

                            if (courses.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-neutral-200">
                                        <BookOpen className="h-10 w-10 text-neutral-300 mb-3" />
                                        <h4 className="text-lg font-medium text-neutral-900">No courses yet</h4>
                                        <p className="text-neutral-500 mt-1">No marks recorded for Semester {selectedSemester}</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase">Course</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Credits</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Internal</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Semester</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Total</th>
                                                <th className="px-4 py-4 text-center text-xs font-semibold text-neutral-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100">
                                            {courses.map((course) => (
                                                <tr key={course.courseId} className="hover:bg-neutral-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-neutral-900">{course.courseName}</div>
                                                        <div className="text-sm text-neutral-500">{course.courseCode}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-secondary-100 text-secondary-700 font-semibold text-sm">{course.credits}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="font-medium text-neutral-900">{course.internalMarks !== null ? course.internalMarks : '-'}</div>
                                                        <div className="text-xs text-neutral-500">/ {course.internalMaxMarks}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="font-medium text-neutral-900">{course.semesterMarks !== null ? course.semesterMarks : '-'}</div>
                                                        <div className="text-xs text-neutral-500">/ {course.semesterMaxMarks}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="font-bold text-lg text-primary-700">{course.totalMarks !== null ? course.totalMarks : '-'}</div>
                                                        <div className="text-xs text-neutral-500">/ {course.totalMaxMarks}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${course.status === 'PASS' ? 'bg-green-100 text-green-700' :
                                                            course.status === 'FAIL' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                            {course.status === 'PASS' ? <CheckCircle className="h-3 w-3" /> :
                                                                course.status === 'FAIL' ? <XCircle className="h-3 w-3" /> :
                                                                    <Clock className="h-3 w-3" />}
                                                            {course.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                </TabsContent>
                <TabsContent value="attendance">
                    <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-neutral-200">
                        <Clock className="h-10 w-10 text-neutral-300 mb-3" />
                        <h3 className="text-lg font-medium text-neutral-900">Attendance Record</h3>
                        <p className="text-neutral-500 mt-1">Detailed attendance logs will be displayed here.</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div >
    );
}
