
import { formatBytes, formatDuration, parseSizeString, formatDate, getNextRunForRepo } from './formatters';
import { BackupJob } from '../types';

const createMockJob = (overrides: Partial<BackupJob>): BackupJob => ({
    id: 'job-1',
    repoId: 'repo-1',
    name: 'Test Job',
    sourcePath: '/path',
    archivePrefix: 'archive-',
    lastRun: '',
    status: 'idle',
    compression: 'auto',
    pruneEnabled: false,
    keepDaily: 7,
    keepWeekly: 4,
    keepMonthly: 12,
    keepYearly: 1,
    scheduleEnabled: false,
    scheduleType: 'manual',
    scheduleTime: '00:00',
    ...overrides
});

describe('formatters', () => {
    describe('parseSizeString', () => {
        it('parses valid strings correctly', () => {
            expect(parseSizeString('100 B')).toBe(100);
            expect(parseSizeString('1 KB')).toBe(1024);
            expect(parseSizeString('1.5 MB')).toBe(1.5 * 1024 * 1024);
            expect(parseSizeString('2 GB')).toBe(2 * 1024 * 1024 * 1024);
            expect(parseSizeString('1 TB')).toBe(1024 * 1024 * 1024 * 1024);
        });

        it('handles case insensitivity and whitespace', () => {
            expect(parseSizeString('100b')).toBe(100);
            expect(parseSizeString('  1 kb ')).toBe(1024);
        });

        it('returns 0 for invalid inputs', () => {
            expect(parseSizeString('')).toBe(0);
            expect(parseSizeString('Unknown')).toBe(0);
            expect(parseSizeString('invalid')).toBe(0);
        });
    });

    describe('formatBytes', () => {
        it('formats bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 B');
            expect(formatBytes(1024)).toBe('1 KB');
            expect(formatBytes(1024 * 1024)).toBe('1 MB');
            expect(formatBytes(123456789)).toBe('117.74 MB');
        });

        it('handles number variance', () => {
            expect(formatBytes(500)).toBe('500 B');
            expect(formatBytes(1500)).toBe('1.46 KB');
        });

        it('respects decimals argument', () => {
             expect(formatBytes(123456789, 0)).toBe('118 MB');
             expect(formatBytes(123456789, 3)).toBe('117.738 MB');
        })
    });

    describe('formatDate', () => {
        it('formats ISO strings correctly', () => {
            const date = new Date(2025, 0, 1, 12, 30, 0); // Jan 1 2025
            const iso = date.toISOString();
            
            const result = formatDate(iso);
            expect(result).toContain('2025');
        });

        it('returns original string on error', () => {
             expect(formatDate('invalid-date')).toBe('invalid-date');
        });
    });

    describe('formatDuration', () => {
        it('formats duration correctly', () => {
            expect(formatDuration(45)).toBe('45.0s');
            expect(formatDuration(60)).toBe('1m 0s');
            expect(formatDuration(3665)).toBe('61m 5s');
        });
    });

    describe('getNextRunForRepo', () => {
        const repoId = 'repo-1';

        it('returns null if no active jobs', () => {
            expect(getNextRunForRepo([], repoId)).toBeNull();
            const jobs: BackupJob[] = [
                createMockJob({ id: '1', repoId: 'repo-2', scheduleEnabled: true, scheduleType: 'hourly' }),
                createMockJob({ id: '2', repoId: repoId, scheduleEnabled: false, scheduleType: 'hourly' })
            ];
            expect(getNextRunForRepo(jobs, repoId)).toBeNull();
        });

        it('calculates hourly schedule', () => {
             const jobs: BackupJob[] = [
                createMockJob({ id: '1', repoId: repoId, scheduleEnabled: true, scheduleType: 'hourly' })
             ];
             const result = getNextRunForRepo(jobs, repoId);
             expect(result).not.toBeNull();
             expect(typeof result).toBe('string');
        });

        it('calculates daily schedule', () => {
            const jobs: BackupJob[] = [
                createMockJob({ id: '1', repoId: repoId, scheduleEnabled: true, scheduleType: 'daily', scheduleTime: '12:00' })
             ];
             const result = getNextRunForRepo(jobs, repoId);
             expect(result).not.toBeNull();
             expect(typeof result).toBe('string');
        });
    });
});
