import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import { render } from "@testing-library/react";
import { createElement, memo } from "react";

describe("ResourceService.Provider", () => {
	test("does not rerender consumers when its resource state is unchanged", () => {
		let consumerRenders = 0;
		const Consumer = memo(() => {
			ResourceService.value;
			consumerRenders++;
			return null;
		});
		const renderProvider = () => createElement(ResourceService.Provider, null, createElement(Consumer));
		const view = render(renderProvider());
		const rendersAfterMount = consumerRenders;

		view.rerender(renderProvider());

		expect(consumerRenders).toBe(rendersAfterMount);
	});
});
