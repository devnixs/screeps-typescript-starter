import { ILongDistanceHarvesterMemory } from "roles/longDistanceHarvester";
import { IDismantlerMemory } from "roles/dismantler";
import { requiredFightersForAnAttack, requiredDismantlersForAnAttack } from "./constants/misc";
import { requiredHealersForAnAttack } from "./constants/misc";
import { IStaticHarvesterMemory } from "roles/static-harvester";
import { findClosestRoom } from "utils/finder";
import { RoleBuilder } from "roles/builder";
import { IReserverMemory } from "roles/reserver";
import { ILongDistanceTruckMemory } from "roles/longdistancetruck";
import { IRemoteDefenderMemory } from "roles/remote-defender";
import { getMyRooms } from "utils/misc-utils";

export interface RoleRequirement {
  role: roles;
  percentage: number;

  maxRepatAccrossAll?: number;
  maxRepeat?: number;
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
  onlyRooms?: string[];
  disableIfLowOnCpu?: boolean;
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
let closestRoomToClaimTarget: string | undefined = "";

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

  const canColonize = Game.gcl.level > getMyRooms().length;
  const claimFlag = Game.flags["claimer_target"];
  if (
    claimFlag &&
    canColonize &&
    Game.map.isRoomAvailable(claimFlag.pos.roomName) &&
    !(claimFlag.room && claimFlag.room.controller && claimFlag.room.controller.my)
  ) {
    claimerCount = 1;
    closestRoomToClaimTarget = findClosestRoom(claimFlag.pos.roomName);
    /*     console.log("Found claim target : ", claimFlag.pos.roomName);
    console.log("closestRoomToClaimTarget : ", closestRoomToClaimTarget);
    console.log("claimerCount : ", claimerCount); */
  }

  const myRooms = getMyRooms();
  let colonyThatNeedsHelpBuilding = Object.keys(Game.rooms)
    .map(i => Game.rooms[i])
    .filter(
      i =>
        (i.controller && i.controller.my && i.controller.level === 1) ||
        (i.find(FIND_FLAGS, { filter: flag => flag.name === "claimer_target" }).length && canColonize)
    )[0];

  if (colonyThatNeedsHelpBuilding && myRooms.length > 1) {
    var initialCpu = Game.cpu.getUsed();
    builderHelperSource = findClosestRoom(colonyThatNeedsHelpBuilding.name);
    var afterCpu = Game.cpu.getUsed();
    //  console.log("Used CPU: ", afterCpu - initialCpu);
    builderHelperTarget = colonyThatNeedsHelpBuilding.name;
    builderHelperCount = 2;
    /* console.log("Found colonyThatNeedsHelpBuilding : ", colonyThatNeedsHelpBuilding.name);
    console.log("builderHelperTarget : ", colonyThatNeedsHelpBuilding.name);
    console.log("builderHelperSource : ", builderHelperSource);
    console.log("builderHelperCount : ", builderHelperCount); */
  }
}

