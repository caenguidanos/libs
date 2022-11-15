# Delsenyoret

**Validator** utility class.

### Install

```bash
npm i delsenyoret
```

### Use

```ts
import { Validator } from "delsenyoret";

let product_name_validator = new Validator<string>()
   .addRule("is_string", value => typeof value === "string")
   .addRule("is_not_empty", value => value.length > 0)
   .addRule("starts_with_pattern", value => value.startsWith("sku-"));

product_name_validator.exec("sku 37db5e2d-c36c-49c0-b8bd-ca750fd9e35a"); // throws
product_name_validator.exec("sku-37db5e2d-c36c-49c0-b8bd-ca750fd9e35a"); // ok
```
