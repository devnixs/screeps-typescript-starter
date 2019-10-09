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
import { getAverageCpu, measureCpuAverage } from "utils/cpu";
import { Observer } from "utils/observer";
import { rolePestControl, RolePestControl } from "roles/pestcontrol";
import { SafeModeActivator } from "utils/safemode-activator";
import { roleReserver } from "roles/reserver";
import { roleLongDistanceTruck } from "roles/longdistancetruck";
import { RemotesManager } from "./managers/remotes-manager";
import { roleRemoteDefender } from "roles/remote-defender";
import { DefenseManager } from "./managers/defense";
import { RoomAnalyzer } from "./managers/room-analyzer";
import { ExplorationCache } from "./utils/exploration-cache";
import { roleScout } from "roles/scout";
import { roleLocalDefender } from "roles/local-defender";
import { UpgradeManager } from "managers/upgrader";
import { ConquestManager } from "managers/conquest";
import { RoomPlanner } from "managers/roomplanner";
import { StatsManager } from "managers/stats-manager";
import { SegmentManager } from "managers/segments";
import { CachedPaths } from "utils/cached-paths";
import { AttackManager } from "managers/attack";
import { AttackPartyManager } from "managers/attack-party";
import { roleTransport } from "roles/transport";
import { rolePoker } from "roles/poker";
import { PokingManager } from "managers/poking";
import { runTimeout } from "utils/set-timeout";
import { StealingManager } from "managers/stealing";
import { roleStealer } from "roles/stealer";
import { AttackPlanner } from "managers/attack-planner";
import { simpleAllies } from "managers/team-manager";
import { runFromTimeToTime } from "utils/misc-utils";
import { roleRemoteCamper } from "roles/remote-camper";
import { RemoteCampingManager } from "managers/remote-camping";
import { roleDowngrader } from "roles/downgrader";
import { whitelist } from "constants/misc";

console.log("Code has been loaded");

