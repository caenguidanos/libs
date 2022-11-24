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

   let response = await http.fetch("http://localhost:8080/1");
   let responseBody = await response.text();
   expect(responseBody).toBe("Bearer 1234");
});

test("it should return multiple authorization headers", async () => {
   http.headers.set("authorization", "Bearer 1234");
   http.headers.set("role", "viewer");

   let response = await http.fetch("http://localhost:8080/2");
   let responseBody = await response.text();
   let expected = JSON.stringify({ authorization: "Bearer 1234", role: "viewer" });
   expect(responseBody).toBe(expected);
});

test("it should intercept request and add header", async () => {
   http.intercept.request.add(async (_url, request) => {
      let headers = request.headers as Headers;
      headers.set("boom", "1234");
      return Promise.resolve(request);
   });

   let response = await http.fetch("http://localhost:8080/3");
   let responseBody = await response.text();
   expect(responseBody).toBe("1234");
});

test("it should intercept request and error", async () => {
   http.intercept.request.add(async url => {
      throw new Error(url as string);
   });

   try {
      await http.fetch("http://localhost:8080/0");
   } catch (error) {
      expect(error.message).toBe("http://localhost:8080/0");
   }
});

test("it should intercept response", async () => {
   http.intercept.response.add(async (request, response) => {
      let authorizedResponse: Response = response;

      if (response.status === 401) {
         let newToken = await response.text();
         http.headers.set("authorization", newToken);
         authorizedResponse = await http.fetch("http://localhost:8080/5", request);
      }

      return authorizedResponse;
   });

   let response = await http.fetch("http://localhost:8080/4");
   expect(response.status).toBe(201);
});
