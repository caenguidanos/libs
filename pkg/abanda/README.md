# Abanda

Minimal **HTTP** utility class **web compliance** (596 bytes).

<div style="display: flex; align-items: center; justify-content: center; margin: 1rem 0;">
  <img width="512" height="512" style="border-radius: 10px;" src="./public/abanda.png">
</div>

## Features

- :helicopter: Global headers
- :vertical_traffic_light: Route interceptors
- :vertical_traffic_light: Request interceptors
- :vertical_traffic_light: Response interceptors
- :underage: Resource blacklist
- :link: Base URL with slash normalization
- :inbox_tray: Accepts `string`, `URL`, and `Request` objects

### Install

```bash
npm i abanda
```

## API

| Property | Type | Description |
| --- | --- | --- |
| `http.base` | `string` | Base URL prepended to relative paths |
| `http.headers` | `Headers` | Global headers added to every request |
| `http.blacklist` | `Set<RequestInfo \| URL>` | URLs that will be immediately aborted |
| `http.intercept.request` | `Set<HttpRequestInterceptor>` | Modify requests before they are sent |
| `http.intercept.response` | `Set<HttpResponseInterceptor>` | Modify responses after they arrive |
| `http.intercept.route` | `Map<RegExp, HttpRouteInterceptor>` | Mock or override specific routes |
| `http.fetch` | `typeof fetch` | Drop-in replacement for `globalThis.fetch` |

### Execution order

```
1. Base URL resolution
2. Blacklist check → AbortError if matched
3. Global headers merge (request headers take priority)
4. Request interceptors (in insertion order)
5. Route interceptors (first regex match wins, skips real fetch + response interceptors)
6. Real fetch
7. Response interceptors (in insertion order)
```

## Examples

### Base URL

```ts
import { http } from "abanda";

http.base = "http://localhost:8080";

// Fetches http://localhost:8080/api/users
http.fetch("/api/users").then(response => response.json());
```

Slash normalization is handled automatically:

```ts
http.base = "http://localhost:8080/";

// No double slash — fetches http://localhost:8080/api/users
http.fetch("/api/users").then(response => response.json());
```

Absolute URLs bypass the base entirely:

```ts
http.base = "http://localhost:8080";

// Fetches https://other-api.com/data, base is ignored
http.fetch("https://other-api.com/data").then(response => response.json());
```

### Global headers

```ts
import { http } from "abanda";

http.headers.set("authorization", "Bearer <TOKEN>");
http.headers.set("x-target", "A");

http.fetch("http://localhost:8080").then(response => response.json());
```

Request-specific headers take priority over global headers:

```ts
http.headers.set("authorization", "Bearer global-token");

// This request uses "Bearer override-token", not the global one
http.fetch("/api/admin", {
   headers: { authorization: "Bearer override-token" },
});
```

### Intercept requests

Request interceptors run before the fetch and can modify headers, method, body, or anything in the `RequestInit`:

```ts
import { http } from "abanda";

// Add a custom header to every request
http.intercept.request.add(async (url, request) => {
   let headers = request.headers as Headers;
   headers.set("x-request-id", crypto.randomUUID());
   return request;
});

http.fetch("http://localhost:8080/api").then(response => response.json());
```

Multiple interceptors run in insertion order — each receives the result of the previous one:

```ts
// First: add a timestamp
http.intercept.request.add(async (url, request) => {
   let headers = request.headers as Headers;
   headers.set("x-timestamp", Date.now().toString());
   return request;
});

// Second: log the final request
http.intercept.request.add(async (url, request) => {
   console.log(`→ ${request.method} ${url}`);
   return request;
});
```

### Intercept responses

Response interceptors run after the fetch and can inspect, modify, or replace the response:

```ts
import { http } from "abanda";

// Automatic token refresh on 401
http.intercept.response.add(async (request, response) => {
   if (response.status === 401) {
      const newToken = await refreshToken();
      http.headers.set("authorization", `Bearer ${newToken}`);
      return http.fetch(response.url, request); // Retry with new token
   }
   return response;
});

http.fetch("http://localhost:8080/api").then(response => response.json());
```

