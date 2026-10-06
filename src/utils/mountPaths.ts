// WSL mount points used by the Mounts view. Names are reduced to a safe character set,
// so the path can be shown, created and opened without quoting issues.

const WSL_MOUNT_ROOT = '/mnt/wsl/winborg';

export const ALL_ARCHIVES_LABEL = 'All archives';

function toSafeSegment(value: string): string {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  // "." and ".." would point at the mount root or its parent.
  return cleaned === '.' || cleaned === '..' ? cleaned.replace(/\./g, '_') : cleaned;
}

/** Mount point for a single archive, e.g. /mnt/wsl/winborg/daily-2026-01-03 */
export function getArchiveMountPath(archiveName: string): string {
  return `${WSL_MOUNT_ROOT}/${toSafeSegment(archiveName)}`;
}

/** Mount point for a whole repository (all archives), e.g. /mnt/wsl/winborg/all-archives-My_Repo */
export function getRepositoryMountPath(repo: { id: string; name?: string }): string {
  const repoPart = toSafeSegment(repo.name || '').replace(/^[._-]+/, '') || toSafeSegment(repo.id) || 'repository';
  return `${WSL_MOUNT_ROOT}/all-archives-${repoPart}`;
}
