interface StaleBundleRecoveryOptions {
  reload: () => void;
  storage: Storage;
}

const STALE_BUNDLE_RELOAD_PREFIX = 'pelegrini:stale-bundle-reload:';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}

function isStaleBundleError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    (message.includes('loading chunk') && message.includes('failed'))
  );
}

export function installStaleBundleRecovery(
  target: EventTarget,
  options: StaleBundleRecoveryOptions,
): () => void {
  const handlePreloadError = (event: Event) => {
    const preloadError = event as Event & { payload?: unknown };

    if (recoverFromStaleBundle(preloadError.payload, options)) {
      event.preventDefault();
    }
  };

  target.addEventListener('vite:preloadError', handlePreloadError);
  return () => target.removeEventListener('vite:preloadError', handlePreloadError);
}

export function recoverFromStaleBundle(
  error: unknown,
  { reload, storage }: StaleBundleRecoveryOptions,
): boolean {
  if (!isStaleBundleError(error)) return false;

  const message = getErrorMessage(error);
  const reloadKey = `${STALE_BUNDLE_RELOAD_PREFIX}${message.slice(0, 240)}`;

  try {
    if (storage.getItem(reloadKey)) return false;
    storage.setItem(reloadKey, '1');
  } catch {
    return false;
  }

  reload();
  return true;
}
