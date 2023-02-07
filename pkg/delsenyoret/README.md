# Delsenyoret

**Validator** utility class (304 bytes).

<div style="display: flex; align-items: center; justify-content: center; margin: 1rem 0;">
  <img width="512" height="512" style="border-radius: 10px;" src="./public/delsenyoret.png">
</div>

### Install

```bash
npm i delsenyoret
```

### Use

```ts
import { Validator } from "delsenyoret";

let product_name_validator = new Validator<string>("product")
   .addRule("is_string", value => typeof value === "string")
   .addRule("is_not_empty", value => value.length > 0)
   .addRule("starts_with_pattern", value => value.startsWith("sku-"));

product_name_validator.exec("sku 37db5e2d-c36c-49c0-b8bd-ca750fd9e35a"); // throws
product_name_validator.exec("sku-37db5e2d-c36c-49c0-b8bd-ca750fd9e35a"); // ok
```

## License

Delsenyoret is distributed under [the MIT license](https://opensource.org/licenses/MIT)
