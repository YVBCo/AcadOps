'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { teacherTimetableApi } from '@/lib/api';
import { Clock, MapPin, BookOpen, Calendar, Beaker, Users } from 'lucide-react';
import { clsx } from 'clsx';

function formatDate(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (fmt === 'yyyy-MM-dd') return d.toISOString().split('T')[0];
  if (fmt === 'EEEE, MMMM d, yyyy') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (fmt === 'MMM d') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (fmt === 'h:mm a') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString();
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MAX_PERIODS = 8;

export default function TeacherTimetablePage() {
  const { data: gridData, isLoading } = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: () => teacherTimetableApi.getGrid(),
  });

  const todayIndex = new Date().getDay(); // 1 = Monday, ..., 5 = Friday

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-900 opacity-20 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium text-emerald-50 border border-white/20 shadow-sm mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              {formatDate(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">My Weekly Schedule</h1>
            <p className="text-emerald-50 max-w-xl text-lg opacity-90">View your classes, labs, and free periods for the week.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex flex-col gap-3 min-w-[200px] shadow-lg">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-100 mb-1">Quick Legend</h3>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-white border border-gray-200 shadow-sm block"></span>
              <span className="text-sm">Theory Class</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-indigo-50 border border-indigo-200 shadow-sm block"></span>
              <span className="text-sm">Lab Session</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-gray-50 border border-gray-200 border-dashed block"></span>
              <span className="text-sm text-emerald-100">Free Period</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <Card className="overflow-hidden border-0 shadow-lg rounded-3xl bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px] p-6">
            <div className="grid grid-cols-6 gap-4">
              
              {/* Corner Empty Cell */}
              <div className="col-span-1 border-b-2 border-r-2 border-gray-100 pb-4 pr-4 flex items-end justify-end">
                <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Periods</span>
              </div>

              {/* Days Header */}
              {DAYS.map((day, idx) => {
                const dayNum = idx + 1; // 1 = Monday
                const isToday = dayNum === todayIndex;
                
                return (
                  <div key={day} className={clsx(
                    "col-span-1 pb-4 text-center border-b-2 transition-colors",
                    isToday ? "border-teal-500" : "border-gray-100"
                  )}>
                    <div className={clsx(
                      "inline-flex flex-col items-center justify-center px-6 py-2 rounded-2xl",
                      isToday ? "bg-teal-50 text-teal-700 shadow-sm" : ""
                    )}>
                      <span className={clsx(
                        "text-lg font-bold",
                        isToday ? "text-teal-700" : "text-gray-700"
                      )}>{day}</span>
                      {isToday && <span className="text-xs font-bold uppercase tracking-widest text-teal-500 mt-1">Today</span>}
                    </div>
                  </div>
                );
              })}

              {/* Grid Body */}
              {isLoading ? (
                // Skeleton loading state
                Array.from({ length: MAX_PERIODS }).map((_, pIdx) => (
                  <React.Fragment key={`skel-${pIdx}`}>
                    <div className="col-span-1 py-4 pr-4 border-r-2 border-gray-100 flex flex-col items-end justify-center">
                      <div className="w-16 h-6 bg-gray-100 rounded-md animate-pulse"></div>
                    </div>
                    {DAYS.map((_, dIdx) => (
                      <div key={`skel-cell-${pIdx}-${dIdx}`} className="col-span-1 p-2">
                        <div className="w-full h-28 bg-gray-50 rounded-2xl animate-pulse"></div>
                      </div>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                Array.from({ length: MAX_PERIODS }).map((_, pIdx) => {
                  const periodNum = pIdx + 1;
                  return (
                    <React.Fragment key={`period-${periodNum}`}>
                      {/* Period Time Column */}
                      <div className="col-span-1 py-6 pr-4 border-r-2 border-gray-100 flex flex-col items-end justify-center">
                        <div className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm border border-slate-200">
                          Period {periodNum}
                        </div>
                        {/* Assuming times would be displayed here if available */}
                      </div>

                      {/* Day Columns for this Period */}
                      {DAYS.map((_, dIdx) => {
                        const dayNum = dIdx + 1; // 1 = Monday
                        const dayData = gridData?.[dayNum] || [];
                        const cellData = dayData.find((d: any) => d.periodNumber === periodNum);
                        const isToday = dayNum === todayIndex;

                        if (!cellData) {
                          // Free Period
                          return (
                            <div key={`empty-${periodNum}-${dayNum}`} className="col-span-1 p-2">
                              <div className={clsx(
                                "w-full h-full min-h-[120px] rounded-2xl border-2 border-dashed flex items-center justify-center transition-all",
                                isToday ? "bg-teal-50/30 border-teal-100" : "bg-gray-50/50 border-gray-100",
                                "hover:bg-gray-50 hover:border-gray-200"
                              )}>
                                <span className="text-gray-300 text-sm font-medium">Free</span>
                              </div>
                            </div>
                          );
                        }

                        // Scheduled Class/Lab
                        const { isLab, course, section, classroom } = cellData;

                        return (
                          <div key={`cell-${cellData.id}`} className="col-span-1 p-2">
                            <div className={clsx(
                              "w-full h-full min-h-[120px] p-4 rounded-2xl shadow-sm border transition-all duration-200 hover:-translate-y-1 hover:shadow-md flex flex-col justify-between group",
                              isLab 
                                ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100" 
                                : "bg-white border-gray-200",
                              isToday && !isLab && "border-teal-200 ring-1 ring-teal-100"
                            )}>
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className={clsx(
                                    "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                                    isLab ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                                  )}>
                                    {isLab ? 'Lab' : 'Theory'}
                                  </span>
                                  {isLab && <Beaker className="w-4 h-4 text-indigo-400 opacity-50" />}
                                </div>
                                <h4 className="font-bold text-gray-900 leading-tight mb-1 group-hover:text-teal-700 transition-colors line-clamp-2">
                                  {course?.name || 'Unknown Course'}
                                </h4>
                                <p className="text-xs font-medium text-gray-500 mb-3">{course?.code}</p>
                              </div>

                              <div className="space-y-1.5 pt-3 border-t border-gray-100/50">
                                <div className="flex items-center text-xs text-gray-700 font-medium">
                                  <Users className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                                  <span className="truncate">{section || 'N/A'}</span>
                                </div>
                                <div className="flex items-center text-xs text-gray-600">
                                  <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                                  <span className="truncate">{classroom || 'TBA'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
