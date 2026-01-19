
import { parseWslListOutput } from '../../wsl-helper';

describe('WSL Distro Parsing Logic', () => {
    it('returns null for empty input', () => {
        expect(parseWslListOutput('')).toBeNull();
        expect(parseWslListOutput(null)).toBeNull();
    });

    it('identifies standard Ubuntu distro', () => {
        const output = `
Windows Subsystem for Linux Distributions:
Ubuntu (Default)
Docker-Desktop
        `;
        expect(parseWslListOutput(output)).toBe('Ubuntu');
    });

    it('identifies specific Ubuntu version', () => {
        const output = `
Windows Subsystem for Linux Distributions:
Ubuntu-22.04 (Default)
        `;
        expect(parseWslListOutput(output)).toBe('Ubuntu-22.04');
    });

    it('identifies non-default Ubuntu', () => {
        const output = `
Windows Subsystem for Linux Distributions:
Docker-Desktop (Default)
Ubuntu-20.04
        `;
        expect(parseWslListOutput(output)).toBe('Ubuntu-20.04');
    });

    it('handles localized outputs (German)', () => {
        const output = `
Windows Subsystem für Linux-Verteilungen:
Ubuntu-24.04 (Standard)
Debian`// Simulated output based on user's locale
        ;
        expect(parseWslListOutput(output)).toBe('Ubuntu-24.04');
    });

    it('handles French localization', () => {
         const output = `
Distributions du sous-système Windows pour Linux :
Ubuntu (par défaut)
        `;
        expect(parseWslListOutput(output)).toBe('Ubuntu');
    });

    it('prefers Ubuntu over Debian if both present', () => {
        const output = `
Ubuntu
Debian
        `;
        expect(parseWslListOutput(output)).toBe('Ubuntu');
    });

    it('falls back to Debian if Ubuntu missing', () => {
        const output = `
Debian (Default)
Docker-Desktop
        `;
        expect(parseWslListOutput(output)).toBe('Debian');
    });
});
