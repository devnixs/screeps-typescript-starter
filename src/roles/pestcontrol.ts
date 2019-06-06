import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";
import { unwatchFile } from "fs";

interface IVersatileMemory extends CreepMemory {}

export class RolePestControl implements IRole {
  static checkReconstruction() {
    if (Game.time % 15 !== 0) {
      return;
    }
    const roomsToWatch = ["E25N37", "E23N36"];
    for (let index = 0; index < roomsToWatch.length; index++) {
      const roomName = roomsToWatch[index];
      const room = Game.rooms[roomName];
      if (!room) {
        continue;
      }

      const spawnsInConstruction = room.find(FIND_CONSTRUCTION_SITES, {
        filter: i => i.structureType === "spawn" && i.progress > 0
      });
      if (spawnsInConstruction.length > 0) {
        const pos = spawnsInConstruction[0].pos;
        room.createFlag(pos.x, pos.y, "pest_control");
      } else {
        if (Game.flags["pest_control"]) {
          Game.flags["pest_control"].remove();
        }
      }
    }
  }

  run(creep: Creep) {
    if (creep.ticksToLive === 1480) {
      creep.notifyWhenAttacked(false);
    }

    if (creep.memory.subRole === "stop") {
      return;
    }

    const memory: IVersatileMemory = creep.memory as any;

    const attackFlag = Game.flags["pest_control"];

    if (!attackFlag) {
      // creep.suicide();
      return;
    } else {
      if (attackFlag.pos && attackFlag.pos.roomName != creep.room.name) {
        creep.goTo(attackFlag);
        return;
      } else {
        const targetStructure = this.findTargetStructure(creep, attackFlag);
        if (targetStructure) {
          creep.goTo(targetStructure);
        } else {
          creep.goTo(attackFlag);
        }
      }
    }
  }

  findTargetStructure(creep: Creep, attackFlag: Flag): ConstructionSite | undefined | null {
    const constructionSites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, attackFlag) as ConstructionSite[];
    let targetStructure = constructionSites[0];
    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);

    return targetStructure;
  }
}

export const rolePestControl = new RolePestControl();
