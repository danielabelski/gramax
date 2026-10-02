type Quantifier = { length: number; min: number; max: number };

export class RegexSafety {
	static assertNoNestedQuantifiers(pattern: string): void {
		const unboundedAtLevel: boolean[] = [false];

		for (let i = 0; i < pattern.length; i++) {
			const char = pattern[i];

			if (char === "\\") {
				i++;
				continue;
			}

			if (char === "[") {
				i = RegexSafety._endOfCharacterClass(pattern, i);
				continue;
			}

			if (char === "(") {
				unboundedAtLevel.push(false);
				if (pattern[i + 1] === "?") i++;
				continue;
			}

			if (char === ")") {
				const inner = unboundedAtLevel.length > 1 ? unboundedAtLevel.pop() : false;
				const quantifier = RegexSafety._quantifierAt(pattern, i + 1);
				const max = quantifier?.max ?? 1;
				if (inner && max > 1) {
					throw new Error(
						"nested quantifiers are not supported: a group that already repeats must not repeat again",
					);
				}
				if (inner || RegexSafety._repeatsAmbiguously(quantifier))
					RegexSafety._markCurrentLevel(unboundedAtLevel);
				i += quantifier?.length ?? 0;
				continue;
			}

			const quantifier = RegexSafety._quantifierAt(pattern, i);
			if (!quantifier) continue;
			if (RegexSafety._repeatsAmbiguously(quantifier)) RegexSafety._markCurrentLevel(unboundedAtLevel);
			i += quantifier.length - 1;
		}
	}

	private static _repeatsAmbiguously(quantifier: Quantifier | null): boolean {
		return !!quantifier && quantifier.min < quantifier.max;
	}

	private static _markCurrentLevel(unboundedAtLevel: boolean[]): void {
		unboundedAtLevel[unboundedAtLevel.length - 1] = true;
	}

	private static _endOfCharacterClass(pattern: string, start: number): number {
		for (let i = start + 1; i < pattern.length; i++) {
			if (pattern[i] === "\\") {
				i++;
				continue;
			}
			if (pattern[i] === "]") return i;
		}
		return pattern.length;
	}

	private static _quantifierAt(pattern: string, index: number): Quantifier | null {
		const char = pattern[index];
		if (char === "*") return RegexSafety._withLazyMark(pattern, index + 1, 1, 0, Number.POSITIVE_INFINITY);
		if (char === "+") return RegexSafety._withLazyMark(pattern, index + 1, 1, 1, Number.POSITIVE_INFINITY);
		if (char === "?") return RegexSafety._withLazyMark(pattern, index + 1, 1, 0, 1);
		if (char !== "{") return null;

		const end = pattern.indexOf("}", index);
		if (end === -1) return null;
		const body = pattern.slice(index + 1, end);
		const bounds = /^(\d+)(,(\d*))?$/.exec(body);
		if (!bounds) return null;

		return RegexSafety._withLazyMark(
			pattern,
			end + 1,
			end + 1 - index,
			Number(bounds[1]),
			RegexSafety._upperBound(bounds),
		);
	}

	private static _upperBound(bounds: RegExpExecArray): number {
		if (!bounds[2]) return Number(bounds[1]);
		return bounds[3] ? Number(bounds[3]) : Number.POSITIVE_INFINITY;
	}

	private static _withLazyMark(pattern: string, next: number, length: number, min: number, max: number): Quantifier {
		return { length: pattern[next] === "?" ? length + 1 : length, min, max };
	}
}
