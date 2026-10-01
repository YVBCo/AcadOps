'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { calendarApi } from '@/lib/api';
import { toast } from 'sonner';
import clsx from 'clsx';

// Date helpers (replacing date-fns)
function formatDate(date: Date, fmt: string): string {
  if (fmt === 'MMMM yyyy') return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (fmt === 'yyyy-MM-dd') return date.toISOString().split('T')[0];
  if (fmt === 'd') return date.getDate().toString();
  if (fmt === 'EEE') return date.toLocaleDateString('en-US', { weekday: 'short' });
  if (fmt === 'MMM d') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (fmt === 'MMMM d, yyyy') return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return date.toLocaleDateString();
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function subMonths(date: Date, n: number): Date {
  return addMonths(date, -n);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date, _opts?: any): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeek(date: Date, _opts?: any): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function eachDayOfInterval({ start, end }: { start: Date; end: Date }): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'view'>('create');
  const [formData, setFormData] = useState({
    type: 'HOLIDAY', reason: '', followTimetableDay: '1'
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed

  const { data: monthData, isLoading } = useQuery({
    queryKey: ['calendar-month', year, month],
    queryFn: () => calendarApi.getMonth(year, month).then((r: any) => r.data),
  });

  const declareMutation = useMutation({
    mutationFn: (data: any) => calendarApi.declareDay(data),
    onSuccess: () => {
      toast.success('Calendar updated');
      queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
      handleCloseModal();
    },
    onError: () => toast.error('Failed to update calendar')
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => calendarApi.remove(id),
    onSuccess: () => {
      toast.success('Event removed');
      queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
      handleCloseModal();
    },
    onError: () => toast.error('Failed to remove event')
  });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDayClick = (day: Date) => {
    const dateStr = formatDate(day, 'yyyy-MM-dd');
    const existingEvent = monthData?.find((e: any) => e.date === dateStr);
    
    setSelectedDate(day);
    if (existingEvent) {
      setModalMode('view');
      setFormData({
        type: existingEvent.type,
        reason: existingEvent.reason || '',
        followTimetableDay: existingEvent.followTimetableDay?.toString() || '1'
      });
    } else {
      setModalMode('create');
      setFormData({ type: 'HOLIDAY', reason: '', followTimetableDay: '1' });
    }
  };

  const handleCloseModal = () => {
    setSelectedDate(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    const dateStr = formatDate(selectedDate, 'yyyy-MM-dd');
    
    declareMutation.mutate({
      date: dateStr,
      type: formData.type,
      label: formData.reason,
      overrideDay: formData.type !== 'HOLIDAY' ? Number(formData.followTimetableDay) : undefined
    });
  };

  const getEventForDay = (day: Date) => {
    const dateStr = formatDate(day, 'yyyy-MM-dd');
    return monthData?.find((e: any) => e.date === dateStr);
  };

  const getTypeStyles = (type: string) => {
    switch(type) {
      case 'HOLIDAY': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'WORKING_SATURDAY': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CLASS_ON_HOLIDAY': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-emerald-400" />
            Academic Calendar
          </h1>
          <p className="text-emerald-100 mt-2 text-sm max-w-2xl">
            Manage holidays, working Saturdays, and schedule overrides for the department timetable.
          </p>
        </div>
        <div className="flex gap-4 items-center bg-slate-800/50 p-2 rounded-xl backdrop-blur-sm border border-slate-700/50">
          <Button variant="ghost" className="text-white hover:bg-slate-700/50 h-10 w-10 p-0 rounded-lg" onClick={prevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-bold text-lg min-w-[140px] text-center tracking-wide">{formatDate(currentDate, 'MMMM yyyy')}</span>
          <Button variant="ghost" className="text-white hover:bg-slate-700/50 h-10 w-10 p-0 rounded-lg" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4 justify-end">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-3 h-3 rounded-full bg-rose-400"></div> Holiday</div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-3 h-3 rounded-full bg-amber-400"></div> Working Saturday</div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><div className="w-3 h-3 rounded-full bg-blue-400"></div> Class on Holiday</div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white/50 backdrop-blur">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          </div>
        )}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-r last:border-0 border-slate-200">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const event = getEventForDay(day);

            return (
              <div 
                key={day.toString()} 
                onClick={() => handleDayClick(day)}
                className={clsx(
                  "min-h-[120px] p-2 border-r border-b border-slate-200 relative cursor-pointer transition-all hover:bg-slate-50",
                  !isCurrentMonth && "bg-slate-50/50 text-slate-400 opacity-60",
                  event ? (event.type === 'HOLIDAY' ? 'bg-rose-50/30' : event.type === 'WORKING_SATURDAY' ? 'bg-amber-50/30' : 'bg-blue-50/30') : "bg-white"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={clsx(
                    "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full",
                    isTodayDate ? "bg-emerald-500 text-white shadow-md" : "text-slate-700"
                  )}>
                    {formatDate(day, 'd')}
                  </span>
                </div>
                
                {event && (
                  <div className={clsx("p-2 rounded border text-xs font-medium truncate mt-1 transition-all shadow-sm", getTypeStyles(event.type))}>
                    {event.type.replace(/_/g, ' ')}
                    {event.reason && <div className="font-normal opacity-80 text-[10px] truncate mt-0.5">{event.reason}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Action Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-4 bg-slate-50 border-b flex flex-row items-center justify-between py-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {formatDate(selectedDate, 'MMMM d, yyyy')}
              </h3>
              <Button variant="ghost" size="sm" onClick={handleCloseModal} className="h-8 w-8 p-0 rounded-full"><X className="w-4 h-4" /></Button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Day Override Type</label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="HOLIDAY">Holiday</option>
                    <option value="WORKING_SATURDAY">Working Saturday</option>
                    <option value="CLASS_ON_HOLIDAY">Class on Holiday</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Label / Reason</label>
                  <Input 
                    placeholder="e.g. Diwali, Sports Day..." 
                    value={formData.reason} 
                    onChange={e => setFormData({...formData, reason: e.target.value})}
                  />
                </div>

                {formData.type !== 'HOLIDAY' && (
                  <div className="space-y-2 pt-2">
                    <label className="text-sm font-medium text-slate-700">Follow Timetable Of</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.followTimetableDay}
                      onChange={e => setFormData({...formData, followTimetableDay: e.target.value})}
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                    </select>
                    <p className="text-xs text-slate-500">Classes will run according to the schedule of this weekday.</p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-between gap-3">
                {modalMode === 'view' ? (
                  <Button 
                    type="button" 
                    variant="danger"
                    onClick={() => {
                      const evt = selectedDate ? getEventForDay(selectedDate) : null;
                      if (evt?.id) removeMutation.mutate(evt.id);
                    }}
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Remove Event
                  </Button>
                ) : (
                  <div></div> // Spacer
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={declareMutation.isPending}>
                    {declareMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Settings
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
