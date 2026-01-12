import { spawn } from 'node:child_process';
import net from 'node:net';

const preferredPort = Number(process.env.PORT || process.env.VITE_PORT || 5174);

const npmCmd = 'npm';
const npxCmd = 'npx';

function tryListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', (err) => resolve({ ok: false, err }));
    server.listen({ port, host }, () => {
      server.close(() => resolve({ ok: true }));
    });
  });
}

async function isPortFree(port) {
  // Vite defaults to binding on "localhost", which may resolve to IPv4 or IPv6.
  // So we must ensure the port is free on both loopback families.
  const v4 = await tryListen(port, '127.0.0.1');
  if (!v4.ok) return false;

  const v6 = await tryListen(port, '::1');
  if (!v6.ok) {
    const code = v6.err?.code;
    // If IPv6 isn't available, ignore and rely on IPv4 loopback.
    if (code === 'EADDRNOTAVAIL' || code === 'EAFNOSUPPORT') return true;
    return false;
  }

  return true;
}

async function findFreePort(startPort, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    const port = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + attempts - 1}`);
}

function quoteWindowsArg(arg) {
  if (arg === '') return '""';
  // Minimal safe quoting for cmd.exe
  if (!/[\s"^&|<>]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function run(cmd, args, options = {}) {
  const baseOptions = {
    stdio: 'inherit',
    ...options,
  };

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const commandLine = [cmd, ...args].map(quoteWindowsArg).join(' ');
    return spawn(comspec, ['/d', '/s', '/c', commandLine], baseOptions);
  }

  return spawn(cmd, args, baseOptions);
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const port = await findFreePort(preferredPort);
const devUrl = `http://localhost:${port}`;

console.log(`[dev-electron] Starting Vite on ${devUrl}`);
const vite = run(npmCmd, ['run', 'dev', '--', '--port', String(port), '--strictPort']);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try { vite.kill(); } catch {}
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

await waitForHttp(devUrl, 60_000);

console.log('[dev-electron] Starting Electron...');
const electron = run(npxCmd, ['electron', '.'], {
  env: { ...process.env, VITE_DEV_SERVER_URL: devUrl },
});

electron.on('exit', (code) => shutdown(code ?? 0));
vite.on('exit', (code) => {
  if (!shuttingDown && code && code !== 0) shutdown(code);
});
