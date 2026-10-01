'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  CalendarDays, Settings, Play, Trash2, Save, Users, Building, AlertCircle, Loader2, CheckCircle2, LayoutGrid, CheckCircle, Clock, Plus, X
} from 'lucide-react';
import { timetableApi } from '@/lib/api';
import api from '@/lib/api';
import clsx from 'clsx';
import { toast } from 'sonner';

export default function TimetableGeneratorV2Page() {
  const queryClient = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  
  // UI State
  const [activeSectionTab, setActiveSectionTab] = useState<string>('');
  const [activeGridTab, setActiveGridTab] = useState<string>('');
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  
  // Config state
  const [maxPeriodsPerDay, setMaxPeriodsPerDay] = useState(8);
  const [teacherMaxPerDay, setTeacherMaxPerDay] = useState(4); // Global limit
  
  // Per-section configs map: sectionId -> courseId -> config
  const [sectionCourseConfigs, setSectionCourseConfigs] = useState<Record<string, Record<string, any>>>({});

  // Time slot config state
  const [slotDuration, setSlotDuration] = useState(60);
  const [dayStartTime, setDayStartTime] = useState('09:00');
  const [dayEndTime, setDayEndTime] = useState('17:00');
  const [breakSlots, setBreakSlots] = useState<Array<{ start: string; end: string; label: string }>>([]);

  // Fetch active semester
  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => api.get('/semesters').then(r => r.data),
  });
  const activeSemester = semesters?.find((s: any) => s.status === 'ACTIVE');

  // Fetch time slot config
  const { data: timeSlotConfig } = useQuery({
    queryKey: ['time-slot-config'],
    queryFn: () => api.get('/dept-admin/time-slots').then(r => r.data),
  });

  // Sync time slot config to state
  useEffect(() => {
    if (timeSlotConfig) {
      setSlotDuration(timeSlotConfig.slotDuration || 60);
      setDayStartTime(timeSlotConfig.dayStartTime || '09:00');
      setDayEndTime(timeSlotConfig.dayEndTime || '17:00');
      setBreakSlots(timeSlotConfig.breakSlots || []);
    }
  }, [timeSlotConfig]);

  // Fetch batches
  const { data: batches, isLoading: loadingBatches } = useQuery({
    queryKey: ['dept-batches'],
    queryFn: () => api.get('/batches').then(r => r.data),
  });

  // Fetch sections for selected batch
  const { data: sections, isLoading: loadingSections } = useQuery({
    queryKey: ['dept-sections', selectedBatchId],
    queryFn: () => api.get(`/dept-admin/sections`, { params: { batchId: selectedBatchId } }).then(r => r.data),
    enabled: !!selectedBatchId,
  });

  // Fetch teacher load for semester
  const { data: teacherLoad, isLoading: loadingTeacherLoad } = useQuery({
    queryKey: ['teacher-load', activeSemester?.id],
    queryFn: () => timetableApi.getTeacherLoad(activeSemester!.id),
    enabled: !!activeSemester?.id,
  });

  // Keep active section tab in sync
  useEffect(() => {
    if (sections && sections.length > 0 && !activeSectionTab) {
      setActiveSectionTab(sections[0].id.toString());
      setActiveGridTab(sections[0].id.toString());
    } else if (!sections || sections.length === 0) {
      setActiveSectionTab('');
      setActiveGridTab('');
    }
  }, [sections, activeSectionTab]);

  // Fetch allocations for active section tab
  const { data: activeAllocations, isLoading: loadingAllocations } = useQuery({
    queryKey: ['section-allocations', activeSectionTab],
    queryFn: () => api.get(`/dept-admin/sections/${activeSectionTab}/allocations`).then(r => r.data),
    enabled: !!activeSectionTab,
  });

  // Initialize configs when allocations load
  useEffect(() => {
    if (activeAllocations && activeSectionTab) {
      setSectionCourseConfigs(prev => {
        const existing = prev[activeSectionTab] || {};
        const newSectionConfig = { ...existing };
        let changed = false;
        
        activeAllocations.forEach((alloc: any) => {
          if (!newSectionConfig[alloc.course.id]) {
            newSectionConfig[alloc.course.id] = {
              classesPerWeek: alloc.course.credits || 3,
              isLab: false,
              labBlockSize: 2
            };
            changed = true;
          }
        });
        
        if (changed) {
          return { ...prev, [activeSectionTab]: newSectionConfig };
        }
        return prev;
      });
    }
  }, [activeAllocations, activeSectionTab]);

  // Handle config changes
  const handleConfigChange = (courseId: string, field: string, value: any) => {
    setSectionCourseConfigs(prev => ({
      ...prev,
      [activeSectionTab]: {
        ...(prev[activeSectionTab] || {}),
        [courseId]: {
          ...((prev[activeSectionTab] || {})[courseId] || {}),
          [field]: value
        }
      }
    }));
  };

  // Mutations
  const saveTimeSlotsMutation = useMutation({
    mutationFn: () => api.post('/dept-admin/time-slots', {
      slotDuration,
      dayStartTime,
      dayEndTime,
      breakSlots,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('Period timings saved');
      queryClient.invalidateQueries({ queryKey: ['time-slot-config'] });
    },
    onError: () => toast.error('Failed to save period timings'),
  });

  const addBreak = () => {
    setBreakSlots(prev => [...prev, { start: '12:00', end: '12:30', label: 'Break' }]);
  };

  const removeBreak = (index: number) => {
    setBreakSlots(prev => prev.filter((_, i) => i !== index));
  };

  const updateBreak = (index: number, field: string, value: string) => {
    setBreakSlots(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  const saveAllConfigsMutation = useMutation({
    mutationFn: async () => {
      if (!activeSemester) throw new Error("No active semester");
      const promises = (sections || []).map((sec: any) => {
        const secConfig = sectionCourseConfigs[sec.id.toString()] || {};
        const courseWeeklyClasses: Record<string, number> = {};
        const courseIsLab: Record<string, boolean> = {};
        let labBlockSize = 2;
        
        Object.entries(secConfig).forEach(([courseId, config]: [string, any]) => {
          courseWeeklyClasses[courseId] = config.classesPerWeek || 3;
          courseIsLab[courseId] = config.isLab || false;
          if (config.labBlockSize) labBlockSize = config.labBlockSize;
        });
        
        return timetableApi.saveConfig({
          sectionId: sec.id,
          semesterId: activeSemester.id,
          maxPeriodsPerDay,
          teacherMaxPerDay: { 1: teacherMaxPerDay, 2: teacherMaxPerDay, 3: teacherMaxPerDay, 4: teacherMaxPerDay, 5: teacherMaxPerDay },
          courseWeeklyClasses,
          courseIsLab,
          labBlockSize,
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => toast.success('All configurations saved successfully'),
    onError: () => toast.error('Failed to save configurations'),
  });

  const validateMutation = useMutation({
    mutationFn: () => {
      const sectionIds = (sections || []).map((s: any) => s.id);
      return timetableApi.validate(sectionIds, activeSemester!.id);
    },
    onSuccess: (data: any) => {
      if (data.warnings && data.warnings.length > 0) {
        setValidationWarnings(data.warnings);
        toast.warning('Validation completed with warnings');
      } else {
        setValidationWarnings([]);
        toast.success('Validation passed perfectly!');
      }
    },
    onError: () => toast.error('Validation failed'),
  });

  const generateMutation = useMutation({
    mutationFn: (allowExceedLimits: boolean = false) => {
      const sectionIds = (sections || []).map((s: any) => s.id);
      return timetableApi.generate(sectionIds, activeSemester!.id, allowExceedLimits);
    },
    onSuccess: () => {
      toast.success('Timetables generated successfully');
      setShowGenerateConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['timetable-grid'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-load'] });
    },
    onError: () => toast.error('Failed to generate timetables'),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const promises = (sections || []).map((s: any) => 
        timetableApi.clear(s.id, activeSemester!.id)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('All timetables cleared');
      queryClient.invalidateQueries({ queryKey: ['timetable-grid'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-load'] });
    },
    onError: () => toast.error('Failed to clear timetables'),
  });

  const handleGenerateClick = () => {
    if (validationWarnings.length > 0) {
      setShowGenerateConfirm(true);
    } else {
      generateMutation.mutate(false);
    }
  };

  const { data: gridData, isLoading: loadingGrid } = useQuery({
    queryKey: ['timetable-grid', activeGridTab, activeSemester?.id],
    queryFn: () => timetableApi.getGrid(Number(activeGridTab), activeSemester!.id),
    enabled: !!activeGridTab && !!activeSemester?.id,
  });

  const days = [1, 2, 3, 4, 5];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutGrid className="w-8 h-8 text-blue-400" />
            Timetable Generator (V2)
          </h1>
          <p className="text-slate-300 mt-2 text-sm max-w-2xl">
            Configure all sections at once and generate a conflict-free schedule for the entire batch.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl backdrop-blur-sm border border-slate-700/50">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Active Semester</label>
            <div className="font-medium flex items-center gap-2">
              {activeSemester ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-400"></span>{activeSemester.name}</>
              ) : (
                <span className="text-slate-500">None Active</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Flow & Configs */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Period Timings & Breaks */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" /> Period Timings
              </h3>
              <Button 
                size="sm" variant="outline"
                onClick={() => saveTimeSlotsMutation.mutate()}
                disabled={saveTimeSlotsMutation.isPending}
              >
                {saveTimeSlotsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                Save
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Start Time</label>
                  <Input type="time" value={dayStartTime} onChange={e => setDayStartTime(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">End Time</label>
                  <Input type="time" value={dayEndTime} onChange={e => setDayEndTime(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Slot (min)</label>
                  <Input type="number" value={slotDuration} onChange={e => setSlotDuration(Number(e.target.value))} className="h-8 text-sm" min={30} max={120} />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-700">Breaks</label>
                  <button onClick={addBreak} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Break
                  </button>
                </div>
                {breakSlots.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No breaks configured.</p>
                ) : (
                  <div className="space-y-2">
                    {breakSlots.map((brk, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                        <Input type="time" value={brk.start} onChange={e => updateBreak(i, 'start', e.target.value)} className="h-7 text-xs flex-1" />
                        <span className="text-slate-400 text-xs">to</span>
                        <Input type="time" value={brk.end} onChange={e => updateBreak(i, 'end', e.target.value)} className="h-7 text-xs flex-1" />
                        <Input 
                          type="text" placeholder="Label" 
                          value={brk.label} onChange={e => updateBreak(i, 'label', e.target.value)} 
                          className="h-7 text-xs flex-1" 
                        />
                        <button onClick={() => removeBreak(i)} className="text-red-400 hover:text-red-600 shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Batch Selection */}
          <Card className="border-slate-200 shadow-sm p-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
              Select Batch
            </h3>
            <select 
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              disabled={loadingBatches}
            >
              <option value="">Select Batch...</option>
              {batches?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            
            {sections && sections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2 block">
                  Sections in Batch (Auto-Selected)
                </label>
                <div className="flex flex-wrap gap-2">
                  {sections.map((s: any) => (
                    <span key={s.id} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Configuration */}
          {selectedBatchId && sections && sections.length > 0 && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                  <span className="bg-indigo-200 text-indigo-800 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                  Section Configurations
                </h3>
                <Button 
                  size="sm" 
                  onClick={() => saveAllConfigsMutation.mutate()}
                  disabled={saveAllConfigsMutation.isPending}
                >
                  {saveAllConfigsMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save All
                </Button>
              </div>
              
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Max Periods/Day</label>
                    <Input type="number" value={maxPeriodsPerDay} onChange={e => setMaxPeriodsPerDay(Number(e.target.value))} className="h-8 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium mb-1 block">Teacher Max Classes/Day</label>
                    <Input type="number" value={teacherMaxPerDay} onChange={e => setTeacherMaxPerDay(Number(e.target.value))} className="h-8 bg-white" />
                  </div>
                </div>
              </div>

              <div className="flex overflow-x-auto border-b border-slate-200 custom-scrollbar">
                {sections.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSectionTab(s.id.toString())}
                    className={clsx(
                      "px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                      activeSectionTab === s.id.toString() 
                        ? "border-indigo-500 text-indigo-600 bg-white" 
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-white min-h-[300px] max-h-[400px] overflow-y-auto">
                {loadingAllocations ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                ) : activeAllocations?.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" /> No courses allocated to this section.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeAllocations?.map((alloc: any) => {
                      const conf = (sectionCourseConfigs[activeSectionTab] || {})[alloc.course.id] || { classesPerWeek: alloc.course.credits || 3, isLab: false, labBlockSize: 2 };
                      return (
                        <div key={alloc.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-sm text-slate-800">{alloc.course.code}</div>
                            <div className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{alloc.teacher?.user?.name || 'No Teacher'}</div>
                          </div>
                          <div className="text-xs text-slate-600 truncate">{alloc.course.name}</div>
                          
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50">
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Classes/Week</label>
                              <Input 
                                type="number" className="h-7 text-xs"
                                value={conf.classesPerWeek}
                                onChange={(e) => handleConfigChange(alloc.course.id, 'classesPerWeek', Number(e.target.value))}
                              />
                            </div>
                            <div className="flex flex-col justify-end pb-0.5">
                              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                  checked={conf.isLab}
                                  onChange={(e) => handleConfigChange(alloc.course.id, 'isLab', e.target.checked)}
                                />
                                Is Lab Session?
                              </label>
                            </div>
                          </div>
                          {conf.isLab && (
                            <div className="space-y-1">
                              <label className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Lab Block Size</label>
                              <select 
                                className="flex h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={conf.labBlockSize}
                                onChange={(e) => handleConfigChange(alloc.course.id, 'labBlockSize', Number(e.target.value))}
                              >
                                <option value={2}>2 Periods</option>
                                <option value={3}>3 Periods</option>
                                <option value={4}>4 Periods</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Action Center */}
          {selectedBatchId && sections && sections.length > 0 && (
            <Card className="border-slate-200 shadow-sm p-4 bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                Generate Action
              </h3>
              
              <div className="space-y-3">
                <Button 
                  variant="outline" className="w-full bg-white" 
                  onClick={() => validateMutation.mutate()}
                  disabled={validateMutation.isPending}
                >
                  {validateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2 text-indigo-500" />}
                  Validate Constraints First
                </Button>
                
                {validationWarnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 max-h-32 overflow-y-auto text-xs text-amber-800 space-y-1 custom-scrollbar">
                    <p className="font-semibold mb-1">Warnings:</p>
                    {validationWarnings.map((w, i) => (
                      <div key={i} className="flex gap-1.5 items-start">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{w.message || JSON.stringify(w)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" 
                  onClick={handleGenerateClick}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Generate All Timetables
                </Button>

                <Button 
                  variant="danger" className="w-full" 
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Clear All Grids
                </Button>
              </div>
            </Card>
          )}

        </div>

        {/* Right Column: Dashboard & Grid */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Teacher Load Dashboard */}
          {selectedBatchId && (
            <Card className="border-slate-200 shadow-sm overflow-hidden shrink-0">
              <div className="bg-white p-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" /> Teacher Load Dashboard
                </h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                    <tr>
                      <th className="px-4 py-3">Teacher</th>
                      <th className="px-4 py-3 text-center">Mon</th>
                      <th className="px-4 py-3 text-center">Tue</th>
                      <th className="px-4 py-3 text-center">Wed</th>
                      <th className="px-4 py-3 text-center">Thu</th>
                      <th className="px-4 py-3 text-center">Fri</th>
                      <th className="px-4 py-3 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loadingTeacherLoad ? (
                      <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
                    ) : !teacherLoad || teacherLoad.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-500">No load data available. Generate timetable first.</td></tr>
                    ) : (
                      teacherLoad.map((t: any) => (
                        <tr key={t.teacherId} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">{t.teacherName}</td>
                          {days.map(d => {
                            const count = t.dayCounts?.[d] || 0;
                            return (
                              <td key={d} className="px-4 py-2 text-center">
                                <span className={clsx(
                                  "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                                  count > teacherMaxPerDay ? "bg-red-100 text-red-700" :
                                  count === teacherMaxPerDay ? "bg-amber-100 text-amber-700" :
                                  count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                )}>
                                  {count}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center font-bold text-slate-700">{t.totalClasses || 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Generated Grid */}
          <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-[500px]">
             <div className="bg-white border-b border-slate-100">
               <div className="p-4 pb-0 flex flex-col gap-4">
                 <h3 className="text-lg font-semibold text-slate-800">Generated Timetables</h3>
                 <div className="flex overflow-x-auto border-b border-slate-200 custom-scrollbar">
                    {sections?.map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveGridTab(s.id.toString())}
                        className={clsx(
                          "px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                          activeGridTab === s.id.toString() 
                            ? "border-indigo-500 text-indigo-600 bg-slate-50" 
                            : "border-transparent text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
               </div>
             </div>
             
             <div className="p-4 flex-1 bg-slate-50/50 relative overflow-hidden">
                {!activeGridTab ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <CalendarDays className="w-12 h-12 mb-4 opacity-20" />
                    <p>Select a batch and section to view grid.</p>
                  </div>
                ) : loadingGrid ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : !gridData || Object.keys(gridData).length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
                      <LayoutGrid className="w-8 h-8 text-indigo-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-600">Grid is Empty</p>
                    <p className="text-sm">Click Generate All Timetables.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto h-full rounded-xl border border-slate-200 bg-white">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-20 border-r border-slate-200">Per</th>
                          {dayNames.map(day => (
                            <th key={day} className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase border-r border-slate-200 last:border-0 min-w-[150px]">{day}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Array.from({length: maxPeriodsPerDay}).map((_, i) => {
                          const periodNumber = i + 1;
                          return (
                            <tr key={periodNumber} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2 border-r border-slate-200 bg-slate-50 text-center font-medium text-slate-500 text-sm">
                                {periodNumber}
                              </td>
                              {days.map(day => {
                                const dayData = gridData[day] || [];
                                const cell = dayData.find((c: any) => c.periodNumber === periodNumber);
                                
                                if (!cell) return (
                                  <td key={day} className="border-r border-slate-200 p-1.5 last:border-0">
                                    <div className="h-full flex items-center justify-center p-2 rounded border border-dashed border-slate-200 bg-slate-50/50">
                                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Free Period</span>
                                    </div>
                                  </td>
                                );
                                
                                if (cell.isBreak) {
                                  return (
                                    <td key={day} className="border-r border-slate-200 p-1 last:border-0 bg-slate-100">
                                      <div className="h-full flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cell.breakLabel || 'BREAK'}</span>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={day} className={clsx(
                                    "border-r border-slate-200 p-1.5 last:border-0",
                                    cell.isLab ? "bg-amber-50" : "bg-white"
                                  )}>
                                    <div className={clsx(
                                      "h-full p-2 rounded border flex flex-col gap-1",
                                      cell.isLab ? "border-amber-200 bg-amber-100/30" : "border-indigo-100 bg-indigo-50/30"
                                    )}>
                                      <div className="flex justify-between items-start">
                                        <span className={clsx("font-bold text-xs", cell.isLab ? "text-amber-900" : "text-indigo-900")}>
                                          {cell.course?.code}
                                        </span>
                                        {cell.isLab && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-200 text-amber-800">LAB</span>}
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-auto pt-1 border-t border-slate-200/50">
                                        <span className="truncate flex-1">{cell.teacher?.name?.split(' ')[0]}</span>
                                        <span className="shrink-0">{cell.classroom?.name}</span>
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
             </div>
          </Card>

        </div>
      </div>

      {/* Confirmation Modal */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 p-3 rounded-full text-amber-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Validation Warnings</h3>
                <p className="text-sm text-slate-600 mt-1">
                  There are warnings in your configuration (e.g., teacher limits exceeded). Do you want to generate anyway?
                </p>
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 max-h-32 overflow-y-auto text-xs text-slate-700 space-y-1">
                  {validationWarnings.map((w, i) => (
                    <div key={i}>• {w.message || JSON.stringify(w)}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowGenerateConfirm(false)}>Cancel</Button>
              <Button onClick={() => generateMutation.mutate(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                Allow & Generate
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
