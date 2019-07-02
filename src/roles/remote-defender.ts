import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";

export interface IRemoteDefenderMemory extends CreepMemory {
  status: "healing" | "attacking";
  targetRoom: string;
}

class RoleRemoteDefender implements IRole {
  run(creep: Creep) {
    if (creep.ticksToLive === 1480) {
      creep.notifyWhenAttacked(false);
    }

    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    } else {
    }

    if (creep.memory.subRole === "stop") {
      return;
    }

    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: IRemoteDefenderMemory = creep.memory as any;

    let hostile: Creep | null = null;
    hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (hostile) {
      if (hostile.pos.isNearTo(creep.pos)) {
        creep.attack(hostile);
      }
    }

    if (creep.fatigue > 0) {
      creep.heal(creep);
      return;
    }

    if (!memory.status) {
      memory.status = "attacking";
    }

    if (memory.status === "attacking") {
      const needsHealing = this.needsHealing(creep);
      if (needsHealing) {
        memory.status = "healing";
      }
    }

    if (memory.status === "healing") {
      const isFullyHealed = this.isFullyHealed(creep);
      if (isFullyHealed) {
        memory.status = "attacking";
      }
    }

    if (memory.status === "healing") {
      creep.heal(creep);
    } else {
      if (!memory.targetRoom) {
        this.goHome(creep);
        return;
      } else {
        if (memory.targetRoom != creep.room.name) {
          creep.goTo(new RoomPosition(25, 25, memory.targetRoom));
          return;
        } else {
          if (hostile) {
            creep.goTo(hostile);
          }
        }
      }
    }
  }

  goHome(creep: Creep) {
    if (creep.room.name !== creep.memory.homeRoom) {
      // go back home
      creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
      return;
    }
  }

  needsHealing(creep: Creep) {
    const toughParts = creep.body.filter(i => i.type === "tough");
    const totalToughHits = toughParts.length * 100;
    const actualToughHits = toughParts.reduce((acc, part) => acc + part.hits, 0);
    return totalToughHits > 0 && actualToughHits <= totalToughHits / 2;
  }
  isFullyHealed(creep: Creep) {
    const toughParts = creep.body.filter(i => i.type === "tough");
    const totalToughHits = toughParts.length * 100;
    const actualToughHits = toughParts.reduce((acc, part) => acc + part.hits, 0);
    return totalToughHits > 0 && actualToughHits >= totalToughHits * 0.8;
  }
}

export const roleRemoteDefender = new RoleRemoteDefender();
