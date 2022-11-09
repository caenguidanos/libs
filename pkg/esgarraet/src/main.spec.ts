import { expect, test } from "vitest";

import { Primitive } from "./main";

class CheckoutAmount extends Primitive<number> {
   constructor(private initial_value: number) {
      super(initial_value);
   }

   public charge_taxes_from_percent(tax: number): CheckoutAmount {
      this.update(prev => prev + (prev * tax) / 100);

      return this;
   }

   public apply_discount_from_value(quantity: number): CheckoutAmount {
      this.update(prev => prev - quantity);

      return this;
   }

   public apply_discount_from_values(quantities: number[]): CheckoutAmount {
      let operators = quantities.map(quantity => (value: number) => value - quantity);
      this.updateFromPipe(...operators);

      return this;
   }

   public reset(): CheckoutAmount {
      this.update(this.initial_value);

      return this;
   }

   public emit(): number {
      let value = this.currentValue();
      this.destroy();

      return value;
   }
}

test("it should emit value", () => {
   let amount = new CheckoutAmount(1_000);

   let amount_value = amount
      .charge_taxes_from_percent(21)
      .apply_discount_from_value(100)
      .apply_discount_from_values([50, 50])
      .emit();

   expect(amount_value).toBe(1_010);
});

test("it should reset value", () => {
   let amount = new CheckoutAmount(1_000);

   let amount_value = amount.apply_discount_from_value(100).reset().emit();

   expect(amount_value).toBe(1_000);
});

test("it should throw error when state is changed after emit()", () => {
   let amount = new CheckoutAmount(1_000);

   amount.charge_taxes_from_percent(21).emit();

   expect(() => amount.apply_discount_from_value(100)).toThrow();
});
