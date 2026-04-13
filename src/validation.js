import path from 'node:path';

/** @param {string} name @param {string | undefined} value */
export function validateRequiredString(name, value) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

/** @param {string} rawPath */
export function ensureSafeStoragePath(rawPath) {
  if (rawPath.includes('..')) {
    throw new Error('Path traversal segments are not allowed in storage paths.');
  }
  return path.resolve(rawPath);
}

/** @param {string} identifier */
export function validateDbIdentifier(identifier) {
  if (!/^[a-zA-Z0-9_\-]+$/.test(identifier)) {
    throw new Error('Database identifiers can only contain letters, numbers, underscore, and hyphen.');
  }
  return identifier;
}
