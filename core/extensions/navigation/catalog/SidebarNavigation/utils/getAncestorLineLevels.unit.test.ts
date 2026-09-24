import { link } from "../hooks/tests/navigationTreeStoreTestUtils";
import { createNavigationTreeStore } from "../store/navigationTreeStore";
import { DropMode } from "./dropMode";
import { getAncestorLineLevels } from "./getAncestorLineLevels";

it("continues the insertion guide through expanded descendants of an earlier sibling", () => {
	const store = createNavigationTreeStore([
		link("root", [link("parent", [link("folder", [link("leaf")]), link("anchor")])]),
	]);
	store.getState().setHover("parent", "anchor");
	expect(getAncestorLineLevels("leaf", 4, store.getState())).toEqual([3]);
	expect(getAncestorLineLevels("folder", 3, store.getState())).toEqual([]);
});

it("continues the drag guide through descendants without drawing past the anchor", () => {
	const store = createNavigationTreeStore([
		link("root", [link("folder", [link("leaf")]), link("anchor"), link("after", [link("last")])]),
	]);
	store.getState().setDragTarget({ anchorId: "anchor", parentId: "root", mode: DropMode.After });
	expect(getAncestorLineLevels("leaf", 3, store.getState())).toEqual([2]);
	expect(getAncestorLineLevels("last", 3, store.getState())).toEqual([]);
});
