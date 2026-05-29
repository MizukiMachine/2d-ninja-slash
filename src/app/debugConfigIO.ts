export async function loadJsonConfig<T>(
  url: string,
  normalize: (value: unknown) => T
): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    return normalize(await response.json());
  } catch {
    return null;
  }
}

export async function saveJsonConfig(
  endpoint: string,
  payload: object
): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Save failed with ${response.status}`);
  }
}
