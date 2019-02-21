import { findEmptySpotCloseTo, findRestSpot } from "utils/finder";

interface IHealerMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleHealer implements IRole {
  run(creep: Creep) {
    const memory: IHealerMemory = creep.memory as any;

    const attackFlag = Game.flags["fighter_attack"];
    if (attackFlag && attackFlag.room && attackFlag.room.name === creep.room.name) {
      // we are in the right room
      const closeFigther = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "fighter"
      });

      const damagedCreep = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.hits < i.hitsMax
      });
      const healTarget = damagedCreep || closeFigther;

      if (healTarget) {
        if (healTarget.pos.getRangeTo(creep) <= 1) {
          creep.heal(healTarget);
        } else if (healTarget.pos.getRangeTo(creep) <= 3) {
          creep.rangedHeal(healTarget);
        }
        creep.goTo(healTarget);
      } else {
        this.goHome(creep);
      }
    } else if (attackFlag && attackFlag.room) {
      // we are not in the right room, but someone is
      const closeFigther = attackFlag.room.find(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "fighter"
      })[0];

      const damagedCreep = attackFlag.room.find(FIND_MY_CREEPS, {
        filter: i => i.hits < i.hitsMax
      })[0];
      const healTarget = damagedCreep || closeFigther;

      if (healTarget) {
        creep.goTo(healTarget);
      }
    } else {
      if (creep.room.name !== creep.memory.homeRoom) {
        this.goHome(creep);
      }

      let restSpot: RoomPosition | HasPos | null = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "fighter"
      });

      if (!restSpot) {
        restSpot = findRestSpot(creep);
      }
      if (restSpot) {
        creep.goTo(restSpot);
      }
    }
  }

  goHome(creep: Creep) {
    creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
  }
}

export const roleHealer = new RoleHealer();
