type Validation<ValueType> = (value: ValueType) => boolean;
type ValidationName = string;

export class Validator<ValueType> {
   private readonly validations = new Map<ValidationName, Validation<ValueType>>();

   constructor(public readonly key: string) {}

   public get rules(): string[] {
      return [...this.validations.keys()];
   }

   public addRule(name: ValidationName, validation: Validation<ValueType>): Validator<ValueType> {
      this.validations.set(name, validation);

      return this;
   }

   public removeRule(name: ValidationName): Validator<ValueType> {
      this.validations.delete(name);

      return this;
   }

   public exec(value: ValueType): void {
      this.validations.forEach((validation, name) => {
         if (!validation(value)) throw new Error(`Validation failed for ${this.key}::${name}.`);
      });
   }
}
