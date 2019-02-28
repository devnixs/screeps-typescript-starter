import { ErrorMapper } from "utils/ErrorMapper";
import { roleBuilder } from "roles/builder";
import { roleHarvester } from "roles/harvester";
import { roleUpgrader } from "roles/upgrader";
import { roleRanged } from "roles/ranged";
import { roleFighter } from "roles/fighter";
import { spawner } from "./spawner";
import { roleReparator } from "roles/reparator";
import { roleExplorer } from "roles/explorer";
import { architect } from "architect";
import { roleLongDistanceHarvester } from "roles/longDistanceHarvester";
import { profiler } from "./utils/profiler";
import { roleTower } from "roles/tower";
import { rolePickaBoo } from "roles/pickaboo";
import { roleClaimer } from "roles/claimer";

import "./utils/navigator";
import { roleMiner } from "roles/miner";
import { roleHealer } from "roles/healer";
import { Chemist } from "chemist";
import { roleTruck } from "roles/truck";
import { roleDismantler } from "roles/dismantler";
import { LinkManager } from "utils/link-manager";

// profiler.enable();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(function() {
    /*     console.log("Bucket :" + Game.cpu.bucket);
    console.log("Used :" + Game.cpu.getUsed());
    console.log("Limit :" + Game.cpu.limit);
    console.log("TickLimit :" + Game.cpu.tickLimit); */

    if (Game.cpu.tickLimit < 80) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Bucket almost empty. Skipping tick.");
      return;
    }
    spawner.run();
    Chemist.runForAllRooms();
    LinkManager.runForAllRooms();

    let error: any = null;

    for (var name in Game.creeps) {
      var creep = Game.creeps[name];
      const memory = creep.memory;
      try {
        if (memory.role == "harvester") {
          roleHarvester.run(creep);
        }
        if (memory.role == "upgrader") {
          roleUpgrader.run(creep);
        }
        if (memory.role == "builder") {
          roleBuilder.run(creep);
        }
        if (memory.role == "dismantler") {
          roleDismantler.run(creep);
        }
        if (memory.role == "ranged") {
          roleRanged.run(creep);
        }
        if (memory.role == "fighter") {
          roleFighter.run(creep);
        }
        if (memory.role == "reparator") {
          roleReparator.run(creep);
        }
        if (memory.role == "explorer") {
          roleExplorer.run(creep);
        }
        if (memory.role == "pickaboo") {
          rolePickaBoo.run(creep);
        }
        if (memory.role == "claimer") {
          roleClaimer.run(creep);
        }
        if (memory.role == "healer") {
          roleHealer.run(creep);
        }
        if (memory.role == "truck") {
          roleTruck.run(creep);
        }
        if (memory.role == "long-distance-harvester") {
          roleLongDistanceHarvester.run(creep);
        }
        if (memory.role == "miner") {
          roleMiner.run(creep);
        }
      } catch (e) {
        error = e;
      }
    }

    roleTower.runAllTowers();

    architect.run();

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    if (Game.time % 100 === 0) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Used :" + Game.cpu.getUsed());
      //console.log("Limit :" + Game.cpu.limit);
      //console.log("TickLimit :" + Game.cpu.tickLimit);
    }

    Memory.rooms = Memory.rooms || {};

    if (Game.cpu.getUsed() > 50) {
      console.log("Used a lot of cpu : ", Game.cpu.getUsed());
    }

    /*     if (Game.time % 37 === 0) {
      Memory.cpuUsages.push(Game.cpu.getUsed());
      if (Memory.cpuUsages.length > 20) {
        Memory.cpuUsages.shift();
      }
      console.log("Average CPU : ", _.sum(Memory.cpuUsages) / Memory.cpuUsages.length);
    }
 */
    /*
    // shutdown attack
    if (Game.time >= 4536722 && Game.flags["boostmode_1"]) {
      Game.flags["boostmode_1"].remove();
    }

    if (Game.time >= 4536722 + 3000 && Game.flags["dismantler_attack"]) {
      Game.flags["dismantler_attack"].remove();
    } */

    if (error) {
      throw error;
    }
  });
});
