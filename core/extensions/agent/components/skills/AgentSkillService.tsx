import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { refreshPage } from "@core-ui/utils/initGlobalFuncs";
import ArticleAgentSkill from "@ext/agent/components/skills/Article/ArticleAgentSkill";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import { createContext, useContext, useState } from "react";

export type AgentSkillContextType = {
	skills: Map<string, ProviderItemProps>;
	selectedID: string | null;
	remoteVersion: number;
};

export const AgentSkillContext = createContext<AgentSkillContextType>({
	skills: new Map(),
	selectedID: null,
	remoteVersion: 0,
});

class AgentSkillService {
	private _setSkills: (skills: Map<string, ProviderItemProps>) => void = () => {};
	private _setSelectedID: (selectedID: string | null) => void = () => {};
	private _bumpRemoteVersion: () => void = () => {};
	private _isNext: boolean;

	Init = ({ children }: { children: JSX.Element }): JSX.Element => {
		const [skills, setSkills] = useState<Map<string, ProviderItemProps>>(new Map());
		const [selectedID, setSelectedID] = useState<string | null>(null);
		const [remoteVersion, setRemoteVersion] = useState(0);
		const { isNext } = usePlatform();

		this._isNext = isNext;
		this._setSkills = setSkills;
		this._setSelectedID = setSelectedID;
		this._bumpRemoteVersion = () => setRemoteVersion((v) => v + 1);
		return (
			<AgentSkillContext.Provider value={{ skills, selectedID, remoteVersion }}>
				{children}
			</AgentSkillContext.Provider>
		);
	};

	get value(): AgentSkillContextType {
		return useContext(AgentSkillContext);
	}

	setItems(skills: ProviderItemProps[], isRemote = false) {
		this._setSkills(new Map(skills.map((skill) => [skill.id, skill])));
		if (isRemote) this._bumpRemoteVersion();
	}

	closeItem() {
		ArticleViewService.setDefaultView();
		if (!this._isNext) refreshPage();
		this._setSelectedID(null);
	}

	openItem(skill: ProviderItemProps) {
		ArticleViewService.setView(() => <ArticleAgentSkill item={skill} />);
		this._setSelectedID(skill.id);
	}
}

export default new AgentSkillService();
