import { type UseSearchDialogArgs, useSearchDialog } from "@ext/serach/components/hooks/useSearchDialog";
import { act, renderHook } from "@testing-library/react";

const render = (overrides: Partial<UseSearchDialogArgs> = {}) => {
	const onApplyScope = jest.fn();
	const clear = jest.fn();

	const initialProps: UseSearchDialogArgs = {
		openRequest: { has: false, clear },
		canApplyRequestedScope: true,
		onApplyScope,
		...overrides,
	};

	const result = renderHook((args: UseSearchDialogArgs) => useSearchDialog(args), { initialProps });
	return { ...result, onApplyScope, clear, initialProps };
};

describe("useSearchDialog", () => {
	it("starts closed", () => {
		const { result } = render();

		expect(result.current.open).toBe(false);
	});

	describe("setOpen", () => {
		it("opens and closes", () => {
			const { result } = render();

			act(() => result.current.setOpen(true));
			expect(result.current.open).toBe(true);

			act(() => result.current.setOpen(false));
			expect(result.current.open).toBe(false);
		});
	});

	describe("toggle", () => {
		it("flips the dialog both ways", () => {
			const { result } = render();

			act(() => result.current.toggle());
			expect(result.current.open).toBe(true);

			act(() => result.current.toggle());
			expect(result.current.open).toBe(false);
		});
	});

	describe("external open request", () => {
		it("opens the dialog and clears the request", () => {
			const { result, rerender, clear, initialProps } = render();

			rerender({ ...initialProps, openRequest: { has: true, clear } });

			expect(result.current.open).toBe(true);
			expect(clear).toHaveBeenCalledTimes(1);
		});

		it("applies the requested scope where scopes are switchable", () => {
			const { rerender, onApplyScope, clear, initialProps } = render();

			rerender({ ...initialProps, openRequest: { has: true, scope: "article", clear } });

			expect(onApplyScope).toHaveBeenCalledWith("article");
		});

		it("ignores the requested scope on the home page", () => {
			const { rerender, onApplyScope, clear, initialProps } = render({ canApplyRequestedScope: false });

			rerender({
				...initialProps,
				canApplyRequestedScope: false,
				openRequest: { has: true, scope: "article", clear },
			});

			expect(onApplyScope).not.toHaveBeenCalled();
		});

		it("handles a request once", () => {
			const { rerender, clear, initialProps } = render();
			const openRequest = { has: true, clear };

			rerender({ ...initialProps, openRequest });
			rerender({ ...initialProps, openRequest });

			expect(clear).toHaveBeenCalledTimes(1);
		});
	});
});
