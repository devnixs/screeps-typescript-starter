import { ILongDistanceHarvesterMemory } from "roles/longDistanceHarvester";
import { IDismantlerMemory } from "roles/dismantler";
import { requiredFightersForAnAttack, requiredDismantlersForAnAttack } from "./constants/misc";
import { requiredHealersForAnAttack } from "./constants/misc";
import { profiler } from "./utils/profiler";
import { IHarvesterMemory } from "./roles/harvester";
import { IStaticHarvesterMemory } from "roles/static-harvester";
import { findClosestRoom } from "utils/finder";
import { RoleBuilder } from "roles/builder";

export interface RoleRequirement {
  role: roles;
  percentage: number;
  maxCount?: number;
  exactBody?: BodyPartConstant[];
  bodyTemplate?: BodyPartConstant[];
  bodyTemplatePrepend?: BodyPartConstant[];
  additionalMemory?: any;
  countAllRooms?: boolean;
  capMaxEnergy?: number;
  minEnergy?: number;
  sortBody?: BodyPartConstant[];
  subRole?: string;
  onlyRoom?: string;
}

// MOVE	            50	Moves the creep. Reduces creep fatigue by 2/tick. See movement.
// WORK	            100	Harvests energy from target source. Gathers 2 energy/tick.
// CARRY	        50	Stores energy. Contains up to 50 energy units. Weighs nothing when empty.
// ATTACK	        80	Attacks a target creep/structure. Deals 30 damage/tick. Short-ranged attack (1 tile).
// RANGED_ATTACK	150	Attacks a target creep/structure. Deals 10 damage/tick. Long-ranged attack (1 to 3 tiles).
// HEAL	            250	Heals a target creep. Restores 12 hit points/tick at short range (1 tile) or 4 hits/tick at a distance (up to 3 tiles).
// TOUGH	        10	No effect other than the 100 hit points all body parts add. This provides a cheap way to add hit points to a creep.
// CLAIM	        600

// Stuff that needs to be computed once.

let claimerCount = 0;
let closestRoomToClaimTarget = "";

let builderHelperCount = 0;
let builderHelperTarget: string | undefined = undefined;
let builderHelperSource: string | undefined = undefined;

let lastInitializationTick: number | undefined;
function initOneTimeValues() {
  if (lastInitializationTick === Game.time) {
    return;
  } else {
    lastInitializationTick = Game.time;
  }

  const claimFlag = Game.flags["claimer_target"];
  if (
    claimFlag &&
    Game.map.isRoomAvailable(claimFlag.pos.roomName) &&
    !(claimFlag.room && claimFlag.room.controller && claimFlag.room.controller.my)
  ) {
    claimerCount = 1;
    closestRoomToClaimTarget = findClosestRoom(claimFlag.pos.roomName);
    console.log("Found claim target : ", claimFlag.pos.roomName);
    console.log("closestRoomToClaimTarget : ", closestRoomToClaimTarget);
    console.log("claimerCount : ", claimerCount);
  }

  let colonyThatNeedsHelpBuilding = Object.keys(Game.rooms)
    .map(i => Game.rooms[i])
    .filter(i => i.controller && i.controller.my && i.controller.level === 1)[0];

  if (colonyThatNeedsHelpBuilding) {
    var initialCpu = Game.cpu.getUsed();
    builderHelperSource = findClosestRoom(colonyThatNeedsHelpBuilding.name);
    var afterCpu = Game.cpu.getUsed();
    console.log("Used CPU: ", afterCpu - initialCpu);
    builderHelperTarget = colonyThatNeedsHelpBuilding.name;
    builderHelperCount = 1;
    console.log("Found colonyThatNeedsHelpBuilding : ", colonyThatNeedsHelpBuilding.name);
    console.log("builderHelperTarget : ", colonyThatNeedsHelpBuilding.name);
    console.log("builderHelperSource : ", builderHelperSource);
    console.log("builderHelperCount : ", builderHelperCount);
  }
}

