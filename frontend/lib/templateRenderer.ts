function getValueAtPath(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

function replacePlaceholders(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, path: string) => {
    const segments = path.trim().split('.');
    const value = getValueAtPath(context, segments);
    if (value === null || value === undefined) return '';
    return String(value);
  });
}

export function renderWorkflow(template: string, workflow: Record<string, unknown>): string {
  const eachBlockRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  const rendered = template.replace(eachBlockRegex, (_match, pathStr: string, innerTemplate: string) => {
    const segments = pathStr.trim().split('.');
    const items = getValueAtPath(workflow, segments);

    if (!Array.isArray(items)) return '';

    return items
      .map((item) => {
        const itemContext = typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>)
          : {};
        return replacePlaceholders(innerTemplate, itemContext);
      })
      .join('');
  });

  return replacePlaceholders(rendered, workflow);
}

export function renderAllWorkflows(
  template: string,
  workflows: Record<string, unknown>[]
): string {
  return workflows.map((w) => renderWorkflow(template, w)).join('');
}
