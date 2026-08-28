import { ClientDocument } from './types';

const STORAGE_KEY = 'merlin_client_documents_v1';

export function getStoredDocuments(): ClientDocument[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse client documents from storage:', e);
    return [];
  }
}

export function saveStoredDocuments(docs: ClientDocument[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  }
}
