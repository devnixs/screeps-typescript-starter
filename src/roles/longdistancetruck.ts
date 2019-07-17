import { sourceManager } from "utils/source-manager";
import { profiler } from "../utils/profiler";
import { findHostile, findNonEmptyResourceInStore, findNonEmptyResourcesInStore } from "utils/finder";
import { IRemoteDefenderMemory } from "./remote-defender";
import { flee } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";

export interface ILongDistanceTruckMemory extends CreepMemory {
  depositing?: boolean;
  home: string;
  homeSpawnPosition: { x: number; y: number };
  targetContainer: string | undefined;
  energyRetrieved: number | undefined;
}

class RoleLongDistanceTruck implements IRole {
  run(creep: Creep) {
    const memory: ILongDistanceTruckMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (flee(creep) === OK) {
      return;
    }

    this.addRemoteCostStats(creep, memory);

    // if creep is bringing energy to a structure but has no energy left
    if (memory.depositing == true && totalCargoContent == 0) {
      creep.say("R" + memory.energyRetrieved);
      this.addRemoteRetrievedEnergyStats(creep, memory);
      // switch state
      memory.depositing = false;
      delete memory.energyRetrieved;
      delete memory.targetContainer;
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
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (
        constructionSite &&
        constructionSite.pos.inRangeTo(creep, 5) &&
        constructionSite.structureType !== "rampart"
      ) {
        if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
          creep.goTo(constructionSite);
        }
        return;
      }

      // if in home room
      if (creep.room.name == memory.home) {
        sourceManager.store(creep);
      }
      // if not in home room...
      else {
        const damagedRoad: StructureRoad = creep.pos.findInRange(FIND_STRUCTURES, 3, {
          filter: structure => structure.structureType === "road" && structure.hits < structure.hitsMax * 0.75
        })[0] as any;

        if (damagedRoad) {
          if (creep.repair(damagedRoad) === ERR_NOT_IN_RANGE) {
            creep.goTo(damagedRoad);
          }
          return;
        }

        // find exit to home room
        const moveResult = creep.goTo(
          new RoomPosition(memory.homeSpawnPosition.x, memory.homeSpawnPosition.y, memory.home)
        );
      }
    }
    // if creep is supposed to harvest energy from source
    else {
      const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1).filter(i => i.amount > 50)[0];
      if (droppedResource) {
        if (droppedResource.amount >= creep.carryCapacity - totalCargoContent) {
          // stats: if the resource is on top of a container, switch to that container
          const container = droppedResource.pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "container");
          if (container) {
            memory.targetContainer = container.id;
          }
        }

        creep.pickup(droppedResource);
        return;
      }

      const roomIsSK = Cartographer.roomType(creep.room.name) === "SK";
      if (roomIsSK) {
        const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 3).filter(i => i.amount > 200)[0];
        if (droppedResource) {
          if (creep.pickup(droppedResource) === ERR_NOT_IN_RANGE) {
            creep.goTo(droppedResource);
          }
          return;
        }
      }

      // if in target room
      const container = Game.getObjectById(memory.targetContainer) as StructureContainer;
      if (!container) {
        const ctrl = Game.rooms[memory.homeRoom].controller;
        if (ctrl) {
          creep.goTo(ctrl);
        }
        return;
      }
      if (creep.room.name == container.room.name) {
        const nonEmptyResources = findNonEmptyResourcesInStore(container.store);
        if (nonEmptyResources.length) {
          const withdrawResult = creep.withdraw(container, nonEmptyResources[0]);
          if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.goTo(container);
          }
          // if more than 1, wait one tick to get the other resource
          if (withdrawResult === OK && nonEmptyResources.length === 1) {
            memory.depositing = true;
          }
        } else {
          memory.depositing = true;
        }

        return;
      }
      // if not in target room
      else {
        const homeRoom = Game.rooms[creep.memory.homeRoom];
        const hasEnemy = homeRoom.memory.needsDefenders.find(i => i.room === container.room.name);
        const isRoomSK = Cartographer.roomType(container.room.name) === "SK";
        if (hasEnemy && !isRoomSK) {
          // go back home until the threat is gone
          const ctrl = Game.rooms[memory.homeRoom].controller;
          if (ctrl) {
            creep.say("🐓");
            creep.goTo(ctrl);
          }
        } else {
          creep.goTo(container.pos);
        }
      }
    }
  }

  addRemoteCostStats(creep: Creep, memory: ILongDistanceTruckMemory) {
    const skipTicks = 9;
    if (Game.time % skipTicks === 0) {
      const cost = _.sum(creep.body.map(i => BODYPART_COST[i.type]));
      const currentCost = (cost / CREEP_LIFE_TIME) * skipTicks;

      const homeRoom = Game.rooms[memory.homeRoom];
      const remote = homeRoom.memory.remotes.find(i => i.container === memory.targetContainer);

      // save stats
      if (remote) {
        remote.spentEnergy = remote.spentEnergy || 0;
        remote.spentEnergy += currentCost;
      }
    }
  }

  addRemoteRetrievedEnergyStats(creep: Creep, memory: ILongDistanceTruckMemory) {
    const homeRoom = Game.rooms[memory.homeRoom];
    const remote = homeRoom.memory.remotes.find(i => i.container === memory.targetContainer);

    // save stats
    if (remote && memory.targetContainer) {
      remote.retrievedEnergy = remote.retrievedEnergy || 0;
      remote.retrievedEnergy += memory.energyRetrieved || 0;
    }
  }
}

profiler.registerClass(RoleLongDistanceTruck, "RoleLongDistanceTruck");
export const roleLongDistanceTruck = new RoleLongDistanceTruck();
