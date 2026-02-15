import http_ from "node:http";
import { afterAll, beforeAll, expect, test, describe, beforeEach } from "vitest";

import { http } from "./main";

let server: http_.Server;

// ─── Test server ────────────────────────────────────────────────────────────

beforeAll(() => {
   server = http_.createServer((request, response) => {
      const url = request.url ?? "/";

      // Echo body: devuelve el body recibido (ANTES de /echo para evitar startsWith match)
      if (url === "/echo-body") {
         let body = "";
         request.on("data", (chunk: string) => (body += chunk));
         request.on("end", () => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.write(body);
            response.end();
         });
         return;
      }

      // Echo: devuelve todos los headers y metadatos de la request
      if (url.startsWith("/echo")) {
         const payload = JSON.stringify({
            method: request.method,
            headers: request.headers,
            url: request.url,
         });
         response.writeHead(200, { "Content-Type": "application/json" });
         response.write(payload);
         return response.end();
      }

      // Slow: responde con delay
      if (url === "/slow") {
         setTimeout(() => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.write("slow-response");
            response.end();
         }, 100);
         return;
      }

      // Status codes
      if (url === "/401") {
         response.writeHead(401, { "Content-Type": "text/plain" });
         response.write("unauthorized");
         return response.end();
      }

      if (url === "/500") {
         response.writeHead(500, { "Content-Type": "text/plain" });
         response.write("server-error");
         return response.end();
      }

      if (url === "/201") {
         response.writeHead(201, { "Content-Type": "text/plain" });
         response.write("created");
         return response.end();
      }

      // Fallback
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.write("ok");
      return response.end();
   });

   server.listen(9090);
});

afterAll(() => {
   server.close();
});

beforeEach(() => {
   http.intercept.request.clear();
   http.intercept.response.clear();
   http.intercept.route.clear();
   http.blacklist.clear();
   http.base = "";
   [...http.headers.keys()].forEach((key) => http.headers.delete(key));
});

// ─── Base URL ───────────────────────────────────────────────────────────────

describe("base URL", () => {
   test("prepends base to relative path", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("does NOT prepend base to absolute URL", async () => {
      http.base = "http://should-not-be-used:1111";
      const res = await http.fetch("http://localhost:9090/echo");
      expect(res.ok).toBe(true);
   });

   test("normalizes double slash: base with trailing slash", async () => {
      http.base = "http://localhost:9090/";
      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("normalizes missing slash: path without leading slash", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("echo");
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("normalizes both: base trailing + path leading slash", async () => {
      http.base = "http://localhost:9090/";
      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
   });

   test("works without base (empty string)", async () => {
      http.base = "";
      const res = await http.fetch("http://localhost:9090/echo");
      expect(res.ok).toBe(true);
   });
});

// ─── Headers globales ───────────────────────────────────────────────────────

describe("global headers", () => {
   test("adds global headers to request", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-custom", "hello");

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-custom"]).toBe("hello");
   });

   test("adds multiple global headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-one", "1");
      http.headers.set("x-two", "2");
      http.headers.set("x-three", "3");

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-one"]).toBe("1");
      expect(body.headers["x-two"]).toBe("2");
      expect(body.headers["x-three"]).toBe("3");
   });

   test("does NOT overwrite request-specific headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("authorization", "global-token");

      const res = await http.fetch("/echo", {
         headers: { authorization: "request-token" },
      });
      const body = await res.json();
      expect(body.headers["authorization"]).toBe("request-token");
   });

   test("global header applies when request has no headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("authorization", "Bearer abc");

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["authorization"]).toBe("Bearer abc");
   });

   test("global header applies alongside different request headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("authorization", "Bearer abc");

      const res = await http.fetch("/echo", {
         headers: { "x-request-id": "123" },
      });
      const body = await res.json();
      expect(body.headers["authorization"]).toBe("Bearer abc");
      expect(body.headers["x-request-id"]).toBe("123");
   });

   test("request Headers object takes priority over global", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-priority", "global");

      const reqHeaders = new Headers();
      reqHeaders.set("x-priority", "local");

      const res = await http.fetch("/echo", { headers: reqHeaders });
      const body = await res.json();
      expect(body.headers["x-priority"]).toBe("local");
   });
});

// ─── HTTP methods ───────────────────────────────────────────────────────────

