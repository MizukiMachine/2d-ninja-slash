import { Capacitor } from '@capacitor/core';
import { Client } from '@colyseus/sdk';

const DEFAULT_COLYSEUS_PORT = 2567;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

interface ColyseusEndpointOptions {
  readonly configuredUrl?: string;
  readonly hostname: string;
  readonly platform: string;
  readonly protocol: string;
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

function normalizeProtocol(protocol: string): 'http:' | 'https:' {
  return protocol === 'https:' ? 'https:' : 'http:';
}

export function resolveColyseusEndpoint({
  configuredUrl,
  hostname,
  platform,
  protocol
}: ColyseusEndpointOptions): string {
  const trimmedConfiguredUrl = configuredUrl?.trim();

  if (trimmedConfiguredUrl !== undefined && trimmedConfiguredUrl.length > 0) {
    return trimmedConfiguredUrl;
  }

  if (platform === 'android' && isLocalHostname(hostname)) {
    throw new Error(
      'Missing VITE_COLYSEUS_URL for Android. Use the android debug build scripts for emulator testing, or set VITE_COLYSEUS_URL to an HTTPS Colyseus endpoint for release builds.'
    );
  }

  if (isLocalHostname(hostname)) {
    return `http://localhost:${DEFAULT_COLYSEUS_PORT}`;
  }

  return `${normalizeProtocol(protocol)}//${hostname}:${DEFAULT_COLYSEUS_PORT}`;
}

export function getColyseusEndpoint(): string {
  const configuredUrl = import.meta.env.VITE_COLYSEUS_URL;
  const { hostname, protocol } = window.location;

  return resolveColyseusEndpoint({
    configuredUrl,
    hostname,
    platform: Capacitor.getPlatform(),
    protocol
  });
}

export function createColyseusClient(): Client {
  const endpoint = getColyseusEndpoint();
  const platform = Capacitor.getPlatform();

  console.info(
    `[ninja-slash:colyseus] endpoint=${endpoint} platform=${platform} location=${window.location.href}`,
    {
      endpoint,
      location: window.location.href,
      platform
    }
  );

  return new Client(endpoint);
}
