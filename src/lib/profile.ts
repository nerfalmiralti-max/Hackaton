import type { Profile } from "./types";
export const defaultProfile: Profile = { name: "", school: "", grade: 0, language: "ru" };
export interface SchoolContextProvider {
  getContext(): { simulated: true; events: { subject: string; task: string; daysFromNow: number }[]; learning: { subject: string; topic: string; level: string }[] };
}
export const demoSchoolProvider: SchoolContextProvider = {
  getContext: () => ({
    simulated: true,
    events: [],
    learning: [],
  }),
};
