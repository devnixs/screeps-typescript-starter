import { ILongDistanceHarvesterMemory } from "roles/longDistanceHarvester";
import { IDismantlerMemory } from "roles/dismantler";
import { requiredFightersForAnAttack } from "./constants/misc";
import { requiredHealersForAnAttack } from "./constants/misc";

export interface RoleRequirement {
  role: roles;
  percentage: number;
  maxCount?: number;
  exactBody?: BodyPartConstant[];
  bodyTemplate?: BodyPartConstant[];
  additionalMemory?: any;
  countAllRooms?: boolean;
  capMaxEnergy?: number;
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

export function getSpawnerRequirements(spawn: StructureSpawn): RoleRequirement[] {
  const hasSafeMode = spawn.room.controller && spawn.room.controller.safeMode;

  const maxEnergyInRoom = spawn.room.energyCapacityAvailable;

  const harvesters = spawn.room.find(FIND_MY_CREEPS).filter(i => i.memory.role === "harvester");
  const towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });
  const extractors = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "extractor" });
  const mineralWithReserve = spawn.room.find(FIND_MINERALS, { filter: i => i.mineralAmount > 0 });
  const labs = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "lab" });

  let maxUpgraderCount: number;
  if (spawn.room.storage) {
    const availableEnergy = spawn.room.storage.store.energy;
    if (availableEnergy > 200000) {
      maxUpgraderCount = 4;
    } else if (availableEnergy > 150000) {
      maxUpgraderCount = 3;
    } else if (availableEnergy > 20000) {
      maxUpgraderCount = 2;
    } else {
      maxUpgraderCount = 1;
    }
  } else {
    const containers: StructureContainer[] = spawn.room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "container"
    }) as any;

    if (containers.length === 0) {
      maxUpgraderCount = 3;
    } else {
      const totalStorage = _.sum(containers.map(i => i.storeCapacity));
      const totalEnergy = _.sum(containers.map(i => i.store.energy));

      const ratio = totalEnergy / totalStorage;
      if (ratio >= 0.9) {
        maxUpgraderCount = 7;
      } else if (ratio >= 0.5) {
        maxUpgraderCount = 5;
      } else if (ratio >= 0.3) {
        maxUpgraderCount = 2;
      } else {
        maxUpgraderCount = 1;
      }
    }
  }

  const claimerCount = Game.flags["claimer_target"] ? 1 : 0;

  if (harvesters.length === 0) {
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

  return [
    {
      percentage: 20,
      role: "harvester",
      maxCount: maxEnergyInRoom > 1400 ? 2 : 3,
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1800
    },
    {
      percentage: 2,
      role: "builder",
      maxCount: 1,
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1800
    },
    {
      percentage: 2,
      role: "reparator",
      maxCount: towers.length ? 0 : 1, // handled by towers
      exactBody: [MOVE, WORK, CARRY]
    },
    {
      percentage: 2,
      role: "truck",
      maxCount: labs.length ? 1 : 0,
      exactBody: [MOVE, WORK, CARRY]
    },
    {
      percentage: 1,
      role: "fighter",
      maxCount: hasSafeMode ? 0 : Game.flags["fighter_attack"] ? requiredFightersForAnAttack : 0,
      bodyTemplate: [TOUGH, MOVE, ATTACK],
      sortBody: [TOUGH, MOVE, ATTACK]
    },
    {
      percentage: 1,
      role: "healer",
      maxCount: Game.flags["fighter_attack"] ? requiredHealersForAnAttack : 0,
      bodyTemplate: [HEAL, MOVE],
      sortBody: [TOUGH, HEAL, MOVE]
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
      maxCount: 2,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room1",
      onlyRoom: "E27N47",
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        role: "long-distance-harvester",
        targetRoomName: "E27N48",
        targetRoomX: 29,
        targetRoomY: 7
      } as ILongDistanceHarvesterMemory
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: 2,
      countAllRooms: true,
      onlyRoom: "E27N47",
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room2",
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        role: "long-distance-harvester",
        targetRoomName: "E26N47",
        targetRoomX: 26,
        targetRoomY: 31
      } as ILongDistanceHarvesterMemory
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: 2,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room3",
      onlyRoom: "E27N47",
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        role: "long-distance-harvester",
        targetRoomName: "E26N48",
        targetRoomX: 32,
        targetRoomY: 46
      } as ILongDistanceHarvesterMemory
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: maxEnergyInRoom > 1500 ? 2 : 3,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room4",
      onlyRoom: "E25N48",
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        role: "long-distance-harvester",
        targetRoomName: "E24N48",
        targetRoomX: 24,
        targetRoomY: 17
      } as ILongDistanceHarvesterMemory
    },
    {
      percentage: 1,
      role: "long-distance-harvester",
      maxCount: maxEnergyInRoom > 1500 ? 2 : 3,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room5",
      onlyRoom: "E25N48",
      additionalMemory: {
        homeSpawnPosition: spawn.pos,
        home: spawn.pos.roomName,
        role: "long-distance-harvester",
        targetRoomName: "E24N48",
        targetRoomX: 8,
        targetRoomY: 7
      } as ILongDistanceHarvesterMemory
    },
    {
      percentage: 1,
      role: "upgrader",
      maxCount: maxUpgraderCount,
      bodyTemplate: [MOVE, WORK, CARRY],
      capMaxEnergy: 1800
    },
    {
      percentage: 1,
      role: "claimer",
      maxCount: claimerCount,
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
      additionalMemory: {
        homeRoom: spawn.pos.roomName,
        targetStructureId: "5c114bae7935880bfeed5a9d",
        targetRoomX: 7,
        targetRoomY: 27,
        homeRoomX: 47,
        homeRoomY: 22,
        targetRoomName: "E28N47",
        isAttacking: false,
        targetTowers: ["5c629039b23c6c6832d07889"]
      } as IDismantlerMemory
    },
    {
      percentage: 1,
      role: "dismantler",
      maxCount: 0,
      countAllRooms: true,
      bodyTemplate: [HEAL, MOVE, HEAL, MOVE, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, WORK],
      sortBody: [TOUGH, WORK, HEAL, MOVE],
      onlyRoom: "E27N47",
      subRole: "room1",
      additionalMemory: {
        homeRoom: spawn.pos.roomName,
        targetStructureId: "5c114bae7935880bfeed5a9d",
        targetRoomX: 7,
        targetRoomY: 27,
        homeRoomX: 47,
        homeRoomY: 22,
        targetRoomName: "E28N47",
        isAttacking: false,
        targetTowers: ["5c629039b23c6c6832d07889"]
      } as IDismantlerMemory
    }
  ];
}