export function getSpawnerRequirements(spawn: StructureSpawn): RoleRequirement[] {
  initOneTimeValues();

  /*   const hasSafeMode = spawn.room.controller && spawn.room.controller.safeMode;

  const maxEnergyInRoom = spawn.room.energyCapacityAvailable; */

  const harvesters = spawn.room
    .find(FIND_MY_CREEPS)
    .filter(i => i.memory.role === "harvester" || i.memory.role === "static-harvester");

  const towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });
  const extractors = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "extractor" });
  const mineralWithReserve = spawn.room.find(FIND_MINERALS, { filter: i => i.mineralAmount > 0 });
  const amountOfMineralInTerminal =
    spawn.room.terminal && mineralWithReserve && mineralWithReserve.length
      ? spawn.room.terminal.store[mineralWithReserve[0].mineralType] || 0
      : 0;
  // const labs = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "lab" });
  const links = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "link" });
  const enemies = spawn.room.find(FIND_HOSTILE_CREEPS);

  const constructionSites = spawn.room.find(FIND_MY_CONSTRUCTION_SITES);

  const storageQuantity = spawn.room.storage ? _.sum(spawn.room.storage.store) : 0;
  const isStorageAlmostFull = storageQuantity > 900000;
  const controllerLevel = spawn.room.controller ? spawn.room.controller.level : 0;

  let upgraderRatio: number;
  let maxUpgraderCount: number = 1;

  // OPTIMIZATION POSSIBLE
  var needsBuilder = !!RoleBuilder.findTargetStructure(spawn.room, false);
  /*   if (!spawn.room.memory.nextCheckNeedsBuilder || spawn.room.memory.nextCheckNeedsBuilder < Game.time) {
    var targetStructure = RoleBuilder.findTargetStructure(spawn.room, false);
    if (!targetStructure) {
      spawn.room.memory.nextCheckNeedsBuilder = Game.time + 100;
    } else {
      spawn.room.memory.nextCheckNeedsBuilder = Game.time + 20;
      needsBuilder = true;
    }
  }
 */
  if (links.length === 0) {
    if (constructionSites.length) {
      maxUpgraderCount = 1;
    } else {
      maxUpgraderCount = 8;
    }
  }

  if (spawn.room.controller && spawn.room.controller.level === 8) {
    // added x1000 to force upgraders temporarily to increase GCL
    if (spawn.room.controller.ticksToDowngrade <= 6000 * 1000) {
      maxUpgraderCount = 1;
      upgraderRatio = 1;
    } else {
      maxUpgraderCount = 0;
      upgraderRatio = 0;
    }
  } else {
    if (spawn.room.storage) {
      const availableEnergy = spawn.room.storage.store.energy;
      if (availableEnergy > 700000) {
        upgraderRatio = 50;
        maxUpgraderCount = 8;
      } else if (availableEnergy > 500000) {
        upgraderRatio = 30;
        maxUpgraderCount = 6;
      } else if (availableEnergy > 300000) {
        upgraderRatio = 20;
        maxUpgraderCount = 5;
      } else if (availableEnergy > 200000) {
        upgraderRatio = 12;
        maxUpgraderCount = 3;
      } else if (availableEnergy > 150000) {
        upgraderRatio = 8;
        maxUpgraderCount = 2;
      } else if (availableEnergy > 20000) {
        upgraderRatio = 4;
        maxUpgraderCount = 1;
      } else if (availableEnergy > 10000) {
        upgraderRatio = 1;
        maxUpgraderCount = 1;
      } else {
        upgraderRatio = 1;
        maxUpgraderCount = 0;
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
          maxUpgraderCount = 10;
        } else if (ratio >= 0.5) {
          upgraderRatio = 8;
          maxUpgraderCount = 6;
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
            storageQuantity && spawn.room.storage && storageQuantity >= spawn.room.storage.storeCapacity * 0.96 ? 0 : 1,
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

  const dismantlerFlag = Game.flags["dismantler_attack"];

  const remoteHarvesters = spawn.room.memory.remotes
    .filter(i => !i.disabled)
    .map(remote => {
      return {
        percentage: 4,
        role: "long-distance-harvester",
        maxCount: isStorageAlmostFull ? 0 : 1,
        bodyTemplate: [WORK],
        maxRepeat: (remote.energyGeneration || 10) / HARVEST_POWER,
        subRole: remote.room + "-" + remote.x + "-" + remote.y,
        bodyTemplatePrepend: [CARRY, MOVE, MOVE, MOVE],
        disableIfLowOnCpu: true,
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName,
          targetRoomName: remote.room,
          targetRoomX: remote.x,
          targetRoomY: remote.y
        } as Partial<ILongDistanceHarvesterMemory>
      } as RoleRequirement;
    });

  const remoteDefenders = (spawn.room.memory.needsDefenders || [])
    .filter(i => i.mode === "remote" && spawn.room.energyCapacityAvailable > 620)
    .map(remote => {
      return {
        percentage: 20,
        role: "remote-defender",
        bodyTemplate: [MOVE, MOVE, MOVE, ATTACK, ATTACK, HEAL],
        maxRepatAccrossAll: Math.ceil(remote.threatLevel),
        sortBody: [TOUGH, MOVE, ATTACK, HEAL],
        subRole: remote.room,
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName
        } as Partial<IRemoteDefenderMemory>
      } as RoleRequirement;
    });

  const localDefenders = (spawn.room.memory.needsDefenders || [])
    .filter(i => i.mode === "local" && spawn.room.energyCapacityAvailable > 620)
    .map(remote => {
      return {
        percentage: 20,
        role: "local-defender",
        bodyTemplate: [MOVE, RANGED_ATTACK, RANGED_ATTACK],
        maxRepatAccrossAll: Math.ceil(remote.threatLevel * 2),
        bodyTemplatePrepend: [HEAL, HEAL, MOVE],
        sortBody: [TOUGH, MOVE, ATTACK, HEAL],
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName
        } as Partial<IRemoteDefenderMemory>
      } as RoleRequirement;
    });

  const reservers = spawn.room.memory.remotes
    .filter(i => i.needsReservation && !i.disabled && spawn.room.energyCapacityAvailable >= 650)
    .map(remote => {
      return {
        percentage: 20,
        role: "reserver",
        maxCount: isStorageAlmostFull ? 0 : 1,
        bodyTemplate: [CLAIM, MOVE],
        maxRepeat: 2,
        subRole: remote.room,
        disableIfLowOnCpu: true,
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName,
          targetRoomName: remote.room
        } as Partial<IReserverMemory>
      } as RoleRequirement;
    });

  return [
    ...harvesterDefinitions,
    {
      percentage: 100,
      role: "truck",
      maxCount: spawn.room.memory.trucksCount || 2,
      bodyTemplate: [MOVE, CARRY, CARRY]
    },
    ...remoteDefenders,
    ...localDefenders,
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
      bodyTemplate: [MOVE, MOVE, WORK, CARRY],
      onlyRooms: builderHelperSource ? [builderHelperSource] : undefined,
      subRole: builderHelperTarget,
      disableIfLowOnCpu: true
    },
    {
      percentage: 2,
      role: "builder",
      maxCount: 2,
      bodyTemplate: [MOVE, MOVE, WORK, CARRY],
      onlyRooms: ["E13S15"],
      subRole: "E8S15",
      disableIfLowOnCpu: true
    },
    {
      percentage: 1,
      role: "claimer",
      maxCount: claimerCount,
      onlyRooms: closestRoomToClaimTarget ? [closestRoomToClaimTarget] : undefined,
      exactBody: [MOVE, CLAIM]
    },
    {
      percentage: 2,
      role: "reparator",
      maxCount: 0, // handled by towers
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1400,
      disableIfLowOnCpu: true
    },
    {
      percentage: 20,
      role: "versatile",
      maxCount: Game.flags["versatile_attack"] ? 1 : 0,
      countAllRooms: true,
      // bodyTemplate: [TOUGH, TOUGH, RANGED_ATTACK, WORK, MOVE, HEAL, HEAL, HEAL, HEAL],
      bodyTemplate: [TOUGH, RANGED_ATTACK, WORK, WORK, WORK, MOVE, HEAL, HEAL, HEAL],
      sortBody: [TOUGH, RANGED_ATTACK, WORK, MOVE, HEAL],
      onlyRooms: ["E22N36"],
      additionalMemory: {
        boostable: true
      } as IDismantlerMemory
    },
    {
      percentage: 1,
      role: "fighter",
      maxCount: enemies.length > 0 && towers.length === 0 ? 1 : 0,
      bodyTemplate: [TOUGH, MOVE, MOVE, ATTACK],
      sortBody: [TOUGH, MOVE, ATTACK]
    },
    {
      percentage: 1,
      role: "miner",
      maxCount: extractors.length >= 1 && mineralWithReserve.length > 0 && amountOfMineralInTerminal < 100000 ? 1 : 0,
      bodyTemplate: [MOVE, WORK, CARRY, WORK, CARRY, WORK, CARRY],
      capMaxEnergy: 1800,
      sortBody: [MOVE, WORK, CARRY],
      disableIfLowOnCpu: true
    },
    ...remoteHarvesters,
    {
      percentage: 4,
      role: "long-distance-truck",
      maxRepatAccrossAll: isStorageAlmostFull
        ? 0
        : Math.ceil(
            spawn.room.memory.remotes
              .filter(i => i.energy > 0 && !i.disabled)
              .map(i => i.distance / 4) // 1 truck template repetition for every 4 distance
              .reduce((acc, i) => acc + i, 0)
          ),
      bodyTemplate: [MOVE, CARRY, CARRY],
      disableIfLowOnCpu: true,
      bodyTemplatePrepend: [WORK, CARRY, MOVE],
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName
      } as Partial<ILongDistanceTruckMemory>
    },
    ...reservers,
    controllerLevel < 4
      ? {
          percentage: 1,
          role: "upgrader",
          maxCount: maxUpgraderCount,
          bodyTemplate: [MOVE, WORK, CARRY],
          capMaxEnergy: 600 * upgraderRatio,
          disableIfLowOnCpu: true
        }
      : {
          percentage: 1,
          role: "upgrader",
          maxCount: maxUpgraderCount,
          bodyTemplate: [WORK],
          bodyTemplatePrepend: [MOVE, MOVE, CARRY, CARRY],
          maxRepeat: upgraderRatio * 2,
          disableIfLowOnCpu: true
        },
    {
      exactBody: [MOVE],
      percentage: 1,
      role: "scout",
      maxCount: (spawn.room.memory.explorations || []).find(i => i.needsExploration) ? 1 : 0,
      countAllRooms: false
    }
  ];
}
