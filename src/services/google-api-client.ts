import RetryableRequestError from './retryable-request-error';

interface RequestOptions {
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
}

const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;

// A rate limit fails instantly, so three tries are cheap. A timeout costs the
// full 15s, and a request Google never answers is unlikely to be answered on
// the third ask either, so it gets one retry rather than two.
const MAX_TIMEOUT_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 500;

// Rate limits and backend hiccups are routine on the Google APIs and recover on
// their own, so they are worth retrying. Anything else is our bug or the user's
// permissions, and retrying only makes the wait longer.
const isRetryableStatus = (status: number) => status === 429 || status >= 500;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default class GoogleApiClient {
  constructor(private baseUrl: string, private token: string) {}

  private async fetchWithTimeout(url: URL, options: RequestOptions) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      const text = await response.text();

      return { response, text };
    } catch (error) {
      // A hung request never resolves on its own, so an aborted attempt has to
      // surface as a real failure instead of leaving the caller waiting.
      const timedOut = controller.signal.aborted;
      const message = timedOut
        ? chrome.i18n.getMessage('requestTimeout')
        : (error as Error).message;

      throw new RetryableRequestError(message, timedOut);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async attempt<T>(url: URL, options: RequestOptions): Promise<T> {
    const { response, text } = await this.fetchWithTimeout(url, options);
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText;

      throw isRetryableStatus(response.status)
        ? new RetryableRequestError(message)
        : new Error(message);
    }

    return data as T;
  }

  async request<T>(path = '', options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    Object.entries(options.params || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    let lastError = new Error(chrome.i18n.getMessage('somethingWentWrong'));
    let timeouts = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.attempt<T>(url, options);
      } catch (error) {
        if (!(error instanceof RetryableRequestError)) {
          throw error;
        }

        lastError = error;

        if (error.timedOut) {
          timeouts += 1;

          if (timeouts >= MAX_TIMEOUT_ATTEMPTS) {
            throw error;
          }
        }
      }
    }

    throw lastError;
  }
}
