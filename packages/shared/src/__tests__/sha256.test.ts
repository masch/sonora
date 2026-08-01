import { describe, it, expect } from 'vitest';
import { sha256 } from '../utils/sha256';

describe('sha256', () => {
  it('produces correct digest for known test vector', async () => {
    const digest = await sha256('test-device-123');
    expect(digest).toBe('a6896270a62b75eaa63ba4724c236adc366bd774d53a252437d0759ca314058b');
  });

  it('is deterministic — same input produces same output', async () => {
    const a = await sha256('hello');
    const b = await sha256('hello');
    expect(a).toBe(b);
  });

  it('produces different digests for different inputs', async () => {
    const a = await sha256('input-one');
    const b = await sha256('input-two');
    expect(a).not.toBe(b);
  });

  it('produces a 64-character lowercase hex digest', async () => {
    const digest = await sha256('anything');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles empty string', async () => {
    const digest = await sha256('');
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles Unicode / non-ASCII input', async () => {
    const digest = await sha256('ññoñó — 日本語 — 🌍');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
