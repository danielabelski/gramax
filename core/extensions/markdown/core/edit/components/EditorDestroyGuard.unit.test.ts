import EditorDestroyGuard from "@ext/markdown/core/edit/components/EditorDestroyGuard";
import { render } from "@testing-library/react";
import { Component, createElement } from "react";

describe("EditorDestroyGuard", () => {
	test("destroys the editor before descendants unmount", () => {
		const events: string[] = [];
		const editor = {
			isDestroyed: false,
			destroy() {
				events.push("editor-destroy");
				this.isDestroyed = true;
			},
		};

		class UnmountProbe extends Component {
			componentWillUnmount() {
				events.push("child-unmount");
			}

			render() {
				return null;
			}
		}

		const view = render(
			createElement(EditorDestroyGuard, { editor: editor as never }, createElement(UnmountProbe)),
		);

		view.unmount();

		expect(events).toEqual(["editor-destroy", "child-unmount"]);
	});
});
