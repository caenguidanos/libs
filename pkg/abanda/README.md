# Abanda

Minimal **HTTP** utility class **web compliance** (407 bytes).

### Install

```bash
npm i abanda
```

### Use

```ts
import { http } from "abanda";

/*
 * Set global headers
 */
http.headers.set("authorization", "Bearer <TOKEN>");
http.headers.set("x-target", "A");

/*
 * Intercept requests
 */
http.intercept.request.add((url, request): Promise<RequestInit> => {
   let headers = request.headers as Headers;

   headers.forEach((value, key) => {
      console.log([url, { [key]: value }]);
   });

   return Promise.resolve(request);
});

/*
 * Intercept responses
 */
http.intercept.response.add(async (request, response): Promise<Response> => {
   let out: Response = response;

   if (response.status === 403) {
      let ok = response.ok;
      let retries = 1;

      /*
       * Use vanilla fetch inside retries !!
       */
      while (retries < 5 || ok) {
         let r = await fetch(response.url, request);
         ok = r.ok;
         out = r;
         retries++;
      }
   }

   return out;
});

/*
 * Multiple times
 */
http.intercept.response.add(async (request, response): Promise<Response> => {
   let out: Response = response;

   if (response.status === 401) {
      http.headers.set("authorization", "Bearer <NEW_TOKEN>");

      out = await http.fetch(response.url, request);
   }

   return out;
});

/*
 * Do fetch (web compliance)
 */
http.fetch("http://localhost:8080").then(response => response.json());
```
