export interface DiffResult<T> {
  toAdd: T[];
  toRemove: T[];
}

export function arrayDiff<T>(
  current: T[],
  target: T[],
  keyExtractor: (item: T) => string
): DiffResult<T> {
  const currentKeys = new Set(current.map(keyExtractor));
  const targetKeys = new Set(target.map(keyExtractor));

  const toAdd = target.filter((item) => !currentKeys.has(keyExtractor(item)));
  const toRemove = current.filter((item) => !targetKeys.has(keyExtractor(item)));

  return { toAdd, toRemove };
}
