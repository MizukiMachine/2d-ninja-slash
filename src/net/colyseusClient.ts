import { Client } from '@colyseus/sdk';

const DEFAULT_COLYSEUS_PORT = 2567;

export function getColyseusEndpoint(): string {
  const configuredUrl = import.meta.env.VITE_COLYSEUS_URL;

  if (typeof configuredUrl === 'string' && configuredUrl.trim().length > 0) {
    return configuredUrl.trim();
  }

  const { hostname, protocol } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:${DEFAULT_COLYSEUS_PORT}`;
  }

  return `${protocol === 'https:' ? 'https:' : 'http:'}//${hostname}:${DEFAULT_COLYSEUS_PORT}`;
}

export function createColyseusClient(): Client {
  return new Client(getColyseusEndpoint());
}
