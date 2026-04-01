import { ValidationError } from '../types/errors.js';

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        result[key] = [...new Set([...targetValue, ...sourceValue])];
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeDependencies(
  target: Record<string, string>,
  source: Record<string, string>
): Record<string, string> {
  const result = { ...target };

  for (const [pkg, version] of Object.entries(source)) {
    if (result[pkg] && result[pkg] !== version) {
      throw new ValidationError(
        `Dependency conflict: ${pkg} is already defined with version ${result[pkg]}, trying to add ${version}`
      );
    }
    result[pkg] = version;
  }

  return result;
}

export function mergeScripts(
  target: Record<string, string>,
  source: Record<string, string>
): Record<string, string> {
  const result = { ...target };

  for (const [name, script] of Object.entries(source)) {
    if (result[name] && result[name] !== script) {
      // Append to existing script
      result[name] = `${result[name]} && ${script}`;
    } else {
      result[name] = script;
    }
  }

  return result;
}