export function getSpawnerRequirements(spawn: StructureSpawn): RoleRequirement[] {
  initOneTimeValues();

  const hasSafeMode = spawn.room.controller && spawn.room.controller.safeMode;

  const maxEnergyInRoom = spawn.room.energyCapacityAvailable;

  const harvesters = spawn.room
    .find(FIND_MY_CREEPS)
    .filter(i => i.memory.role === "harvester" || i.memory.role === "static-harvester");

  const towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });
  const extractors = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "extractor" });
  const mineralWithReserve = spawn.room.find(FIND_MINERALS, { filter: i => i.mineralAmount > 0 });
  // const labs = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "lab" });
  const links = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "link" });
  const enemies = spawn.room.find(FIND_HOSTILE_CREEPS);
  const constructionSites = spawn.room.find(FIND_MY_CONSTRUCTION_SITES);

  const storageQuantity = spawn.room.storage && _.sum(spawn.room.storage.store);

  let upgraderRatio: number;
  let maxUpgraderCount: number = 1;

  var needsBuilder = false;
  if (!spawn.room.memory.nextCheckNeedsBuilder || spawn.room.memory.nextCheckNeedsBuilder < Game.time) {
    var targetStructure = RoleBuilder.findTargetStructure(spawn.room, false);
    if (!targetStructure) {
      spawn.room.memory.nextCheckNeedsBuilder = Game.time + 1000;
    } else {
      spawn.room.memory.nextCheckNeedsBuilder = Game.time + 300;
      needsBuilder = true;
    }
  }

  if (links.length === 0) {
    if (constructionSites.length) {
      maxUpgraderCount = 1;
    } else {
      maxUpgraderCount = 8;
    }
  }

  if (spawn.room.controller && spawn.room.controller.level === 8) {
    if (spawn.room.controller.ticksToDowngrade <= 6000) {
      maxUpgraderCount = 1;
      upgraderRatio = 1;
    } else {
      maxUpgraderCount = 0;
      upgraderRatio = 0;
    }
  } else {
    if (spawn.room.storage) {
      const availableEnergy = spawn.room.storage.store.energy;
      if (availableEnergy > 800000) {
        upgraderRatio = 10;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 600000) {
        upgraderRatio = 8;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 300000) {
        upgraderRatio = 6;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 200000) {
        upgraderRatio = 4;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 150000) {
        upgraderRatio = 3;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 20000) {
        upgraderRatio = 2;
        maxUpgraderCount = 1;
      } else {
        upgraderRatio = 1;
        maxUpgraderCount = 1;
      }
    } else {
      const containers: StructureContainer[] = spawn.room.find(FIND_STRUCTURES, {
        filter: i => i.structureType === "container"
      }) as any;

      if (containers.length === 0) {
        upgraderRatio = 3;
      } else {
        const totalStorage = _.sum(containers.map(i => i.storeCapacity));
        const totalEnergy = _.sum(containers.map(i => i.store.energy));

        const ratio = totalEnergy / totalStorage;
        if (ratio >= 0.7) {
          upgraderRatio = 10;
          maxUpgraderCount = 6;
        } else if (ratio >= 0.5) {
          upgraderRatio = 8;
          maxUpgraderCount = 4;
        } else if (ratio >= 0.25) {
          upgraderRatio = 6;
          maxUpgraderCount = 2;
        } else if (ratio >= 0.1) {
          upgraderRatio = 2;
          maxUpgraderCount = 2;
        } else {
          upgraderRatio = 1;
          maxUpgraderCount = 2;
        }
      }
    }
  }

  /*   if (harvesters.length === 0) {
    // we need at least one harvester
    return [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 4,
        exactBody: [MOVE, WORK, CARRY]
      }
    ];
  }
 */
  if ("sim" in Game.rooms) {
    upgraderRatio = 0;
    claimerCount = 0;
  }

  const harvesterDefinitions = spawn.room
    .find(FIND_SOURCES)
    .map(source => {
      const energyRate = source.energyCapacity / 300;
      const currentEnergyRateForThisSource = _.sum(
        harvesters.filter(i => i.memory.subRole === source.id).map(i => i.getActiveBodyparts(WORK) * HARVEST_POWER)
      );
      const requiredAdditionalEnergyRate = energyRate - currentEnergyRateForThisSource;
      if (requiredAdditionalEnergyRate <= 0) {
        return null;
      }

      const closeContainer: StructureContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0] as any;

      let carryCount = 0;
      if (closeContainer) {
        // we don't need to be able to carry
        carryCount = 0;
      } else {
        // we need to be able to carry
        carryCount = 1;
      }

      // build creep with max build rate, otherwise we will end up indefinitely with multiple creeps

      const neededWorkParts = Math.ceil(energyRate / HARVEST_POWER);
      const neededEnergy = neededWorkParts * BODYPART_COST.work + BODYPART_COST.move + carryCount * BODYPART_COST.carry;

      if (closeContainer) {
        return {
          percentage: 20,
          role: "static-harvester",
          subRole: source.id,
          maxCount:
            storageQuantity && spawn.room.storage && storageQuantity >= spawn.room.storage.storeCapacity * 0.95 ? 0 : 1,
          bodyTemplate: [WORK],
          bodyTemplatePrepend: [MOVE],
          minEnergy: BODYPART_COST.work + BODYPART_COST.move,
          capMaxEnergy: neededEnergy,
          additionalMemory: {
            targetContainerId: closeContainer.id
          } as IStaticHarvesterMemory
        } as RoleRequirement;
      } else {
        return {
          percentage: 20,
          role: "harvester",
          subRole: source.id,
          maxCount: 3,
          bodyTemplate: [WORK],
          bodyTemplatePrepend: [MOVE, CARRY],
          minEnergy: BODYPART_COST.work + BODYPART_COST.move + BODYPART_COST.carry,
          capMaxEnergy: neededEnergy
        } as RoleRequirement;
      }
    })
    .filter(i => i)
    .map(i => i as RoleRequirement);

  return [
    ...harvesterDefinitions,
    {
      percentage: 2,
      role: "truck",
      maxCount: spawn.room.memory.trucksCount || 1,
      bodyTemplate: [MOVE, CARRY, CARRY]
    },
    {
      percentage: 2,
      role: "builder",
      maxCount: needsBuilder ? 1 : 0,
      bodyTemplate: [MOVE, WORK, CARRY]
    },
    {
      percentage: 2,
      role: "builder",
      maxCount: builderHelperCount,
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1900,
      onlyRoom: builderHelperSource,
      subRole: builderHelperTarget
    },
    {
      percentage: 2,
      role: "reparator",
      maxCount: 1, // handled by towers
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1400
    },
    {
      percentage: 20,
      role: "dismantler",
      maxCount: Game.flags["dismantler_attack"] ? requiredDismantlersForAnAttack : 0,
      countAllRooms: true,
      bodyTemplate: [TOUGH, TOUGH, TOUGH, WORK, WORK, RANGED_ATTACK, MOVE, MOVE, MOVE],
      sortBody: [TOUGH, WORK, MOVE, RANGED_ATTACK],
      onlyRoom: "E25N48",
      subRole: "room1",
      additionalMemory: {} as IDismantlerMemory
    },
    {
      percentage: 20,
      role: "versatile",
      maxCount: Game.flags["versatile_attack"] ? 1 : 0,
      countAllRooms: true,
      bodyTemplate: [TOUGH, TOUGH, RANGED_ATTACK, WORK, MOVE, HEAL, HEAL, HEAL, HEAL],
      sortBody: [TOUGH, RANGED_ATTACK, WORK, MOVE, HEAL],
      onlyRoom: "E19N47",
      additionalMemory: {} as IDismantlerMemory
    },
    {
      percentage: 20,
      role: "healer",
      maxCount: Game.flags["fighter_attack"] || Game.flags["dismantler_attack"] ? requiredHealersForAnAttack : 0,
      bodyTemplate: [HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE],
      sortBody: [TOUGH, HEAL, MOVE],
      onlyRoom: "E27N47",
      capMaxEnergy: 1600,
      minEnergy: 1300
    },
    {
      percentage: 1,
      role: "fighter",
      maxCount: Game.flags["fighter_attack"]
        ? requiredFightersForAnAttack
        : enemies.length > 0 && towers.length === 0
        ? 1
        : 0,
      bodyTemplate: [TOUGH, MOVE, MOVE, ATTACK],
      sortBody: [TOUGH, MOVE, ATTACK]
    },
    {
      percentage: 1,
      role: "miner",
      maxCount: extractors.length >= 1 && mineralWithReserve.length > 0 ? 1 : 0,
      bodyTemplate: [MOVE, WORK, CARRY, WORK, CARRY, WORK, CARRY],
      capMaxEnergy: 1800,
      sortBody: [MOVE, WORK, CARRY]
    },
    {
      percentage: 4,
      role: "long-distance-harvester",
      maxCount: 1,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room10",
      onlyRoom: "E22N36",
      capMaxEnergy: 1800,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E21N36",
        targetRoomX: 39,
        targetRoomY: 16
      } as Partial<ILongDistanceHarvesterMemory>
    },
    {
      percentage: 4,
      role: "long-distance-harvester",
      maxCount: 1,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room11",
      onlyRoom: "E22N35",
      capMaxEnergy: 1800,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E21N35",
        targetRoomX: 41,
        targetRoomY: 39
      } as Partial<ILongDistanceHarvesterMemory>
    } /*
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: 2,
      countAllRooms: true,
      onlyRoom: "E27N47",
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room2",
      capMaxEnergy: 1800,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E26N47",
        targetRoomX: 26,
        targetRoomY: 31
      } as Partial<ILongDistanceHarvesterMemory>
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: 2,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room3",
      onlyRoom: "E27N47",
      capMaxEnergy: 1800,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E26N48",
        targetRoomX: 32,
        targetRoomY: 46
      } as Partial<ILongDistanceHarvesterMemory>
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: maxEnergyInRoom > 1500 ? 2 : 3,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room4",
      onlyRoom: "E25N48",
      capMaxEnergy: 1200,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E24N48",
        targetRoomX: 24,
        targetRoomY: 17
      } as Partial<ILongDistanceHarvesterMemory>
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: maxEnergyInRoom > 1500 ? 2 : 3,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room5",
      onlyRoom: "E25N48",
      capMaxEnergy: 1200,
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        targetRoomName: "E24N48",
        targetRoomX: 8,
        targetRoomY: 7
      } as Partial<ILongDistanceHarvesterMemory>
    }, */,
    {
      percentage: 1,
      role: "upgrader",
      maxCount: maxUpgraderCount,
      bodyTemplate:
        maxEnergyInRoom < 500 || links.length === 0 ? [MOVE, WORK, CARRY] : [MOVE, WORK, WORK, WORK, WORK, CARRY],
      capMaxEnergy: 600 * upgraderRatio
    },
    {
      percentage: 1,
      role: "claimer",
      maxCount: claimerCount,
      onlyRoom: closestRoomToClaimTarget,
      exactBody: [MOVE, CLAIM]
    },
    {
      percentage: 1,
      role: "pickaboo",
      maxCount: 0,
      countAllRooms: true,
      bodyTemplate: [TOUGH, MOVE],
      sortBody: [TOUGH, WORK, MOVE],
      subRole: "room1",
      capMaxEnergy: 60,
      onlyRoom: "E27N47",
      additionalMemory: {} as IDismantlerMemory
    }
  ];
}
