type HttpHeaders = Headers;
type HttpResponseInterceptor = (request: RequestInit, response: Response) => Promise<Response>;
type HttpRequestInterceptor = (url: RequestInfo | URL, request: RequestInit) => Promise<RequestInit>;
type HttpIntercept = {
   request: Set<HttpRequestInterceptor>;
   response: Set<HttpResponseInterceptor>;
};

class Http {
   public headers: HttpHeaders = new Headers();

   public intercept: HttpIntercept = {
      request: new Set<HttpRequestInterceptor>(),
      response: new Set<HttpResponseInterceptor>(),
   };

   public fetch: typeof globalThis.fetch = new Proxy(globalThis.fetch, {
      apply: async (target, _, args: Parameters<typeof globalThis.fetch>): Promise<Response> => {
         let request: RequestInit = args[1] ?? { method: "GET" };
         let requestUrl: RequestInfo | URL = args[0];

         let requestHeadersCustom: Headers = new Headers(request.headers);
         this.headers.forEach((value, key) => requestHeadersCustom.append(key, value));
         request.headers = requestHeadersCustom;

         for (let requestInterceptor of this.intercept.request) {
            request = await requestInterceptor(requestUrl, request);
         }

         let response = await target(requestUrl, request);

         for (let responseInterceptor of this.intercept.response) {
            response = await responseInterceptor(request, response);
         }

         return response;
      },
   });
}

export let http = new Http();
