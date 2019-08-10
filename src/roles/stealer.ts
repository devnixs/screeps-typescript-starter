import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";
import { findHostile, findNonEmptyResourceInStore, findNonEmptyResourcesInStore } from "utils/finder";
import { IRemoteDefenderMemory } from "./remote-defender";
import { flee, runFromTimeToTime } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { roleUpgrader } from "./upgrader";
import { getUsedPercentage } from "utils/cpu";
import { whitelist } from "constants/misc";

export interface IStealerMemory extends CreepMemory {
  depositing?: boolean;
  targetPos: SimplePosWithRoomName;
  energyRetrieved: number | undefined;
  homeSpawnPosition: SimplePos;
  lastHits: number;
}

class RoleStealer implements IRole {
  run(creep: Creep) {
    const memory: IStealerMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    const enemy = creep.pos
      .findInRange(FIND_HOSTILE_CREEPS, 1, { filter: i => whitelist.indexOf(i.owner.username) === -1 })
      .filter(i => i.body.find(t => t.type === ATTACK) || i.body.find(t => t.type === RANGED_ATTACK));

    if (enemy) {
      creep.attack(enemy[0]);
    }

    if (memory.lastHits !== creep.hits) {
      // we've just been attacked. We might have lost some energy
      memory.lastHits = creep.hits;

      if (memory.depositing) {
        memory.energyRetrieved = creep.carry.energy;
      }
    }

    // if creep is bringing energy to a structure but has no energy left
    if (memory.depositing == true && totalCargoContent == 0) {
      creep.say("R" + memory.energyRetrieved);
      this.addRemoteRetrievedEnergyStats(creep, memory);
      // switch state
      memory.depositing = false;
      delete memory.energyRetrieved;
    }
    // if creep is harvesting energy but is full
    else if (!memory.depositing && totalCargoContent == creep.carryCapacity) {
      // switch state
      memory.depositing = true;
    }

    if (memory.depositing && !memory.energyRetrieved && creep.carry.energy) {
      memory.energyRetrieved = creep.carry.energy;
    }

    // if creep is supposed to transfer energy to a structure
    if (memory.depositing == true) {
      // first let's see if a road needs to be built
      /*       const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (
        constructionSite &&
        constructionSite.pos.inRangeTo(creep, 5) &&
        constructionSite.structureType !== "rampart"
      ) {
        if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
          creep.goTo(constructionSite);
        }
        return;
      } */

      // if in home room
      if (creep.room.name == memory.homeRoom) {
        if (creep.room.energyAvailable < creep.room.energyCapacityAvailable / 2 || getUsedPercentage() < 0.6) {
          sourceManager.store(creep);
        } else {
          const res = sourceManager.storeInStorageIfPossible(creep);
        }
      } else {
        // if not in home room...
        /*         if (runFromTimeToTime(5, 20)) {
          const damagedRoad: StructureRoad = creep.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: structure => structure.structureType === "road" && structure.hits < structure.hitsMax * 0.75
          })[0] as any;

          if (damagedRoad) {
            if (creep.repair(damagedRoad) === ERR_NOT_IN_RANGE) {
              creep.goTo(damagedRoad);
            }
            return;
          }
        } */

        // find exit to home room
        creep.goTo(new RoomPosition(memory.homeSpawnPosition.x, memory.homeSpawnPosition.y, memory.homeRoom));
      }
    }
    // if creep is supposed to harvest energy from source
    else {
      const droppedResource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, { filter: i => i.amount > 100 });
      if (droppedResource && droppedResource.pos.isNearTo(creep)) {
        creep.pickup(droppedResource);
        return;
      }

      const pos = new RoomPosition(memory.targetPos.x, memory.targetPos.y, memory.targetPos.roomName);
      // if in target room
      const container = Game.rooms[memory.targetPos.roomName]
        ? (pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "container") as (StructureContainer | undefined))
        : undefined;

      const otherContainer = Game.rooms[memory.targetPos.roomName]
        ? (pos.findClosestByRange(FIND_STRUCTURES, {
            filter: i => i.structureType === "container" && i.store.energy > 200
          }) as (StructureContainer | undefined))
        : undefined;

      const targetPos =
        (container && container.store.energy > 100 && container.pos) ||
        (droppedResource && droppedResource.pos) ||
        (otherContainer && otherContainer.pos) ||
        pos;

      if (creep.room.name == pos.roomName) {
        if (targetPos.getRangeTo(creep) > 1) {
          creep.goTo(targetPos);
          return;
        } else {
          if (container && container.pos.isNearTo(creep)) {
            const nonEmptyResources = findNonEmptyResourcesInStore(container.store);
            if (nonEmptyResources.length) {
              const withdrawResult = creep.withdraw(container, nonEmptyResources[0]);
              // if more than 1, wait one tick to get the other resource
              if (withdrawResult === OK && nonEmptyResources.length === 1) {
                memory.depositing = true;
              }
            } else {
              memory.depositing = true;
            }
          }
        }

        return;
      }
      // if not in target room
      else {
        creep.goTo(pos);
      }
    }
  }

  addRemoteRetrievedEnergyStats(creep: Creep, memory: IStealerMemory) {
    const homeRoom = Game.rooms[memory.homeRoom];
    let remote = homeRoom.memory.stealingStats.find(
      i =>
        i.pos.roomName === memory.targetPos.roomName && i.pos.x === memory.targetPos.x && i.pos.y === memory.targetPos.y
    );

    if (!remote) {
      remote = {
        pos: memory.targetPos,
        brought: 0,
        cost: 0
      };
      homeRoom.memory.stealingStats.push(remote);
    }

    // save stats
    remote.brought += memory.energyRetrieved || 0;
  }
}

profiler.registerClass(RoleStealer, "RoleStealer");
export const roleStealer = new RoleStealer();
