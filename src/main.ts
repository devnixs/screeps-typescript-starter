import { ErrorMapper } from "utils/ErrorMapper";
import { roleBuilder } from "roles/builder";
import { roleHarvester } from "roles/harvester";
import { roleUpgrader } from "roles/upgrader";
import { roleRanged } from "roles/ranged";
import { roleFighter } from "roles/fighter";
import { spawner } from "./spawner";
import { roleReparator } from "roles/reparator";
import { roleExplorer } from "roles/explorer";
import { Architect } from "./managers/architect";
import { roleLongDistanceHarvester } from "roles/longDistanceHarvester";
import { profiler } from "./utils/profiler";
import { roleTower } from "roles/tower";
import { rolePickaBoo } from "roles/pickaboo";
import { roleClaimer } from "roles/claimer";

import "./utils/navigator";
import "./utils/stats";
import "./utils/room-extender";
import { roleMiner } from "roles/miner";
import { roleHealer } from "roles/healer";
import { Chemist } from "./managers/chemist";
import { roleTruck } from "roles/truck";
import { roleDismantler } from "roles/dismantler";
import { LinkManager } from "utils/link-manager";
import { Merchant } from "./managers/merchant";
import { roleStaticHarvester } from "roles/static-harvester";
import { roleVersatile } from "roles/versatile";
import { roleAttacker } from "roles/attacker";
import { getCpuAverage } from "utils/cpu";
import { Observer } from "utils/observer";
import { rolePestControl, RolePestControl } from "roles/pestcontrol";
import { SafeModeActivator } from "utils/safemode-activator";
import { roleReserver } from "roles/reserver";
import { roleLongDistanceTruck } from "roles/longdistancetruck";
import { RemotesManager } from "./managers/remotes-manager";
import { roleRemoteDefender } from "roles/remote-defender";
import { DefenseManager } from "./managers/defense";
import { ExplorationManager } from "./managers/exploration";
import { roleScout } from "roles/scout";
import { roleLocalDefender } from "roles/local-defender";
import { UpgradeManager } from "managers/upgrader";
import { ConquestManager } from "managers/conquest";
import { RoomPlanner } from "managers/roomplanner";

// profiler.enable();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(function() {
    if ("sim" in Game.rooms) {
      return;
    }

    /*     console.log("Bucket :" + Game.cpu.bucket);
    console.log("Used :" + Game.cpu.getUsed());
    console.log("Limit :" + Game.cpu.limit);
    console.log("TickLimit :" + Game.cpu.tickLimit); */

    if (Game.cpu.tickLimit < 200) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Bucket almost empty. Skipping tick.");
      return;
    }
    Chemist.runForAllRooms();
    LinkManager.runForAllRooms();
    Merchant.runForAllRooms();
    RemotesManager.runForAllRooms();

    let error: any = null;

    for (var name in Game.creeps) {
      var creep = Game.creeps[name];
      const memory = creep.memory;
      if (creep.spawning) {
        continue;
      }

      try {
        if (memory.role == "harvester") {
          roleHarvester.run(creep);
        }
        if (memory.role == "static-harvester") {
          roleStaticHarvester.run(creep);
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
        if (memory.role == "long-distance-truck") {
          roleLongDistanceTruck.run(creep);
        }
        if (memory.role == "miner") {
          roleMiner.run(creep);
        }
        if (memory.role == "versatile") {
          roleVersatile.run(creep);
        }
        if (memory.role == "attacker") {
          roleAttacker.run(creep);
        }
        if (memory.role == "pestcontrol") {
          rolePestControl.run(creep);
        }
        if (memory.role == "reserver") {
          roleReserver.run(creep);
        }
        if (memory.role == "remote-defender") {
          roleRemoteDefender.run(creep);
        }
        if (memory.role == "local-defender") {
          roleLocalDefender.run(creep);
        }
        if (memory.role == "scout") {
          roleScout.run(creep);
        }
      } catch (e) {
        console.log(e, creep.name);
        error = e;
      }
    }

    roleTower.runAllTowers();

    Architect.runForAllRooms();
    DefenseManager.runForAllRooms();
    Observer.runAllObservers();
    ExplorationManager.runForAllRooms();
    RolePestControl.checkReconstruction();
    SafeModeActivator.activeSafeModeIfNecessary();
    UpgradeManager.runForAllRooms();
    ConquestManager.run();
    RoomPlanner.runForAllRooms();

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }

    if (Game.time % 1300 === 0) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Used :" + Game.cpu.getUsed());
      console.log("Average CPU : ", getCpuAverage());
      //console.log("Limit :" + Game.cpu.limit);
      //console.log("TickLimit :" + Game.cpu.tickLimit);
    }

    Memory.rooms = Memory.rooms || {};

    if (Game.cpu.getUsed() > 100) {
      console.log("Used a lot of cpu : ", Game.cpu.getUsed(), Game.time);
    }

    if (Game.time % 7 === 0) {
      Memory.cpuUsages = Memory.cpuUsages || [];
      Memory.cpuUsages.push(Game.cpu.getUsed());
      if (Memory.cpuUsages.length > 100) {
        Memory.cpuUsages.shift();
      }
    }

    // shutdown attack
    /*
    if (Game.flags["versatile_attack"] && Game.time > 7084587 + 3000) {
      Game.flags["versatile_attack"].remove();
      Game.flags["boostmode_5"].remove();
    } */
    /*     if (
      Game.flags["dismantler_attack"] &&
      !Game.getObjectById("5c1cbb97e38b1f6a4735759e") &&
      Game.getObjectById("5c1cbb95c219895c92dfdb3d")
    ) {
      Game.flags["dismantler_attack"].remove();
    } */

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