describe("HTTP methods", () => {
   test("defaults to GET when no method specified", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.method).toBe("GET");
   });

   test("respects explicit GET", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", { method: "GET" });
      const body = await res.json();
      expect(body.method).toBe("GET");
   });

   test("sends POST request", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", { method: "POST" });
      const body = await res.json();
      expect(body.method).toBe("POST");
   });

   test("sends PUT request", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", { method: "PUT" });
      const body = await res.json();
      expect(body.method).toBe("PUT");
   });

   test("sends DELETE request", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", { method: "DELETE" });
      const body = await res.json();
      expect(body.method).toBe("DELETE");
   });

   test("sends PATCH request", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", { method: "PATCH" });
      const body = await res.json();
      expect(body.method).toBe("PATCH");
   });

   test("sends POST with JSON body", async () => {
      http.base = "http://localhost:9090";
      const payload = JSON.stringify({ name: "test" });
      const res = await http.fetch("/echo-body", {
         method: "POST",
         body: payload,
         headers: { "content-type": "application/json" },
      });
      const body = await res.text();
      expect(body).toBe(payload);
   });
});

// ─── Request interceptors ───────────────────────────────────────────────────

describe("request interceptors", () => {
   test("modifies headers via interceptor", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         headers.set("x-intercepted", "yes");
         return init;
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-intercepted"]).toBe("yes");
   });

   test("multiple interceptors execute in insertion order", async () => {
      http.base = "http://localhost:9090";
      const order: number[] = [];

      http.intercept.request.add(async (_url, init) => {
         order.push(1);
         const headers = init.headers as Headers;
         headers.set("x-order", "first");
         return init;
      });

      http.intercept.request.add(async (_url, init) => {
         order.push(2);
         const headers = init.headers as Headers;
         headers.set("x-order", "second");
         return init;
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(order).toEqual([1, 2]);
      expect(body.headers["x-order"]).toBe("second");
   });

   test("interceptor receives the resolved URL (with base)", async () => {
      http.base = "http://localhost:9090";
      let receivedUrl: string = "";

      http.intercept.request.add(async (url, init) => {
         receivedUrl = url as string;
         return init;
      });

      await http.fetch("/echo");
      expect(receivedUrl).toBe("http://localhost:9090/echo");
   });

   test("interceptor can modify method", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async (_url, init) => {
         init.method = "POST";
         return init;
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.method).toBe("POST");
   });

   test("interceptor error propagates", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async () => {
         throw new Error("interceptor-boom");
      });

      await expect(http.fetch("/echo")).rejects.toThrow("interceptor-boom");
   });

   test("second interceptor does NOT run if first throws", async () => {
      http.base = "http://localhost:9090";
      let secondRan = false;

      http.intercept.request.add(async () => {
         throw new Error("first-fails");
      });

      http.intercept.request.add(async (_url, init) => {
         secondRan = true;
         return init;
      });

      await expect(http.fetch("/echo")).rejects.toThrow("first-fails");
      expect(secondRan).toBe(false);
   });

   test("clearing interceptors removes all of them", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         headers.set("x-should-not-exist", "yes");
         return init;
      });

      http.intercept.request.clear();

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-should-not-exist"]).toBeUndefined();
   });

   test("deleting a specific interceptor keeps others", async () => {
      http.base = "http://localhost:9090";

      const toRemove = async (_url: RequestInfo | URL, init: RequestInit) => {
         const headers = init.headers as Headers;
         headers.set("x-removed", "yes");
         return init;
      };

      const toKeep = async (_url: RequestInfo | URL, init: RequestInit) => {
         const headers = init.headers as Headers;
         headers.set("x-kept", "yes");
         return init;
      };

      http.intercept.request.add(toRemove);
      http.intercept.request.add(toKeep);
      http.intercept.request.delete(toRemove);

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-removed"]).toBeUndefined();
      expect(body.headers["x-kept"]).toBe("yes");
   });
});

// ─── Response interceptors ──────────────────────────────────────────────────

