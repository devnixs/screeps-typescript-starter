import { findAndCache, findRestSpot } from "./finder";
import { LinkManager } from "./link-manager";
import { profiler } from "../utils/profiler";
import { desiredEnergyInTerminal } from "constants/misc";

class SourceManager {
  harvestEnergyFromSource(creep: Creep) {
    if (this.pickupDroppedEnergy(creep) === OK) {
      return;
    }

    const targetEnergySource = findAndCache<FIND_SOURCES>(
      creep,
      "harvest_source_id",
      FIND_SOURCES,
      (targetStructure: Source) => targetStructure.energy > 0,
      {
        filter: (structure: Source) => {
          return structure.energy > 0;
        }
      }
    );

    if (!targetEnergySource) {
      return;
    }

    const distanceX = Math.abs(creep.pos.x - targetEnergySource.pos.x);
    const distanceY = Math.abs(creep.pos.y - targetEnergySource.pos.y);
    if (distanceX <= 1 && distanceY <= 1) {
      const harvestResult = creep.harvest(targetEnergySource);

      if (harvestResult !== OK) {
      }
    } else {
      creep.goTo(targetEnergySource);
      creep.harvest(targetEnergySource);
    }
  }
  mineMineral(creep: Creep) {
    if (this.pickupDroppedMineral(creep) === OK) {
      return OK;
    }

    const targetMineralDeposit = findAndCache<FIND_MINERALS>(
      creep,
      "harvest_mineral_id",
      FIND_MINERALS,
      (targetStructure: Mineral) => targetStructure.mineralAmount > 0,
      {
        filter: (structure: Mineral) => {
          return structure.mineralAmount > 0;
        }
      }
    );

    if (!targetMineralDeposit) {
      console.log("Found no minerals to mine");
      return -1;
    }

    if (creep.carry.energy > 0) {
      this.storeEnergy(creep);
      return OK;
    }

    if (creep.harvest(targetMineralDeposit) === ERR_NOT_IN_RANGE) {
      creep.goTo(targetMineralDeposit);
      creep.harvest(targetMineralDeposit);
    }
    return OK;
  }
  harvestEnergyFromSpecificSource(creep: Creep, source: Source) {
    if (!source) {
      return;
    }

    if (creep.pos.isNearTo(source)) {
      const harvestResult = creep.harvest(source);
      if (harvestResult !== OK && harvestResult !== ERR_NOT_ENOUGH_RESOURCES) {
        console.log("Harvest result", creep.name, harvestResult);
      }
    } else {
      creep.goTo(source);
    }
  }

