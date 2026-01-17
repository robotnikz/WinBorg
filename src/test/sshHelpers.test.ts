// @vitest-environment node



const {
    isHetznerStorageBoxTarget,
    extractRemoteUser,
    resolveSshKeyInstallOptions,
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
});
