import { getExecutingEnvironment } from "@app/resolveModule/env";
import { calendarSkill } from "./calendar";
import { diagramsSkill } from "./diagrams";
import { mailSkill } from "./mail";
import { planningSkill } from "./planning";
import { skillsSkill } from "./skills";

export const systemSkills = [
	diagramsSkill,
	skillsSkill,
	planningSkill,
	calendarSkill,
	...(getExecutingEnvironment() === "tauri" ? [mailSkill] : []),
];
