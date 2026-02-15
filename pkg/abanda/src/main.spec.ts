import http_ from "node:http";
import { afterAll, beforeAll, expect, test, describe, beforeEach } from "vitest";

import { http } from "./main";

let server: http_.Server<typeof http_.IncomingMessage, typeof http_.ServerResponse>;

beforeEach(() => {
   http.intercept.request.clear();
   http.intercept.response.clear();
});

beforeAll(() => {
   server = http_.createServer((request, response) => {
      if (request.url === "/1") {
         let payload = request.headers.authorization;
         response.writeHead(200, { "Content-Type": "text/plain" });
         response.write(payload);
         return response.end();
      }

      if (request.url === "/2") {
         let payload = JSON.stringify({
            authorization: request.headers.authorization,
            role: request.headers.role,
         });
         response.writeHead(200, { "Content-Type": "text/plain" });
         response.write(payload);
         return response.end();
      }

      if (request.url === "/3") {
         let payload = request.headers.boom;
         response.writeHead(200, { "Content-Type": "text/plain" });
         response.write(payload);
         return response.end();
      }

      if (request.url === "/4") {
         response.writeHead(401, { "Content-Type": "text/plain" });
         response.write("9876");
         return response.end();
      }

      if (request.url === "/5") {
         let payload = request.headers.authorization;
         response.writeHead(201, { "Content-Type": "text/plain" });
         response.write(payload);
         return response.end();
      }

      response.writeHead(200);
      return response.end();
   });

   server.listen(8080);
});

afterAll(() => {
   server.close();
});

test("it should return authorization header", async () => {
   http.headers.set("authorization", "Bearer 1234");

   http.base = "http://localhost:8080";

   let response = await http.fetch("/1");
   let responseBody = await response.text();
   expect(responseBody).toBe("Bearer 1234");
});

test("it should return multiple authorization headers", async () => {
   http.headers.set("authorization", "Bearer 1234");
   http.headers.set("role", "viewer");

   http.base = "http://localhost:8080";

   let response = await http.fetch("/2");
   let responseBody = await response.text();
   let expected = JSON.stringify({ authorization: "Bearer 1234", role: "viewer" });
   expect(responseBody).toBe(expected);
});

test("it should intercept request and add header", async () => {
   http.base = "http://localhost:8080";

   http.intercept.request.add(async (_url, request) => {
      let headers = request.headers as Headers;
      headers.set("boom", "1234");
      return Promise.resolve(request);
   });

   let response = await http.fetch("/3");
   let responseBody = await response.text();
   expect(responseBody).toBe("1234");
});

test("it should intercept request and error", async () => {
   http.base = "http://localhost:8080";

   http.intercept.request.add(async url => {
      throw new Error(url as string);
   });

   try {
      await http.fetch("/0");
   } catch (error) {
      expect(error.message).toBe("http://localhost:8080/0");
   }
});

test("it should intercept response", async () => {
   http.base = "http://localhost:8080";

   http.intercept.response.add(async (request, response) => {
      let authorizedResponse: Response = response;

      if (response.status === 401) {
         let newToken = await response.text();
         http.headers.set("authorization", newToken);
         authorizedResponse = await http.fetch("/5", request);
      }

      return authorizedResponse;
   });

   let response = await http.fetch("/4");
   expect(response.status).toBe(201);
});

test("it should intercept route I", async () => {
   http.base = "http://localhost:8080";

   http.intercept.route.set(/\/4$/, async () => {
      return new Response("alojomora", { status: 201, headers: { "content-type": "text/plain" } });
   });

   let response = await http.fetch("/4");

   expect(response.status).toBe(201);
   expect(await response.text()).toBe("alojomora");
});

test("it should intercept route II", async () => {
   http.intercept.route.set(/\/ping$/, async (info, request) => {
      return new Response(request.body, {
         status: 201,
         headers: { "content-type": "text/plain" },
      });
   });

   let response = await http.fetch("http://localhost:8080/ping", {
      body: JSON.stringify({ h: 1 }),
   });

   expect(response.status).toBe(201);
   expect(await response.text()).toBe(JSON.stringify({ h: 1 }));
});

test("it should abort blacklisted resources", async () => {
   expect.assertions(6);

   http.base = "http://localhost:8080";

   let resource_1 = "/private-endpoint-1";
   let resource_2 = "/private-endpoint-2";
   let resource_3 = "/private-endpoint-3";

   http.blacklist.add(resource_1);
   http.blacklist.add(resource_2);
   http.blacklist.add(resource_3);

   try {
      await http.fetch(resource_1);
   } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("AbortError");
   }

   try {
      await http.fetch(resource_2);
   } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("AbortError");
   }

   try {
      await http.fetch(resource_3);
   } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe("AbortError");
   }
});
