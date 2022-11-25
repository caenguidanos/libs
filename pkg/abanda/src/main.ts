type HttpHeaders = Headers;

type HttpResponseInterceptor = (request: RequestInit, response: Response) => Promise<Response>;

type HttpRequestInterceptor = (url: RequestInfo | URL, request: RequestInit) => Promise<RequestInit>;

interface HttpIntercept {
   request: Set<HttpRequestInterceptor>;
   response: Set<HttpResponseInterceptor>;
};

class Http {
   public readonly headers: HttpHeaders = new Headers();
   
   public readonly intercept: HttpIntercept = {
      request: new Set<HttpRequestInterceptor>(),
      response: new Set<HttpResponseInterceptor>(),
   };

   public readonly fetch: typeof globalThis.fetch = new Proxy(globalThis.fetch, {
      apply: async (target, _, args: Parameters<typeof globalThis.fetch>): Promise<Response> => {
         let requestInfo: RequestInfo | URL = args[0];
         let requestInit: RequestInit = args[1] ?? {};
         let requestInitHeaders: Headers = new Headers(requestInit.headers);

         this.headers.forEach((value, key) => requestInitHeaders.append(key, value));
         requestInit.headers = requestInitHeaders;
         for (let requestInterceptor of this.intercept.request) {
            requestInit = await requestInterceptor(requestInfo, requestInit);
         }

         let response = await target(requestInfo, requestInit);
         for (let responseInterceptor of this.intercept.response) {
            response = await responseInterceptor(requestInit, response);
         }

         return response;
      },
   });
}

export let http = new Http();
