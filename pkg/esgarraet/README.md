# Esgarraet

Minimal **Primitive** utility class (483 bytes).

### Install

```bash
npm i esgarraet
```

### Use

```ts
import { Primitive } from "esgarraet";

class CheckoutAmount extends Primitive<number> {
   constructor(readonly initial_value: number) {
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

   public emit(): number {
      let value = this.currentValue();
      this.destroy();

      return value;
   }
}

let amount = new CheckoutAmount(1_000);

let amount_value = amount.charge_taxes_from_percent(21).apply_discount_from_value(100).emit();

console.log(amount_value);
```
