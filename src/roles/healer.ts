import { findEmptySpotCloseTo, findRestSpot } from "../utils/finder";
import { boostCreep } from "../utils/boost-manager";

interface IHealerMemory extends CreepMemory {
  assignedExplorerName: string | null;
}

class RoleHealer implements IRole {
  run(creep: Creep) {
    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    }

    const memory: IHealerMemory = creep.memory as any;

    const attackFlag = Game.flags["fighter_attack"] || Game.flags["dismantler_attack"];
    if (attackFlag && attackFlag.room && attackFlag.room.name === creep.room.name) {
      // console.log("Healer: is in attack room");
      // we are in the right room
      const closeFigther = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "fighter" || i.memory.role === "dismantler"
      });

      const damagedCreep = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.hits < i.hitsMax
      });
      const healTarget = damagedCreep || closeFigther;

      if (healTarget) {
        // console.log("Healer: has heal target");
        if (healTarget.pos.getRangeTo(creep) <= 1) {
          creep.heal(healTarget);
        } else if (healTarget.pos.getRangeTo(creep) <= 3) {
          creep.rangedHeal(healTarget);
        }
        creep.goTo(healTarget);
      } else {
        this.goHome(creep);
      }
    } else if (attackFlag) {
      // we are not in the right room, but someone is
      const closeFigther = Object.keys(Game.creeps)
        .map(i => Game.creeps[i])
        .filter(i => i.memory.role === "fighter" || i.memory.role === "dismantler")[0];
      /*
      const damagedCreep = attackFlag.room.find(FIND_MY_CREEPS, {
        filter: i => i.hits < i.hitsMax
      })[0]; */
      const healTarget = closeFigther;

      if (healTarget) {
        creep.goTo(healTarget);
      }
    } else {
      // console.log("Healer: 2");
      if (creep.room.name !== creep.memory.homeRoom) {
        // console.log("Healer: going home");
        this.goHome(creep);
      }

      let restSpot: RoomPosition | HasPos | null = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: i => i.memory.role === "fighter" || i.memory.role === "dismantler"
      });

      if (!restSpot) {
        restSpot = findRestSpot(creep);
      }
      if (restSpot) {
        // console.log("Healer:going to rest spot : ", JSON.stringify(restSpot));
        creep.goTo(restSpot);
      }
    }
  }

  goHome(creep: Creep) {
    creep.goTo(new RoomPosition(25, 25, creep.memory.homeRoom || ""));
  }
}

export const roleHealer = new RoleHealer();
