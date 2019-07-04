import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { wantsToSell, desiredStocks, desiredEnergyInTerminal } from "../constants/misc";
import { findRestSpot, findNonEmptyResourceInStore, findNonEmptyResourcesInStore } from "utils/finder";
import { profiler } from "../utils/profiler";

interface ITruckDestination {}

interface ITruckMemory extends CreepMemory {
  targetSource?: string;
  targetDestination?: string;
  jobResource: ResourceConstant;
  jobNeededAmount: number;
  isDepositing?: boolean;
  idle: boolean;
  lastJobRefreshTime: number | undefined;
  jobTag: string | undefined;

  isDepositingEnergy: boolean;
}

interface IJob {
  targetSource: string | undefined;
  targetDestination: string;
  jobResource: ResourceConstant;
  jobNeededAmount: number;

  jobTag: string;
}

class RoleTruck implements IRole {
  static hasActiveTruckJobs(room: Room) {
    return;
  }

  run(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    const totalCargoContent = _.sum(creep.carry);

    if (!memory.idle && creep.room.energyAvailable === creep.room.energyCapacityAvailable) {
      this.setJob(creep);
      let target: AnyStructure;
      if (memory.isDepositing) {
        target = Game.getObjectById(memory.targetDestination) as AnyStructure;
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);
          const depositResult = creep.transfer(target, memory.jobResource);
          if (totalCargoContent === 0 || depositResult === OK) {
            memory.isDepositing = false;

            // job is complete.
            this.endJob(creep);
          } else if (depositResult === ERR_FULL) {
            this.restartJob(creep);
          }
        }
      } else {
        target = Game.getObjectById(memory.targetSource) as AnyStructure;
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);

          let currentlyInStock = 100000;
          const store = (target as any).store;
          if (store) {
            currentlyInStock = store[memory.jobResource] || 0;
          }

          var currentlyCarrying = creep.carry[memory.jobResource] || 0;
          var needsToWithdraw = memory.jobNeededAmount - currentlyCarrying;
          let withdrawResult: ScreepsReturnCode = -1;
          if (needsToWithdraw <= 0) {
            withdrawResult = OK;
          }

          if (withdrawResult != OK) {
            withdrawResult = creep.withdraw(target, memory.jobResource, Math.min(needsToWithdraw, currentlyInStock));
          }

          if (withdrawResult === ERR_INVALID_TARGET) {
            // maybe it's a dropped resource
            withdrawResult = creep.pickup(target as any);
          }

