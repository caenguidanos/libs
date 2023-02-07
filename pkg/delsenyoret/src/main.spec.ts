import { expect, test } from "vitest";

import { Validator } from "./main";

test("it should validate product name", async () => {
   let product_name_validator = new Validator<string>("product")
      .addRule("is_string", value => typeof value === "string")
      .addRule("is_not_empty", value => value.length > 0)
      .addRule("starts_with_pattern", value => value.startsWith("sku-"))
      .addRule("is_number", value => typeof value === "number")
      .removeRule("is_number");

   expect(product_name_validator.rules).toStrictEqual(["is_string", "is_not_empty", "starts_with_pattern"]);

   product_name_validator.exec("sku-48e06569-cf1a-4d48-ba9b-5ae7bc659973");
   product_name_validator.exec("sku-64a3078f-fdda-4b53-b833-903021fef4ca");
   product_name_validator.exec("sku-3fa95869-8a8a-47ac-93e7-8bac767500d5");

   expect(() => product_name_validator.exec("sku 37db5e2d-c36c-49c0-b8bd-ca750fd9e35a")).toThrowError(
      new Error(`Validation failed for: product::starts_with_pattern.`)
   );
   expect(() => product_name_validator.exec("sku82cf7948-4017-4714-adca-9c4d57efa2f0")).toThrowError(
      new Error(`Validation failed for: product::starts_with_pattern.`)
   );
   expect(() => product_name_validator.exec("sku_c0b148b3-c2f0-45f4-a565-952f66ab3c2b")).toThrowError(
      new Error(`Validation failed for: product::starts_with_pattern.`)
   );

   expect(() => product_name_validator.exec("")).toThrowError(
      new Error(`Validation failed for: product::is_not_empty.`)
   );

   expect(() => product_name_validator.exec(89 as unknown as string)).toThrowError(
      new Error(`Validation failed for: product::is_string.`)
   );
});
