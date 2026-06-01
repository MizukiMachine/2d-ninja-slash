import { describe, expect, it } from 'vitest';
import { resolveColyseusEndpoint } from '../src/net/colyseusClient';

describe('resolveColyseusEndpoint', () => {
  it('uses the configured URL when provided', () => {
    expect(
      resolveColyseusEndpoint({
        configuredUrl: '  https://duel.example.test  ',
        hostname: 'localhost',
        platform: 'android',
        protocol: 'https:'
      })
    ).toBe('https://duel.example.test');
  });

  it('keeps browser localhost on the local Colyseus port', () => {
    expect(
      resolveColyseusEndpoint({
        hostname: 'localhost',
        platform: 'web',
        protocol: 'http:'
      })
    ).toBe('http://localhost:2567');
  });

  it('uses the configured Android emulator URL when provided', () => {
    expect(
      resolveColyseusEndpoint({
        configuredUrl: 'http://10.0.2.2:2567',
        hostname: 'localhost',
        platform: 'android',
        protocol: 'https:'
      })
    ).toBe('http://10.0.2.2:2567');
  });

  it('requires an explicit URL for Android local origins', () => {
    expect(() =>
      resolveColyseusEndpoint({
        hostname: 'localhost',
        platform: 'android',
        protocol: 'https:'
      })
    ).toThrow('Missing VITE_COLYSEUS_URL for Android');
  });

  it('preserves the page scheme for non-local hosts', () => {
    expect(
      resolveColyseusEndpoint({
        hostname: 'staging.example.test',
        platform: 'web',
        protocol: 'https:'
      })
    ).toBe('https://staging.example.test:2567');
  });
});
