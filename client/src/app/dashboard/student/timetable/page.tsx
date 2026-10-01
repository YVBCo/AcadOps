'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { studentTimetableApi } from '@/lib/api';
import { Clock, MapPin, User, BookOpen, Calendar, Beaker, Coffee } from 'lucide-react';
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

export default function StudentTimetablePage() {
  const { data: gridData, isLoading } = useQuery({
    queryKey: ['student-timetable'],
    queryFn: () => studentTimetableApi.getGrid(),
  });

  const todayIndex = new Date().getDay(); // 1 = Monday, ..., 5 = Friday

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 left-10 w-72 h-72 bg-violet-900 opacity-30 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-medium text-purple-50 border border-white/20 shadow-sm mb-2">
              <Calendar className="w-4 h-4 mr-2" />
              {formatDate(new Date(), 'EEEE, MMMM d, yyyy')}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Class Timetable</h1>
            <p className="text-purple-100 max-w-xl text-lg">Your academic schedule for the week. Stay on top of classes and labs.</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex flex-col gap-3 min-w-[200px] shadow-lg">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-100 mb-1">Legend</h3>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-white border border-gray-200 shadow-sm block"></span>
              <span className="text-sm">Regular Class</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-amber-50 border border-amber-200 shadow-sm block"></span>
              <span className="text-sm">Lab Session</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-md bg-slate-100 border border-slate-200 block"></span>
              <span className="text-sm">Break / Lunch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable Grid */}
      <Card className="overflow-hidden border-0 shadow-xl shadow-purple-500/5 rounded-3xl bg-white">
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
                    "col-span-1 pb-4 text-center border-b-2 transition-all",
                    isToday ? "border-purple-500" : "border-gray-100"
                  )}>
                    <div className={clsx(
                      "inline-flex flex-col items-center justify-center px-6 py-2 rounded-2xl",
                      isToday ? "bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-100" : ""
                    )}>
                      <span className={clsx(
                        "text-lg font-bold",
                        isToday ? "text-purple-700" : "text-gray-700"
                      )}>{day}</span>
                      {isToday && <span className="text-xs font-bold uppercase tracking-widest text-purple-500 mt-1">Today</span>}
                    </div>
                  </div>
                );
              })}

              {/* Grid Body */}
              {isLoading ? (
                Array.from({ length: MAX_PERIODS }).map((_, pIdx) => (
                  <React.Fragment key={`skel-${pIdx}`}>
                    <div className="col-span-1 py-4 pr-4 border-r-2 border-gray-100 flex flex-col items-end justify-center">
                      <div className="w-16 h-6 bg-gray-100 rounded-md animate-pulse"></div>
                    </div>
                    {DAYS.map((_, dIdx) => (
                      <div key={`skel-cell-${pIdx}-${dIdx}`} className="col-span-1 p-2">
                        <div className="w-full h-32 bg-gray-50 rounded-2xl animate-pulse"></div>
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
                        <div className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm border border-slate-200 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          Period {periodNum}
                        </div>
                      </div>

                      {/* Day Columns for this Period */}
                      {DAYS.map((_, dIdx) => {
                        const dayNum = dIdx + 1; // 1 = Monday
                        const dayData = gridData?.[dayNum] || [];
                        const cellData = dayData.find((d: any) => d.periodNumber === periodNum);
                        const isToday = dayNum === todayIndex;

                        if (!cellData) {
                          // No Data (Free Period conceptually, though students usually don't have many)
                          return (
                            <div key={`empty-${periodNum}-${dayNum}`} className="col-span-1 p-2">
                              <div className={clsx(
                                "w-full h-full min-h-[128px] rounded-2xl border-2 border-dashed flex items-center justify-center transition-all",
                                isToday ? "bg-purple-50/30 border-purple-100" : "bg-gray-50/50 border-gray-100"
                              )}>
                                <span className="text-gray-300 text-sm font-medium">Free</span>
                              </div>
                            </div>
                          );
                        }

                        // Break / Lunch
                        if (cellData.isBreak) {
                          return (
                            <div key={`break-${cellData.id || periodNum}-${dayNum}`} className="col-span-1 p-2">
                              <div className="w-full h-full min-h-[128px] p-4 rounded-2xl bg-slate-100/80 border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                                <Coffee className="w-6 h-6 mb-2 opacity-50" />
                                <span className="font-semibold uppercase tracking-wider text-sm">{cellData.breakLabel || 'Break'}</span>
                              </div>
                            </div>
                          );
                        }

                        // Scheduled Class/Lab
                        const { isLab, course, teacher, classroom } = cellData;

                        return (
                          <div key={`cell-${cellData.id}`} className="col-span-1 p-2">
                            <div className={clsx(
                              "w-full h-full min-h-[128px] p-4 rounded-2xl shadow-sm border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between group",
                              isLab 
                                ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200" 
                                : "bg-white border-gray-200",
                              isToday && !isLab && "border-purple-200 ring-1 ring-purple-100"
                            )}>
                              <div>
                                <div className="flex justify-between items-start mb-2">
                                  <span className={clsx(
                                    "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md",
                                    isLab ? "bg-amber-200/50 text-amber-800" : "bg-indigo-50 text-indigo-700"
                                  )}>
                                    {isLab ? 'Lab' : 'Class'}
                                  </span>
                                  {isLab && <Beaker className="w-4 h-4 text-amber-500 opacity-60" />}
                                </div>
                                <h4 className="font-bold text-gray-900 leading-tight mb-1 group-hover:text-purple-700 transition-colors line-clamp-2">
                                  {course?.name || 'Unknown Course'}
                                </h4>
                                <p className="text-xs font-semibold text-gray-500 mb-3">{course?.code}</p>
                              </div>

                              <div className="space-y-2 pt-3 border-t border-gray-100/60">
                                <div className="flex items-center text-xs text-gray-700">
                                  <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center mr-2 flex-shrink-0">
                                    <User className="w-3 h-3 text-purple-700" />
                                  </div>
                                  <span className="font-medium truncate">{teacher?.name || 'TBA'}</span>
                                </div>
                                <div className="flex items-center text-xs text-gray-600">
                                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center mr-2 flex-shrink-0">
                                    <MapPin className="w-3 h-3 text-slate-500" />
                                  </div>
                                  <span className="truncate font-medium">{classroom?.name || classroom || 'TBA'}</span>
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
