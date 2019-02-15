import { ILongDistanceHarvesterMemory } from "roles/longDistanceHarvester";
import { IDismantlerMemory } from "roles/dismantler";

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

  const extensions = spawn.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_EXTENSION }
  });

  const harvesters = spawn.room.find(FIND_MY_CREEPS).filter(i => i.memory.role === "harvester");
  const towers = spawn.room.find(FIND_MY_STRUCTURES, { filter: i => i.structureType === "tower" });

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
      percentage: 10,
      role: "harvester",
      maxCount: 2,
      bodyTemplate: [MOVE, WORK, CARRY]
    },
    {
      percentage: 2,
      role: "builder",
      maxCount: 1,
      bodyTemplate: [MOVE, WORK, CARRY]
    },
    {
      percentage: 1,
      role: "upgrader",
      maxCount: 2,
      bodyTemplate: [MOVE, WORK, CARRY]
    },
    {
      percentage: 2,
      role: "reparator",
      maxCount: towers.length ? 0 : 1, // handled by towers
      exactBody: [MOVE, WORK, CARRY]
    },
    {
      percentage: 5,
      role: "fighter",
      maxCount: hasSafeMode ? 0 : 1,
      bodyTemplate: [TOUGH, MOVE, ATTACK],
      capMaxEnergy: 700,
      sortBody: [TOUGH, MOVE, ATTACK]
    },
    {
      percentage: 4,
      role: "long-distance-harvester",
      maxCount: 2,
      countAllRooms: true,
      bodyTemplate: [MOVE, WORK, CARRY],
      subRole: "room1",
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
      role: "dismantler",
      maxCount: 0,
      countAllRooms: true,
      bodyTemplate: [TOUGH, MOVE],
      sortBody: [TOUGH, WORK, MOVE],
      subRole: "room1",
      capMaxEnergy: 60,
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
      role: "explorer",
      maxCount: 0,
      exactBody: [MOVE, CLAIM]
    }
  ];
}
