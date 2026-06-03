import { describe, expect, it } from 'vitest';
import {
  ANDROID_CAPACITOR_ORIGIN,
  createCorsOriginConfig,
  resolveCorsAllowOrigin,
  resolveCorsHeaderOrigin
} from '../server/cors';

describe('server CORS origin handling', () => {
  it('allows the configured web origin and Android Capacitor origin', () => {
    const config = createCorsOriginConfig({
      clientOrigin: 'https://gekka-no-shinobi.vercel.app'
    });

    expect(
      resolveCorsAllowOrigin(config, 'https://gekka-no-shinobi.vercel.app')
    ).toBe('https://gekka-no-shinobi.vercel.app');
    expect(resolveCorsAllowOrigin(config, ANDROID_CAPACITOR_ORIGIN)).toBe(
      ANDROID_CAPACITOR_ORIGIN
    );
    expect(resolveCorsAllowOrigin(config, 'https://example.invalid')).toBeNull();
    expect(resolveCorsHeaderOrigin(config, 'https://example.invalid')).toBe(
      'null'
    );
  });

  it('supports comma-separated origin env values', () => {
    const config = createCorsOriginConfig({
      clientOrigin:
        ' https://gekka-no-shinobi.vercel.app/, https://2d-ninja-slash.vercel.app '
    });

    expect(
      resolveCorsAllowOrigin(config, 'https://2d-ninja-slash.vercel.app')
    ).toBe('https://2d-ninja-slash.vercel.app');
  });

  it('keeps CLIENT_ORIGIN precedence over CORS_ORIGIN', () => {
    const config = createCorsOriginConfig({
      clientOrigin: 'https://gekka-no-shinobi.vercel.app',
      corsOrigin: '*'
    });

    expect(
      resolveCorsAllowOrigin(config, 'https://gekka-no-shinobi.vercel.app')
    ).toBe('https://gekka-no-shinobi.vercel.app');
    expect(resolveCorsAllowOrigin(config, 'https://example.invalid')).toBeNull();
  });

  it('allows every origin when no origin env is configured', () => {
    const config = createCorsOriginConfig();

    expect(resolveCorsAllowOrigin(config, 'https://example.invalid')).toBe('*');
  });
});
