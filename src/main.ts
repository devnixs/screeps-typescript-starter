import { ErrorMapper } from "utils/ErrorMapper";
import { roleBuilder } from "roles/builder";
import { roleHarvester } from "roles/harvester";
import { roleUpgrader } from "roles/upgrader";
import { roleRanged } from "roles/ranged";
import { roleFighter } from "roles/fighter";
import { spawner } from "./spawner";

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  spawner.run();

  for (var name in Game.creeps) {
    var creep = Game.creeps[name];
    const memory = creep.memory;
    if (memory.role == "harvester") {
      roleHarvester.run(creep);
    }
    if (memory.role == "upgrader") {
      roleUpgrader.run(creep);
    }
    if (memory.role == "builder") {
      roleBuilder.run(creep);
    }
    if (memory.role == "ranged") {
      roleRanged.run(creep);
    }
    if (memory.role == "fighter") {
      roleFighter.run(creep);
    }
  }

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
});
