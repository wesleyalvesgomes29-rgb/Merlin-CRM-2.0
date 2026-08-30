/**
 * Merlin CRM - Standardized ID Generation Utilities
 * Provides resilient UUID v4 generation with browser/Node fallbacks.
 */

export function generateUUID(): string {
  // 1. Native Web Crypto API (crypto.randomUUID)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if blocked or in insecure context
    }
  }

  // 2. Cryptographically strong Uint8Array fallback (crypto.getRandomValues)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 Variant 10
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch {
      // Fallback to pseudo-random below
    }
  }

  // 3. Resilient pseudo-random fallback compliant with RFC4122 format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Standardized Prefixed ID Generators
 */
export function generateClientId(): string {
  return `c_${generateUUID()}`;
}

export function generateHistoryId(actionPrefix = 'h'): string {
  return `${actionPrefix}_${generateUUID()}`;
}

export function generateTaskId(): string {
  return `task_${generateUUID()}`;
}

export function generateSaleId(): string {
  return `sale_${generateUUID()}`;
}

export function generateTagId(): string {
  return `tag_${generateUUID()}`;
}

export function generateMemoryId(): string {
  return `mem_${generateUUID()}`;
}

export function generateDocumentId(): string {
  return `doc_${generateUUID()}`;
}