  pickupDroppedEnergy(creep: Creep) {
    const droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
      filter: i =>
        i.resourceType === RESOURCE_ENERGY && i.pos.getRangeTo(creep.pos.x, creep.pos.y) <= 5 && i.amount >= 300
    });
    if (droppedEnergy) {
      if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
        creep.goTo(droppedEnergy);
        creep.pickup(droppedEnergy);
      }
      return OK;
    }

    const tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
      filter: tomb => tomb.store && tomb.store.energy > 0 && tomb.pos.getRangeTo(creep.pos.x, creep.pos.y) <= 8
    });

    if (tombstone) {
      if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.goTo(tombstone);
        creep.withdraw(tombstone, RESOURCE_ENERGY);
      }
      return OK;
    }

    return -1;
  }

  pickupDroppedMineral(creep: Creep) {
    const droppedResource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
      filter: i => i.resourceType != RESOURCE_ENERGY
    });
    if (droppedResource) {
      if (creep.pickup(droppedResource) === ERR_NOT_IN_RANGE) {
        creep.goTo(droppedResource);
        creep.pickup(droppedResource);
      }
      return OK;
    }

    const tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
      filter: tomb => tomb.store && this.getCurrentCarryingMineral(tomb.store)
    });

    if (tombstone) {
      const element = this.getCurrentCarryingMineral(tombstone.store);
      if (element) {
        if (creep.withdraw(tombstone, element) === ERR_NOT_IN_RANGE) {
          creep.goTo(tombstone);
          creep.withdraw(tombstone, element);
        }
        return OK;
      }
    }

    return -1;
  }

  getEnergyFromStorageIfPossible(creep: Creep) {
    const storage = creep.room.storage;
    if (storage && storage.store.energy > 2000) {
      const withdrawResult = creep.withdraw(storage, RESOURCE_ENERGY);
      if (withdrawResult === ERR_NOT_IN_RANGE) {
        creep.goTo(storage);
        creep.withdraw(storage, RESOURCE_ENERGY);
      }
      return OK;
    } else {
      return this.getEnergy(creep);
    }
  }

  getEnergy(creep: Creep) {
    let targetStructure: AnyStructure | undefined = undefined;

    if (this.pickupDroppedEnergy(creep) === OK) {
      return OK;
    }

    const linkToWithdrawEnergy = LinkManager.getLinksToWithdrawEnergy(creep.pos)[0];
    if (linkToWithdrawEnergy && linkToWithdrawEnergy.link && creep.memory.role != "truck") {
      targetStructure = linkToWithdrawEnergy.link;
    }

    if (!targetStructure) {
      if (creep.room.terminal && creep.room.terminal.store.energy + 2000 > desiredEnergyInTerminal) {
        targetStructure = creep.room.terminal;
      }
    }

    if (!targetStructure) {
      targetStructure = creep.room.storage && creep.room.storage.store.energy > 0 ? creep.room.storage : undefined;
    }

    if (!targetStructure) {
      targetStructure = findAndCache<FIND_STRUCTURES>(
        creep,
        "harvest_container_id",
        FIND_STRUCTURES,
        (targetStructure: any) => targetStructure.store.energy >= targetStructure.storeCapacity / 4,
        {
          filter: (structure: StructureContainer) => {
            return (
              structure.structureType == STRUCTURE_CONTAINER && structure.store.energy >= structure.storeCapacity / 4
            );
          }
        }
      ) as any;
    }

    if (targetStructure) {
      const withdrawResult = creep.withdraw(targetStructure, RESOURCE_ENERGY);
      if (withdrawResult === ERR_NOT_IN_RANGE) {
        creep.goTo(targetStructure);
        creep.withdraw(targetStructure, RESOURCE_ENERGY);
      }
      return OK;
    } else if (creep.getActiveBodyparts(WORK) > 0 && !creep.room.storage) {
      // when a room doesn't have a storage yet, creeps need to be able to harvest themselves
      return this.harvestEnergyFromSource(creep);
    } else {
      return -1;
    }
  }

  filterStructureNeedsEnergy = (structure: StructureSpawn | StructureExtension | StructureTower | StructureLab) => {
    const isExtOrSpawn = structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN;

    const isTowerOrLab = structure.structureType == STRUCTURE_TOWER || structure.structureType == STRUCTURE_LAB;

    const hasEnoughEnergyInRoom = structure.room.energyAvailable === structure.room.energyCapacityAvailable;

    return (
      (isExtOrSpawn && structure.energy < structure.energyCapacity) ||
      (hasEnoughEnergyInRoom && isTowerOrLab && structure.energy < structure.energyCapacity * 0.5) // we don't want to keep filling towers. Or the creep would keep doing this as the energy goes down every tick
    );
  };

  getStructureThatNeedsEnergy(creep: Creep) {
    let targetStructure: AnyStructure | undefined = findAndCache<FIND_STRUCTURES>(
      creep,
      "deposit_structure_id",
      FIND_STRUCTURES,
      (targetStructure: any) =>
        (targetStructure.structureType != "tower" && targetStructure.energy < targetStructure.energyCapacity) ||
        (targetStructure.structureType === "tower" && targetStructure.energy < targetStructure.energyCapacity - 100),
      {
        filter: this.filterStructureNeedsEnergy
      }
    ) as any;

    return targetStructure;
  }

  storeInCloseContainer(creep: Creep) {
    const closeContainer: StructureContainer | undefined = creep.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: i => i.structureType === "container"
    })[0] as any;

    if (closeContainer) {
      const isFull = _.sum(closeContainer.store) >= closeContainer.storeCapacity;
      if (isFull) {
        return -1;
      } else {
        const creepCarrying = Object.keys(creep.carry).find(i => (creep.carry as any)[i] > 0) as ResourceConstant;
        if (creepCarrying) {
          return creep.transfer(closeContainer, creepCarrying);
        } else {
          return -1;
        }
      }
    } else {
      return -1;
    }
  }

  storeEnergy(creep: Creep) {
    let targetStructure: AnyStructure | undefined = undefined;
    const inputLink = LinkManager.getInputLinkThatCanReceiveEnergy(creep.pos);

    if (inputLink && creep.memory.role !== "truck") {
      // if the link is very close, use it first, but not for trucks as they might end up stuck in a loop
      targetStructure = inputLink && inputLink.link;
    }

    if (!targetStructure) {
      targetStructure = this.getStructureThatNeedsEnergy(creep);
    }

    if (!targetStructure) {
      const inputOutputLink = LinkManager.getInputOutputLinkThatCanReceiveEnergy(creep.pos);
      targetStructure = inputOutputLink && inputOutputLink.link;
    }

    if (!targetStructure) {
      targetStructure =
        creep.room.storage && creep.room.storage.store.energy < creep.room.storage.storeCapacity
          ? creep.room.storage
          : undefined;
    }

    if (!targetStructure) {
      targetStructure = findAndCache<FIND_STRUCTURES>(
        creep,
        "deposit_container_id",
        FIND_STRUCTURES,
        (targetStructure: any) => targetStructure.store.energy < targetStructure.storeCapacity,
        {
          filter: (structure: StructureContainer) => {
            return structure.structureType == STRUCTURE_CONTAINER && structure.store.energy < structure.storeCapacity;
          }
        }
      ) as any;
    }

    if (targetStructure) {
      let transferResult: number = creep.transfer(targetStructure, RESOURCE_ENERGY);
      if (transferResult == ERR_NOT_IN_RANGE) {
        creep.goTo(targetStructure);
        transferResult = creep.transfer(targetStructure, RESOURCE_ENERGY);
      }
    } else {
      return -1;
    }
    return OK;
  }

  getCurrentCarryingMineral(store: StoreDefinition) {
    var carrying = Object.keys(store as any).filter(i => i !== "energy" && store && (store as any)[i] > 0)[0] as
      | ResourceConstant
      | undefined;
    return carrying;
  }
  getCurrentCarrying(store: StoreDefinition) {
    var carrying = Object.keys(store as any).filter(i => (store as any)[i] > 0)[0] as ResourceConstant | undefined;
    return carrying;
  }
  storeMinerals(creep: Creep) {
    let targetStructure: AnyStructure | undefined = undefined;

    var carrying = this.getCurrentCarrying(creep.carry);

    if (!carrying) {
      return;
    }

    if (!targetStructure) {
      targetStructure = creep.room.terminal || creep.room.storage;
    }

    if (targetStructure) {
      if (creep.transfer(targetStructure, carrying) == ERR_NOT_IN_RANGE) {
        creep.goTo(targetStructure);
        creep.transfer(targetStructure, carrying);
      }
    } else {
      const restSpot = findRestSpot(creep);
      if (restSpot) {
        creep.goTo(restSpot);
      }
    }
  }
  store(creep: Creep) {
    if (creep.carry.energy > 0) {
      return this.storeEnergy(creep);
    } else {
      return this.storeMinerals(creep);
    }
  }
}

profiler.registerClass(SourceManager, "SourceManager");
export const sourceManager = new SourceManager();
