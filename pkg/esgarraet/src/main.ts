type PrimitivePipeOperator<InitialType, TransformedType> = (value: InitialType) => TransformedType;

export class Primitive<K> {
	private _destroyed = false;

	constructor(private _value: K) {}

	private _next(value: K): Primitive<K> {
		this._checkDestroy();
		this._value = value;

		return this;
	}

	private _checkDestroy(): void {
		if (this._destroyed) {
			throw new Error("Primitive is destroyed.");
		}
	}

	protected currentValue(): K {
		this._checkDestroy();
		return this._value;
	}

	protected update(updater: ((prev: K) => K) | K): void {
		if (typeof updater === "function") {
			this._next((updater as (prev: K) => K)(this._value));
		} else {
			this._next(updater as K);
		}
	}

	protected updateFromPipe(...operators: PrimitivePipeOperator<K, K>[]): void {
		this._checkDestroy();

		let result = operators.reduce((acc, fn) => fn(acc), this._value);
		this._next(result);
	}

	protected destroy(): void {
		this._checkDestroy();
		this._destroyed = true;
	}
}
