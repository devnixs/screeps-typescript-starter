export type roles = "harvester" | "upgrader" | "builder" | "ranged";

export interface BaseCreepMemory {
  role: roles;
  subRole?: string;
}
