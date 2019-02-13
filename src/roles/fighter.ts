import { defaultReusePath } from "../constants";

interface IFighterMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleFighter implements IRole {
  run(creep: Creep) {
    var hostileRoom1 = creep.room.find(FIND_HOSTILE_CREEPS)[0];
    var hostileRoom2 = Game.rooms["E26N47"].find(FIND_HOSTILE_CREEPS)[0];
    var hostileRoom3 = Game.rooms["E27N48"].find(FIND_HOSTILE_CREEPS)[0];

    var hostile = hostileRoom1 || hostileRoom2 || hostileRoom3;

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
