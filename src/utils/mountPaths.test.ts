import { ALL_ARCHIVES_LABEL, getArchiveMountPath, getRepositoryMountPath } from './mountPaths';

describe('mountPaths', () => {
  it('keeps safe archive names unchanged', () => {
    expect(getArchiveMountPath('daily-2026-01-03')).toBe('/mnt/wsl/winborg/daily-2026-01-03');
    expect(getArchiveMountPath('host.2026_01')).toBe('/mnt/wsl/winborg/host.2026_01');
  });

  it('replaces unsafe characters in archive names', () => {
    expect(getArchiveMountPath('my archive (1)')).toBe('/mnt/wsl/winborg/my_archive__1_');
    expect(getArchiveMountPath('a/b"c;$(x)')).toBe('/mnt/wsl/winborg/a_b_c___x_');
  });

  it('never resolves to the mount root or its parent', () => {
    expect(getArchiveMountPath('.')).toBe('/mnt/wsl/winborg/_');
    expect(getArchiveMountPath('..')).toBe('/mnt/wsl/winborg/__');
  });

  it('builds a per-repository path for whole-repository mounts', () => {
    expect(getRepositoryMountPath({ id: 'r1', name: 'My Repo' })).toBe('/mnt/wsl/winborg/all-archives-My_Repo');
    expect(getRepositoryMountPath({ id: 'r1', name: 'nas/backup "main"' })).toBe(
      '/mnt/wsl/winborg/all-archives-nas_backup__main_'
    );
  });

  it('falls back to the repository id when the name has no usable characters', () => {
    expect(getRepositoryMountPath({ id: 'repo-42', name: '' })).toBe('/mnt/wsl/winborg/all-archives-repo-42');
    expect(getRepositoryMountPath({ id: 'repo-42', name: '...' })).toBe('/mnt/wsl/winborg/all-archives-repo-42');
    expect(getRepositoryMountPath({ id: '', name: '' })).toBe('/mnt/wsl/winborg/all-archives-repository');
  });

  it('keeps repository mounts apart from archive mounts', () => {
    expect(getRepositoryMountPath({ id: 'r1', name: 'daily' })).not.toBe(getArchiveMountPath('daily'));
  });

  it('exposes the display label for repository mounts', () => {
    expect(ALL_ARCHIVES_LABEL).toBe('All archives');
  });
});
