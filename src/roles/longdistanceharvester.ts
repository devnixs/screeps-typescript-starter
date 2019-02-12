import { findAndCache } from "utils/finder";
import { defaultReusePath } from "../constants";
import { sourceManager } from "utils/source-manager";

/* import { sourceManager } from "../utils/source-manager";
import { findAndCache } from "utils/finder";
 */
export interface ILongDistanceHarvesterMemory extends CreepMemory {
  working?: boolean;
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetRoomName: string;
  targetRoomX: number | undefined;
  targetRoomY: number | undefined;
}

class RoleLongDistanceHarvester implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceHarvesterMemory = creep.memory as any;

    // if creep is bringing energy to a structure but has no energy left
    if (memory.working == true && creep.carry.energy == 0) {
      // switch state
      memory.working = false;
    }
    // if creep is harvesting energy but is full
    else if (!memory.working && creep.carry.energy == creep.carryCapacity) {
      // switch state
      memory.working = true;
    }

    // if creep is supposed to transfer energy to a structure
    if (memory.working == true) {
      // if in home room
      if (creep.room.name == memory.home) {
        sourceManager.storeEnergy(creep);
      }
      // if not in home room...
      else {
        // find exit to home room
        creep.moveTo(new RoomPosition(memory.homeSpawnPosition.x, memory.homeSpawnPosition.y, memory.home), {
          reusePath: defaultReusePath
        });
      }
    }
    // if creep is supposed to harvest energy from source
    else {
      // if in target room
      if (creep.room.name == memory.targetRoomName) {
        sourceManager.harvestEnergyFromSource(creep);
      }
      // if not in target room
      else {
        // find exit to target room
        if (memory.targetRoomX === undefined) {
          const flag = Game.flags[creep.memory.role + "_target"];
          if (flag) {
            memory.targetRoomX = flag.pos.x;
            memory.targetRoomY = flag.pos.y;
          }
        }

        if (memory.targetRoomX && memory.targetRoomY && memory.targetRoomName) {
          creep.moveTo(new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName), {
            reusePath: defaultReusePath
          });
        }
      }
    }
  }
}

export const roleLongDistanceHarvester = new RoleLongDistanceHarvester();
