export async function readJsonOrFallback<T>(response: Response, fallback: T): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const trimmed = text.trimStart();

  if (!contentType.toLowerCase().includes('application/json') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return fallback;
  }

  if (!trimmed) return fallback;

  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