// profiler.enable();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(function() {
    try {
      runTimeout();
    } catch (e) {
      console.log("Failed to run timeout", e);
    }

    if (Game.time % 333 === 0) {
      const initial = Game.cpu.getUsed();
      console.log(
        "Time spent deserializing",
        Memory.lastConquestTime ? Game.cpu.getUsed() - initial : Game.cpu.getUsed() - initial
      );
    }

    /*     if ("sim" in Game.rooms) {
      const flag = Game.flags["t"];
      RoomPlanner.initPlanner(flag.pos.x, flag.pos.y, Game.rooms.sim);
      return;
    } */

    /*     console.log("Bucket :" + Game.cpu.bucket);
    console.log("Used :" + Game.cpu.getUsed());
    console.log("Limit :" + Game.cpu.limit);
    console.log("TickLimit :" + Game.cpu.tickLimit); */

    if (Game.cpu.tickLimit < 200) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Bucket almost empty. Skipping tick.");
      return;
    }
    let error: any = null;
    try {
      spawner.run();
    } catch (e) {
      error = e;
    }
    try {
      if (whitelist.length) {
        simpleAllies.startOfTick();
        simpleAllies.run();
      }
    } catch (e) {
      error = e;
    }
    Chemist.runForAllRooms();
    LinkManager.runForAllRooms();
    Merchant.runForAllRooms();
    RemotesManager.runForAllRooms();

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
        if (memory.role == "remote-defender-helper") {
          roleRemoteDefender.run(creep);
        }
        if (memory.role == "local-defender") {
          roleLocalDefender.run(creep);
        }
        if (memory.role == "scout") {
          roleScout.run(creep);
        }
        if (memory.role == "transport") {
          roleTransport.run(creep);
        }
        if (memory.role == "poker") {
          rolePoker.run(creep);
        }
        if (memory.role == "stealer") {
          roleStealer.run(creep);
        }
        if (memory.role == "remote-camper") {
          roleRemoteCamper.run(creep);
        }
        if (memory.role == "downgrader") {
          roleDowngrader.run(creep);
        }
      } catch (e) {
        console.log(e, creep.name);
        error = e;
      }
    }

    let step = 0;
    try {
      roleTower.runAllTowers();
      step = 1;

      Architect.runForAllRooms();
      step = 2;
      DefenseManager.runForAllRooms();
      step = 3;
      Observer.runAllObservers();
      step = 4;
      RoomAnalyzer.run();
      step = 5;
      ExplorationCache.run();
      step = 6;
      RolePestControl.checkReconstruction();
      step = 7;
      SafeModeActivator.activeSafeModeIfNecessary();
      step = 8;
      UpgradeManager.runForAllRooms();
      step = 9;
      // ConquestManager.run()
      step = 10;
      RoomPlanner.runForAllRooms();
      step = 11;
      CachedPaths.run();
      step = 12;
      SegmentManager.run();
      step = 13;
      AttackManager.run();
      step = 14;
      AttackPartyManager.runForAllAttackParties();
      step = 15;
      AttackPlanner.run();
      step = 16;
      PokingManager.runForAllRooms();
      step = 17;
      StealingManager.runForAllRooms();
      step = 18;
      RemoteCampingManager.runForAllRooms();
      step = 19;

      if (whitelist.length) {
        simpleAllies.endOfTick();
        step = 20;
      }
    } catch (e) {
      console.log("Failed to run managers.", e, "Failed at step=", step);
      error = e;
    }
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
    for (const name in Memory.flags) {
      if (!(name in Game.flags)) {
        delete Memory.flags[name];
      }
    }

    // cleanup useless room memories
    if (Game.time % 20000 === 0) {
      for (const roomName in Memory.rooms) {
        if (Object.keys(Memory.rooms[roomName]).length === 0) {
          console.log("Cleaning up room", roomName);
          delete Memory.rooms[roomName];
        }
      }
    }

    if (Game.time % 500 === 0) {
      console.log("Bucket :" + Game.cpu.bucket);
      console.log("Used :" + Game.cpu.getUsed());
      console.log("Average CPU : ", getAverageCpu());
      //console.log("Limit :" + Game.cpu.limit);
      //console.log("TickLimit :" + Game.cpu.tickLimit);
    }

    Memory.rooms = Memory.rooms || {};

    if (Game.cpu.getUsed() > Game.cpu.limit * 2) {
      console.log("Used a lot of cpu : ", Game.cpu.getUsed(), Game.time);
    }

    StatsManager.runForAllRooms();

    // Stop attack
    // TODO: remove this code
    /*     if (Game.time ===  292456 + 20000) {
      const claimFlag = Game.flags.claimer_target;

      if(claimFlag){
        claimFlag.setPosition(new RoomPosition())
      }
    } */

    /*     const storage1 = Game.getObjectById("5d53a21104d374529de1b682") as StructureStorage;
    const terminal1 = Game.getObjectById("5d5489eab42d6a66a3f2cfce") as StructureTerminal;
    if (storage1 && terminal1) {
      if (
        terminal1.store.energy > 10000 &&
        !terminal1.cooldown &&
        storage1.store.energy > 150000 &&
        runFromTimeToTime(500, 1000)
      ) {
        console.log("Sending energy to Tigga");

        const res = terminal1.send(RESOURCE_ENERGY, 10000, "W2N3");
        if (res === OK) {
          Memory.shares = Memory.shares || {};
          Memory.shares["energy"] = Memory.shares["energy"] || 0;
          Memory.shares["energy"] += 10000;
        }
      }
    } */
    /*
    const storage2 = Game.getObjectById("5d549d0732f0ba666cd64aaa") as StructureStorage;
    const terminal2 = Game.getObjectById("5d55d14dc5cdea666aab5500") as StructureTerminal;
    if (storage2 && terminal1) {
      if (
        terminal2.store.energy > 10000 &&
        !terminal2.cooldown &&
        storage2.store.energy > 150000 &&
        runFromTimeToTime(500, 1000)
      ) {
        console.log("2. Sending energy to my other room...");
        terminal2.send(RESOURCE_ENERGY, 1000, "W1N5");
      }
    }
 */
    if (error) {
      throw error;
    }
  });
});
