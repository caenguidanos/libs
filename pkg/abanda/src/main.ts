type HttpHeaders = Headers;

type HttpResponseInterceptor = (
  request: RequestInit,
  response: Response
) => Promise<Response>;

type HttpRequestInterceptor = (
  url: RequestInfo | URL,
  request: RequestInit
) => Promise<RequestInit>;

type HttpRouteInterceptor = (
  url: RequestInfo,
  request: RequestInit
) => Promise<Response>;

interface HttpIntercept {
  request: Set<HttpRequestInterceptor>;
  response: Set<HttpResponseInterceptor>;
  route: Map<RegExp, HttpRouteInterceptor>;
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : "/" + path;
  return b + p;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

class Http {
  public readonly headers: HttpHeaders = new Headers();
  public readonly blacklist = new Set<RequestInfo | URL>();
  public readonly intercept: HttpIntercept = {
    request: new Set<HttpRequestInterceptor>(),
    response: new Set<HttpResponseInterceptor>(),
    route: new Map<RegExp, HttpRouteInterceptor>(),
  };
	
  public base: string = "";

  public readonly fetch: typeof globalThis.fetch = new Proxy(
    globalThis.fetch,
    {
      apply: async (
        target,
        _,
        args: Parameters<typeof globalThis.fetch>
      ): Promise<Response> => {
        let requestInfo: Parameters<typeof globalThis.fetch>[0] = args[0];
        let requestInit: Parameters<typeof globalThis.fetch>[1] =
          args[1] ?? {};

        if (!requestInit.method) requestInit.method = "GET";

        const url = resolveUrl(requestInfo);
        if (this.base && !url.startsWith("http")) {
          requestInfo = joinUrl(this.base, url);
        }

        if (this.blacklist.has(requestInfo) || this.blacklist.has(url)) {
          requestInit.signal = this.abortedController.signal;
          return target(requestInfo, requestInit);
        }

        let requestInitHeaders = new Headers(requestInit.headers);
        this.headers.forEach((value, key) => {
          if (!requestInitHeaders.has(key)) {
            requestInitHeaders.set(key, value);
          }
        });
        requestInit.headers = requestInitHeaders;

        for (let requestInterceptor of this.intercept.request) {
          requestInit = await requestInterceptor(requestInfo, requestInit);
        }

        if (this.intercept.route.size) {
          const urlStr = resolveUrl(requestInfo);
          for (let [route, handler] of this.intercept.route.entries()) {
            if (route.test(urlStr)) {
              return handler(requestInfo, requestInit);
            }
          }
        }

        let response = await target(requestInfo, requestInit);

        for (let responseInterceptor of this.intercept.response) {
          response = await responseInterceptor(requestInit, response);
        }

        return response;
      },
    }
  );

  private readonly abortedController = new AbortController();

  constructor() {
    this.abortedController.abort();
  }
}

export let http = new Http();
