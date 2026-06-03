export const ANDROID_CAPACITOR_ORIGIN = 'https://localhost';

export interface CorsOriginConfigInput {
  readonly clientOrigin?: string;
  readonly corsOrigin?: string;
}

export interface CorsOriginConfig {
  readonly allowAll: boolean;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly configuredOrigins: readonly string[];
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

function parseOriginList(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map(normalizeOrigin)
      .filter((origin) => origin.length > 0) ?? []
  );
}

export function createCorsOriginConfig({
  clientOrigin,
  corsOrigin
}: CorsOriginConfigInput = {}): CorsOriginConfig {
  const configuredOriginValue =
    clientOrigin !== undefined && clientOrigin.trim().length > 0
      ? clientOrigin
      : corsOrigin;
  const configuredOrigins = parseOriginList(configuredOriginValue);
  const allowAll =
    configuredOrigins.length === 0 || configuredOrigins.includes('*');

  return {
    allowAll,
    allowedOrigins: allowAll
      ? new Set()
      : new Set([...configuredOrigins, ANDROID_CAPACITOR_ORIGIN]),
    configuredOrigins: configuredOrigins.filter((origin) => origin !== '*')
  };
}

export function resolveCorsAllowOrigin(
  config: CorsOriginConfig,
  requestOrigin: string | undefined
): string | null {
  if (config.allowAll) {
    return '*';
  }

  if (requestOrigin === undefined) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);

  return config.allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : null;
}

export function resolveCorsHeaderOrigin(
  config: CorsOriginConfig,
  requestOrigin: string | undefined
): string {
  return resolveCorsAllowOrigin(config, requestOrigin) ?? 'null';
}
