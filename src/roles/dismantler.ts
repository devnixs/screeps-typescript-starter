import { defaultReusePath } from "../constants";
import { notify } from "../utils/notify";
import { roleLongDistanceHarvester } from "./longDistanceHarvester";
import { compileFunction } from "vm";

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
        creep.moveTo(new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName), {
          reusePath: defaultReusePath,
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      } else {
        const targetTowers: StructureTower[] = (memory.targetTowers || [])
          .map(i => Game.getObjectById(i))
          .filter(i => i) as any;

        const combinedEnergy = _.sum(targetTowers.map(i => i.energy));
        if (combinedEnergy > 0) {
          // Abort!
          creep.moveTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom), {
            reusePath: defaultReusePath,
            visualizePathStyle: { stroke: "#ffaa00" }
          });
          return;
        } else {
          /*           var structure: AnyStructure | null;

          structure = Game.getObjectById(memory.targetStructureId);

          if (!structure) {
            structure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);
          }

          if (!structure) {
            return;
          }

          if (creep.dismantle(structure) == ERR_NOT_IN_RANGE) {
            creep.moveTo(structure, { visualizePathStyle: { stroke: "#ff0000" }, reusePath: defaultReusePath });
          } */
        }
      }
    } else {
      if (creep.room.name !== memory.homeRoom) {
        creep.moveTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom), {
          reusePath: defaultReusePath,
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      } else {
        // just wait to be healed
      }
    }
  }
}

export const roleDismantler = new RoleDismantler();
