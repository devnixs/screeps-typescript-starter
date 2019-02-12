import { ILongDistanceHarvesterMemory } from "roles/longDistanceHarvester";

export interface RoleRequirement {
  role: roles;
  percentage: number;
  maxCount?: number;
  body: BodyPartConstant[];
  additionalMemory?: any;
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

  if (harvesters.length === 0) {
    // we need at least one harvester
    return [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 4,
        body: [MOVE, WORK, CARRY]
      }
    ];
  }

  const harvest1Flag = Game.flags["harvest_1"];
  const extensionsCount = extensions.length;

  if (extensionsCount <= 2) {
    return [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 4,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 4,
        role: "builder",
        maxCount: 4,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 2,
        role: "upgrader",
        maxCount: 4,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 2,
        role: "reparator",
        maxCount: 1,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 1,
        role: "fighter",
        maxCount: hasSafeMode ? 0 : 4,
        body: [TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK]
      }
    ];
  } else if (extensionsCount <= 6) {
    return [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 3,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY]
      },
      {
        percentage: 5,
        role: "builder",
        maxCount: 2,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY]
      },
      {
        percentage: 3,
        role: "upgrader",
        maxCount: 3,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY]
      },
      {
        percentage: 2,
        role: "reparator",
        maxCount: 1,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY]
      },
      {
        percentage: 1,
        role: "fighter",
        maxCount: hasSafeMode ? 0 : 4,
        body: [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK]
      },
      {
        percentage: 3,
        role: "long-distance-harvester",
        maxCount: 2,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY],
        additionalMemory: {
          homeSpawnPosition: spawn.pos,
          home: spawn.pos.roomName,
          role: "long-distance-harvester",
          targetRoomName: (harvest1Flag && harvest1Flag.room && harvest1Flag.room.name) || "E27N48"
        } as ILongDistanceHarvesterMemory
      }
      /*       {
        percentage: 1,
        role: "explorer",
        maxCount: 1,
        body: [TOUGH, TOUGH, MOVE]
      } */
    ];
  } else {
    return [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 4,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY, WORK, CARRY, MOVE]
      },
      {
        percentage: 4,
        role: "builder",
        maxCount: 4,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY, WORK, CARRY, MOVE]
      },
      {
        percentage: 2,
        role: "upgrader",
        maxCount: 4,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY, WORK, CARRY, MOVE]
      },
      {
        percentage: 2,
        role: "reparator",
        maxCount: 1,
        body: [MOVE, WORK, CARRY, MOVE, WORK, CARRY, CARRY, WORK, CARRY, MOVE]
      },
      {
        percentage: 1,
        role: "fighter",
        maxCount: hasSafeMode ? 0 : 4,
        body: [
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          TOUGH,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          MOVE,
          ATTACK,
          ATTACK,
          ATTACK,
          ATTACK
        ]
      },
      {
        percentage: 1,
        role: "explorer",
        maxCount: 1,
        body: [MOVE, CLAIM]
      }
    ];
  }
}