Retry logic with backoff:

```ts
http.intercept.response.add(async (request, response) => {
   if (response.status === 503) {
      let retries = 0;
      let res = response;

      while (retries < 3 && !res.ok) {
         await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
         res = await fetch(response.url, request); // Use platform fetch to avoid re-intercepting
         retries++;
      }

      return res;
   }

   return response;
});
```

Inject metadata into every response:

```ts
http.intercept.response.add(async (request, response) => {
   const body = await response.json();
   body._fetchedAt = new Date().toISOString();
   return new Response(JSON.stringify(body), {
      status: response.status,
      headers: response.headers,
   });
});
```

### Intercept routes

Route interceptors match against the full resolved URL (including base). The first matching regex wins, and the real fetch is skipped entirely — response interceptors do **not** run for matched routes.

```ts
import { http } from "abanda";

// Mock a route entirely
http.intercept.route.set(/\/api\/health$/, async () => {
   return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
   });
});

http.fetch("/api/health").then(response => response.json()); // { status: "ok" }
```

Use capture groups to extract parameters:

```ts
http.intercept.route.set(/\/api\/users\/(\d+)$/, async (url) => {
   const match = (url as string).match(/\/api\/users\/(\d+)$/);
   const userId = match?.[1];

   return new Response(JSON.stringify({ id: userId, name: "Mock User" }), {
      status: 200,
      headers: { "content-type": "application/json" },
   });
});

http.fetch("/api/users/42").then(response => response.json()); // { id: "42", name: "Mock User" }
```

Echo the request body back (useful for testing):

```ts
http.intercept.route.set(/\/echo$/, async (url, request) => {
   return new Response(request.body, {
      status: 200,
      headers: { "content-type": "text/plain" },
   });
});
```

### Blacklist

Blacklisted URLs are aborted immediately — no headers are applied, no interceptors run, and no network request is made.

```ts
import { http } from "abanda";

http.blacklist.add("/tracking");
http.blacklist.add("/analytics");

http.fetch("/tracking"); // throws DOMException (AbortError)
http.fetch("/api/data"); // works normally
```

Works with both relative paths and absolute URLs:

```ts
http.base = "http://localhost:8080";

// Both forms work when base is set
http.blacklist.add("/private");
http.blacklist.add("http://localhost:8080/also-private");

http.fetch("/private"); // AbortError
http.fetch("/also-private"); // AbortError
```

Dynamically manage the blacklist:

```ts
// Block a resource temporarily
http.blacklist.add("/maintenance-endpoint");

// Unblock it later
http.blacklist.delete("/maintenance-endpoint");

// Clear all blocks
http.blacklist.clear();
```

### Cleanup

All interceptor collections support standard `Set` and `Map` operations:

```ts
// Remove a specific interceptor
const logger = async (url: RequestInfo | URL, request: RequestInit) => {
   console.log(`${request.method} ${url}`);
   return request;
};

http.intercept.request.add(logger);
http.intercept.request.delete(logger);

// Remove all interceptors
http.intercept.request.clear();
http.intercept.response.clear();
http.intercept.route.clear();
```

### Full example: API client

```ts
import { http } from "abanda";

// Configure
http.base = "https://api.example.com/v1";
http.headers.set("accept", "application/json");

// Auth
http.intercept.request.add(async (url, request) => {
   const headers = request.headers as Headers;
   const token = getAccessToken(); // your auth logic
   headers.set("authorization", `Bearer ${token}`);
   return request;
});

// Token refresh
http.intercept.response.add(async (request, response) => {
   if (response.status === 401) {
      await refreshAccessToken();
      return http.fetch(response.url, request);
   }
   return response;
});

// Mock in development
if (import.meta.env.DEV) {
   http.intercept.route.set(/\/api\/feature-flags$/, async () => {
      return Response.json({ darkMode: true, beta: false });
   });
}

// Block telemetry
http.blacklist.add("/telemetry");

// Use it
const users = await http.fetch("/users").then(r => r.json());
const me = await http.fetch("/users/me").then(r => r.json());
```

## License

Abanda is distributed under [the MIT license](https://opensource.org/licenses/MIT).
