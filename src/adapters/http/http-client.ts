import { RateLimiter, type Clock, systemClock } from "./rate-limiter";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  userAgent: string;
  minIntervalMs: number;
  fetchFn?: FetchFn;
  clock?: Clock;
  accept?: string;
}

/** No se pudo conectar (DNS, proxy, red caída…). */
export class NetworkError extends Error {
  constructor(
    readonly url: string,
    cause: unknown,
  ) {
    const detail =
      cause instanceof Error
        ? cause.cause instanceof Error
          ? cause.cause.message
          : cause.message
        : String(cause);
    super(`No se pudo conectar con ${url}: ${detail}`);
  }
}

export class HttpError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} al pedir ${url}`);
  }
}

/** fetch con User-Agent identificable y rate limiting. Un cliente por servicio externo. */
export class HttpClient {
  private readonly limiter: RateLimiter;
  private readonly fetchFn: FetchFn;

  constructor(private readonly opts: HttpClientOptions) {
    this.limiter = new RateLimiter(opts.minIntervalMs, opts.clock ?? systemClock);
    this.fetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  }

  /** GET que lanza `HttpError` si la respuesta no es 2xx. */
  async get(url: string): Promise<Response> {
    const res = await this.limiter.schedule(async () => {
      try {
        return await this.fetchFn(url, {
          headers: {
            "User-Agent": this.opts.userAgent,
            Accept: this.opts.accept ?? "application/json;q=0.9,*/*;q=0.8",
          },
        });
      } catch (err) {
        throw new NetworkError(url, err);
      }
    });
    if (!res.ok) throw new HttpError(url, res.status);
    return res;
  }

  async getJson(url: string): Promise<unknown> {
    return (await this.get(url)).json();
  }
}