describe("response interceptors", () => {
   test("can read and pass through response", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async (_init, response) => {
         expect(response.status).toBe(200);
         return response;
      });

      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
   });

   test("can replace response entirely", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async () => {
         return new Response("intercepted-body", {
            status: 299,
            headers: { "content-type": "text/plain" },
         });
      });

      const res = await http.fetch("/echo");
      expect(res.status).toBe(299);
      expect(await res.text()).toBe("intercepted-body");
   });

   test("multiple response interceptors chain in order", async () => {
      http.base = "http://localhost:9090";
      const order: number[] = [];

      http.intercept.response.add(async (_init, response) => {
         order.push(1);
         return response;
      });

      http.intercept.response.add(async (_init, response) => {
         order.push(2);
         return response;
      });

      await http.fetch("/echo");
      expect(order).toEqual([1, 2]);
   });

   test("response interceptor can retry on 401", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async (init, response) => {
         if (response.status === 401) {
            http.headers.set("authorization", "refreshed-token");
            return http.fetch("/echo", init);
         }
         return response;
      });

      const res = await http.fetch("/401");
      expect(res.ok).toBe(true);
   });

   test("response interceptor error propagates", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async () => {
         throw new Error("response-interceptor-boom");
      });

      await expect(http.fetch("/echo")).rejects.toThrow("response-interceptor-boom");
   });

   test("response interceptor receives the RequestInit", async () => {
      expect.assertions(1);
      http.base = "http://localhost:9090";

      http.intercept.response.add(async (init, response) => {
         expect(init.method).toBe("POST");
         return response;
      });

      await http.fetch("/echo", { method: "POST" });
   });

   test("second response interceptor receives modified response from first", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async () => {
         return new Response("modified-by-first", { status: 201 });
      });

      http.intercept.response.add(async (_init, response) => {
         const text = await response.text();
         return new Response(text + "-then-second", { status: response.status });
      });

      const res = await http.fetch("/echo");
      expect(res.status).toBe(201);
      expect(await res.text()).toBe("modified-by-first-then-second");
   });
});

// ─── Route interceptors ────────────────────────────────────────────────────

describe("route interceptors", () => {
   test("intercepts matching route", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/\/mocked$/, async () => {
         return new Response("mocked", { status: 200 });
      });

      const res = await http.fetch("/mocked");
      expect(await res.text()).toBe("mocked");
   });

   test("non-matching routes go to real server", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/\/other-route$/, async () => {
         return new Response("should-not-see-this", { status: 200 });
      });

      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("first matching route wins (Map insertion order)", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/\/conflict/, async () => {
         return new Response("first-wins", { status: 200 });
      });

      // Mismo regex es la misma key en el Map -> sobreescribe
      // Usamos regex diferente para tener dos entradas
      http.intercept.route.set(/\/conflict.*/, async () => {
         return new Response("second-loses", { status: 200 });
      });

      const res = await http.fetch("/conflict");
      expect(await res.text()).toBe("first-wins");
   });

   test("route handler receives resolved URL", async () => {
      http.base = "http://localhost:9090";
      let receivedUrl = "";

      http.intercept.route.set(/\/captured/, async (url) => {
         receivedUrl = url as string;
         return new Response("ok");
      });

      await http.fetch("/captured");
      expect(receivedUrl).toBe("http://localhost:9090/captured");
   });

   test("route handler receives RequestInit with global headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("authorization", "Bearer xyz");

      http.intercept.route.set(/\/check-headers/, async (_url, init) => {
         const headers = init.headers as Headers;
         const auth = headers.get("authorization");
         return new Response(auth ?? "missing");
      });

      const res = await http.fetch("/check-headers");
      expect(await res.text()).toBe("Bearer xyz");
   });

   test("route interceptor receives body from RequestInit", async () => {
      http.intercept.route.set(/\/echo-route/, async (_url, init) => {
         return new Response(init.body as string, { status: 201 });
      });

      const payload = JSON.stringify({ data: "test" });
      const res = await http.fetch("http://localhost:9090/echo-route", {
         method: "POST",
         body: payload,
      });

      expect(res.status).toBe(201);
      expect(await res.text()).toBe(payload);
   });

   test("route interceptor skips response interceptors", async () => {
      http.base = "http://localhost:9090";
      let responseInterceptorRan = false;

      http.intercept.route.set(/\/routed/, async () => {
         return new Response("routed");
      });

      http.intercept.response.add(async (_init, response) => {
         responseInterceptorRan = true;
         return response;
      });

      await http.fetch("/routed");
      expect(responseInterceptorRan).toBe(false);
   });

   test("request interceptors run BEFORE route matching", async () => {
      http.base = "http://localhost:9090";
      let interceptorRan = false;

      http.intercept.request.add(async (_url, init) => {
         interceptorRan = true;
         return init;
      });

      http.intercept.route.set(/\/routed/, async () => {
         return new Response("routed");
      });

      await http.fetch("/routed");
      expect(interceptorRan).toBe(true);
   });

   test("regex with capture groups works", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/\/users\/(\d+)/, async (url) => {
         const match = (url as string).match(/\/users\/(\d+)/);
         return new Response(`user-${match?.[1]}`);
      });

      const res = await http.fetch("/users/42");
      expect(await res.text()).toBe("user-42");
   });

   test("clearing route map removes all handlers", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/\/will-be-cleared/, async () => {
         return new Response("intercepted");
      });

      http.intercept.route.clear();

      const res = await http.fetch("/will-be-cleared");
      expect(await res.text()).toBe("ok");
   });

   test("deleting a specific route keeps others", async () => {
      http.base = "http://localhost:9090";

      const routeA = /\/route-a/;
      const routeB = /\/route-b/;

      http.intercept.route.set(routeA, async () => new Response("a"));
      http.intercept.route.set(routeB, async () => new Response("b"));

      http.intercept.route.delete(routeA);

      // route-a va al servidor real
      const resA = await http.fetch("/route-a");
      expect(await resA.text()).toBe("ok");

      // route-b sigue interceptado
      const resB = await http.fetch("/route-b");
      expect(await resB.text()).toBe("b");
   });

   test("route matches against full resolved URL, not just path", async () => {
      http.base = "http://localhost:9090";

      http.intercept.route.set(/localhost:9090\/specific/, async () => {
         return new Response("matched-full-url");
      });

      const res = await http.fetch("/specific");
      expect(await res.text()).toBe("matched-full-url");
   });
});

