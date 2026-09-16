import { describe, expect, it, vi } from 'vitest';
import {
  installStaleBundleRecovery,
  recoverFromStaleBundle,
} from './staleBundleRecovery';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('stale bundle recovery', () => {
  it('reloads once when a deployed lazy chunk is no longer available', () => {
    const reload = vi.fn();
    const storage = createMemoryStorage();
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://www.pelegrini.t2a.ia.br/assets/ComissaoPage-old.js',
    );

    expect(recoverFromStaleBundle(error, { reload, storage })).toBe(true);
    expect(recoverFromStaleBundle(error, { reload, storage })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload for an unrelated rendering error', () => {
    const reload = vi.fn();

    expect(
      recoverFromStaleBundle(new Error('Falha ao calcular comissao'), {
        reload,
        storage: createMemoryStorage(),
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('handles the Vite preload error before it reaches the screen boundary', () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const event = new Event('vite:preloadError', { cancelable: true }) as Event & {
      payload: unknown;
    };
    event.payload = new TypeError('Importing a module script failed');

    const removeListener = installStaleBundleRecovery(target, {
      reload,
      storage: createMemoryStorage(),
    });
    target.dispatchEvent(event);
    removeListener();

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
