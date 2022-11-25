# Abanda

Minimal **HTTP** utility class **web compliance** (596 bytes).

<div style="display: flex; align-items: center; justify-content: center; margin: 1rem 0;">
  <img width="512" height="512" style="border-radius: 10px;" src="./public/abanda.png">
</div>

## Features

-  :helicopter: Global headers
-  :vertical_traffic_light: Request interceptors
-  :vertical_traffic_light: Response interceptors
-  :underage: Resource blacklist

### Install

```bash
npm i abanda
```

### Use

##### Global headers

```ts
import { http } from "abanda";

http.headers.set("authorization", "Bearer <TOKEN>");
http.headers.set("x-target", "A");

http.fetch("http://localhost:8080").then(response => response.json());
```

##### Intercept responses

```ts
import { http } from "abanda";

http.intercept.response.add(async (request, response): Promise<Response> => {
   let res: Response = response;

   if (response.status === 403) {
      let ok = false;
      let retries = 1;

      while (retries < 5 || !ok) {
         let r = await fetch(response.url, request); // Use platform fetch inside retries !!
         ok = r.ok;
         res = r;
         retries++;
      }
   }

   return res;
});

http.intercept.response.add(async (request, response): Promise<Response> => {
   let r: Response = response;

   if (response.status === 401) {
      http.headers.set("authorization", "Bearer <NEW_TOKEN>");
      r = await http.fetch(response.url, request); // with new token
   }

   return r;
});

http.fetch("http://localhost:8080").then(response => response.json());
```

##### Intercept requests

```ts
import { http } from "abanda";

http.intercept.request.add((url, request): Promise<RequestInit> => {
   let headers = request.headers as Headers;
   headers.set("x-test", "B");
   return Promise.resolve(request);
});

http.fetch("http://localhost:8080").then(response => response.json());
```

##### Blacklist

```ts
import { http } from "abanda";

let resource = "http://localhost:8080/private-endpoint";

http.blacklist.add(resource);

http.fetch(resource).then(response => response.json()); // AbortError
```

## License

Abanda is distributed under [the MIT license](https://opensource.org/licenses/MIT)