// ─── Blacklist ──────────────────────────────────────────────────────────────

describe("blacklist", () => {
   test("aborts request for blacklisted relative path", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      http.blacklist.add("/blocked");

      try {
         await http.fetch("/blocked");
      } catch (error) {
         expect(error).toBeInstanceOf(DOMException);
         expect(error.name).toBe("AbortError");
      }
   });

   test("aborts request for blacklisted absolute URL", async () => {
      expect.assertions(2);
      http.blacklist.add("http://localhost:9090/blocked");

      try {
         await http.fetch("http://localhost:9090/blocked");
      } catch (error) {
         expect(error).toBeInstanceOf(DOMException);
         expect(error.name).toBe("AbortError");
      }
   });

   test("blacklist with relative path works when base is set", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      http.blacklist.add("/secret");

      try {
         await http.fetch("/secret");
      } catch (error) {
         expect(error).toBeInstanceOf(DOMException);
         expect(error.name).toBe("AbortError");
      }
   });

   test("blacklist with full URL works when base is set", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      http.blacklist.add("http://localhost:9090/secret");

      try {
         await http.fetch("/secret");
      } catch (error) {
         expect(error).toBeInstanceOf(DOMException);
         expect(error.name).toBe("AbortError");
      }
   });

   test("non-blacklisted paths are NOT blocked", async () => {
      http.base = "http://localhost:9090";
      http.blacklist.add("/blocked");

      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
   });

   test("multiple blacklisted paths all abort", async () => {
      expect.assertions(6);
      http.base = "http://localhost:9090";
      http.blacklist.add("/a");
      http.blacklist.add("/b");
      http.blacklist.add("/c");

      for (const path of ["/a", "/b", "/c"]) {
         try {
            await http.fetch(path);
         } catch (error) {
            expect(error).toBeInstanceOf(DOMException);
            expect(error.name).toBe("AbortError");
         }
      }
   });

   test("removing from blacklist allows request again", async () => {
      http.base = "http://localhost:9090";
      http.blacklist.add("/temporary");

      let blocked = false;
      try {
         await http.fetch("/temporary");
      } catch {
         blocked = true;
      }
      expect(blocked).toBe(true);

      http.blacklist.delete("/temporary");
      const res = await http.fetch("/temporary");
      expect(res.ok).toBe(true);
   });

   test("clearing blacklist allows all requests", async () => {
      http.base = "http://localhost:9090";
      http.blacklist.add("/x");
      http.blacklist.add("/y");

      http.blacklist.clear();

      const res1 = await http.fetch("/x");
      const res2 = await http.fetch("/y");
      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);
   });

   test("blacklisted requests do NOT apply global headers", async () => {
      expect.assertions(1);
      http.base = "http://localhost:9090";
      http.headers.set("x-should-not-leak", "secret");
      http.blacklist.add("/blocked");

      try {
         await http.fetch("/blocked");
      } catch (error) {
         expect(error.name).toBe("AbortError");
      }
   });

   test("blacklisted requests do NOT run request interceptors", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      let interceptorRan = false;

      http.intercept.request.add(async (_url, init) => {
         interceptorRan = true;
         return init;
      });

      http.blacklist.add("/blocked");

      try {
         await http.fetch("/blocked");
      } catch (error) {
         expect(error.name).toBe("AbortError");
      }
      expect(interceptorRan).toBe(false);
   });

   test("blacklisted requests do NOT run response interceptors", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      let responseInterceptorRan = false;

      http.intercept.response.add(async (_init, response) => {
         responseInterceptorRan = true;
         return response;
      });

      http.blacklist.add("/blocked");

      try {
         await http.fetch("/blocked");
      } catch (error) {
         expect(error.name).toBe("AbortError");
      }
      expect(responseInterceptorRan).toBe(false);
   });

   test("blacklisted requests do NOT match route interceptors", async () => {
      expect.assertions(2);
      http.base = "http://localhost:9090";
      let routeHandlerRan = false;

      http.intercept.route.set(/\/blocked/, async () => {
         routeHandlerRan = true;
         return new Response("should-not-reach");
      });

      http.blacklist.add("/blocked");

      try {
         await http.fetch("/blocked");
      } catch (error) {
         expect(error.name).toBe("AbortError");
      }
      expect(routeHandlerRan).toBe(false);
   });
});

