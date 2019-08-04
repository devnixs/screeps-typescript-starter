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
import { getMyRooms, runFromTimeToTime, hasRoomBeenAttacked } from "utils/misc-utils";
import { isInSafeArea } from "utils/safe-area";
import { profiler } from "utils/profiler";
import { Cartographer } from "utils/cartographer";
import { IAttackerMemory } from "roles/attacker";
import { AttackManager } from "managers/attack";
import { ITransportMemory } from "roles/transport";
import { IPokerMemory, rolePoker } from "roles/poker";
import { getAverageCpu, getUsedPercentage } from "utils/cpu";

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

  onSpawn?: (totalCost: number, body: BodyPartConstant[], creepName: string) => void;
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

let remoteDefenderHelperCount = 0;
let remoteDefenderHelperTarget: string | undefined = undefined;
let remoteDefenderHelperSource: string | undefined = undefined;

let transportHelperCount = 0;
let transportHelperTarget: string | undefined = undefined;
let transportHelperSource: string | undefined = undefined;

let lastInitializationTick: number | undefined;
function initOneTimeValues() {
  if (lastInitializationTick === Game.time) {
    return;
  } else {
    lastInitializationTick = Game.time;
  }

  const myRooms = getMyRooms();
  const canColonize = Game.gcl.level > myRooms.length;
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

  let colonyThatNeedsHelpBuilding = Object.keys(Game.rooms)
    .map(i => Game.rooms[i])
    .filter(
      i =>
        (i.controller && i.controller.my && i.controller.level <= 2) ||
        //  (i.controller && i.controller.my && i.spawns.length === 0) ||
        (i.find(FIND_FLAGS, { filter: flag => flag.name === "claimer_target" }).length && canColonize)
    )[0];

  if (colonyThatNeedsHelpBuilding && myRooms.length > 1) {
    var initialCpu = Game.cpu.getUsed();
    builderHelperSource = findClosestRoom(colonyThatNeedsHelpBuilding.name);
    var afterCpu = Game.cpu.getUsed();
    //  console.log("Used CPU: ", afterCpu - initialCpu);
    builderHelperTarget = colonyThatNeedsHelpBuilding.name;
    builderHelperCount = 2;
    if (Game.time % 100 === 0) {
      console.log("Found colonyThatNeedsHelpBuilding : ", colonyThatNeedsHelpBuilding.name);
      console.log("builderHelperTarget : ", colonyThatNeedsHelpBuilding.name);
      console.log("builderHelperSource : ", builderHelperSource);
      console.log("builderHelperCount : ", builderHelperCount);
    }
  }

  let colonyThatNeedsHelpDefending = Object.keys(Game.rooms)
    .map(i => Game.rooms[i])
    .filter(i => i.controller && i.controller.my && i.controller.level <= 5)[0];

  if (colonyThatNeedsHelpDefending && myRooms.length > 1 && hasRoomBeenAttacked(colonyThatNeedsHelpDefending)) {
    remoteDefenderHelperSource = findClosestRoom(colonyThatNeedsHelpDefending.name);
    remoteDefenderHelperTarget = colonyThatNeedsHelpDefending.name;
    remoteDefenderHelperCount = 4;
    const sourceRoom = remoteDefenderHelperSource && Game.rooms[remoteDefenderHelperSource];

    if (
      colonyThatNeedsHelpDefending.find(FIND_SOURCES).length === 1 &&
      sourceRoom &&
      sourceRoom.controller &&
      sourceRoom.controller.level >= 7
    ) {
      transportHelperSource = remoteDefenderHelperSource;
      transportHelperTarget = colonyThatNeedsHelpDefending.name;
      transportHelperCount = 4;
    }
  }
}

