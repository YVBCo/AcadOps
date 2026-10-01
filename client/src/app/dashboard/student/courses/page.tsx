'use client';

import { useQuery } from '@tanstack/react-query';
import { studentDashboardApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Clock, FileImage, Download } from 'lucide-react';

interface CourseData {
    id: number;
    code: string;
    name: string;
    credits: number;
    semesterNumber: number;
    teacher: string;
    section: string | null;
    status: string;
}

interface TimetableData {
    id: number;
    fileUrl: string;
    fileName: string;
    fileType: string;
    semesterNumber: number;
    uploadedAt: string;
}

export default function StudentCoursesPage() {
    // Fetch courses
    const { data: courses = [], isLoading: coursesLoading } = useQuery<CourseData[]>({
        queryKey: ['student-courses'],
        queryFn: studentDashboardApi.getCourses,
    });

    // Fetch timetable
    const { data: timetable, isLoading: timetableLoading } = useQuery<TimetableData | null>({
        queryKey: ['student-timetable'],
        queryFn: studentDashboardApi.getTimetable,
    });

    const isLoading = coursesLoading || timetableLoading;

    // Group courses by semester
    const coursesBySemester = courses.reduce((acc, course) => {
        const sem = course.semesterNumber || 1;
        if (!acc[sem]) acc[sem] = [];
        acc[sem].push(course);
        return acc;
    }, {} as Record<number, CourseData[]>);

    const semesters = Object.keys(coursesBySemester)
        .map(Number)
        .sort((a, b) => b - a);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-2xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Courses</h1>
                    <p className="text-slate-500 mt-1">View your enrolled courses and section timetable</p>
                </div>
                <Badge variant="neutral" className="w-fit">
                    {courses.length} Courses Enrolled
                </Badge>
            </div>

            {/* Timetable Section */}
            {timetable && (
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800">Section Timetable</h3>
                                <p className="text-sm text-slate-500">Semester {timetable.semesterNumber}</p>
                            </div>
                        </div>
                        <a
                            href={timetable.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-200 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </a>
                    </div>
                    {timetable.fileType?.startsWith('image/') ? (
                        <div className="rounded-xl overflow-hidden border border-slate-200">
                            <img
                                src={timetable.fileUrl}
                                alt="Timetable"
                                className="w-full h-auto"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                            <FileImage className="w-8 h-8 text-slate-400" />
                            <div>
                                <p className="font-medium text-slate-700">{timetable.fileName}</p>
                                <p className="text-sm text-slate-500">
                                    Uploaded on {new Date(timetable.uploadedAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Courses Grid */}
            {semesters.map(semester => (
                <div key={semester}>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                            S{semester}
                        </span>
                        Semester {semester}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {coursesBySemester[semester].map(course => (
                            <Card key={course.id} className="hover:shadow-lg transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                                        <BookOpen className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-slate-800 truncate">
                                                {course.code}
                                            </h3>
                                            <Badge variant="outline" className="flex-shrink-0">
                                                {course.credits} Cr
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                            {course.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                                            <User className="w-4 h-4" />
                                            <span className="truncate">{course.teacher}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}

            {courses.length === 0 && (
                <Card className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-700">No Courses Found</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        You are not enrolled in any courses yet.
                    </p>
                </Card>
            )}
        </div>
    );
}