// ─── Interacción entre features ─────────────────────────────────────────────

describe("feature interactions", () => {
   test("request interceptor + global headers coexist", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-global", "from-global");

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         headers.set("x-intercepted", "from-interceptor");
         return init;
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["x-global"]).toBe("from-global");
      expect(body.headers["x-intercepted"]).toBe("from-interceptor");
   });

   test("request interceptor can override global headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("authorization", "global-token");

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         headers.set("authorization", "interceptor-token");
         return init;
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.headers["authorization"]).toBe("interceptor-token");
   });

   test("request + response interceptors both execute on normal request", async () => {
      http.base = "http://localhost:9090";
      const order: string[] = [];

      http.intercept.request.add(async (_url, init) => {
         order.push("request");
         return init;
      });

      http.intercept.response.add(async (_init, response) => {
         order.push("response");
         return response;
      });

      await http.fetch("/echo");
      expect(order).toEqual(["request", "response"]);
   });

   test("route interceptor receives headers modified by request interceptor", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         headers.set("x-from-interceptor", "value");
         return init;
      });

      http.intercept.route.set(/\/check/, async (_url, init) => {
         const headers = init.headers as Headers;
         return new Response(headers.get("x-from-interceptor") ?? "missing");
      });

      const res = await http.fetch("/check");
      expect(await res.text()).toBe("value");
   });

   test("full pipeline: global headers → request interceptor → route handler", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-step", "global");

      http.intercept.request.add(async (_url, init) => {
         const headers = init.headers as Headers;
         const prev = headers.get("x-step") ?? "";
         headers.set("x-step", prev + "+request");
         return init;
      });

      http.intercept.route.set(/\/pipeline/, async (_url, init) => {
         const headers = init.headers as Headers;
         return new Response(headers.get("x-step") ?? "missing");
      });

      const res = await http.fetch("/pipeline");
      expect(await res.text()).toBe("global+request");
   });
});

// ─── Concurrent requests ────────────────────────────────────────────────────