let getSpawnerRequirements = function(spawn: StructureSpawn): RoleRequirement[] {
  initOneTimeValues();

  const controllerLevel = spawn.room.controller ? spawn.room.controller.level : 0;

  const towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });
  const extractors = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "extractor" });
  const mineralWithReserve = spawn.room.find(FIND_MINERALS, { filter: i => i.mineralAmount > 0 });
  const amountOfMineralInTerminal =
    spawn.room.terminal && mineralWithReserve && mineralWithReserve.length
      ? spawn.room.terminal.store[mineralWithReserve[0].mineralType] || 0
      : 0;
  const enemies = spawn.room.find(FIND_HOSTILE_CREEPS);

  const storageQuantity = spawn.room.storage ? _.sum(spawn.room.storage.store) : 0;
  const isStorageAlmostFull = storageQuantity > 900000;

  const hasStorageOrContainers = !!spawn.room.storage || !!spawn.room.containers.length;

  // while forming an attack, stop spawning those as they occupy all the trucks
  const isStartingAttack =
    Memory.attack &&
    Memory.attack.fromRoom === spawn.pos.roomName &&
    Memory.attack.parties.find(i => i.status === "forming");

  // OPTIMIZATION POSSIBLE
  var needsBuilder = hasStorageOrContainers && !!RoleBuilder.findTargetStructure(spawn.room, false);

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

  const upgraders: RoleRequirement[] = [];
  if (spawn.room.memory.upgraderRatio > 0 && !spawn.room.memory.isUnderSiege && !isStartingAttack) {
    if (spawn.room.memory.upgraderType === "mobile") {
      upgraders.push({
        percentage: 1,
        role: "upgrader",
        bodyTemplate: [MOVE, WORK, CARRY],
        maxRepatAccrossAll: spawn.room.memory.upgraderRatio,
        disableIfLowOnCpu: true,
        maxCount: 7
      });
    } else {
      upgraders.push({
        percentage: 1,
        role: "upgrader",
        bodyTemplate: [WORK],
        bodyTemplatePrepend: [MOVE, MOVE, CARRY, CARRY],
        maxRepatAccrossAll: spawn.room.memory.upgraderRatio,
        disableIfLowOnCpu: true,
        maxCount: 7
      });
    }
  }

  const harvesterDefinitions = spawn.room
    .find(FIND_SOURCES)
    .map(source => {
      const energyRate = source.energyCapacity / 300;
      const closeContainer: StructureContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: i => i.structureType === "container"
      })[0] as any;
      const closeLink: StructureContainer =
        closeContainer &&
        (closeContainer.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: i => i.structureType === "link"
        })[0] as any);

      const neededWorkParts = Math.ceil(energyRate / HARVEST_POWER);

      if (spawn.room.memory.isUnderSiege && !isInSafeArea(source.pos, spawn.room)) {
        return null;
      }

      if (closeLink) {
        return {
          percentage: 20,
          role: "static-harvester",
          subRole: source.id,
          maxRepatAccrossAll: neededWorkParts,
          maxCount:
            storageQuantity && spawn.room.storage && storageQuantity >= spawn.room.storage.storeCapacity * 0.96 ? 0 : 1,
          bodyTemplate: [WORK],
          bodyTemplatePrepend: [MOVE, MOVE, WORK, CARRY],
          additionalMemory: {
            targetContainerId: closeContainer.id,
            targetLinkId: closeLink.id
          } as IStaticHarvesterMemory
        } as RoleRequirement;
      } else if (closeContainer) {
        return {
          percentage: 20,
          role: "static-harvester",
          subRole: source.id,
          maxRepatAccrossAll: neededWorkParts,
          maxCount:
            storageQuantity && spawn.room.storage && storageQuantity >= spawn.room.storage.storeCapacity * 0.96 ? 0 : 1,
          bodyTemplate: [WORK],
          bodyTemplatePrepend: [MOVE],
          additionalMemory: {
            targetContainerId: closeContainer.id
          } as IStaticHarvesterMemory
        } as RoleRequirement;
      } else {
        return {
          percentage: 20,
          role: "harvester",
          subRole: source.id,
          maxRepatAccrossAll: 12,
          bodyTemplate: [MOVE, WORK, CARRY],
          maxCount: 3
        } as RoleRequirement;
      }
    })
    .filter(i => i)
    .map(i => i as RoleRequirement);

  const remoteHarvesters = (spawn.room.memory.remotes || [])
    .filter(i => !i.disabled)
    .filter(i => !spawn.room.memory.isUnderSiege && !isStartingAttack)
    .map(remote => {
      return {
        percentage: 4,
        role: "long-distance-harvester",
        maxCount: isStorageAlmostFull ? 0 : 1,
        bodyTemplate: [WORK],
        maxRepeat: ((remote.energyGeneration || 10) * (remote.ratio || 1)) / HARVEST_POWER,
        subRole: remote.room + "-" + remote.x + "-" + remote.y,
        bodyTemplatePrepend: [CARRY, MOVE, MOVE, MOVE],
        disableIfLowOnCpu: true,
        onSpawn: (totalCost, bodyTemplate) => {
          remote.spentEnergy = remote.spentEnergy || 0;
          remote.spentEnergy += totalCost;
        },
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
    .filter(i => !spawn.room.memory.isUnderSiege)
    .filter(i => i.mode === "remote" && spawn.room.energyCapacityAvailable > 620)
    .map(defense => {
      return {
        percentage: 20,
        role: "remote-defender",
        // bodyTemplate: [MOVE, MOVE, MOVE, ATTACK, ATTACK, HEAL],
        bodyTemplate: [MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL],
        maxRepatAccrossAll: Math.ceil(defense.threatLevel * 0.5),
        sortBody: [TOUGH, MOVE, ATTACK, RANGED_ATTACK, HEAL],
        subRole: defense.room,
        onSpawn: (totalCost, bodyTemplate) => {
          const remotes = spawn.room.memory.remotes.filter(i => i.room === defense.room);
          remotes.forEach(remote => {
            remote.spentEnergy = remote.spentEnergy || 0;
            remote.spentEnergy += totalCost / remotes.length;
          });
        },
        additionalMemory: {
          boostable: defense.boosted,
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName
        } as Partial<IRemoteDefenderMemory>
      } as RoleRequirement;
    });

  const remoteDefendersHelper = remoteDefenderHelperTarget
    ? ({
        percentage: 20,
        role: "remote-defender-helper",
        maxCount: remoteDefenderHelperCount,
        bodyTemplate: [MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL],
        sortBody: [TOUGH, MOVE, ATTACK, RANGED_ATTACK, HEAL],
        onlyRooms: [remoteDefenderHelperSource],
        additionalMemory: {
          roomTarget: remoteDefenderHelperTarget
        } as Partial<IRemoteDefenderMemory>
      } as RoleRequirement)
    : null;

  /*   const siegedRoom = getMyRooms().find(i =>
    i.memory.isUnderSiege &&
    i.name !== spawn.room.name &&
    i.controller &&
    i.controller.level < controllerLevel &&
    Cartographer.findRoomDistanceSum(i.name, spawn.room.name) <= 6
      ? true
      : false
  );
  const remoteDefendersSiegeHelper = siegedRoom
    ? ({
        percentage: 20,
        role: "remote-defender-helper",
        maxCount: 3,
        bodyTemplate: [MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL],
        sortBody: [TOUGH, MOVE, ATTACK, RANGED_ATTACK, HEAL],
        additionalMemory: {
          roomTarget: siegedRoom.name,
          subRole: siegedRoom.name
        } as Partial<IRemoteDefenderMemory>
      } as RoleRequirement)
    : null; */
  /*
  if (siegedRoom) {
    console.log("Spawning siege helper from ", spawn.room.name);
  } */

  let localDefenders: RoleRequirement[];
  if (controllerLevel <= 3) {
    localDefenders = (spawn.room.memory.needsDefenders || [])
      .filter(i => i.mode === "local" && spawn.room.energyCapacityAvailable >= 500)
      .map(remote => {
        return {
          percentage: 20,
          role: "local-defender",
          bodyTemplate: [MOVE, RANGED_ATTACK],
          maxRepatAccrossAll: Math.ceil(remote.threatLevel * 2),
          bodyTemplatePrepend: [HEAL, MOVE],
          maxCount: remote.threatLevel / 50,
          sortBody: [TOUGH, MOVE, ATTACK, HEAL],
          additionalMemory: {
            homeSpawnPosition: spawn.pos,
            home: spawn.pos.roomName,
            boostable: !!spawn.room.memory.boostMode
          } as Partial<IRemoteDefenderMemory>
        } as RoleRequirement;
      });
  } else {
    localDefenders = (spawn.room.memory.needsDefenders || [])
      .filter(i => i.mode === "local" && spawn.room.energyCapacityAvailable >= 900)
      .map(remote => {
        return {
          percentage: 20,
          role: "local-defender",
          bodyTemplate: [MOVE, RANGED_ATTACK, RANGED_ATTACK],
          maxRepatAccrossAll: Math.ceil(remote.threatLevel * 2),
          bodyTemplatePrepend: [HEAL, HEAL, MOVE],
          maxCount: remote.threatLevel / 50,
          sortBody: [TOUGH, MOVE, ATTACK, HEAL],
          additionalMemory: {
            homeSpawnPosition: spawn.pos,
            home: spawn.pos.roomName,
            boostable: !!spawn.room.memory.boostMode
          } as Partial<IRemoteDefenderMemory>
        } as RoleRequirement;
      });
  }

  const reservers = spawn.room.memory.remotes
    .filter(i => !spawn.room.memory.isUnderSiege)
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
        onSpawn: (totalCost, bodyTemplate) => {
          const remotes = spawn.room.memory.remotes.filter(i => i.room === remote.room);
          remotes.forEach(remote => {
            remote.spentEnergy = remote.spentEnergy || 0;
            remote.spentEnergy += totalCost / remotes.length;
          });
        },
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName,
          targetRoomName: remote.room
        } as Partial<IReserverMemory>
      } as RoleRequirement;
    });

  const attackers = spawn.room.memory.needsAttackers
    ? ({
        percentage: 100,
        role: "attacker",
        subRole: Game.time.toString(), // this will cound each attackers are individuals, and for it to be high priority
        maxCount: spawn.room.memory.needsAttackers.count,
        exactBody: spawn.room.memory.needsAttackers.parts,
        sortBody: [TOUGH, WORK, RANGED_ATTACK, MOVE, HEAL],
        onSpawn: (a, b, name) => {
          AttackManager.assignToAttackParty(
            name,
            (spawn.room.memory.needsAttackers && spawn.room.memory.needsAttackers.partyId) || 0
          );
        },
        additionalMemory: {
          home: spawn.pos.roomName,
          ready: false,
          boostable: spawn.room.memory.needsAttackers.boosted
        } as Partial<IAttackerMemory>
      } as RoleRequirement)
    : null;

  let trucksCount = 2;
  if (controllerLevel === 1) {
    trucksCount = 0;
  }

  const hasIdleLongDistanceTrucks = spawn.room
    .find(FIND_MY_CREEPS)
    .find(i => i.memory.role === "long-distance-truck" && !(i.memory as ILongDistanceTruckMemory).targetContainer);

  const totalTruckRepetitions = Math.ceil(
    _.sum(spawn.room.memory.remotes.filter(i => i.energy > 0 && !i.disabled).map(i => i.distance / 4)) // 1 truck template repetition for every 4 distance
  );

  const requirements = ([
    ...harvesterDefinitions,
    {
      percentage: 100,
      role: "truck",
      maxCount: trucksCount,
      bodyTemplate: [MOVE, CARRY, CARRY]
    },
    attackers,
    {
      percentage: 2,
      role: "builder",
      maxCount: needsBuilder ? (controllerLevel <= 3 ? 2 : spawn.room.memory.isUnderSiege ? 4 : 1) : 0,
      bodyTemplate: [MOVE, WORK, CARRY]
    },
    ...remoteDefenders,
    ...localDefenders,
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
      role: "transport",
      maxCount: transportHelperCount,
      bodyTemplate: [MOVE, CARRY],
      onlyRooms: transportHelperSource ? [transportHelperSource] : undefined,
      disableIfLowOnCpu: true,
      additionalMemory: {
        targetRoom: transportHelperTarget
      } as ITransportMemory
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
      maxCount: spawn.room.towers.length > 0 ? 0 : 1, // handled by towers
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1400,
      disableIfLowOnCpu: true
    },
    {
      percentage: 1,
      role: "fighter",
      maxCount: enemies.length > 0 && towers.length === 0 ? 1 : 0,
      bodyTemplate: [TOUGH, MOVE, MOVE, ATTACK],
      sortBody: [TOUGH, MOVE, ATTACK]
    },
    remoteDefendersHelper,
    {
      percentage: 1,
      role: "miner",
      maxCount:
        extractors.length >= 1 &&
        mineralWithReserve.length > 0 &&
        amountOfMineralInTerminal < 100000 &&
        !spawn.room.memory.isUnderSiege
          ? 1
          : 0,
      bodyTemplate: [MOVE, WORK, WORK, WORK, WORK],
      bodyTemplatePrepend: [CARRY, MOVE],
      sortBody: [MOVE, WORK, CARRY],
      disableIfLowOnCpu: true
    },
    ...remoteHarvesters,
    {
      exactBody: [MOVE],
      percentage: 1,
      role: "scout",
      maxCount:
        (getUsedPercentage() > 0.5 ? runFromTimeToTime(1500, 4500) : true) &&
        !spawn.room.memory.isUnderSiege &&
        controllerLevel >= 3 &&
        controllerLevel < 8
          ? 1
          : 0
    },
    ...upgraders,
    {
      percentage: 4,
      role: "long-distance-truck",
      maxRepatAccrossAll:
        isStorageAlmostFull || hasIdleLongDistanceTrucks || spawn.room.memory.isUnderSiege || isStartingAttack
          ? 0
          : totalTruckRepetitions,
      bodyTemplate: [MOVE, CARRY, CARRY],
      disableIfLowOnCpu: true,
      bodyTemplatePrepend: [WORK, CARRY, MOVE],
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName
      } as Partial<ILongDistanceTruckMemory>
    },
    ...reservers,
    {
      percentage: 2,
      role: "poker",
      exactBody: [MOVE, ATTACK],
      maxCount: spawn.room.memory.poker ? 1 : 0,
      additionalMemory: {
        targetRoom: spawn.room.memory.poker
      } as Partial<IPokerMemory>
    }
  ] as (RoleRequirement | null)[])
    .filter(i => i)
    .map(i => i as RoleRequirement);

  return requirements;
};

getSpawnerRequirements = getSpawnerRequirements = profiler.registerFN(getSpawnerRequirements, "getSpawnerRequirements");

export { getSpawnerRequirements };
