import { config } from '../config/index.js';
import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'sms' });

// In-memory dedup cache: "phone:studentId:date" → timestamp
const sentSmsCache = new Map<string, number>();
const SMS_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

class SmsService {
    private enabled: boolean;
    private apiKey: string;
    private senderId: string;

    constructor() {
        this.enabled = config.sms.enabled;
        this.apiKey = config.sms.fast2smsApiKey || '';
        this.senderId = config.sms.senderId;
    }

    /**
     * Send an SMS via Fast2SMS API
     * Returns true if sent successfully, false otherwise.
     * Never throws - failures are logged silently.
     */
    async sendSms(phoneNumber: string, message: string): Promise<boolean> {
        if (!this.enabled) {
            log.debug({ phoneNumber }, 'SMS disabled — message not sent');
            return false;
        }

        if (!this.apiKey) {
            log.warn('No FAST2SMS_API_KEY configured — skipping SMS');
            return false;
        }

        // Normalize phone number (remove +91, spaces, dashes)
        const normalizedPhone = phoneNumber.replace(/[\s\-+]/g, '').replace(/^91/, '');
        if (!/^\d{10}$/.test(normalizedPhone)) {
            log.warn({ phoneNumber }, 'Invalid phone number');
            return false;
        }

        try {
            const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: {
                    'authorization': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    route: 'q', // Quick SMS route (transactional)
                    message,
                    language: 'english',
                    flash: 0,
                    numbers: normalizedPhone,
                    sender_id: this.senderId,
                }),
            });

            const result = await response.json() as { return: boolean; message: string };

            if (result.return) {
                log.info({ phone: normalizedPhone }, 'SMS sent successfully');
                return true;
            } else {
                log.error({ phone: normalizedPhone, reason: result.message }, 'SMS send failed');
                return false;
            }
        } catch (error) {
            log.error({ phone: normalizedPhone, err: error }, 'SMS send error');
            return false;
        }
    }

    /**
     * Send absence notification SMS to parent(s).
     * Looks up parent phone from AdmissionData JSON fields.
     * Fire-and-forget — never blocks attendance marking.
     */
    async sendAbsenceNotification(
        studentId: number,
        subjectName: string,
        date: Date
    ): Promise<void> {
        try {
            // Get student profile with user info
            const studentProfile = await prisma.studentProfile.findUnique({
                where: { userId: studentId },
                include: {
                    user: { select: { name: true } },
                    admissionData: {
                        select: {
                            fatherDetails: true,
                            motherDetails: true,
                            mobileNumber: true,
                        },
                    },
                },
            });

            if (!studentProfile) {
                log.debug({ studentId }, 'No student profile found');
                return;
            }

            const studentName = studentProfile.user.name;
            const dateStr = date.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            });

            const message = `Dear Parent, your ward ${studentName} was marked ABSENT for ${subjectName} on ${dateStr}. Please contact the college for details. - Academic Operations`;

            // Collect parent phone numbers
            const parentPhones: string[] = [];

            // From admission data JSON fields
            if (studentProfile.admissionData) {
                const fatherDetails = studentProfile.admissionData.fatherDetails as { mobile?: string } | null;
                const motherDetails = studentProfile.admissionData.motherDetails as { mobile?: string } | null;

                if (fatherDetails?.mobile) parentPhones.push(fatherDetails.mobile);
                if (motherDetails?.mobile) parentPhones.push(motherDetails.mobile);
            }

            // Fallback: student's own mobile from admission data
            if (parentPhones.length === 0 && studentProfile.admissionData?.mobileNumber) {
                parentPhones.push(studentProfile.admissionData.mobileNumber);
            }

            if (parentPhones.length === 0) {
                log.debug({ studentId, studentName }, 'No parent phone found');
                return;
            }

            // Send to each parent phone (with dedup)
            for (const phone of parentPhones) {
                const dedupKey = `${phone}:${studentId}:${dateStr}:${subjectName}`;

                // Check dedup cache
                const lastSent = sentSmsCache.get(dedupKey);
                if (lastSent && Date.now() - lastSent < SMS_DEDUP_WINDOW_MS) {
                    log.debug({ phone, studentName, dateStr }, 'SMS dedup — already sent');
                    continue;
                }

                await this.sendSms(phone, message);
                sentSmsCache.set(dedupKey, Date.now());
            }

            // Periodic cache cleanup (every 1000 entries)
            if (sentSmsCache.size > 1000) {
                const cutoff = Date.now() - SMS_DEDUP_WINDOW_MS;
                for (const [key, timestamp] of sentSmsCache) {
                    if (timestamp < cutoff) sentSmsCache.delete(key);
                }
            }
        } catch (error) {
            // Never let SMS failures affect attendance marking
            log.error({ studentId, err: error }, 'Absence notification error');
        }
    }
}

export const smsService = new SmsService();
