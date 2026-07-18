interface RequestOptions {
  method?: string;
  params?: Record<string, string>;
  body?: unknown;
}

export default class GoogleApiClient {
  constructor(private baseUrl: string, private token: string) {}

  async request<T>(path = '', options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    Object.entries(options.params || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || response.statusText);
    }

    return data as T;
  }
}