          if (withdrawResult === OK) {
            memory.isDepositing = true;
          } else if (withdrawResult === ERR_FULL) {
            this.restartJob(creep, { forceEmptying: true });
          } else if (creep.pos.getRangeTo(target.pos.x, target.pos.y) <= 1) {
            // if it fails but we're in range, abort the job.

            this.restartJob(creep);
          }
        }
      }
    } else {
      if (this.runEnergyTruck(creep) !== OK) {
        new RoomVisual(creep.room.name).circle(creep.pos, {
          radius: 0.3,
          fill: "transparent",
          stroke: "#DCDCAA",
          strokeWidth: 0.15,
          opacity: 0.9
        });
        this.goToRestSpot(creep);

        const checkTime = "sim" in Game.rooms ? 1 : 1;
        if (Game.time % checkTime === 0) {
          // periodically check for jobs
          this.setJob(creep);
        }
      }
    }
  }

  goToRestSpot(creep: Creep) {
    var restSpot = findRestSpot(creep);
    if (restSpot) {
      creep.goTo(restSpot);
      return OK;
    } else {
      return -1;
    }
  }

  runEnergyTruck(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    const totalCargoContent = _.sum(creep.carry);
    if (totalCargoContent > creep.carry.energy) {
      // has other than energy
      sourceManager.storeMinerals(creep);
      return OK;
    }

    const getStructureThatNeedsEnergy = sourceManager.getStructureThatNeedsEnergy(creep);
    if (!getStructureThatNeedsEnergy) {
      if (creep.carry.energy > 0) {
        // empty energy first
        return sourceManager.storeEnergy(creep);
      } else {
        // No need to do anything
        return -1;
      }
    }

    if (!memory.isDepositingEnergy && creep.carry.energy === creep.carryCapacity) {
      memory.isDepositingEnergy = true;
    }

    if (memory.isDepositingEnergy && creep.carry.energy === 0) {
      memory.isDepositingEnergy = false;
    }

    if (memory.isDepositingEnergy) {
      return sourceManager.storeEnergy(creep);
    } else {
      return sourceManager.getEnergyFromStorageIfPossible(creep);
    }
  }

  restartJob(creep: Creep, { forceEmptying }: { forceEmptying?: boolean } = { forceEmptying: false }) {
    const memory: ITruckMemory = creep.memory as any;
    memory.idle = true;
    memory.jobTag = undefined;
    this.setJob(creep, { assumeEmpty: !forceEmptying });
  }

  endJob(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    memory.isDepositing = false;
    memory.jobTag = undefined;
  }

  getResource(store: StoreDefinition | StoreDefinitionWithoutEnergy, res: string) {
    return (store as any)[res] || 0;
  }

  getWantsToSellForThisRoom(room: string) {
    return wantsToSell[room] || {};
  }

  getWantsToKeepForThisRoom(room: string) {
    return desiredStocks;
  }

  createRetrievalJob(params: {
    creep: Creep;
    tag: string;
    sourceId: string;
    amount: number;
    resource: ResourceConstant;
  }) {
    let target: StructureTerminal | StructureStorage | undefined = undefined;
    if (params.resource === "energy") {
      target = params.creep.room.storage;
    } else {
      target = params.creep.room.terminal;
    }

    if (target) {
      return {
        targetSource: params.sourceId,
        targetDestination: target.id,
        jobResource: params.resource,
        jobNeededAmount: params.amount,
        jobTag: params.tag
      };
    }

    if (params.resource === "energy") {
      const structureThatNeedsEnergy = sourceManager.getStructureThatNeedsEnergy(params.creep) as StructureExtension;

      if (structureThatNeedsEnergy) {
        return {
          targetSource: params.sourceId,
          targetDestination: structureThatNeedsEnergy.id,
          jobResource: params.resource,
          jobNeededAmount: Math.min(
            params.amount,
            structureThatNeedsEnergy.energyCapacity - structureThatNeedsEnergy.energy
          ) as any,
          jobTag: params.tag
        };
      }
    }
    return null;
  }

  createRefillJob(params: { creep: Creep; tag: string; targetId: string; amount: number; resource: ResourceConstant }) {
    let source: StructureTerminal | StructureStorage | undefined = undefined;
    if (params.resource === "energy") {
      source = params.creep.room.storage;
    } else {
      source = params.creep.room.terminal;
    }

    if (source) {
      return {
        targetSource: source.id,
        targetDestination: params.targetId,
        jobResource: params.resource,
        jobNeededAmount: params.amount,
        jobTag: params.tag
      };
    }

    if (params.resource === "energy") {
      const containerWithEnergy: StructureContainer | undefined = params.creep.room.find(FIND_STRUCTURES, {
        filter: structure =>
          structure.structureType == STRUCTURE_CONTAINER && structure.store.energy >= structure.storeCapacity / 4
      })[0] as any;

      if (containerWithEnergy) {
        return {
          targetSource: containerWithEnergy.id,
          targetDestination: params.targetId,
          jobResource: params.resource,
          jobNeededAmount: Math.min(
            params.amount,
            containerWithEnergy.storeCapacity - containerWithEnergy.store.energy
          ) as any,
          jobTag: params.tag
        };
      }
    }
    return null;
  }

  *getJobs(creep: Creep): IterableIterator<IJob | null> {
    const storage = creep.room.storage as StructureStorage | undefined;
    const terminal = creep.room.terminal as StructureTerminal | undefined;
    var droppedResource = creep.room.find(FIND_DROPPED_RESOURCES)[0];

    if (
      droppedResource &&
      droppedResource.amount > 100 &&
      droppedResource.amount > creep.pos.getRangeTo(droppedResource.pos.x, droppedResource.pos.y) * 10
    ) {
      const job = this.createRetrievalJob({
        amount: droppedResource.amount,
        creep: creep,
        tag: "dropped-resource-" + droppedResource.id,
        resource: droppedResource.resourceType,
        sourceId: droppedResource.id
      });
      if (job) {
        yield job;
      }
    }

    const filledContainer: StructureContainer | undefined = creep.room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "container" && _.sum(i.store) >= i.storeCapacity / 2
    })[0] as StructureContainer;

    if (filledContainer) {
      const resourceType = findNonEmptyResourceInStore(filledContainer.store) as ResourceConstant;
      const job = this.createRetrievalJob({
        amount: filledContainer.store[resourceType] as any,
        creep: creep,
        tag: "empty-container",
        resource: resourceType,
        sourceId: filledContainer.id
      });
      if (job) {
        yield job;
      }
    }

    const containerWithMultipleResources: StructureContainer | undefined = creep.room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "container" && findNonEmptyResourcesInStore(i.store).length >= 2
    })[0] as StructureContainer;

    if (containerWithMultipleResources) {
      const resourcesInThatContainer = findNonEmptyResourcesInStore(containerWithMultipleResources.store);
      const resourceId = _.random(0, resourcesInThatContainer.length - 1);

      const resourceType = resourcesInThatContainer[resourceId] as ResourceConstant;
      const job = this.createRetrievalJob({
        amount: containerWithMultipleResources.store[resourceType] as any,
        creep: creep,
        tag: "empty-container",
        resource: resourceType,
        sourceId: containerWithMultipleResources.id
      });
      if (job) {
        yield job;
      }
    }

    var labs = this.getLabs(creep.room).map(i => ({ memory: i, obj: Game.getObjectById(i.id) as StructureLab }));
    var labThatNeedsEmptying = labs.filter(
      i =>
        i.memory.state === "needs-emptying" &&
        i.obj.mineralAmount > 0 &&
        (i.obj.cooldown === 0 || i.obj.mineralAmount > 300)
    )[0];

    if (storage) {
      var linkThatNeedsEmptying =
        creep.room.memory.links && creep.room.memory.links.find(i => i.state == "needs-emptying");

      var linkThatNeedsRefill =
        creep.room.memory.links &&
        creep.room.memory.links.find(i => i.state == "needs-refill" && i.type === "input-output");

      if (linkThatNeedsEmptying && linkThatNeedsEmptying.needsAmount !== undefined) {
        var linkObject = Game.getObjectById(linkThatNeedsEmptying.id) as StructureLink;

        const overSupply = linkObject.energy - linkThatNeedsEmptying.needsAmount;
        if (overSupply > 100) {
          const job = this.createRetrievalJob({
            amount: Math.min(overSupply, creep.carryCapacity),
            creep: creep,
            tag: "empty-link-" + linkThatNeedsEmptying.id,
            resource: "energy",
            sourceId: linkThatNeedsEmptying.id
          });
          if (job) {
            yield job;
          }
        }
      }

      if (linkThatNeedsRefill && linkThatNeedsRefill.needsAmount !== undefined) {
        var linkObject = Game.getObjectById(linkThatNeedsRefill.id) as StructureLink;
        const underSupply = linkThatNeedsRefill.needsAmount - linkObject.energy;
        if (underSupply > 100) {
          const job = this.createRefillJob({
            amount: underSupply,
            creep: creep,
            tag: "refill-link-" + linkThatNeedsRefill.id,
            resource: "energy",
            targetId: linkThatNeedsRefill.id
          });
          if (job) {
            yield job;
          }
        }
      }
    }

    if (storage && terminal) {
      var assets = storage.store;

      let terminalOversupply: string | undefined;
      let terminalUndersupply: string | undefined;

      const wantsToKeepForThisRoom = this.getWantsToKeepForThisRoom(creep.room.name);

      const terminal = creep.room.terminal;

      if (
        terminal &&
        terminal.store.energy < desiredEnergyInTerminal &&
        storage &&
        storage.store.energy >= desiredEnergyInTerminal
      ) {
        yield {
          targetSource: storage.id,
          targetDestination: terminal.id,
          jobResource: "energy",
          jobNeededAmount: desiredEnergyInTerminal - terminal.store.energy,
          jobTag: "refill-terminal-energy"
        };
      }

      if (
        terminal &&
        terminal.store.energy > desiredEnergyInTerminal &&
        storage &&
        _.sum(storage.store) < storage.storeCapacity - 10000
      ) {
        yield {
          targetSource: terminal.id,
          targetDestination: storage.id,
          jobResource: "energy",
          jobNeededAmount: terminal.store.energy - desiredEnergyInTerminal,
          jobTag: "empty-terminal-energy"
        };
      }

      if (terminal && storage) {
        var nonEnergyInStorage = Object.keys(storage.store).filter(i => i !== "energy")[0] as
          | ResourceConstant
          | undefined;
        if (nonEnergyInStorage) {
          yield {
            targetSource: storage.id,
            targetDestination: terminal.id,
            jobResource: nonEnergyInStorage,
            jobNeededAmount: storage.store[nonEnergyInStorage] as any,
            jobTag: "empty-storage"
          };
        }
      }

      if (terminal) {
        const resources = _.uniq(Object.keys(wantsToKeepForThisRoom).concat(Object.keys(terminal.store)));

        terminalOversupply = resources.filter(
          i =>
            i !== "energy" &&
            this.getResource(terminal.store, i) > 0 &&
            this.getResource(storage.store, i) < this.getResource(wantsToKeepForThisRoom, i)
        )[0];

        terminalUndersupply = resources.filter(
          i => i !== "energy" && this.getResource(storage.store, i) > this.getResource(wantsToKeepForThisRoom, i)
        )[0];
      }

      if (creep.room.controller && creep.room.controller.level === 8 && terminal) {
        var nucker: StructureNuker | undefined = creep.room.find(FIND_STRUCTURES, {
          filter: i => i.structureType === "nuker"
        })[0] as any;

        if (nucker) {
          if (nucker.energy < nucker.energyCapacity && storage.store.energy > 100000) {
            yield {
              targetSource: storage.id,
              targetDestination: nucker.id,
              jobResource: "energy",
              jobNeededAmount: nucker.energyCapacity - nucker.energy,
              jobTag: "refill-e-nuker-" + nucker.id
            };
          }
          const availableGhodium = terminal.store[RESOURCE_GHODIUM] || 0;
          if (nucker.ghodium < nucker.ghodiumCapacity && availableGhodium > 0) {
            yield {
              targetSource: terminal.id,
              targetDestination: nucker.id,
              jobResource: RESOURCE_GHODIUM,
              jobNeededAmount: nucker.ghodiumCapacity - nucker.ghodium,
              jobTag: "refill-g-nuker-" + nucker.id
            };
          }
        }
      }

      var labThatNeedsRefills = labs.filter(i => {
        if (!i.memory.needsResource) {
          return;
        }
        const availableResource = (terminal && terminal.store[i.memory.needsResource]) || 0;
        return (
          i.memory.state === "waiting-for-resource" &&
          availableResource > 0 &&
          i.memory.needsAmount > i.obj.mineralAmount
        );
      })[0];

      if (labThatNeedsRefills && terminal) {
        const lab = labThatNeedsRefills;
        yield {
          targetSource: terminal.id,
          targetDestination: lab.obj.id,
          jobResource: lab.memory.needsResource,
          jobNeededAmount: lab.memory.needsAmount - lab.obj.mineralAmount,
          jobTag: "refill-lab-" + lab.obj.id
        };
      }

      if (labThatNeedsEmptying && terminal) {
        const lab = labThatNeedsEmptying;
        yield {
          targetSource: lab.obj.id,
          targetDestination: terminal.id,
          jobResource: lab.obj.mineralType as ResourceConstant,
          jobNeededAmount: lab.obj.mineralAmount,
          jobTag: "empty-lab-" + lab.obj.id
        };
      }
    }

    const emptyTowers: StructureTower[] = creep.room.find(FIND_MY_STRUCTURES, {
      filter: i => i.structureType === "tower" && i.energy <= 100
    }) as any;

    if (storage && emptyTowers.length) {
      const tower = emptyTowers[0];
      if (storage) {
        yield {
          jobNeededAmount: tower.energyCapacity - tower.energy,
          jobResource: "energy",
          jobTag: "refill-tower-" + tower.id,
          targetSource: storage.id,
          targetDestination: tower.id
        };
      }
    }

    const nonEmptyContainers: StructureContainer[] = creep.room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "container" && _.sum(i.store) > 500
    }) as StructureContainer[];

    for (var nonEmptyContainersIndex in nonEmptyContainers) {
      const nonEmptyContainer = nonEmptyContainers[nonEmptyContainersIndex];
      const resourceType = findNonEmptyResourceInStore(nonEmptyContainer.store) as ResourceConstant;
      const job = this.createRetrievalJob({
        amount: nonEmptyContainer.store[resourceType] as any,
        creep: creep,
        resource: resourceType,
        sourceId: nonEmptyContainer.id,
        tag: "empty-container"
      });
    }
  }

  setJob(creep: Creep, { assumeEmpty }: { assumeEmpty?: boolean } = { assumeEmpty: false }) {
    const memory: ITruckMemory = creep.memory as any;

    if (!memory.idle && memory.jobTag && memory.lastJobRefreshTime && memory.lastJobRefreshTime + 100 > Game.time) {
      // don't do anything if we already have a job or if we are not stuck
      return;
    } else {
      memory.lastJobRefreshTime = Game.time;
    }

    var jobIterator = this.getJobs(creep);
    const otherTrucksJobs = creep.room
      .find(FIND_MY_CREEPS, { filter: c => c.memory.role === "truck" && c.name !== creep.name })
      .map(i => i.memory as ITruckMemory)
      .map(i => i.jobTag);

    // find a job that is not assigned to another truck
    var result = jobIterator.next();
    let job: IJob | null = null;
    while (result.value) {
      if (otherTrucksJobs.indexOf(result.value.jobTag) >= 0) {
        result = jobIterator.next();
      } else {
        job = result.value;
        break;
      }
    }

    const totalCargoContent = _.sum(creep.carry);
    const carrying = Object.keys(creep.carry).find(i => (creep.carry as any)[i] > 0) as ResourceConstant | undefined;
    const storage = creep.room.storage;

    if (!assumeEmpty && storage && totalCargoContent > 0 && job && carrying) {
      // if we carry something, deposit it before starting a new job.
      job = {
        jobNeededAmount: creep.carry[memory.jobResource] as any,
        jobResource: carrying,
        targetDestination: storage.id,
        targetSource: undefined,
        jobTag: "empty-truck-" + creep.id
      };
    }

    if (job) {
      creep.say(job.jobTag);
      memory.targetSource = job.targetSource;
      memory.targetDestination = job.targetDestination;
      memory.jobResource = job.jobResource;
      memory.jobNeededAmount = Math.min(job.jobNeededAmount, creep.carryCapacity);
      memory.isDepositing = !job.targetSource;
      memory.idle = false;
      memory.jobTag = job.jobTag;
      memory.lastJobRefreshTime = Game.time;
    } else {
      memory.idle = true;
    }
  }

  getLabs(room: Room) {
    var groups = room.memory.labGroups || [];
    return _.flatten(groups.map(i => [i.labResult, i.labSource1, i.labSource2]));
  }
}

profiler.registerClass(RoleTruck, "RoleTruck");
export const roleTruck = new RoleTruck();
