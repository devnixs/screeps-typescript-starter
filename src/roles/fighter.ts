import { defaultReusePath } from "../constants";
import { notify } from "../utils/notify";
import { roleLongDistanceHarvester } from "./longDistanceHarvester";

interface IFighterMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleFighter implements IRole {
  run(creep: Creep) {
    const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);

    let hostile: Creep | null = null;
    _.forEach(rooms, room => {
      if (room.controller && !room.controller.my) {
        return;
      }
      hostile = room.find(FIND_HOSTILE_CREEPS)[0];
      // no need tok look for another hostile.
      if (hostile) {
        return false;
      } else {
        return true;
      }
    });

    if (hostile) {
      notify("Hostile creep detected (time=" + Game.time + ")! " + JSON.stringify(hostile), 200);
    }

    const memory: IFighterMemory = creep.memory as any;

    if (!memory.assignedExplorerName && Game.time % 30 === 0) {
      this.lookForSomeoneToProtect(creep, memory);
    }

    if (hostile) {
      if (creep.attack(hostile) == ERR_NOT_IN_RANGE) {
        creep.moveTo(hostile, { visualizePathStyle: { stroke: "#ff0000" }, reusePath: defaultReusePath });
      }
    } else {
      if (memory.assignedExplorerName) {
        var assignedExplorer = Game.creeps[memory.assignedExplorerName];
        if (!assignedExplorer) {
          memory.assignedExplorerName = null;
        } else {
          creep.moveTo(assignedExplorer, { reusePath: defaultReusePath });
        }
      } else {
        // move to flag
        var restFlag = creep.room.find(FIND_FLAGS, { filter: i => i.name === "fighter_rest" })[0];
        if (restFlag) {
          creep.moveTo(restFlag, { reusePath: defaultReusePath });
        }
      }
    }
  }

  lookForSomeoneToProtect(creep: Creep, memory: IFighterMemory) {
    const allCreeps: Creep[] = _.values(Game.creeps);
    const explorerWithNoGuards = allCreeps.find(
      i => i.memory.role === "explorer" && (!i.memory.guardsNames || !i.memory.guardsNames.length)
    );
    if (explorerWithNoGuards) {
      explorerWithNoGuards.memory.guardsNames = explorerWithNoGuards.memory.guardsNames || [];
      explorerWithNoGuards.memory.guardsNames.push(creep.name);

      memory.assignedExplorerName = explorerWithNoGuards.name;
    }
  }
}

export const roleFighter = new RoleFighter();
