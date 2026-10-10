import { describe, expect, it } from 'vitest';
import { createAdmissionSchema } from './admissions.routes.js';

describe('admission creation validation', () => {
    it('accepts browser string years, blank optional email, and configured education fields', () => {
        const payload = {
            applicantName: 'QA Admission Validation',
            admissionYear: '2026',
            emailId: '',
            schoolName: 'Lions',
            percentage: '80',
            yearOfPassing: '2010',
            sslcDetails: { schoolName: 'Lions', percentage: '80', yearOfPassing: '2010' },
            pucDetails: { registerNo: 'QA-PUC-4656466', collegeName: 'Lions', percentage: '80' },
            formData: {
                schoolName: 'Lions',
                percentage: '80',
                yearOfPassing: '2010',
                pucRegisterNo: 'QA-PUC-4656466',
            },
        };

        const parsed = createAdmissionSchema.parse(payload);

        expect(parsed.admissionYear).toBe(2026);
        expect(parsed.emailId).toBe('');
        expect(parsed.schoolName).toBe('Lions');
        expect(parsed.formData).toEqual(payload.formData);
        expect(parsed.pucDetails).toEqual(payload.pucDetails);
    });
});
