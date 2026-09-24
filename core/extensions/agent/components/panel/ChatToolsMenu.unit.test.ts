import { AGENT_SKILLS_PANEL_ID } from "@ext/agent/components/types/constants";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { ChatToolsMenu } from "./ChatToolsMenu";

const mockRefetchSkills = jest.fn();
let mockSkills: Array<{ name?: string; description: string }>;

jest.mock("@core-ui/hooks/useApi", () => ({
	RequestStatus: { Init: "init", Loading: "loading", Success: "success" },
	useApi: () => ({
		call: mockRefetchSkills,
		data: mockSkills,
		status: "success",
	}),
}));

describe("ChatToolsMenu", () => {
	beforeEach(() => {
		mockSkills = [
			{ name: "Review PR", description: "Review a pull request" },
			{ name: "Bug analysis", description: "Analyze a bug" },
		];
		useFloatingPanelStore.setState({ detachedPanels: {}, panels: {}, slots: {} });
	});

	it("renders an unnamed skill without crashing the search filter", () => {
		mockSkills = [{ name: undefined, description: "Not named yet" }];

		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatToolsMenu, {
					catalogName: "docs",
					onFileChange: jest.fn(),
					onSkillChange: jest.fn(),
					selectedSkillName: null,
				}),
			),
		);

		fireEvent.keyDown(screen.getByRole("button", { name: "Add file and more" }), { key: "Enter" });
		const skillsTrigger = screen.getByText("Skills");
		skillsTrigger.focus();
		fireEvent.keyDown(skillsTrigger, { key: "ArrowRight" });

		expect(screen.getByText("Unnamed skill")).not.toBeNull();
	});

	it("opens skills in a searchable submenu", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatToolsMenu, {
					catalogName: "docs",
					onFileChange: jest.fn(),
					onSkillChange: jest.fn(),
					selectedSkillName: null,
				}),
			),
		);

		fireEvent.keyDown(screen.getByRole("button", { name: "Add file and more" }), { key: "Enter" });
		const skillsTrigger = screen.getByText("Skills");
		skillsTrigger.focus();
		fireEvent.keyDown(skillsTrigger, { key: "ArrowRight" });

		const search = screen.getByPlaceholderText("Search skills...");
		expect(search.getAttribute("type")).toBe("search");

		fireEvent.change(search, { target: { value: "bug" } });

		expect(screen.queryByText("Review PR")).toBeNull();
		expect(screen.getByText("Bug analysis")).not.toBeNull();
	});

	it("opens the skills panel next to the agent panel", () => {
		useFloatingPanelStore.getState().registerPanel({ id: AGENT_SKILLS_PANEL_ID, title: "Skills" });
		const agentPanel = document.createElement("div");
		agentPanel.dataset.floatingPanelId = "agent-chat";
		agentPanel.getBoundingClientRect = () =>
			({ bottom: 680, height: 480, left: 600, right: 920, top: 200, width: 320 }) as DOMRect;
		document.body.append(agentPanel);

		render(
			createElement(
				TooltipProvider,
				null,
				createElement(ChatToolsMenu, {
					catalogName: "docs",
					onFileChange: jest.fn(),
					onSkillChange: jest.fn(),
					selectedSkillName: null,
				}),
			),
		);

		fireEvent.keyDown(screen.getByRole("button", { name: "Add file and more" }), { key: "Enter" });
		const skillsTrigger = screen.getByText("Skills");
		skillsTrigger.focus();
		fireEvent.keyDown(skillsTrigger, { key: "ArrowRight" });
		fireEvent.click(screen.getByText("Manage skills"));

		expect(useFloatingPanelStore.getState().panels[AGENT_SKILLS_PANEL_ID].position).toEqual({ x: 268, y: 200 });
		agentPanel.remove();
	});
});
