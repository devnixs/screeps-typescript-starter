import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";

interface IVersatileMemory extends CreepMemory {
  status: "healing" | "attacking";
}

class RoleVersatile implements IRole {
  run(creep: Creep) {
    if (boostCreep(creep) === OK) {
      // Don't do anything else
      return;
    } else {
    }

    // const rooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    const memory: IVersatileMemory = creep.memory as any;

    let hostile: Creep | null = null;
    hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (hostile) {
      creep.rangedAttack(hostile);
    }

    const attackFlag = Game.flags["versatile_attack"];

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
      if (!attackFlag) {
        this.goHome(creep);
        return;
      } else {
        if (attackFlag.pos && attackFlag.pos.roomName != creep.room.name) {
          creep.goTo(attackFlag);
          return;
        } else {
          const targetStructure = this.findTargetStructure(creep, attackFlag);
          if (targetStructure) {
            if (creep.dismantle(targetStructure) === ERR_NOT_IN_RANGE) {
              creep.goTo(targetStructure);
              creep.dismantle(targetStructure);
            }
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

    let restSpot: RoomPosition | null;
    restSpot = Game.flags["dismantler_rest"] && Game.flags["dismantler_rest"].pos;
    restSpot = restSpot || findRestSpot(creep);
    if (restSpot) {
      creep.goTo(restSpot);
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

  findTargetStructure(creep: Creep, attackFlag: Flag): AnyStructure | undefined {
    const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, attackFlag) as AnyStructure[];
    let targetStructure = targetStructures[0];

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "tower" });

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "spawn" });

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES, { filter: i => i.structureType === "tower" });

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
        filter: i => i.structureType !== "rampart" && i.structureType !== "controller"
      });

    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);

    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);

    return targetStructure;
  }
}

export const roleVersatile = new RoleVersatile();
