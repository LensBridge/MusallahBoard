import { describe, expect, it } from 'vitest';
import { detectRuntime } from './runtime.js';

// The runtime decides where the board gets its identity and its content, so a
// hosted page mistaken for a local one would sit on "Waiting for content" and
// a local one mistaken for hosted would wait for an enrollment cookie forever.
describe('detectRuntime', () => {
  const at = (host, search = '') => detectRuntime({ host, search });

  it('is local when served by the agent', () => {
    expect(at('127.0.0.1:8080')).toBe('local');
    expect(at('localhost:8080')).toBe('local');
    expect(at('LOCALHOST:8080')).toBe('local');
  });

  it('is local when asked for, or for a v1 offline kiosk URL', () => {
    expect(at('board.example.org', '?runtime=local')).toBe('local');
    expect(at('localhost:3000', '?deviceId=x&mode=offline')).toBe('local');
  });

  it('is hosted otherwise', () => {
    expect(at('musallahboard.example.workers.dev')).toBe('hosted');
    expect(at('localhost:3000')).toBe('hosted');        // vite dev server
    expect(at('127.0.0.1:8081')).toBe('hosted');
    expect(at('board.example.org', '?mode=online')).toBe('hosted');
    expect(at('board.example.org', '?runtime=hosted')).toBe('hosted');
  });
});
