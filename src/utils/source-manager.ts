import { findAndCache, findRestSpot } from "./finder";
import { LinkManager } from "./link-manager";

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
      return;
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
      return -1;
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

    const distanceX = Math.abs(creep.pos.x - source.pos.x);
    const distanceY = Math.abs(creep.pos.y - source.pos.y);
    if (distanceX <= 1 && distanceY <= 1) {
      const harvestResult = creep.harvest(source);
      if (harvestResult !== OK) {
      }
    } else {
      creep.goTo(source);
      creep.harvest(source);
    }
  }

  pickupDroppedEnergy(creep: Creep) {
    const droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
      filter: i => i.resourceType === RESOURCE_ENERGY
    });
    if (droppedEnergy) {
      if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
        creep.goTo(droppedEnergy);
        creep.pickup(droppedEnergy);
      }
      return OK;
    }

    const tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
      filter: tomb => tomb.store && tomb.store.energy > 0
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
    const droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
      filter: i => i.resourceType != RESOURCE_ENERGY
    });
    if (droppedEnergy) {
      if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
        creep.goTo(droppedEnergy);
        creep.pickup(droppedEnergy);
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

  getEnergy(creep: Creep) {
    let targetStructure: AnyStructure | undefined = undefined;

    if (this.pickupDroppedEnergy(creep) === OK) {
      return OK;
    }

    const linkToWithdrawEnergy = LinkManager.getLinksToWithdrawEnergy(creep.pos)[0];
    if (
      linkToWithdrawEnergy &&
      linkToWithdrawEnergy.link &&
      linkToWithdrawEnergy.link.energy >= creep.carryCapacity - creep.carry.energy
    ) {
      targetStructure = linkToWithdrawEnergy.link;
    }

    if (!targetStructure) {
      targetStructure = creep.room.storage && creep.room.storage.store.energy > 0 ? creep.room.storage : undefined;
    }

    if (!targetStructure) {
      targetStructure = findAndCache<FIND_STRUCTURES>(
        creep,
        "harvest_container_id",
        FIND_STRUCTURES,
        (targetStructure: any) => targetStructure.store.energy > 0,
        {
          filter: (structure: StructureContainer) => {
            return structure.structureType == STRUCTURE_CONTAINER && structure.store.energy > 0;
          }
        }
      ) as any;
    }

    if (targetStructure) {
      if (creep.withdraw(targetStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.goTo(targetStructure);
        creep.withdraw(targetStructure, RESOURCE_ENERGY);
      }
      return OK;
    } else if (creep.getActiveBodyparts(WORK) > 0) {
      return this.harvestEnergyFromSource(creep);
    } else {
      return -1;
    }
  }

  getStructureThatNeedsEnergy(creep: Creep) {
    let targetStructure: AnyStructure | undefined = findAndCache<FIND_STRUCTURES>(
      creep,
      "deposit_structure_id",
      FIND_STRUCTURES,
      (targetStructure: any) => targetStructure.energy < targetStructure.energyCapacity,
      {
        filter: (structure: StructureSpawn | StructureExtension | StructureTower | StructureLab) => {
          const isExtOrSpawn =
            structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN;

          const isTowerOrLab = structure.structureType == STRUCTURE_TOWER || structure.structureType == STRUCTURE_LAB;

          return (
            (isExtOrSpawn && structure.energy < structure.energyCapacity) ||
            (isTowerOrLab && structure.energy < structure.energyCapacity * 0.5) // we don't want to keep filling towers. Or the creep would keep doing this as the energy goes down every tick
          );
        }
      }
    ) as any;

    return targetStructure;
  }

  storeEnergy(creep: Creep) {
    let targetStructure = this.getStructureThatNeedsEnergy(creep);

    if (!targetStructure) {
      const link = LinkManager.getLinksThatCanReceiveEnergy(creep.pos)[0];
      targetStructure = link && link.link;
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
      if (creep.transfer(targetStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.goTo(targetStructure);
        creep.transfer(targetStructure, RESOURCE_ENERGY);
      }
    } else {
      const restSpot = findRestSpot(creep);
      if (restSpot) {
        creep.goTo(restSpot);
      }
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
      targetStructure = creep.room.storage;
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

export const sourceManager = new SourceManager();
