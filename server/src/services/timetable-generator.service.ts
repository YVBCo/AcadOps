import { prisma } from '../data-access/prisma.js';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'timetable-generator-service' });

interface SlotPlacement {
    dayOfWeek: number;
    periodNumber: number;
    startTime: string;
    endTime: string;
    courseAllocationId: number;
    classroomId: number | null;
    isLab: boolean;
    labBlockSize: number;
}

export const timetableGeneratorService = {
    async saveConfig(sectionId: number, semesterId: number, config: {
        maxPeriodsPerDay: number;
        teacherMaxPerDay?: Record<string, number>;
        courseWeeklyClasses: Record<string, number>;
        courseIsLab?: Record<string, boolean>;
        labBlockSize?: number;
    }) {
        return prisma.timetableConfig.upsert({
            where: { sectionId_semesterId: { sectionId, semesterId } },
            create: {
                sectionId,
                semesterId,
                maxPeriodsPerDay: config.maxPeriodsPerDay,
                teacherMaxPerDay: config.teacherMaxPerDay ?? Prisma.DbNull,
                courseWeeklyClasses: config.courseWeeklyClasses,
                courseIsLab: config.courseIsLab ?? Prisma.DbNull,
                labBlockSize: config.labBlockSize || 2,
            },
            update: {
                maxPeriodsPerDay: config.maxPeriodsPerDay,
                teacherMaxPerDay: config.teacherMaxPerDay ?? Prisma.DbNull,
                courseWeeklyClasses: config.courseWeeklyClasses,
                courseIsLab: config.courseIsLab ?? Prisma.DbNull,
                labBlockSize: config.labBlockSize || 2,
            },
        });
    },
    
    async getConfig(sectionId: number, semesterId: number) {
        return prisma.timetableConfig.findUnique({
            where: { sectionId_semesterId: { sectionId, semesterId } },
        });
    },

    async getTeacherLoadSummary(semesterId: number, departmentId: number) {
        const slots = await prisma.timetableSlot.findMany({
            where: {
                semesterId,
                isBreak: false,
                courseAllocation: {
                    teacher: { user: { departmentId } },
                },
            },
            include: {
                courseAllocation: {
                    include: {
                        course: true,
                        teacher: { include: { user: true } },
                    },
                },
            },
        });

        const teacherMap = new Map<number, {
            teacherId: number;
            teacherName: string;
            employeeId: string | null;
            subjects: Set<string>;
            dailyLoad: Record<number, number>;
            totalWeekly: number;
        }>();

        for (const slot of slots) {
            const alloc = slot.courseAllocation;
            if (!alloc || !alloc.teacherId || !alloc.teacher) continue;
            const tId = alloc.teacherId;

            if (!teacherMap.has(tId)) {
                teacherMap.set(tId, {
                    teacherId: tId,
                    teacherName: alloc.teacher.user.name,
                    employeeId: alloc.teacher.employeeId,
                    subjects: new Set<string>(),
                    dailyLoad: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                    totalWeekly: 0,
                });
            }

            const stats = teacherMap.get(tId)!;
            stats.subjects.add(alloc.course.name);
            if (stats.dailyLoad[slot.dayOfWeek] !== undefined) {
                stats.dailyLoad[slot.dayOfWeek]++;
            }
            stats.totalWeekly++;
        }

        return Array.from(teacherMap.values()).map(s => ({
            ...s,
            subjects: Array.from(s.subjects),
        }));
    },

    async validateBeforeGenerate(sectionIds: number[], semesterId: number, teacherMaxPerDay: Record<string, number>) {
        const warnings: Array<{ teacherName: string; day: number; currentLoad: number; wouldBe: number; limit: number }> = [];

        const configs = await prisma.timetableConfig.findMany({
            where: { sectionId: { in: sectionIds }, semesterId }
        });
        const configMap = new Map(configs.map(c => [c.sectionId, c]));

        const allocations = await prisma.courseAllocation.findMany({
            where: { sectionId: { in: sectionIds } },
            include: { course: true, teacher: { include: { user: true } } },
        });

        const teacherWeeklyNeed = new Map<number, { name: string; need: number }>();
        for (const alloc of allocations) {
            if (!alloc.teacherId || !alloc.teacher) continue;
            const config = configMap.get(alloc.sectionId);
            if (!config) continue;
            const weekly = (config.courseWeeklyClasses as Record<string, number>)[String(alloc.courseId)] ?? alloc.course.credits;
            
            const cur = teacherWeeklyNeed.get(alloc.teacherId) || { name: alloc.teacher.user.name, need: 0 };
            cur.need += weekly;
            teacherWeeklyNeed.set(alloc.teacherId, cur);
        }

        const existingSlots = await prisma.timetableSlot.findMany({
            where: {
                semesterId,
                sectionId: { notIn: sectionIds },
                isBreak: false,
                courseAllocation: { teacherId: { in: Array.from(teacherWeeklyNeed.keys()) } }
            },
            include: { courseAllocation: true }
        });

        const teacherDailyLoad = new Map<number, Record<number, number>>();
        for (const slot of existingSlots) {
            const tid = slot.courseAllocation?.teacherId;
            if (!tid) continue;
            if (!teacherDailyLoad.has(tid)) teacherDailyLoad.set(tid, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
            teacherDailyLoad.get(tid)![slot.dayOfWeek]++;
        }

        for (const [tid, info] of teacherWeeklyNeed.entries()) {
            const currentLoad = teacherDailyLoad.get(tid) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            const simLoad = { ...currentLoad };
            let remaining = info.need;
            
            while (remaining > 0) {
                let minDay = 1;
                let minVal = simLoad[1];
                for (let d = 2; d <= 5; d++) {
                    if (simLoad[d] < minVal) {
                        minVal = simLoad[d];
                        minDay = d;
                    }
                }
                simLoad[minDay]++;
                remaining--;
            }
            
            for (let d = 1; d <= 5; d++) {
                const limit = teacherMaxPerDay[String(d)] ?? 6;
                if (simLoad[d] > limit) {
                    warnings.push({
                        teacherName: info.name,
                        day: d,
                        currentLoad: currentLoad[d],
                        wouldBe: simLoad[d],
                        limit
                    });
                }
            }
        }

        return { canGenerate: warnings.length === 0, warnings };
    },
    
    async generate(sectionIds: number[], semesterId: number, tenantId: number, allowExceedLimits = false) {
        if (!sectionIds || sectionIds.length === 0) throw new Error('No section IDs provided');

        // 1. Fetch config
        const configs = await prisma.timetableConfig.findMany({
            where: { sectionId: { in: sectionIds }, semesterId },
        });
        if (configs.length === 0) throw new Error('Timetable configurations not found. Please configure first.');
        const mergedTeacherMaxPerDay = (configs[0].teacherMaxPerDay as Record<string, number>) || {};
        
        // 2. Fetch section for department
        const sections = await prisma.section.findMany({
            where: { id: { in: sectionIds } },
            select: { id: true, departmentId: true },
        });
        if (sections.length === 0) throw new Error('Sections not found');
        const deptId = sections[0].departmentId;
        
        // 3. Fetch DepartmentTimeSlotConfig
        const timeConfig = await prisma.departmentTimeSlotConfig.findUnique({
            where: { departmentId: deptId },
        });
        if (!timeConfig) throw new Error('Department time slot configuration not found. Please configure time slots first.');
        
        // 4. Calculate time periods
        const periods = this.calculatePeriods(
            timeConfig.dayStartTime,
            timeConfig.dayEndTime,
            timeConfig.slotDuration,
            (timeConfig.breakSlots as any[]) || [],
            configs[0].maxPeriodsPerDay
        );
        
        // 9. Fetch available classrooms
        const allClassrooms = await prisma.classroom.findMany({
            where: { tenantId, isActive: true },
        });
        const lectureRooms = allClassrooms.filter(r => r.type === 'LECTURE' || r.type === 'SEMINAR');
        const labRooms = allClassrooms.filter(r => r.type === 'LAB');
        
        const allWarnings: string[] = [];
        let totalCreated = 0;

        // Clear existing timetables
        await prisma.timetableSlot.deleteMany({ where: { sectionId: { in: sectionIds }, semesterId } });
        
        // 8. Get existing teacher schedules across ALL sections (to prevent clashes)
        const allTeacherSlots = await prisma.timetableSlot.findMany({
            where: {
                semesterId,
                sectionId: { notIn: sectionIds }, // Other sections
                isBreak: false,
                courseAllocation: { teacherId: { not: null } },
            },
            include: { courseAllocation: { select: { teacherId: true } } },
        });
        
        // Build teacher busy map: teacherId -> Set of "day-period" strings
        const teacherBusyMap = new Map<number, Set<string>>();
        const teacherDayCount = new Map<string, number>(); // "teacherId-day" -> count
        
        for (const slot of allTeacherSlots) {
            const tid = slot.courseAllocation?.teacherId;
            if (!tid) continue;
            if (!teacherBusyMap.has(tid)) teacherBusyMap.set(tid, new Set());
            teacherBusyMap.get(tid)!.add(`${slot.dayOfWeek}-${slot.periodNumber}`);
            const tdKey = `${tid}-${slot.dayOfWeek}`;
            teacherDayCount.set(tdKey, (teacherDayCount.get(tdKey) || 0) + 1);
        }
        
        // Build room busy map: roomId -> Set of "day-period"
        const allRoomSlots = await prisma.timetableSlot.findMany({
            where: { semesterId, classroomId: { not: null }, isBreak: false, sectionId: { notIn: sectionIds } },
            select: { classroomId: true, dayOfWeek: true, periodNumber: true },
        });
        const roomBusyMap = new Map<number, Set<string>>();
        for (const slot of allRoomSlots) {
            if (!slot.classroomId) continue;
            if (!roomBusyMap.has(slot.classroomId)) roomBusyMap.set(slot.classroomId, new Set());
            roomBusyMap.get(slot.classroomId)!.add(`${slot.dayOfWeek}-${slot.periodNumber}`);
        }
        
        for (const sectionId of sectionIds) {
            const config = configs.find(c => c.sectionId === sectionId) || configs[0];
            
            const allocations = await prisma.courseAllocation.findMany({
                where: { sectionId },
                include: { course: true, teacher: { include: { user: true } } },
            });
            if (allocations.length === 0) {
                allWarnings.push(`No course allocations found for section ${sectionId}`);
                continue;
            }
            
            // 6. Parse config JSON fields
            const weeklyClasses = (config.courseWeeklyClasses as Record<string, number>) || {};
            const isLabMap = (config.courseIsLab as Record<string, boolean>) || {};
            const labBlockSize = config.labBlockSize || 2;
            
            // 7. Build demand list
            const demands: Array<{
                allocation: typeof allocations[0];
                weeklySlots: number;
                isLab: boolean;
                teacherId: number | null;
            }> = [];
            
            for (const alloc of allocations) {
                const courseIdStr = String(alloc.courseId);
                const weekly = weeklyClasses[courseIdStr] ?? alloc.course.credits;
                const lab = isLabMap[courseIdStr] ?? false;
                demands.push({
                    allocation: alloc,
                    weeklySlots: weekly,
                    isLab: lab,
                    teacherId: alloc.teacherId,
                });
            }
            
            // 10. Generate placement
            const placements: SlotPlacement[] = [];
            const sectionGrid = new Set<string>(); // "day-period" occupied
            
            // Sort: labs first (harder to place), then by weekly slots desc
            demands.sort((a, b) => {
                if (a.isLab !== b.isLab) return a.isLab ? -1 : 1;
                return b.weeklySlots - a.weeklySlots;
            });
            
            for (const demand of demands) {
                let placed = 0;
                const slotsNeeded = demand.isLab
                    ? Math.ceil(demand.weeklySlots / labBlockSize) // Lab sessions
                    : demand.weeklySlots;
                const daysUsed = new Set<number>();
                const tName = demand.allocation.teacher?.user.name || 'Unknown';
                
                for (let attempt = 0; placed < slotsNeeded && attempt < 100; attempt++) {
                    for (let day = 1; day <= 5 && placed < slotsNeeded; day++) {
                        // Spread across days: skip if already placed on this day (unless we need more)
                        if (daysUsed.has(day) && placed < 3) continue;
                        
                        const periodsForDay = periods.filter(p => !p.isBreak);
                        
                        for (const period of periodsForDay) {
                            if (placed >= slotsNeeded) break;
                            
                            if (demand.isLab) {
                                let canPlaceLab = true;
                                let limitExceeded = false;
                                
                                for (let p = 0; p < labBlockSize; p++) {
                                    const pNum = period.periodNumber + p;
                                    const pInfo = periods.find(pp => pp.periodNumber === pNum && !pp.isBreak);
                                    if (!pInfo) { canPlaceLab = false; break; }
                                    
                                    const key = `${day}-${pNum}`;
                                    if (sectionGrid.has(key)) { canPlaceLab = false; break; }
                                    if (demand.teacherId && teacherBusyMap.get(demand.teacherId)?.has(key)) { canPlaceLab = false; break; }
                                }
                                
                                if (canPlaceLab && demand.teacherId) {
                                    const maxForDay = mergedTeacherMaxPerDay[String(day)] ?? 6;
                                    const tdKey = `${demand.teacherId}-${day}`;
                                    if ((teacherDayCount.get(tdKey) || 0) + labBlockSize > maxForDay) {
                                        limitExceeded = true;
                                        if (!allowExceedLimits) {
                                            canPlaceLab = false;
                                            allWarnings.push(`Teacher ${tName} exceeds limit on day ${day}`);
                                        }
                                    }
                                }
                                
                                if (!canPlaceLab) continue;
                                
                                // Find a free lab room for all consecutive periods
                                const roomId = this.findFreeRoom(labRooms, roomBusyMap, day, period.periodNumber, labBlockSize);
                                
                                // Place the lab block
                                for (let p = 0; p < labBlockSize; p++) {
                                    const pNum = period.periodNumber + p;
                                    const pInfo = periods.find(pp => pp.periodNumber === pNum && !pp.isBreak)!;
                                    
                                    const key = `${day}-${pNum}`;
                                    sectionGrid.add(key);
                                    if (demand.teacherId) {
                                        if (!teacherBusyMap.has(demand.teacherId)) teacherBusyMap.set(demand.teacherId, new Set());
                                        teacherBusyMap.get(demand.teacherId)!.add(key);
                                        const tdKey = `${demand.teacherId}-${day}`;
                                        teacherDayCount.set(tdKey, (teacherDayCount.get(tdKey) || 0) + 1);
                                    }
                                    if (roomId) {
                                        if (!roomBusyMap.has(roomId)) roomBusyMap.set(roomId, new Set());
                                        roomBusyMap.get(roomId)!.add(key);
                                    }
                                    
                                    placements.push({
                                        dayOfWeek: day,
                                        periodNumber: pNum,
                                        startTime: pInfo.startTime,
                                        endTime: pInfo.endTime,
                                        courseAllocationId: demand.allocation.id,
                                        classroomId: roomId,
                                        isLab: true,
                                        labBlockSize,
                                    });
                                }
                                if (limitExceeded) allWarnings.push(`Warning: Teacher ${tName} exceeded limit on day ${day} (Allowed)`);
                                placed++;
                                daysUsed.add(day);
                                break; // Move to next day
                            } else {
                                // Normal lecture
                                const key = `${day}-${period.periodNumber}`;
                                if (sectionGrid.has(key)) continue;
                                
                                let limitExceeded = false;
                                // Check teacher clash
                                if (demand.teacherId) {
                                    if (teacherBusyMap.get(demand.teacherId)?.has(key)) continue;
                                    // Check teacher max per day
                                    const maxForDay = mergedTeacherMaxPerDay[String(day)] ?? 6;
                                    const tdKey = `${demand.teacherId}-${day}`;
                                    if ((teacherDayCount.get(tdKey) || 0) >= maxForDay) {
                                        limitExceeded = true;
                                        if (!allowExceedLimits) {
                                            allWarnings.push(`Teacher ${tName} exceeds limit on day ${day}`);
                                            continue;
                                        }
                                    }
                                }
                                
                                // Find free room
                                const roomId = this.findFreeRoom(lectureRooms, roomBusyMap, day, period.periodNumber, 1);
                                
                                sectionGrid.add(key);
                                if (demand.teacherId) {
                                    if (!teacherBusyMap.has(demand.teacherId)) teacherBusyMap.set(demand.teacherId, new Set());
                                    teacherBusyMap.get(demand.teacherId)!.add(key);
                                    const tdKey = `${demand.teacherId}-${day}`;
                                    teacherDayCount.set(tdKey, (teacherDayCount.get(tdKey) || 0) + 1);
                                }
                                if (roomId) {
                                    if (!roomBusyMap.has(roomId)) roomBusyMap.set(roomId, new Set());
                                    roomBusyMap.get(roomId)!.add(key);
                                }
                                
                                placements.push({
                                    dayOfWeek: day,
                                    periodNumber: period.periodNumber,
                                    startTime: period.startTime,
                                    endTime: period.endTime,
                                    courseAllocationId: demand.allocation.id,
                                    classroomId: roomId,
                                    isLab: false,
                                    labBlockSize: 1,
                                });
                                if (limitExceeded) allWarnings.push(`Warning: Teacher ${tName} exceeded limit on day ${day} (Allowed)`);
                                placed++;
                                daysUsed.add(day);
                                break; // Move to next day for spread
                            }
                        }
                    }
                }
                
                if (placed < slotsNeeded) {
                    log.warn({ courseId: demand.allocation.courseId, placed, needed: slotsNeeded }, 'Could not place all required slots for course');
                    allWarnings.push(`Could not place all slots for ${demand.allocation.course.name} in section ${sectionId}`);
                }
            }
            
            // 12. Insert all placements + break slots
            const allSlots = [
                ...placements.map(p => ({
                    tenantId,
                    sectionId,
                    semesterId,
                    dayOfWeek: p.dayOfWeek,
                    periodNumber: p.periodNumber,
                    startTime: p.startTime,
                    endTime: p.endTime,
                    courseAllocationId: p.courseAllocationId,
                    classroomId: p.classroomId,
                    isBreak: false,
                    isLab: p.isLab,
                    labBlockSize: p.labBlockSize,
                })),
                // Add break slots for each day
                ...this.generateBreakSlots(periods, tenantId, sectionId, semesterId),
            ];
            
            await prisma.timetableSlot.createMany({ data: allSlots });
            totalCreated += allSlots.length;
        }
        
        return { message: 'Timetable generated successfully', slotsCreated: totalCreated, warnings: allWarnings };
    },
    
    calculatePeriods(startTime: string, endTime: string, slotDuration: number, breakSlots: any[], maxPeriods: number) {
        const periods: Array<{ periodNumber: number; startTime: string; endTime: string; isBreak: boolean; breakLabel?: string }> = [];
        
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        let periodNum = 1;
        
        while (currentMinutes + slotDuration <= endMinutes && periodNum <= maxPeriods + 5) { // +5 for breaks
            const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
            const slotEnd = `${String(Math.floor((currentMinutes + slotDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + slotDuration) % 60).padStart(2, '0')}`;
            
            // Check if this slot overlaps with a break
            const breakMatch = breakSlots.find(b => {
                const [bStartH, bStartM] = (b.start || b.startTime || '').split(':').map(Number);
                const bStart = bStartH * 60 + (bStartM || 0);
                return Math.abs(currentMinutes - bStart) < slotDuration;
            });
            
            if (breakMatch) {
                const [bEndH, bEndM] = (breakMatch.end || breakMatch.endTime || '').split(':').map(Number);
                periods.push({
                    periodNumber: periodNum,
                    startTime: breakMatch.start || breakMatch.startTime,
                    endTime: breakMatch.end || breakMatch.endTime,
                    isBreak: true,
                    breakLabel: breakMatch.label || 'Break',
                });
                currentMinutes = bEndH * 60 + (bEndM || 0);
            } else {
                periods.push({
                    periodNumber: periodNum,
                    startTime: slotStart,
                    endTime: slotEnd,
                    isBreak: false,
                });
                currentMinutes += slotDuration;
            }
            periodNum++;
        }
        
        return periods;
    },
    
    canPlaceLabBlock(
        day: number, startPeriod: number, blockSize: number,
        periods: any[], sectionGrid: Set<string>,
        teacherId: number | null,
        teacherBusyMap: Map<number, Set<string>>,
        teacherMaxPerDay: Record<string, number>,
        teacherDayCount: Map<string, number>
    ): boolean {
        for (let p = 0; p < blockSize; p++) {
            const pNum = startPeriod + p;
            const periodInfo = periods.find(pp => pp.periodNumber === pNum && !pp.isBreak);
            if (!periodInfo) return false; // Period doesn't exist or is break
            
            const key = `${day}-${pNum}`;
            if (sectionGrid.has(key)) return false;
            
            if (teacherId) {
                if (teacherBusyMap.get(teacherId)?.has(key)) return false;
            }
        }
        // Check teacher max per day (adding blockSize periods)
        if (teacherId) {
            const maxForDay = teacherMaxPerDay[String(day)] ?? 6;
            const tdKey = `${teacherId}-${day}`;
            if ((teacherDayCount.get(tdKey) || 0) + blockSize > maxForDay) return false;
        }
        return true;
    },
    
    findFreeRoom(
        rooms: Array<{ id: number }>,
        roomBusyMap: Map<number, Set<string>>,
        day: number, startPeriod: number, blockSize: number
    ): number | null {
        for (const room of rooms) {
            let free = true;
            for (let p = 0; p < blockSize; p++) {
                const key = `${day}-${startPeriod + p}`;
                if (roomBusyMap.get(room.id)?.has(key)) {
                    free = false;
                    break;
                }
            }
            if (free) return room.id;
        }
        return null; // No room free
    },
    
    generateBreakSlots(periods: any[], tenantId: number, sectionId: number, semesterId: number) {
        const breakData: any[] = [];
        const breakPeriods = periods.filter(p => p.isBreak);
        for (let day = 1; day <= 5; day++) {
            for (const bp of breakPeriods) {
                breakData.push({
                    tenantId, sectionId, semesterId,
                    dayOfWeek: day,
                    periodNumber: bp.periodNumber,
                    startTime: bp.startTime,
                    endTime: bp.endTime,
                    isBreak: true,
                    breakLabel: bp.breakLabel || 'Break',
                    isLab: false,
                    labBlockSize: 1,
                });
            }
        }
        return breakData;
    },
    
    async clearTimetable(sectionId: number, semesterId: number) {
        // First delete any substitutions for these slots
        const slotIds = await prisma.timetableSlot.findMany({
            where: { sectionId, semesterId },
            select: { id: true },
        });
        if (slotIds.length > 0) {
            await prisma.teacherSubstitution.deleteMany({
                where: { timetableSlotId: { in: slotIds.map(s => s.id) } },
            });
        }
        const result = await prisma.timetableSlot.deleteMany({ where: { sectionId, semesterId } });
        return { message: 'Timetable cleared', deletedSlots: result.count };
    },
    
    async getTimetableGrid(sectionId: number, semesterId: number) {
        const slots = await prisma.timetableSlot.findMany({
            where: { sectionId, semesterId },
            include: {
                courseAllocation: {
                    include: {
                        course: { select: { id: true, name: true, code: true } },
                        teacher: { include: { user: { select: { name: true } } } },
                    },
                },
                classroom: { select: { id: true, name: true, type: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        });
        
        // Group by day
        const grid: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (const slot of slots) {
            const entry = {
                id: slot.id,
                periodNumber: slot.periodNumber,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isBreak: slot.isBreak,
                breakLabel: slot.breakLabel,
                isLab: slot.isLab,
                labBlockSize: slot.labBlockSize,
                course: slot.courseAllocation?.course || null,
                teacher: slot.courseAllocation?.teacher ? {
                    id: slot.courseAllocation.teacher.id,
                    name: slot.courseAllocation.teacher.user.name,
                } : null,
                classroom: slot.classroom,
            };
            if (grid[slot.dayOfWeek]) {
                grid[slot.dayOfWeek].push(entry);
            }
        }
        
        return grid;
    },
    
    async getTeacherTimetable(teacherProfileId: number, semesterId: number) {
        const slots = await prisma.timetableSlot.findMany({
            where: {
                semesterId,
                isBreak: false,
                courseAllocation: { teacherId: teacherProfileId },
            },
            include: {
                section: { select: { id: true, name: true, department: { select: { code: true } }, batch: { select: { name: true } } } },
                courseAllocation: {
                    include: { course: { select: { name: true, code: true } } },
                },
                classroom: { select: { name: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        });
        
        const grid: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (const slot of slots) {
            grid[slot.dayOfWeek]?.push({
                id: slot.id,
                periodNumber: slot.periodNumber,
                startTime: slot.startTime,
                endTime: slot.endTime,
                course: slot.courseAllocation?.course || null,
                section: slot.section ? `${slot.section.department?.code || ''} ${slot.section.batch?.name || ''} - ${slot.section.name}` : '',
                sectionId: slot.sectionId,
                classroom: slot.classroom?.name || null,
                isLab: slot.isLab,
            });
        }
        
        return grid;
    },
    
    async swapSlots(slotId1: number, slotId2: number) {
        const [slot1, slot2] = await Promise.all([
            prisma.timetableSlot.findUnique({ where: { id: slotId1 } }),
            prisma.timetableSlot.findUnique({ where: { id: slotId2 } }),
        ]);
        if (!slot1 || !slot2) throw new Error('One or both slots not found');
        if (slot1.isBreak || slot2.isBreak) throw new Error('Cannot swap break slots');
        
        // Swap courseAllocationId, classroomId, isLab, labBlockSize
        await prisma.$transaction([
            prisma.timetableSlot.update({
                where: { id: slotId1 },
                data: {
                    courseAllocationId: slot2.courseAllocationId,
                    classroomId: slot2.classroomId,
                    isLab: slot2.isLab,
                    labBlockSize: slot2.labBlockSize,
                },
            }),
            prisma.timetableSlot.update({
                where: { id: slotId2 },
                data: {
                    courseAllocationId: slot1.courseAllocationId,
                    classroomId: slot1.classroomId,
                    isLab: slot1.isLab,
                    labBlockSize: slot1.labBlockSize,
                },
            }),
        ]);
        
        return { message: 'Slots swapped successfully' };
    },
};
