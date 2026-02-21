function getValueAtPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function replacePlaceholders(template: string, context: Record<string, unknown>): string {
  return template.replaceAll(/\{([^{}]+)\}/g, (_match: string, path: string) => {
    const segments = path.trim().split('.');
    const value = getValueAtPath(context, segments);
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
    return String(value);
  });
}

export function renderWorkflow(template: string, workflow: Record<string, unknown>): string {
  const eachBlockRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  const rendered = template.replaceAll(
    eachBlockRegex,
    (_match: string, pathStr: string, innerTemplate: string) => {
      const segments = pathStr.trim().split('.');
      const items = getValueAtPath(workflow, segments);
      if (!Array.isArray(items)) return '';
      return items
        .map((item) => {
          const ctx =
            typeof item === 'object' && item !== null
              ? (item as Record<string, unknown>)
              : {};
          return replacePlaceholders(innerTemplate, ctx);
        })
        .join('');
    }
  );

  return replacePlaceholders(rendered, workflow);
}

export function renderAllWorkflows(
  template: string,
  workflows: Record<string, unknown>[]
): string {
  return workflows.map((w) => renderWorkflow(template, w)).join('');
}
