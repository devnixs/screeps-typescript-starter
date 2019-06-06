import { requiredHealersForAnAttack } from "../constants/misc";
import { findRestSpot } from "utils/finder";
import { boostCreep } from "utils/boost-manager";

interface IVersatileMemory extends CreepMemory {
  status: "healing" | "attacking";
  arrivedInTargetRoomAt?: number;
}

class RoleVersatile implements IRole {
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
    const memory: IVersatileMemory = creep.memory as any;

    let hostile: Creep | null = null;
    hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

    if (hostile) {
      if (hostile.pos.inRangeTo(creep.pos, 1)) {
        creep.rangedMassAttack();
      } else {
        creep.rangedAttack(hostile);
      }
    }

    if (creep.fatigue > 0) {
      creep.heal(creep);
      return;
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
          if (!memory.arrivedInTargetRoomAt) {
            memory.arrivedInTargetRoomAt = Game.time;
          }

          let targetStructure: AnyStructure | undefined | null;
          const previousCreep = this.getPreviousCreepInRoom(creep);
          if (!previousCreep) {
            targetStructure = this.findTargetStructure(creep, attackFlag, false);
          } else {
            if (previousCreep.pos.inRangeTo(creep.pos, 1)) {
              targetStructure = this.findTargetStructure(creep, attackFlag, true);
            } else {
              creep.goTo(previousCreep);
              return;
            }
          }

          if (targetStructure) {
            // special case for creep spawning stomping us.
            // If it's almost spawned, we back off to avoid being walked upon.
            if (targetStructure.structureType === "spawn") {
              const spawn = targetStructure as StructureSpawn;
              if (spawn.spawning && spawn.spawning.remainingTime < 5) {
                this.goHome(creep);
                return;
              }
            }

            const dismantleResult = creep.dismantle(targetStructure);
            if (creep.dismantle(targetStructure) === ERR_NOT_IN_RANGE) {
              var gotoResult = creep.goTo(targetStructure);
              creep.dismantle(targetStructure);
            } else if (dismantleResult != OK) {
              if (attackFlag.room && attackFlag.room.controller && attackFlag.room.controller.safeMode) {
                // pull off the attack.
                Game.notify("Removing flag because room " + attackFlag.room.name + " is in safe mode");
                attackFlag.remove();
              }
              console.log(creep.name, "dismantle result", dismantleResult);
              console.log(creep.name, "dismantle type", targetStructure.structureType);
            }
          } else {
            creep.goTo(attackFlag);
          }
        }
      }
    }
  }

  getPreviousCreepInRoom(creep: Creep) {
    var creeps = Object.keys(Game.creeps)
      .filter(creepName => Game.creeps[creepName].room.name === creep.room.name)
      .map(creepName => Game.creeps[creepName]);
    var orderedCreeps = _.sortBy(creeps, creep => (creep.memory as IVersatileMemory).arrivedInTargetRoomAt);
    var myIndex = orderedCreeps.indexOf(creep);
    return orderedCreeps[myIndex - 1];
  }

  removeFlag() {
    const flag = Game.flags["versatile_attack"];
    if (flag) {
      flag.remove();
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

  findTargetStructure(creep: Creep, attackFlag: Flag, ignoreFlags: boolean): AnyStructure | undefined | null {
    let targetStructure: AnyStructure | undefined | null;

    if (!ignoreFlags) {
      const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, attackFlag) as AnyStructure[];
      targetStructure = targetStructures[0];
      let counter = -1;
      while (!targetStructure && counter <= 10) {
        counter++;
        const flag = Game.flags["versatile_attack_" + counter];
        if (!flag) {
          continue;
        }

        const targetStructures = creep.room.lookForAt(LOOK_STRUCTURES, flag) as AnyStructure[];
        targetStructure = targetStructures[0];
      }
    }

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "tower" });

    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: i => i.structureType === "spawn" });
    /*
    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES, { filter: i => i.structureType === "tower" });
 */
    targetStructure =
      targetStructure ||
      creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
        filter: i => i.structureType !== "rampart" && i.structureType !== "controller"
      });
    /*
    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
 */
    targetStructure = targetStructure || creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES);

    return targetStructure;
  }
}

export const roleVersatile = new RoleVersatile();
