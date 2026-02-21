export function resolveDotPath(obj: unknown, path: string): unknown {
  if (!path.trim()) return undefined;
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc === null || acc === undefined) return undefined;
    if (typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
