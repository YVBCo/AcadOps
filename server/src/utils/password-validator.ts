/**
 * Password Strength Validator
 * Enforces strong password requirements for all password-setting operations.
 * Rules are stricter than Supabase Auth defaults.
 */
import { randomBytes } from 'crypto';

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

// Top 50 most common passwords (extended check)
const COMMON_PASSWORDS = new Set([
    'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', 'master',
    'dragon', '111111', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
    'letmein', 'football', 'shadow', 'michael', 'computer', 'superman',
    'admin', 'welcome', 'hello', 'charlie', 'donald', 'password1',
    'qwerty123', '123456789', '1234567890', 'password123', 'admin123',
    'root', 'toor', 'pass', 'test', 'guest', 'changeme', 'default',
    'user', 'login', 'student', 'teacher', 'academic', 'college',
    'university', 'school', 'education', '1q2w3e4r', 'qwertyuiop',
    'p@ssw0rd', 'passw0rd',
]);

/**
 * Validate password strength.
 * Rules:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 * - At least 1 special character
 * - Not a common password
 * - Not similar to email or name
 */
export function validatePassword(
    password: string,
    context?: { email?: string; name?: string }
): PasswordValidationResult {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
        errors.push('Password must be at most 128 characters long');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one digit');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    // Check against common passwords
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        errors.push('This password is too common. Please choose a more unique password');
    }

    // Check similarity to email/name
    if (context?.email) {
        const emailLocal = context.email.split('@')[0].toLowerCase();
        if (password.toLowerCase().includes(emailLocal) && emailLocal.length > 2) {
            errors.push('Password must not contain your email address');
        }
    }

    if (context?.name) {
        const nameLower = context.name.toLowerCase();
        if (nameLower.length > 2 && password.toLowerCase().includes(nameLower)) {
            errors.push('Password must not contain your name');
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Generate a cryptographically secure password that passes all validation rules.
 * Used when admin creates accounts and passwords are emailed.
 */
export function generateSecurePassword(length: number = 14): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed I, O to avoid confusion
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';   // Removed i, l, o
    const digits = '23456789';                      // Removed 0, 1 to avoid confusion
    const special = '!@#$%&*';
    const all = uppercase + lowercase + digits + special;

    // Cryptographically secure random index (imported at top of file)
    const getRandomChar = (charset: string) => {
        const index = randomBytes(1)[0] % charset.length;
        return charset[index];
    };

    // Ensure at least one of each category
    const required = [
        getRandomChar(uppercase),
        getRandomChar(lowercase),
        getRandomChar(digits),
        getRandomChar(special),
    ];

    // Fill remaining with random characters from all
    const remaining = Array.from({ length: length - required.length }, () =>
        getRandomChar(all)
    );

    // Fisher-Yates shuffle to avoid predictable positions
    const password = [...required, ...remaining];
    for (let i = password.length - 1; i > 0; i--) {
        const j = randomBytes(1)[0] % (i + 1);
        [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
}
