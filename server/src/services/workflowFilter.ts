import { RawWorkflow, FilterConfig, FieldConfig, FieldFilter, FilterOperator } from '../types';

export function applyFilterConfig(
  workflows: RawWorkflow[],
  _filterConfig: FilterConfig
): RawWorkflow[] {
  // All supported filter fields are already sent as Skyvern API query params.
  // This hook is for any additional post-fetch filtering in the future.
  return workflows;
}

function matchesOperator(
  actual: unknown,
  operator: FilterOperator,
  expected: string | number | boolean
): boolean {
  if (actual === null || actual === undefined) return false;
  const actualStr = String(actual);
  const expectedStr = String(expected);
  switch (operator) {
    case 'eq':
      return actualStr === expectedStr;
    case 'neq':
      return actualStr !== expectedStr;
    case 'contains':
      return actualStr.includes(expectedStr);
    case 'startsWith':
      return actualStr.startsWith(expectedStr);
    default:
      return false;
  }
}

function getValueAtPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function setValueAtPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown
): void {
  if (segments.length === 0) return;
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!(seg in current) || typeof current[seg] !== 'object' || current[seg] === null || Array.isArray(current[seg])) {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function filterArray(
  items: unknown[],
  arrayPathDot: string,
  filters: FieldFilter[]
): unknown[] {
  const relevant = filters.filter((f) => f.field.startsWith(arrayPathDot + '.'));
  if (relevant.length === 0) return items;

  return items.filter((item) =>
    relevant.every((filter) => {
      const subPath = filter.field.slice(arrayPathDot.length + 1).split('.');
      const val = getValueAtPath(item, subPath);
      return matchesOperator(val, filter.operator, filter.value);
    })
  );
}

function extractIntoOutput(
  raw: Record<string, unknown>,
  segments: string[],
  output: Record<string, unknown>,
  filters: FieldFilter[],
  filteredArrayCache: Map<string, unknown[]>
): void {
  let current: unknown = raw;

  for (let i = 0; i < segments.length; i++) {
    if (current === null || current === undefined) return;

    if (Array.isArray(current)) {
      // We've hit an array mid-path. segments[i] is the leaf property to extract per element.
      const arrayPathSegments = segments.slice(0, i);
      const arrayPathDot = arrayPathSegments.join('.');
      const leafProp = segments[i];

      // Get or build the filtered array (cached for this workflow)
      if (!filteredArrayCache.has(arrayPathDot)) {
        filteredArrayCache.set(arrayPathDot, filterArray(current, arrayPathDot, filters));
      }
      const filteredItems = filteredArrayCache.get(arrayPathDot)!;

      // Get or create the output array at the same path
      let outArray = getValueAtPath(output, arrayPathSegments) as Record<string, unknown>[] | undefined;
      if (!Array.isArray(outArray)) {
        outArray = filteredItems.map(() => ({}));
        setValueAtPath(output, arrayPathSegments, outArray);
      }

      // Merge the leaf property into each output element
      outArray.forEach((outElem, idx) => {
        if (idx < filteredItems.length) {
          const rawElem = filteredItems[idx] as Record<string, unknown>;
          outElem[leafProp] = rawElem[leafProp];
        }
      });

      return;
    }

    // Not an array yet — step into the next segment
    current = (current as Record<string, unknown>)[segments[i]];
  }

  // No array encountered — set the scalar (or object/array leaf) value
  setValueAtPath(output, segments, current);
}

export function applyFieldConfig(
  workflows: RawWorkflow[],
  fieldConfig: FieldConfig
): Record<string, unknown>[] {
  return workflows.map((raw) => {
    const output: Record<string, unknown> = {};
    const filteredArrayCache = new Map<string, unknown[]>();

    for (const fieldPath of fieldConfig.fields) {
      const segments = fieldPath.split('.');
      extractIntoOutput(
        raw as unknown as Record<string, unknown>,
        segments,
        output,
        fieldConfig.filters,
        filteredArrayCache
      );
    }

    return output;
  });
}
