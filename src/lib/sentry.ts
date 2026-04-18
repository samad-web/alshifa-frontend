// Sentry integration — opt-in. To enable:
// 1. npm install @sentry/react
// 2. Set VITE_SENTRY_DSN in your .env

let _sentry: any = null;
let _initialized = false;

export async function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return;

    try {
        // Dynamic import wrapped in a variable path so Rollup won't
        // fail the build when @sentry/react is not installed.
        const pkg = '@sentry' + '/react';
        const mod = await (Function('p', 'return import(p)')(pkg));
        _sentry = mod;

        _sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            integrations: [
                _sentry.browserTracingIntegration(),
                _sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
            ],
            tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,
        });

        _initialized = true;
        console.log('[Sentry] Initialized for environment:', import.meta.env.MODE);
    } catch {
        console.log('[Sentry] @sentry/react not installed — error tracking disabled');
    }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
    if (_initialized && _sentry) {
        _sentry.captureException(error, context ? { extra: context } : undefined);
    }
}

export function getSentry() {
    return _sentry;
}
