import status from './status.json';
export type { BasecampState, Member, VoteState } from '../lib/basecamp-client';

/** A static host cannot authenticate students or save club records. */
export async function basecampRequest<T>(init?: RequestInit): Promise<T> {
  if (init?.method && init.method.toUpperCase() !== 'GET') {
    throw new Error('Registration, voting, and suggestions will open when the live club backend is connected.');
  }
  return structuredClone(status) as T;
}
