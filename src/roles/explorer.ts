import { sourceManager } from "../utils/source-manager";

interface IExplorerMemory extends CreepMemory {
  selectedExit: RoomPosition | null;
  currentRoomName: string | null;
}

class RoleExplorer implements IRole {
  run(creep: Creep) {
    var flag = Game.flags["explore_rest"];
    if (flag) {
      creep.moveTo(flag, { reusePath: 25 });
    }
  }

  captureExplore(creep: Creep) {
    var controller = creep.room.controller;
    if (!controller || controller.owner) {
      this.explore(creep);
    } else {
      this.capture(creep);
    }
  }

  capture(creep: Creep) {
    if (!creep.room.controller) {
      return;
    }

    if (creep.claimController(creep.room.controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller, { reusePath: 25 });
    }
  }

  explore(creep: Creep) {
    const memory = creep.memory as IExplorerMemory;
    console.log(JSON.stringify(memory.selectedExit));
    console.log("Current room name : ", creep.room.name);
    if (memory.selectedExit && memory.currentRoomName !== creep.room.name) {
      memory.selectedExit = null;
      memory.currentRoomName = null;
    }

    if (!memory.selectedExit) {
      const spawns: StructureSpawn[] = _.values(Game.spawns);

      const exitBySpawn = spawns.map(spawn => {
        const exitNames = [FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT, FIND_EXIT_TOP];
        return exitNames.map(name => spawn.room.find(name));
      });

      const exits: RoomPosition[] = _.flattenDeep(exitBySpawn) as any;

      const selectedExit = exits[_.random(0, exits.length - 1)];
      memory.selectedExit = selectedExit;
      memory.currentRoomName = creep.room.name;
      console.log("Explorer, selected exit:", selectedExit.x, selectedExit.y, selectedExit.roomName);
    }

    creep.moveTo(new RoomPosition(memory.selectedExit.x, memory.selectedExit.y, memory.selectedExit.roomName), {
      reusePath: 25
    });
  }
}

export const roleExplorer = new RoleExplorer();