describe("concurrent requests", () => {
   test("multiple simultaneous requests resolve independently", async () => {
      http.base = "http://localhost:9090";

      const [r1, r2, r3] = await Promise.all([
         http.fetch("/echo"),
         http.fetch("/201"),
         http.fetch("/500"),
      ]);

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(201);
      expect(r3.status).toBe(500);
   });

   test("concurrent requests all get global headers", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-shared", "concurrent");

      const responses = await Promise.all(
         Array.from({ length: 5 }, () => http.fetch("/echo"))
      );

      for (const res of responses) {
         const body = await res.json();
         expect(body.headers["x-shared"]).toBe("concurrent");
      }
   });

   test("concurrent requests each trigger interceptors independently", async () => {
      http.base = "http://localhost:9090";
      let count = 0;

      http.intercept.request.add(async (_url, init) => {
         count++;
         return init;
      });

      await Promise.all(
         Array.from({ length: 5 }, () => http.fetch("/echo"))
      );

      expect(count).toBe(5);
   });

   test("mixed concurrent: some blacklisted, some normal", async () => {
      http.base = "http://localhost:9090";
      http.blacklist.add("/blocked-concurrent");

      const results = await Promise.allSettled([
         http.fetch("/echo"),
         http.fetch("/blocked-concurrent"),
         http.fetch("/echo"),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
   });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe("edge cases", () => {
   test("fetch with no second argument works", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.method).toBe("GET");
   });

   test("fetch with empty RequestInit works", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo", {});
      expect(res.ok).toBe(true);
   });

   test("fetch preserves query parameters", async () => {
      http.base = "http://localhost:9090";
      const res = await http.fetch("/echo?foo=bar&baz=1");
      const body = await res.json();
      expect(body.url).toBe("/echo?foo=bar&baz=1");
   });

   test("fetch preserves hash fragments in path", async () => {
      http.base = "http://localhost:9090";
      // El servidor no recibe el hash, pero no debe romper
      const res = await http.fetch("/echo");
      expect(res.ok).toBe(true);
   });

   test("response interceptor can transform JSON body", async () => {
      http.base = "http://localhost:9090";

      http.intercept.response.add(async (_init, response) => {
         const body = await response.json();
         body.injected = true;
         return new Response(JSON.stringify(body), {
            status: response.status,
            headers: { "content-type": "application/json" },
         });
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.injected).toBe(true);
      expect(body.url).toBe("/echo");
   });

   test("adding same interceptor function twice only runs once (Set dedup)", async () => {
      http.base = "http://localhost:9090";
      let count = 0;

      const interceptor: (url: RequestInfo | URL, init: RequestInit) => Promise<RequestInit> =
         async (_url, init) => {
            count++;
            return init;
         };

      http.intercept.request.add(interceptor);
      http.intercept.request.add(interceptor);

      await http.fetch("/echo");
      expect(count).toBe(1);
   });

   test("URL object as input works", async () => {
      const url = new URL("http://localhost:9090/echo");
      const res = await http.fetch(url);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("server error status codes pass through correctly", async () => {
      http.base = "http://localhost:9090";

      const r401 = await http.fetch("/401");
      expect(r401.status).toBe(401);
      expect(r401.ok).toBe(false);

      const r500 = await http.fetch("/500");
      expect(r500.status).toBe(500);
      expect(r500.ok).toBe(false);
   });

   test("network error (unreachable host) rejects the promise", async () => {
      await expect(
         http.fetch("http://localhost:1/unreachable")
      ).rejects.toThrow();
   });

   test("changing base between requests works correctly", async () => {
      http.base = "http://localhost:9090";
      const res1 = await http.fetch("/echo");
      expect(res1.ok).toBe(true);

      http.base = "http://localhost:1";
      await expect(http.fetch("/echo")).rejects.toThrow();

      http.base = "http://localhost:9090";
      const res3 = await http.fetch("/echo");
      expect(res3.ok).toBe(true);
   });

   test("headers set after construction are applied", async () => {
      http.base = "http://localhost:9090";

      const res1 = await http.fetch("/echo");
      const body1 = await res1.json();
      expect(body1.headers["x-late"]).toBeUndefined();

      http.headers.set("x-late", "added-later");
      const res2 = await http.fetch("/echo");
      const body2 = await res2.json();
      expect(body2.headers["x-late"]).toBe("added-later");
   });

   test("deleting a global header stops it from being sent", async () => {
      http.base = "http://localhost:9090";
      http.headers.set("x-temp", "exists");

      const res1 = await http.fetch("/echo");
      const body1 = await res1.json();
      expect(body1.headers["x-temp"]).toBe("exists");

      http.headers.delete("x-temp");

      const res2 = await http.fetch("/echo");
      const body2 = await res2.json();
      expect(body2.headers["x-temp"]).toBeUndefined();
   });

   test("empty base + absolute URL works normally", async () => {
      http.base = "";
      const res = await http.fetch("http://localhost:9090/echo");
      const body = await res.json();
      expect(body.url).toBe("/echo");
   });

   test("interceptor that returns a completely new RequestInit works", async () => {
      http.base = "http://localhost:9090";

      http.intercept.request.add(async (_url, _init) => {
         // Devuelve un RequestInit completamente nuevo
         return {
            method: "POST",
            headers: new Headers({ "x-replaced": "entirely" }),
         };
      });

      const res = await http.fetch("/echo");
      const body = await res.json();
      expect(body.method).toBe("POST");
      expect(body.headers["x-replaced"]).toBe("entirely");
   });
});
