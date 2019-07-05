import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot, findHostile } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { hasMinerals } from "utils/misc-utils";
import { profiler } from "utils/profiler";

export interface IScoutMemory extends CreepMemory {
  targetRoom: string | undefined;
}

class RoleScout implements IRole {
  run(creep: Creep) {
    const memory = creep.memory as IScoutMemory;

    const homeRoom = Game.rooms[creep.memory.homeRoom];
    if (!homeRoom) {
      return;
    }

    if (creep.room.name === memory.targetRoom) {
      // wait until it is marked as explored

      var explored = homeRoom.memory.explorations.find(
        i => i.roomName === creep.room.name && i.needsExploration === false
      );

      if (explored) {
        memory.targetRoom = undefined;
      } else {
        creep.goTo(new RoomPosition(25, 25, creep.room.name));
        return;
      }
    }

    if (!memory.targetRoom) {
      const availableRoomsToExplore = _.shuffle(homeRoom.memory.explorations.filter(i => i.needsExploration));
      const firstRoom = availableRoomsToExplore[0];
      if (firstRoom) {
        memory.targetRoom = firstRoom.roomName;
      } else {
        creep.suicide();
      }
    }

    if (memory.targetRoom) {
      creep.goTo(new RoomPosition(20, 20, memory.targetRoom));
    }
  }

  goHome(creep: Creep) {
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
      return;
    }
  }
}

profiler.registerClass(RoleScout, "RoleScout");

export const roleScout = new RoleScout();
