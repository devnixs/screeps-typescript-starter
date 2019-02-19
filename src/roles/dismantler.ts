import { defaultReusePath } from "../constants";
import { notify } from "../utils/notify";
import { roleLongDistanceHarvester } from "./longDistanceHarvester";

export interface IDismantlerMemory extends CreepMemory {
  isAttacking: boolean;
  homeRoom: string;
  homeRoomX: number;
  homeRoomY: number;

  targetRoomName: string;
  targetRoomX: number;
  targetRoomY: number;
  targetStructureId: string;

  targetTowers: string[];
}

class RoleDismantler implements IRole {
  isAttackSquadReady() {
    Memory.attackSquad = Memory.attackSquad || [];
    const creepsInSquad = Memory.attackSquad.map(i => Game.getObjectById(i) as Creep);

    // if(creepsInSquad.)
  }

  run(creep: Creep) {
    var memory: IDismantlerMemory = creep.memory as any;
    if (memory.isAttacking && creep.hits <= creep.hitsMax / 2) {
      memory.isAttacking = false;
    }

    if (!memory.isAttacking && creep.hits === creep.hitsMax) {
      memory.isAttacking = true;
    }

    if (memory.isAttacking) {
      if (creep.room.name !== memory.targetRoomName) {
        creep.goTo(new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName));
      } else {
        const targetTowers: StructureTower[] = (memory.targetTowers || [])
          .map(i => Game.getObjectById(i))
          .filter(i => i) as any;

        const combinedEnergy = _.sum(targetTowers.map(i => i.energy));
        if (combinedEnergy > 0) {
          // Abort!
          creep.goTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom));
          return;
        } else {
          if (creep.getActiveBodyparts(WORK) >= 0) {
            var structure: AnyStructure | null;

            structure = Game.getObjectById(memory.targetStructureId);

            if (!structure) {
              structure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
            }

            if (!structure) {
              return;
            }

            if (creep.dismantle(structure) == ERR_NOT_IN_RANGE) {
              creep.goTo(structure);
            }
          }
        }
      }
    } else {
      if (creep.room.name !== memory.homeRoom) {
        creep.goTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom));
      } else {
        // just wait to be healed
      }
    }
  }
}

export const roleDismantler = new RoleDismantler();
