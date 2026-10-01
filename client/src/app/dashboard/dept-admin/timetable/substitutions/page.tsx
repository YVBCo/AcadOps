'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { substitutionApi } from '@/lib/api';
import { Calendar, Plus, Trash2, Clock, User, BookOpen, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';

function formatDate(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (fmt === 'yyyy-MM-dd') return d.toISOString().split('T')[0];
  if (fmt === 'EEEE, MMMM d, yyyy') return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  if (fmt === 'MMM d') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (fmt === 'h:mm a') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString();
}

export default function SubstitutionsPage() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: substitutions, isLoading } = useQuery({
    queryKey: ['substitutions', selectedDate],
    queryFn: () => substitutionApi.getForDate(selectedDate),
  });

  const [assignForm, setAssignForm] = useState({
    semesterId: '',
    sectionId: '',
    periodNumber: 1,
    substituteId: '',
    reason: '',
  });

  const dayOfWeek = new Date(selectedDate).getDay();

  const { data: availableTeachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['availableTeachers', assignForm.semesterId, dayOfWeek, assignForm.periodNumber, selectedDate],
    queryFn: () => substitutionApi.getAvailableTeachers({
      semesterId: Number(assignForm.semesterId),
      dayOfWeek,
      periodNumber: assignForm.periodNumber,
      date: selectedDate
    }),
    enabled: !!assignForm.semesterId && isModalOpen,
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => substitutionApi.assign({ 
      ...data, 
      semesterId: Number(data.semesterId),
      sectionId: Number(data.sectionId),
      substituteId: Number(data.substituteId),
      date: selectedDate 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions', selectedDate] });
      setIsModalOpen(false);
      setAssignForm({ semesterId: '', sectionId: '', periodNumber: 1, substituteId: '', reason: '' });
    },
  });

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to cancel this substitution?')) {
      // Assuming delete endpoint exists on substitutionApi
      try {
        await substitutionApi.remove(id);
        queryClient.invalidateQueries({ queryKey: ['substitutions', selectedDate] });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Substitution Management</h1>
          <p className="text-blue-100 max-w-xl">Manage class substitutions, view available teachers, and ensure smooth academic operations.</p>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm cursor-pointer transition-all"
            />
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-indigo-700 hover:bg-blue-50 shadow-lg px-6 py-2.5 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <Plus className="mr-2 h-5 w-5" /> Assign Substitute
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-indigo-500" />
          Substitutions for {formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse shadow-sm border-gray-100">
                <div className="h-32 bg-gray-100 rounded-xl m-4"></div>
              </Card>
            ))}
          </div>
        ) : substitutions?.length === 0 ? (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="h-16 w-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">No substitutions assigned</h3>
            <p className="text-gray-500 max-w-sm mb-6">There are no substitutions assigned for this date yet. Everything is running on schedule.</p>
            <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" /> Assign First Substitute
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {substitutions?.map((sub: any) => (
              <Card key={sub.id} className="overflow-hidden hover:shadow-md transition-shadow border-gray-200">
                <div className="p-0">
                  <div className="bg-slate-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                        <Clock className="w-4 h-4 mr-1.5" />
                        Period {sub.periodNumber}
                      </div>
                      <span className="font-semibold text-gray-700">{sub.section || 'Section'}</span>
                    </div>
                    <button 
                      onClick={() => handleDelete(sub.id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Cancel Substitution"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Original Teacher</p>
                        <div className="flex items-center text-gray-800">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          {sub.originalTeacher?.name || sub.originalTeacherName || 'Unknown'}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-500 uppercase tracking-wider mb-1">Substitute Teacher</p>
                        <div className="flex items-center font-medium text-indigo-700">
                          <User className="w-4 h-4 mr-2 text-indigo-400" />
                          {sub.substituteTeacher?.name || sub.substituteTeacherName || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Course</p>
                        <div className="flex items-center text-gray-800 text-sm">
                          <BookOpen className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="truncate">{sub.substituteCourse?.name || sub.substituteCourseName || 'N/A'}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reason</p>
                        <div className="flex items-center text-gray-600 text-sm italic">
                          <AlertCircle className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="truncate">{sub.reason || 'No reason provided'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
              <h2 className="text-xl font-bold text-gray-800">Assign Substitute</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl flex items-start text-sm">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 text-blue-500 flex-shrink-0" />
                <p>Assigning a substitute for <strong>{formatDate(selectedDate, 'EEEE, MMMM d, yyyy')}</strong>. Select the class details below to find available teachers.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Semester ID / Section</label>
                  <input 
                    type="text" 
                    placeholder="e.g. sem-123"
                    value={assignForm.semesterId}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, semesterId: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Period Number</label>
                  <select 
                    value={assignForm.periodNumber}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, periodNumber: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  >
                    {[1,2,3,4,5,6,7,8].map(p => (
                      <option key={p} value={p}>Period {p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingTeachers ? (
                <div className="h-24 bg-gray-50 rounded-xl flex items-center justify-center animate-pulse border border-gray-100">
                  <div className="text-gray-400 font-medium">Finding available teachers...</div>
                </div>
              ) : assignForm.semesterId ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex justify-between">
                    <span>Available Substitute Teachers</span>
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{availableTeachers?.length || 0} found</span>
                  </label>
                  
                  {availableTeachers?.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-sm">
                      No available teachers found for this period. Try adjusting the period or manually override.
                    </div>
                  ) : (
                    <div className="grid gap-3 max-h-48 overflow-y-auto p-1">
                      {availableTeachers?.map((teacher: any) => (
                        <label 
                          key={teacher.id} 
                          className={clsx(
                            "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                            assignForm.substituteId === teacher.id 
                              ? "border-indigo-500 bg-indigo-50 shadow-sm" 
                              : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <input 
                              type="radio" 
                              name="substituteTeacher"
                              checked={assignForm.substituteId === teacher.id}
                              onChange={() => setAssignForm(prev => ({ ...prev, substituteId: teacher.id }))}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <div>
                              <div className="font-medium text-gray-900">{teacher.name}</div>
                              <div className="text-xs text-gray-500">Suggested Course: {teacher.suggestedCourse?.code || 'N/A'}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-6 text-center text-gray-500 text-sm">
                  Enter Semester/Section to view available teachers
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-gray-700">Reason</label>
                <textarea 
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Leave, Meeting, Sick"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 sticky bottom-0 rounded-b-2xl">
              <Button 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                disabled={!assignForm.substituteId || assignMutation.isPending}
                onClick={() => assignMutation.mutate(assignForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md min-w-[120px]"
              >
                {assignMutation.isPending ? 'Assigning...' : 'Assign Substitute'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
