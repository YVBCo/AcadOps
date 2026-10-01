/**
 * Admission Bulk Service
 * ──────────────────────────────────────
 * Handles Excel bulk upload: parsing, validation, and batch creation
 * of approved students with parent accounts.
 *
 * Extracted from admissions.service.ts (lines 1409-2063)
 */
import { Prisma } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { auditLogRepository } from '../../data-access/index.js';
import { authService } from '../auth.service.js';
import ExcelJS from 'exceljs';
import {
    log,
    branchToCode,
    TEMPLATE_HEADERS,
    type ParsedStudentRow,
} from './shared.js';

class AdmissionBulkService {
    /**
     * Parse an uploaded Excel file and validate it matches the strict template.
     * Returns parsed rows with per-row validation errors.
     */
    async parseStudentExcel(
        fileBuffer: Buffer,
        tenantId?: number
    ): Promise<{ rows: ParsedStudentRow[]; summary: { total: number; valid: number; invalid: number } }> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('No worksheet found in the Excel file');
        }

        // ── Validate headers match template exactly ──────────────────
        const headerRow = worksheet.getRow(1);
        const fileHeaders: string[] = [];
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            // Aggressively strip BOM, non-breaking spaces, zero-width chars, and other invisible Unicode
            let val = String(cell.value ?? '');
            // Remove BOM (U+FEFF), zero-width spaces (U+200B, U+200C, U+200D), and other invisible chars
            val = val.replace(/[\uFEFF\u200B\u200C\u200D\u00AD\u2060]/g, '');
            // Replace non-breaking spaces (U+00A0) with regular spaces
            val = val.replace(/\u00A0/g, ' ');
            // Trim and collapse multiple spaces
            val = val.trim().replace(/\s+/g, ' ');
            fileHeaders[colNumber - 1] = val;
        });

        while (fileHeaders.length > 0 && !fileHeaders[fileHeaders.length - 1]) {
            fileHeaders.pop();
        }

        if (fileHeaders.length < TEMPLATE_HEADERS.length) {
            throw new Error(
                `Invalid template: expected at least ${TEMPLATE_HEADERS.length} columns but found ${fileHeaders.length}. Please download and use the correct template.`
            );
        }

        // Compare headers using normalized strings
        for (let i = 0; i < TEMPLATE_HEADERS.length; i++) {
            const fileHeader = (fileHeaders[i] || '').trim().toLowerCase();
            const expectedHeader = TEMPLATE_HEADERS[i].toLowerCase();
            if (fileHeader !== expectedHeader) {
                throw new Error(
                    `Invalid template: column ${i + 1} should be "${TEMPLATE_HEADERS[i]}" but found "${fileHeaders[i] || '(empty)'}". Please download and use the correct template.`
                );
            }
        }

        // ── Pre-fetch tenant departments for college-type validation ─
        let tenantDepartments: { code: string; name: string }[] = [];
        let tenantType: string | null = null;
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { type: true },
            });
            tenantType = tenant?.type || null;

            const depts = await prisma.department.findMany({
                where: { tenantId },
                select: { code: true, name: true },
            });
            tenantDepartments = depts;
        }

        // ── Parse data rows ──────────────────────────────────────────
        const rows: ParsedStudentRow[] = [];
        const seenEmails = new Set<string>();
        const seenAadhaars = new Set<string>();

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return;

            const data: Record<string, string> = {};
            TEMPLATE_HEADERS.forEach((header, idx) => {
                const cell = row.getCell(idx + 1);
                let value = '';
                if (cell.value !== null && cell.value !== undefined) {
                    if (cell.value instanceof Date) {
                        value = cell.value.toISOString().split('T')[0];
                    } else if (typeof cell.value === 'object') {
                        const obj = cell.value as any;
                        if (obj.hyperlink && typeof obj.hyperlink === 'string' && obj.hyperlink.startsWith('mailto:')) {
                            value = obj.hyperlink.slice(7);
                        } else if (Array.isArray(obj.richText)) {
                            value = obj.richText.map((p: any) => String(p.text || '')).join('');
                        } else if (obj.text && typeof obj.text === 'object' && obj.text.richText) {
                            value = obj.text.richText.map((p: any) => String(p.text || '')).join('');
                        } else if (typeof obj.text === 'string') {
                            value = obj.text;
                        } else if (obj.result != null) {
                            value = obj.result instanceof Date ? obj.result.toISOString().split('T')[0] : String(obj.result);
                        } else if (obj.hyperlink) {
                            value = String(obj.hyperlink);
                        } else {
                            const ct = String(cell.text ?? '');
                            value = (ct && ct !== '[object Object]') ? ct : '';
                        }
                    } else {
                        value = String(cell.value).trim();
                    }
                }
                data[header] = value.trim();
            });

            const hasData = Object.values(data).some(v => v.length > 0);
            if (!hasData) return;

            // ── Row-level validation ─────────────────────────────────
            const errors: string[] = [];

            if (!data['Applicant Name']) errors.push('Applicant Name is required');
            if (!data['Branch']) errors.push('Branch is required');
            if (!data['Admission Year']) errors.push('Admission Year is required');
            else if (isNaN(parseInt(data['Admission Year']))) errors.push('Admission Year must be a number');

            // College-type branch validation
            if (data['Branch'] && tenantDepartments.length > 0) {
                const branchInput = data['Branch'].trim();
                const matchesDept = tenantDepartments.some(
                    dept => dept.code.toLowerCase() === branchInput.toLowerCase()
                        || dept.name.toLowerCase() === branchInput.toLowerCase()
                );
                if (!matchesDept) {
                    const code = branchToCode(branchInput);
                    const codeMatch = tenantDepartments.some(
                        dept => dept.code.toLowerCase() === code.toLowerCase()
                    );
                    if (!codeMatch) {
                        errors.push(
                            `Branch "${branchInput}" does not match any department in your ${tenantType || ''} institution. ` +
                            `Available: ${tenantDepartments.map(d => d.code).join(', ')}`
                        );
                    }
                }
            }

            // Email validation
            if (data['Email']) {
                const email = data['Email'].toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    errors.push('Email is invalid');
                } else if (seenEmails.has(email)) {
                    errors.push('Duplicate email within this file');
                } else {
                    seenEmails.add(email);
                }
            }

            if (data['Mobile Number'] && !/^\d{10,15}$/.test(data['Mobile Number'].replace(/[\s\-\+]/g, ''))) {
                errors.push('Mobile Number must be 10-15 digits');
            }

            if (data['Aadhaar Number']) {
                const cleanAadhaar = data['Aadhaar Number'].replace(/\s/g, '');
                if (!/^\d{12}$/.test(cleanAadhaar)) {
                    errors.push('Aadhaar Number must be 12 digits');
                } else if (seenAadhaars.has(cleanAadhaar)) {
                    errors.push('Duplicate Aadhaar Number within this file');
                } else {
                    seenAadhaars.add(cleanAadhaar);
                }
            }

            if (data['Date of Birth']) {
                const dob = new Date(data['Date of Birth']);
                if (isNaN(dob.getTime())) {
                    errors.push('Date of Birth is invalid — use YYYY-MM-DD or a valid date format');
                } else {
                    const year = dob.getFullYear();
                    const currentYear = new Date().getFullYear();
                    if (year < 1950 || year > currentYear - 10) {
                        errors.push(`Date of Birth year ${year} seems unrealistic`);
                    }
                }
            }

            rows.push({
                rowNumber,
                data,
                errors,
                isValid: errors.length === 0,
            });
        });

        if (rows.length === 0) {
            throw new Error('No data rows found in the Excel file. Please add student data below the header row.');
        }

        return {
            rows,
            summary: {
                total: rows.length,
                valid: rows.filter(r => r.isValid).length,
                invalid: rows.filter(r => !r.isValid).length,
            },
        };
    }

    /**
     * Bulk create approved students from validated Excel rows.
     * OPTIMIZED: Pre-hashes password once, processes in chunked transactions.
     */
    async bulkCreateApprovedStudents(
        validRows: ParsedStudentRow[],
        adminId: number,
        tenantId: number
    ): Promise<{ created: number; skipped: number; parentsCreated: number; errors: { row: number; name: string; error: string }[] }> {
        let created = 0;
        let skipped = 0;
        let parentsCreated = 0;
        const errors: { row: number; name: string; error: string }[] = [];

        // ── Pre-fetch: existing emails in this tenant ────────────────
        const emailsInFile = validRows
            .filter(r => r.isValid && r.data['Email'])
            .map(r => r.data['Email'].toLowerCase());

        const existingEmailUsers = emailsInFile.length > 0
            ? await prisma.user.findMany({
                where: {
                    tenantId,
                    email: { in: emailsInFile, mode: 'insensitive' },
                    NOT: { email: { startsWith: 'deleted_' } },
                },
                select: { email: true },
            })
            : [];
        const existingEmailSet = new Set(existingEmailUsers.map(u => u.email.toLowerCase()));

        // ── Pre-fetch: tenant slug ───────────────────────────────────
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { slug: true },
        });
        const tenantSlug = tenant?.slug || 'default';

        // ── Pre-fetch: existing Aadhaar numbers ─────────────────────
        const aadhaarsInFile = validRows
            .filter(r => r.isValid && r.data['Aadhaar Number'])
            .map(r => r.data['Aadhaar Number'].replace(/\s/g, ''));

        const existingAadhaars = aadhaarsInFile.length > 0
            ? await prisma.admissionData.findMany({
                where: {
                    enteredByUser: { tenantId },
                    aadhaarNumber: { in: aadhaarsInFile },
                },
                select: { aadhaarNumber: true },
            })
            : [];
        const existingAadhaarSet = new Set(existingAadhaars.map(a => a.aadhaarNumber).filter(Boolean));

        // ── Pre-fetch: departments ──────────────────────────────────
        const allDepts = await prisma.department.findMany({
            where: { tenantId },
            select: { id: true, code: true, name: true },
        });
        const deptCache = new Map<string, { id: number; code: string; name: string }>();
        for (const dept of allDepts) {
            deptCache.set(dept.code.toLowerCase(), dept);
            deptCache.set(dept.name.toLowerCase(), dept);
        }

        // ── Pre-fetch: batches ──────────────────────────────────────
        const allBatches = await prisma.batch.findMany({
            where: { tenantId },
            select: { id: true, name: true, currentSemester: true },
        });
        const batchCache = new Map<string, { id: number; currentSemester: number }>();
        for (const batch of allBatches) {
            batchCache.set(batch.name, { id: batch.id, currentSemester: batch.currentSemester });
        }

        // ── Pre-compute: starting admission ID counter ───────────────
        const admissionYears = [...new Set(
            validRows.filter(r => r.isValid).map(r => parseInt(r.data['Admission Year']) || new Date().getFullYear())
        )];
        const admissionCounters = new Map<number, number>();
        for (const year of admissionYears) {
            const last = await prisma.admissionData.findFirst({
                where: {
                    enteredByUser: { tenantId },
                    admissionId: { startsWith: 'ADM' },
                    admissionYear: year,
                },
                orderBy: { admissionId: 'desc' },
                select: { admissionId: true },
            });
            let nextNum = 1;
            if (last?.admissionId) {
                const match = last.admissionId.match(/ADM(\d+)/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            admissionCounters.set(year, nextNum);
        }

        const getNextAdmissionId = (year: number): string => {
            const num = admissionCounters.get(year) || 1;
            admissionCounters.set(year, num + 1);
            return `ADM${num.toString().padStart(4, '0')}`;
        };

        // ── OPTIMIZATION: Pre-hash password ONCE (same for all locked accounts) ──
        const tempPasswordHash = await authService.hashPassword(`LOCKED_BULK_${Date.now()}`);

        // ── OPTIMIZATION: Pre-validate and prepare all rows in memory ──
        interface PreparedRow {
            row: ParsedStudentRow;
            admissionId: string;
            tempEmail: string;
            dept: { id: number; code: string; name: string };
            batch: { id: number; currentSemester: number };
            isLateralEntry: boolean;
        }
        const preparedRows: PreparedRow[] = [];

        for (const row of validRows) {
            if (!row.isValid) {
                skipped++;
                continue;
            }

            const d = row.data;
            const applicantName = d['Applicant Name'];
            const admissionYear = parseInt(d['Admission Year']) || new Date().getFullYear();
            const branchSelection = d['Branch'];

            // Email duplicate check
            if (d['Email']) {
                const emailLower = d['Email'].toLowerCase();
                if (existingEmailSet.has(emailLower)) {
                    errors.push({ row: row.rowNumber, name: applicantName, error: `Email ${d['Email']} already exists in this institution` });
                    skipped++;
                    continue;
                }
            }

            // Aadhaar duplicate check
            if (d['Aadhaar Number']) {
                const cleanAadhaar = d['Aadhaar Number'].replace(/\s/g, '');
                if (existingAadhaarSet.has(cleanAadhaar)) {
                    errors.push({ row: row.rowNumber, name: applicantName, error: `Aadhaar ${cleanAadhaar} already exists in this institution` });
                    skipped++;
                    continue;
                }
            }

            // Resolve department
            let dept = deptCache.get(branchSelection.toLowerCase());
            if (!dept) {
                const code = branchToCode(branchSelection);
                dept = deptCache.get(code.toLowerCase());
            }

            if (!dept) {
                if (allDepts.length > 0) {
                    errors.push({ row: row.rowNumber, name: applicantName, error: `Branch "${branchSelection}" not found. Available: ${allDepts.map(d => d.code).join(', ')}` });
                    skipped++;
                    continue;
                }

                const code = branchToCode(branchSelection);
                const newDept = await prisma.department.create({
                    data: {
                        name: branchSelection,
                        code,
                        description: `${branchSelection} Department`,
                        tenantId,
                    },
                });
                const deptObj = { id: newDept.id, code: newDept.code, name: newDept.name };
                deptCache.set(newDept.code.toLowerCase(), deptObj);
                deptCache.set(newDept.name.toLowerCase(), deptObj);
                allDepts.push(deptObj);
                dept = deptObj;
                log.info({ deptName: dept.name }, 'Auto-created department from bulk upload');
            }

            let batch = batchCache.get(String(admissionYear));
            if (!batch) {
                const newBatch = await prisma.batch.create({
                    data: { name: String(admissionYear), startYear: admissionYear, currentSemester: 1, tenantId },
                });
                batch = { id: newBatch.id, currentSemester: newBatch.currentSemester };
                batchCache.set(String(admissionYear), batch);
            }

            const admissionId = getNextAdmissionId(admissionYear);
            const tempEmail = d['Email']?.toLowerCase() || `pending.${admissionId.toLowerCase()}.${Date.now()}.${row.rowNumber}@noreply.internal`;
            const isLateralEntry = ['yes', 'true', '1'].includes((d['Lateral Entry'] || '').toLowerCase());

            // Track email/aadhaar to prevent intra-batch duplicates
            if (d['Email']) existingEmailSet.add(d['Email'].toLowerCase());
            if (d['Aadhaar Number']) existingAadhaarSet.add(d['Aadhaar Number'].replace(/\s/g, ''));

            preparedRows.push({ row, admissionId, tempEmail, dept, batch, isLateralEntry });
        }

        // ── OPTIMIZATION: Process in chunks of 50 inside batch transactions ──
        const CHUNK_SIZE = 50;
        for (let i = 0; i < preparedRows.length; i += CHUNK_SIZE) {
            const chunk = preparedRows.slice(i, i + CHUNK_SIZE);

            try {
                await prisma.$transaction(async (tx) => {
                    for (const { row, admissionId, tempEmail, dept, batch, isLateralEntry } of chunk) {
                        const d = row.data;
                        const applicantName = d['Applicant Name'];
                        const admissionYear = parseInt(d['Admission Year']) || new Date().getFullYear();

                        const user = await tx.user.create({
                            data: {
                                email: tempEmail,
                                passwordHash: tempPasswordHash,
                                name: applicantName,
                                role: 'STUDENT',
                                departmentId: dept.id,
                                isActive: false,
                                tenantId,
                            },
                        });

                        const profile = await tx.studentProfile.create({
                            data: {
                                userId: user.id,
                                rollNumber: admissionId,
                                admissionYear,
                                currentSemester: batch.currentSemester,
                                optedDepartmentId: dept.id,
                                batchId: batch.id,
                                temporaryUsn: null,
                                admissionId,
                                isLateralEntry,
                            },
                        });

                        // Build parent details JSON
                        const fatherDetails: Record<string, string> = {};
                        if (d['Father Name']) fatherDetails.name = d['Father Name'];
                        if (d['Father Mobile']) fatherDetails.mobile = d['Father Mobile'];
                        if (d['Father Email']) fatherDetails.email = d['Father Email'];
                        if (d['Father Occupation']) fatherDetails.occupation = d['Father Occupation'];
                        if (d['Father Annual Income']) fatherDetails.annualIncome = d['Father Annual Income'];

                        const motherDetails: Record<string, string> = {};
                        if (d['Mother Name']) motherDetails.name = d['Mother Name'];
                        if (d['Mother Mobile']) motherDetails.mobile = d['Mother Mobile'];
                        if (d['Mother Email']) motherDetails.email = d['Mother Email'];
                        if (d['Mother Occupation']) motherDetails.occupation = d['Mother Occupation'];
                        if (d['Mother Annual Income']) motherDetails.annualIncome = d['Mother Annual Income'];

                        const permanentAddress: Record<string, string> = {};
                        if (d['Permanent Address']) permanentAddress.address = d['Permanent Address'];
                        if (d['Permanent State']) permanentAddress.state = d['Permanent State'];
                        if (d['Permanent Pin']) permanentAddress.pin = d['Permanent Pin'];

                        const localAddress: Record<string, string> = {};
                        if (d['Local Address']) localAddress.address = d['Local Address'];
                        if (d['Local State']) localAddress.state = d['Local State'];
                        if (d['Local Pin']) localAddress.pin = d['Local Pin'];

                        let dobDate: Date | null = null;
                        if (d['Date of Birth']) {
                            const parsed = new Date(d['Date of Birth']);
                            if (!isNaN(parsed.getTime())) dobDate = parsed;
                        }

                        await tx.admissionData.create({
                            data: {
                                admissionId,
                                status: 'APPROVED',
                                applicantName,
                                emailId: d['Email'] || null,
                                mobileNumber: d['Mobile Number'] || null,
                                gender: d['Gender'] || null,
                                dateOfBirth: dobDate,
                                bloodGroup: d['Blood Group'] || null,
                                nationality: d['Nationality'] || null,
                                religion: d['Religion'] || null,
                                category: d['Category'] || null,
                                subCaste: d['Sub Caste'] || null,
                                motherTongue: d['Mother Tongue'] || null,
                                aadhaarNumber: d['Aadhaar Number'] || null,
                                branchSelection: d['Branch'],
                                admissionYear,
                                applyingThrough: d['Applying Through'] || null,
                                hostel: ['yes', 'true', '1'].includes((d['Hostel'] || '').toLowerCase()),
                                speciallyAbled: ['yes', 'true', '1'].includes((d['Specially Abled'] || '').toLowerCase()),
                                isLateralEntry,
                                fatherDetails: Object.keys(fatherDetails).length > 0 ? fatherDetails as Prisma.InputJsonValue : Prisma.JsonNull,
                                motherDetails: Object.keys(motherDetails).length > 0 ? motherDetails as Prisma.InputJsonValue : Prisma.JsonNull,
                                permanentAddress: Object.keys(permanentAddress).length > 0 ? permanentAddress as Prisma.InputJsonValue : Prisma.JsonNull,
                                localAddress: Object.keys(localAddress).length > 0 ? localAddress as Prisma.InputJsonValue : Prisma.JsonNull,
                                cetRollNo: d['CET Roll No'] || null,
                                cetRank: d['CET Rank'] || null,
                                comedkRollNo: d['COMEDK Roll No'] || null,
                                comedkRank: d['COMEDK Rank'] || null,
                                enteredBy: adminId,
                                approvedBy: adminId,
                                studentProfileId: profile.id,
                                applicantDeclaration: true,
                                parentDeclaration: true,
                            },
                        });

                        created++;
                    }
                }, { timeout: 60000 }); // Longer timeout for batch
            } catch (err) {
                // If batch fails, fall back to row-by-row for this chunk to identify the bad row
                log.warn({ chunkStart: i, chunkSize: chunk.length }, 'Batch transaction failed, falling back to row-by-row');
                for (const { row, admissionId, tempEmail, dept, batch, isLateralEntry } of chunk) {
                    const d = row.data;
                    const applicantName = d['Applicant Name'];
                    const admissionYear = parseInt(d['Admission Year']) || new Date().getFullYear();
                    try {
                        await prisma.$transaction(async (tx) => {
                            const user = await tx.user.create({
                                data: {
                                    email: tempEmail,
                                    passwordHash: tempPasswordHash,
                                    name: applicantName,
                                    role: 'STUDENT',
                                    departmentId: dept.id,
                                    isActive: false,
                                    tenantId,
                                },
                            });
                            const profile = await tx.studentProfile.create({
                                data: {
                                    userId: user.id,
                                    rollNumber: admissionId,
                                    admissionYear,
                                    currentSemester: batch.currentSemester,
                                    optedDepartmentId: dept.id,
                                    batchId: batch.id,
                                    temporaryUsn: null,
                                    admissionId,
                                    isLateralEntry,
                                },
                            });

                            const fatherDetails: Record<string, string> = {};
                            if (d['Father Name']) fatherDetails.name = d['Father Name'];
                            if (d['Father Mobile']) fatherDetails.mobile = d['Father Mobile'];
                            if (d['Father Email']) fatherDetails.email = d['Father Email'];
                            if (d['Father Occupation']) fatherDetails.occupation = d['Father Occupation'];
                            if (d['Father Annual Income']) fatherDetails.annualIncome = d['Father Annual Income'];
                            const motherDetails: Record<string, string> = {};
                            if (d['Mother Name']) motherDetails.name = d['Mother Name'];
                            if (d['Mother Mobile']) motherDetails.mobile = d['Mother Mobile'];
                            if (d['Mother Email']) motherDetails.email = d['Mother Email'];
                            if (d['Mother Occupation']) motherDetails.occupation = d['Mother Occupation'];
                            if (d['Mother Annual Income']) motherDetails.annualIncome = d['Mother Annual Income'];
                            const permanentAddress: Record<string, string> = {};
                            if (d['Permanent Address']) permanentAddress.address = d['Permanent Address'];
                            if (d['Permanent State']) permanentAddress.state = d['Permanent State'];
                            if (d['Permanent Pin']) permanentAddress.pin = d['Permanent Pin'];
                            const localAddress: Record<string, string> = {};
                            if (d['Local Address']) localAddress.address = d['Local Address'];
                            if (d['Local State']) localAddress.state = d['Local State'];
                            if (d['Local Pin']) localAddress.pin = d['Local Pin'];
                            let dobDate: Date | null = null;
                            if (d['Date of Birth']) {
                                const parsed = new Date(d['Date of Birth']);
                                if (!isNaN(parsed.getTime())) dobDate = parsed;
                            }

                            await tx.admissionData.create({
                                data: {
                                    admissionId, status: 'APPROVED', applicantName,
                                    emailId: d['Email'] || null, mobileNumber: d['Mobile Number'] || null,
                                    gender: d['Gender'] || null, dateOfBirth: dobDate,
                                    bloodGroup: d['Blood Group'] || null, nationality: d['Nationality'] || null,
                                    religion: d['Religion'] || null, category: d['Category'] || null,
                                    subCaste: d['Sub Caste'] || null, motherTongue: d['Mother Tongue'] || null,
                                    aadhaarNumber: d['Aadhaar Number'] || null,
                                    branchSelection: d['Branch'], admissionYear,
                                    applyingThrough: d['Applying Through'] || null,
                                    hostel: ['yes', 'true', '1'].includes((d['Hostel'] || '').toLowerCase()),
                                    speciallyAbled: ['yes', 'true', '1'].includes((d['Specially Abled'] || '').toLowerCase()),
                                    isLateralEntry,
                                    fatherDetails: Object.keys(fatherDetails).length > 0 ? fatherDetails as Prisma.InputJsonValue : Prisma.JsonNull,
                                    motherDetails: Object.keys(motherDetails).length > 0 ? motherDetails as Prisma.InputJsonValue : Prisma.JsonNull,
                                    permanentAddress: Object.keys(permanentAddress).length > 0 ? permanentAddress as Prisma.InputJsonValue : Prisma.JsonNull,
                                    localAddress: Object.keys(localAddress).length > 0 ? localAddress as Prisma.InputJsonValue : Prisma.JsonNull,
                                    cetRollNo: d['CET Roll No'] || null, cetRank: d['CET Rank'] || null,
                                    comedkRollNo: d['COMEDK Roll No'] || null, comedkRank: d['COMEDK Rank'] || null,
                                    enteredBy: adminId, approvedBy: adminId,
                                    studentProfileId: profile.id,
                                    applicantDeclaration: true, parentDeclaration: true,
                                },
                            });
                        }, { timeout: 30000 });
                        created++;
                    } catch (rowErr) {
                        let errorMsg = rowErr instanceof Error ? rowErr.message : String(rowErr);
                        if (rowErr instanceof Prisma.PrismaClientKnownRequestError && rowErr.code === 'P2002') {
                            const target = rowErr.meta?.target as string[] | undefined;
                            if (target?.includes('email')) errorMsg = `Email ${d['Email'] || ''} already exists`;
                            else if (target?.includes('roll_number')) errorMsg = 'Generated admission ID conflict — please retry';
                            else errorMsg = `Duplicate value conflict: ${target?.join(', ') || 'unknown field'}`;
                        }
                        log.error({ row: row.rowNumber, name: applicantName, error: errorMsg }, 'Bulk upload row failed');
                        errors.push({ row: row.rowNumber, name: applicantName, error: errorMsg });
                        skipped++;
                    }
                }
            }
        }

        await auditLogRepository.create({
            actorId: adminId,
            action: 'BULK_UPLOAD_STUDENTS',
            entityType: 'AdmissionData',
            newValue: { created, skipped, errorCount: errors.length } as Prisma.JsonValue,
        });

        return { created, skipped, parentsCreated, errors };
    }

    /**
     * Generate the Excel template with the correct headers.
     * Returns an ExcelJS workbook buffer.
     */
    async generateTemplate(): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Admissions System';
        const sheet = workbook.addWorksheet('Student Data');

        sheet.columns = TEMPLATE_HEADERS.map((header) => ({
            header,
            key: header,
            width: Math.max(header.length + 5, 18),
        }));

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' },
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.height = 28;

        sheet.addRow({
            'Applicant Name': 'John Doe',
            'Email': 'john.doe@example.com',
            'Mobile Number': '9876543210',
            'Gender': 'Male',
            'Date of Birth': '2005-06-15',
            'Blood Group': 'O+',
            'Nationality': 'Indian',
            'Religion': 'Hindu',
            'Category': 'General',
            'Branch': 'CSE',
            'Admission Year': String(new Date().getFullYear()),
            'Applying Through': 'CET',
            'Hostel': 'No',
            'Specially Abled': 'No',
            'Lateral Entry': 'No',
            'Father Name': 'Richard Doe',
            'Father Mobile': '9876543211',
        });

        const exRow = sheet.getRow(2);
        exRow.font = { italic: true, color: { argb: 'FF999999' } };

        const genderCol = TEMPLATE_HEADERS.indexOf('Gender') + 1;
        sheet.getColumn(genderCol).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 1) {
                cell.dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"Male,Female,Other"'],
                };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}

export const admissionBulkService = new AdmissionBulkService();
