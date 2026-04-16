// @vitest-environment node



const {
    isHetznerStorageBoxTarget,
    extractRemoteUser,
    resolveSshKeyInstallOptions,
    normalizeSshKey,
} = require('../../main/sshHelpers');

describe('sshHelpers', () => {
    it('detects Hetzner storagebox targets', () => {
        expect(isHetznerStorageBoxTarget('u123@u123.your-storagebox.de')).toBe(true);
        expect(isHetznerStorageBoxTarget('user@example.com')).toBe(false);
    });

    it('extracts remote user from target', () => {
        expect(extractRemoteUser('root@host')).toBe('root');
        expect(extractRemoteUser('host')).toBe('');
    });

    it('forces port 23 for Hetzner when port missing or 22', () => {
        const t = 'u123@u123.your-storagebox.de';
        expect(resolveSshKeyInstallOptions(t, undefined)).toEqual({
            isHetzner: true,
            finalPort: '23',
            remoteUser: 'u123',
        });
        expect(resolveSshKeyInstallOptions(t, '22').finalPort).toBe('23');
    });

    it('keeps explicit port for Hetzner when provided', () => {
        const t = 'u123@u123.your-storagebox.de';
        expect(resolveSshKeyInstallOptions(t, '2200').finalPort).toBe('2200');
    });

    it('does not rewrite port for non-Hetzner targets', () => {
        const t = 'user@host';
        expect(resolveSshKeyInstallOptions(t, undefined)).toEqual({
            isHetzner: false,
            finalPort: undefined,
            remoteUser: 'user',
        });
    });

    describe('normalizeSshKey', () => {
        const PRIV_KEY_NO_NL =
            '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZ\n-----END OPENSSH PRIVATE KEY-----';
        const PRIV_KEY_WITH_NL = PRIV_KEY_NO_NL + '\n';

        it('appends trailing newline when missing', () => {
            expect(normalizeSshKey(PRIV_KEY_NO_NL)).toBe(PRIV_KEY_WITH_NL);
        });

        it('preserves existing trailing newline (no double newline)', () => {
            expect(normalizeSshKey(PRIV_KEY_WITH_NL)).toBe(PRIV_KEY_WITH_NL);
        });

        it('converts CRLF to LF', () => {
            const crlf = '-----BEGIN OPENSSH PRIVATE KEY-----\r\ndata\r\n-----END OPENSSH PRIVATE KEY-----\r\n';
            const result = normalizeSshKey(crlf);
            expect(result).not.toContain('\r');
            expect(result).toBe('-----BEGIN OPENSSH PRIVATE KEY-----\ndata\n-----END OPENSSH PRIVATE KEY-----\n');
        });

        it('converts standalone CR to LF', () => {
            const cr = 'line1\rline2\rline3';
            const result = normalizeSshKey(cr);
            expect(result).toBe('line1\nline2\nline3\n');
        });

        it('handles trimmed key (no trailing newline after trim)', () => {
            const trimmed = '-----BEGIN OPENSSH PRIVATE KEY-----\ndata\n-----END OPENSSH PRIVATE KEY-----'.trim();
            const result = normalizeSshKey(trimmed);
            expect(result.endsWith('\n')).toBe(true);
            expect(result.endsWith('\n\n')).toBe(false);
        });

        it('handles key with CRLF and no trailing newline', () => {
            const key = '-----BEGIN OPENSSH PRIVATE KEY-----\r\ndata\r\n-----END OPENSSH PRIVATE KEY-----';
            const result = normalizeSshKey(key);
            expect(result.endsWith('\n')).toBe(true);
            expect(result).not.toContain('\r');
        });
    });
});
