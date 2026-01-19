const childProcess = require('child_process');

// Returns 'Ubuntu', 'Debian', or null (for default)
// Decoupled from electron-main for testing
function parseWslListOutput(stdout) {
    if (!stdout) return null;
    
    // Normalize output: Remove null bytes/BOM
    const cleanOut = stdout.replace(/\0/g, '').replace(/^\uFEFF/, '');
    const lines = cleanOut.split(/[\r\n]+/).map(l => l.trim()).filter(l => l && !l.includes('Windows Subsystem') && !l.includes('There are no'));

    // Look for specific known valid distros
    let match = lines.find(l => l.toLowerCase().includes('ubuntu'));
    if (!match) match = lines.find(l => l.toLowerCase().includes('debian'));
    
    if (match) {
        // Take the first token as the distro name (safest against localization like "(Standard)")
        // e.g. "Ubuntu-24.04 (Default)" -> "Ubuntu-24.04"
        const parts = match.trim().split(/\s+/);
        return parts[0];
    }
    
    return null;
}

async function getPreferredWslDistro() {
    return new Promise((resolve) => {
        childProcess.execFile('wsl', ['--list'], { encoding: 'utf16le' }, (error, stdout) => {
            if (error) return resolve(null);
            const distro = parseWslListOutput(stdout);
            resolve(distro);
        });
    });
}

module.exports = { getPreferredWslDistro, parseWslListOutput };
