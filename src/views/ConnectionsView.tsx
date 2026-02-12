import React, { useEffect, useMemo, useState, useId } from 'react';
import { Check, Cloud, Copy, Key, Link2, Loader2, Pencil, Plus, RefreshCw, Server, Trash2, TriangleAlert, ArrowUp, ArrowDown, ArrowUpCircle, X } from 'lucide-react';
import Button from '../components/Button';
import { borgService } from '../services/borgService';
import { toast } from '../utils/eventBus';
import { SshConnection } from '../types';
import { getIpcRendererOrNull } from '../services/electron';

interface ConnectionsViewProps {
  connections: SshConnection[];
  onAddConnection: (conn: SshConnection) => void;
  onUpdateConnection: (conn: SshConnection) => void;
  onDeleteConnection: (id: string) => void;
  onReorderConnections: (next: SshConnection[]) => void;
}

function normalizeServerUrl(serverUrl: string) {
  const s = String(serverUrl || '').trim();
  if (!s) return '';
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

function fnv1a32(str: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function stableConnectionId(serverUrl: string) {
  const hash = fnv1a32(normalizeServerUrl(serverUrl)).toString(16).padStart(8, '0');
  return `conn_${hash}`;
}

function parseTargetAndPort(serverUrl: string): { target: string; port?: string } {
  const s = normalizeServerUrl(serverUrl);
  if (!s.toLowerCase().startsWith('ssh://')) return { target: s };

  const after = s.substring('ssh://'.length);
  // after = user@host:22
  const match = after.match(/^(?<target>[^/]+?)(?::(?<port>\d+))?$/);
  const target = match?.groups?.target || after;
  const port = match?.groups?.port;

  // target might still contain :port if weird input; strip once more
  const safeTarget = target.includes(':') ? target.split(':')[0] : target;
  return { target: safeTarget, port };
}

const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  connections,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
  onReorderConnections,
}) => {
  const importTitleId = useId();
  const importDescriptionId = useId();
  const deployTitleId = useId();
  const deployDescriptionId = useId();
  const createdTitleId = useId();
  const createdDescriptionId = useId();
  const [sshKeyStatus, setSshKeyStatus] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [sshPublicKey, setSshPublicKey] = useState<string>('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [importPublicKey, setImportPublicKey] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formServerUrl, setFormServerUrl] = useState('ssh://user@host:22');

  const [deployConn, setDeployConn] = useState<SshConnection | null>(null);
  const [deployPassword, setDeployPassword] = useState('');
  const [deployBusy, setDeployBusy] = useState(false);

  const [postCreateConn, setPostCreateConn] = useState<SshConnection | null>(null);
  const [hideCreatedModal, setHideCreatedModal] = useState<boolean>(() => {
    // Browser mode fallback
    try {
      return localStorage.getItem('winborg_hide_connection_created_modal') === 'true';
    } catch {
      return false;
    }
  });

  const [testBusyId, setTestBusyId] = useState<string | null>(null);

  const sortedConnections = useMemo(() => connections || [], [connections]);

  const loadKeyStatus = async () => {
    setSshKeyStatus('loading');
    try {
      const res = await borgService.manageSSHKey('check');
      if (res.exists) {
        setSshKeyStatus('found');
        const keyRes = await borgService.manageSSHKey('read');
        setSshPublicKey(keyRes.success ? String(keyRes.key || '') : '');
      } else {
        setSshKeyStatus('missing');
        setSshPublicKey('');
      }
    } catch {
      setSshKeyStatus('missing');
      setSshPublicKey('');
    }
  };

  useEffect(() => {
    loadKeyStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ipc = getIpcRendererOrNull();
    if (!ipc) return;
    ipc.invoke('get-db').then((db: any) => {
      const next = !!db?.settings?.hideConnectionCreatedModal;
      setHideCreatedModal(next);
      try {
        localStorage.setItem('winborg_hide_connection_created_modal', String(next));
      } catch {
        // ignore
      }
    });
  }, []);

  const persistHideCreatedModal = async (next: boolean) => {
    setHideCreatedModal(next);
    try {
      localStorage.setItem('winborg_hide_connection_created_modal', String(next));
    } catch {
      // ignore
    }
    const ipc = getIpcRendererOrNull();
    if (!ipc) return;
    try {
      await ipc.invoke('save-db', { settings: { hideConnectionCreatedModal: next } });
    } catch {
      // ignore
    }
  };

  const startAdd = () => {
    setIsEditing(true);
    setEditId(null);
    setFormName('');
    setFormServerUrl('ssh://user@host:22');
  };

  const startEdit = (conn: SshConnection) => {
    setIsEditing(true);
    setEditId(conn.id);
    setFormName(conn.name);
    setFormServerUrl(conn.serverUrl);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditId(null);
  };

  const saveConnection = () => {
    const serverUrl = normalizeServerUrl(formServerUrl);
    if (!serverUrl) {
      toast.error('Server URL is required');
      return;
    }
    if (!serverUrl.toLowerCase().startsWith('ssh://')) {
      toast.error('Server URL must start with ssh://');
      return;
    }

    const now = new Date().toISOString();
    const id = editId || stableConnectionId(serverUrl);

    const conn: SshConnection = {
      id,
      name: String(formName || '').trim() || serverUrl.replace(/^ssh:\/\//i, ''),
      serverUrl,
      updatedAt: now,
      ...(editId ? {} : { createdAt: now }),
    };

    if (editId) {
      onUpdateConnection(conn);
    } else {
      onAddConnection(conn);
      if (!hideCreatedModal) {
        setPostCreateConn(conn);
      }
    }

    setIsEditing(false);
    setEditId(null);
  };

  const moveConnection = (index: number, dir: -1 | 1) => {
    const next = [...sortedConnections];
    const targetIndex = index + dir;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    onReorderConnections(next);
  };

  const testConnection = async (conn: SshConnection) => {
    setTestBusyId(conn.id);
    try {
      const { target, port } = parseTargetAndPort(conn.serverUrl);
      const res = await borgService.testSshConnection(target, port);
      if (res.success) toast.success('SSH connection OK');
      else toast.error(res.error || 'SSH connection failed');
    } catch (e: any) {
      toast.error(e?.message || 'SSH connection failed');
    } finally {
      setTestBusyId(null);
    }
  };

  const openDeploy = (conn: SshConnection) => {
    setDeployConn(conn);
    setDeployPassword('');
  };

  const closeDeploy = () => {
    if (deployBusy) return;
    setDeployConn(null);
    setDeployPassword('');
  };

  const deployKey = async () => {
    if (!deployConn) return;
    if (!deployPassword) return;

    setDeployBusy(true);
    const toastId = toast.show('Deploying SSH key...', 'loading', 0);

    try {
      const { target, port } = parseTargetAndPort(deployConn.serverUrl);
      const res = await borgService.installSSHKey(target, deployPassword, port);
      toast.dismiss(toastId);
      if (res.success) {
        toast.success('SSH key deployed');
        setDeployConn(null);
        setDeployPassword('');
      } else {
        toast.error(res.error || 'Failed to deploy key');
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'Failed to deploy key');
    } finally {
      setDeployBusy(false);
    }
  };

  const generateKey = async () => {
    if (!window.confirm("This will overwrite any existing 'id_ed25519' key in your WSL distribution. Continue?")) return;
    setIsGeneratingKey(true);
    try {
      const res = await borgService.manageSSHKey('generate');
      if (res.success) {
        toast.success('SSH key generated');
        await loadKeyStatus();
      } else {
        toast.error('SSH key generation failed');
      }
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const openImport = () => {
    setImportPrivateKey('');
    setImportPublicKey('');
    setImportOpen(true);
  };

  const closeImport = () => {
    if (importBusy) return;
    setImportOpen(false);
  };

  const importKey = async () => {
    const priv = String(importPrivateKey || '').trim();
    const pub = String(importPublicKey || '').trim();

    if (!priv) {
      toast.error('Private key is required');
      return;
    }

    // Soft validation (do not block other valid formats)
    if (!/BEGIN [A-Z0-9 ]+PRIVATE KEY/.test(priv) && !priv.startsWith('ssh-')) {
      toast.info('Key format looks unusual; trying import anyway.');
    }

    setImportBusy(true);
    const toastId = toast.show('Importing SSH key...', 'loading', 0);
    try {
      const res = await borgService.manageSSHKey('import', 'ed25519', {
        privateKey: priv,
        ...(pub ? { publicKey: pub } : {}),
      });
      toast.dismiss(toastId);
      if (res.success) {
        toast.success('SSH key imported');
        setImportOpen(false);
        await loadKeyStatus();
      } else {
        toast.error(res.error || 'SSH key import failed');
      }
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e?.message || 'SSH key import failed');
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-blue-400" />
            Connections
          </h2>
          <p className="text-sm text-slate-400">Manage SSH connections used when adding/editing repositories.</p>
        </div>
        <Button onClick={startAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Connection
        </Button>
      </div>

      {/* SSH key section */}
      <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-200">
            <Key className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">SSH Key (WSL)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={loadKeyStatus}>
              <RefreshCw className="w-3 h-3 mr-2" /> Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={openImport}>
              <ArrowUpCircle className="w-3 h-3 mr-2" /> Import
            </Button>
            <Button size="sm" onClick={generateKey} disabled={isGeneratingKey}>
              {isGeneratingKey ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-2" />}
              Generate
            </Button>
          </div>
        </div>

        {sshKeyStatus === 'loading' && (
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking SSH key...
          </div>
        )}

        {sshKeyStatus === 'missing' && (
          <div className="text-sm text-amber-200 bg-amber-900/20 border border-amber-900/30 rounded-lg p-3 flex items-start gap-2">
            <TriangleAlert className="w-4 h-4 mt-0.5" />
            <div>
              <div className="font-semibold">No SSH key found</div>
              <div className="text-xs opacity-90">Generate a key first, then deploy it to your servers per connection.</div>
            </div>
          </div>
        )}

        {sshKeyStatus === 'found' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Public key:</div>
            <div className="relative group">
              <textarea
                readOnly
                value={sshPublicKey}
                className="w-full h-20 p-2 text-[10px] font-mono bg-black/40 border border-white/10 rounded resize-none focus:outline-none text-slate-200"
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sshPublicKey);
                    toast.success('Copied');
                  }}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-slate-200"
                  title="Copy"
                  aria-label="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-500">Key is stored inside WSL under ~/.ssh/id_ed25519</div>
          </div>
        )}
      </div>

      {/* Import SSH Key modal */}
      {importOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeImport();
          }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby={importTitleId}
            aria-describedby={importDescriptionId}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 id={importTitleId} className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" /> Import SSH Key
              </h3>
              {!importBusy && (
                <button onClick={closeImport} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close" title="Close">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div id={importDescriptionId} className="text-sm text-slate-600 dark:text-slate-300">
                Paste your private key (OpenSSH PEM). WinBorg will store it inside WSL under <code>~/.ssh/id_ed25519</code> and derive <code>.pub</code> if needed.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Private key</label>
                <textarea
                  aria-label="Private key"
                  value={importPrivateKey}
                  onChange={(e) => setImportPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
                  className="w-full h-40 p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono text-slate-900 dark:text-gray-100"
                  disabled={importBusy}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Public key (optional)</label>
                <textarea
                  aria-label="Public key"
                  value={importPublicKey}
                  onChange={(e) => setImportPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA... comment"
                  className="w-full h-16 p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono text-slate-900 dark:text-gray-100"
                  disabled={importBusy}
                />
                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  Leave empty to auto-generate via <code>ssh-keygen -y</code>.
                </div>
              </div>

              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 flex items-start gap-2">
                <TriangleAlert className="w-4 h-4 mt-0.5" />
                <div>
                  Importing a private key is sensitive. Only do this on a trusted machine.
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700">
              <Button variant="ghost" size="sm" onClick={closeImport} disabled={importBusy}>Cancel</Button>
              <Button size="sm" onClick={importKey} disabled={importBusy || !String(importPrivateKey || '').trim()}>
                {importBusy ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ArrowUpCircle className="w-3 h-3 mr-2" />}
                {importBusy ? 'Importing...' : 'Import Key'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit panel */}
      {isEditing && (
        <div className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-200 font-semibold">{editId ? 'Edit Connection' : 'New Connection'}</div>
            <button onClick={cancelEdit} className="text-slate-400 hover:text-white" aria-label="Close" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Name</label>
              <input
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-white"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Hetzner StorageBox"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Server URL</label>
              <input
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-mono text-white"
                value={formServerUrl}
                onChange={(e) => setFormServerUrl(e.target.value)}
                placeholder="ssh://user@host:22"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
            <Button onClick={saveConnection}>{editId ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      )}

      {/* Connections list */}
      <div className="space-y-3">
        {sortedConnections.length === 0 ? (
          <div className="bg-gray-800/30 p-6 rounded-xl border border-white/5 text-slate-300">
            <div className="font-semibold mb-1">No connections yet</div>
            <div className="text-sm text-slate-400">Add a connection to select it when creating repositories.</div>
          </div>
        ) : (
          sortedConnections.map((c, idx) => (
            <div key={c.id} className="bg-gray-800/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 font-mono break-all">{c.serverUrl}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => moveConnection(idx, -1)}
                    disabled={idx === 0}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40"
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-200" />
                  </button>
                  <button
                    onClick={() => moveConnection(idx, 1)}
                    disabled={idx === sortedConnections.length - 1}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40"
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-200" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(() => {
                  const keyMissing = sshKeyStatus !== 'found';
                  const disabledReason = keyMissing ? 'Generate an SSH key first' : undefined;
                  return (
                    <>
                      <span title={disabledReason} className="inline-flex">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => testConnection(c)}
                          disabled={keyMissing || testBusyId === c.id}
                        >
                          {testBusyId === c.id ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Check className="w-3 h-3 mr-2" />}
                          Test SSH
                        </Button>
                      </span>

                      <span title={disabledReason} className="inline-flex">
                        <Button size="sm" variant="secondary" onClick={() => openDeploy(c)} disabled={keyMissing}>
                          <Server className="w-3 h-3 mr-2" /> Deploy Key
                        </Button>
                      </span>
                    </>
                  );
                })()}

                <Button size="sm" variant="secondary" onClick={() => startEdit(c)}>
                  <Pencil className="w-3 h-3 mr-2" /> Edit
                </Button>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm(`Delete connection '${c.name}'?`)) return;
                    onDeleteConnection(c.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </Button>
              </div>

              <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-2">
                <Cloud className="w-3 h-3" /> BorgBackup deployment remains in the repository setup flow.
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deploy modal */}
      {deployConn && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            closeDeploy();
          }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby={deployTitleId}
            aria-describedby={deployDescriptionId}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 id={deployTitleId} className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-500" /> Deploy SSH Key
              </h3>
              {!deployBusy && (
                <button onClick={closeDeploy} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close" title="Close">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-3">
              <div id={deployDescriptionId} className="text-sm text-slate-600 dark:text-slate-300">
                Enter the password for <strong>{deployConn.name}</strong> to install the public key.
              </div>

              <input
                type="password"
                autoFocus
                placeholder="Server Password"
                className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition-all text-slate-900 dark:text-gray-100"
                value={deployPassword}
                onChange={(e) => setDeployPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deployPassword && !deployBusy) deployKey();
                }}
                disabled={deployBusy}
              />
            </div>

            <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700">
              <Button variant="ghost" size="sm" onClick={closeDeploy} disabled={deployBusy}>
                Cancel
              </Button>
              <Button size="sm" disabled={!deployPassword || deployBusy} onClick={deployKey}>
                {deployBusy ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Server className="w-3 h-3 mr-2" />}
                {deployBusy ? 'Deploying...' : 'Deploy Key'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Post-create actions modal */}
      {postCreateConn && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (testBusyId) return;
            setPostCreateConn(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-600 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby={createdTitleId}
            aria-describedby={createdDescriptionId}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <h3 id={createdTitleId} className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" /> Connection created
              </h3>
              {!testBusyId && (
                <button
                  onClick={() => setPostCreateConn(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div id={createdDescriptionId} className="text-sm text-slate-600 dark:text-slate-300">
                Next steps for <strong>{postCreateConn.name}</strong>:
              </div>

              {sshKeyStatus !== 'found' && (
                <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3">
                  No SSH key found yet. Generate one above before deploying.
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end">
                {sshKeyStatus !== 'found' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await generateKey();
                    }}
                    disabled={isGeneratingKey}
                  >
                    {isGeneratingKey ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Key className="w-3 h-3 mr-2" />}
                    Generate Key
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => testConnection(postCreateConn)}
                  disabled={testBusyId === postCreateConn.id}
                >
                  {testBusyId === postCreateConn.id ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Check className="w-3 h-3 mr-2" />}
                  Test SSH
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    const c = postCreateConn;
                    setPostCreateConn(null);
                    openDeploy(c);
                  }}
                  disabled={sshKeyStatus !== 'found'}
                  title={sshKeyStatus !== 'found' ? 'Generate an SSH key first' : undefined}
                >
                  <Server className="w-3 h-3 mr-2" /> Deploy Key
                </Button>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={hideCreatedModal}
                  onChange={(e) => persistHideCreatedModal(e.target.checked)}
                />
                Don’t show this again
              </label>
            </div>

            <div className="p-4 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-700">
              <Button variant="ghost" size="sm" onClick={() => setPostCreateConn(null)} disabled={testBusyId === postCreateConn.id}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsView;
