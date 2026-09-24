declare global {
	interface Array<T> {
		mapAsync<U>(
			callback: (value: T, index: number, array: T[]) => Promise<U>,
			concurrencyLimit?: number,
		): Promise<U[]>;
		forEachAsync(
			callback: (value: T, index: number, array: T[]) => Promise<void>,
			concurrencyLimit?: number,
		): Promise<void>;
		waitAll(): Promise<T[]>;
		waitAllSettled(): Promise<PromiseSettledResult<T>[]>;
		waitAny(): Promise<T>;
		waitRace(): Promise<T>;
	}
}

type Callback<T, U> = (value: T, index: number, array: T[]) => Promise<U>;

/**
 * Added the way the built-in array methods are: not enumerable.
 *
 * A plain assignment to `Array.prototype` is enumerable, so every `for...in` over an array in the test
 * process yields these names along with the indices. Libraries check for exactly that and refuse to run —
 * pdf.js throws "Array.prototype contains unexpected enumerable property" before it reads a byte.
 */
const defineArrayMethod = (name: string, method: (...args: never[]) => unknown) =>
	Object.defineProperty(Array.prototype, name, { value: method, writable: true, configurable: true });

defineArrayMethod("mapAsync", async function <T, U>(
	this: T[],
	callback: Callback<T, U>,
	concurrencyLimit: number = 5,
): Promise<U[]> {
	return asyncUtils.mapAsync(this, callback, concurrencyLimit);
} as never);

defineArrayMethod("forEachAsync", async function <T>(
	this: T[],
	callback: Callback<T, void>,
	concurrencyLimit: number = 5,
): Promise<void> {
	return asyncUtils.forEachConcurrent(this, callback, concurrencyLimit);
} as never);

defineArrayMethod("waitAll", async function <T>(this: Promise<T>[]): Promise<T[]> {
	return Promise.all(this);
} as never);

defineArrayMethod("waitAllSettled", async function <T>(this: Promise<T>[]): Promise<PromiseSettledResult<T>[]> {
	return Promise.allSettled(this);
} as never);

defineArrayMethod("waitAny", async function <T>(this: Promise<T>[]): Promise<T> {
	return Promise.any(this);
} as never);

defineArrayMethod("waitRace", async function <T>(this: Promise<T>[]): Promise<T> {
	return Promise.race(this);
} as never);

export const asyncUtils = {
	mapSeq: async <T, U>(array: T[], callback: Callback<T, U>): Promise<U[]> => {
		const results: U[] = [];
		for (let i = 0; i < array.length; i++) {
			const result = await callback(array[i]!, i, array);
			results.push(result);
		}
		return results;
	},

	forEachSeq: async <T>(array: T[], callback: Callback<T, void>): Promise<void> => {
		for (let i = 0; i < array.length; i++) {
			await callback(array[i]!, i, array);
		}
	},

	forEachConcurrent: async <T>(
		array: T[],
		callback: Callback<T, void>,
		concurrencyLimit: number = 5,
	): Promise<void> => {
		if (concurrencyLimit === 1) return asyncUtils.forEachSeq(array, callback);

		let index = 0;

		const worker = async (): Promise<void> => {
			while (index < array.length) {
				const currentIndex = index++;
				await callback(array[currentIndex]!, currentIndex, array);
			}
		};

		const workers = Array.from(
			{ length: concurrencyLimit <= 0 ? array.length : Math.min(concurrencyLimit, array.length) },
			() => worker(),
		);
		await Promise.all(workers);
	},

	mapAsync: async <T, U>(array: T[], callback: Callback<T, U>, concurrencyLimit: number = 5): Promise<U[]> => {
		if (concurrencyLimit === 1) return asyncUtils.mapSeq(array, callback);

		const results: U[] = new Array(array.length);
		let index = 0;

		const worker = async (): Promise<void> => {
			while (index < array.length) {
				const currentIndex = index++;
				const result = await callback(array[currentIndex]!, currentIndex, array);
				results[currentIndex] = result;
			}
		};

		const workers = Array.from(
			{ length: concurrencyLimit <= 0 ? array.length : Math.min(concurrencyLimit, array.length) },
			() => worker(),
		);
		await Promise.all(workers);
		return results;
	},
};

export default asyncUtils;
