import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { wantsToSell, desiredStocks, desiredEnergyInTerminal } from "../constants/misc";
import { findRestSpot, findNonEmptyResourceInStore, findNonEmptyResourcesInStore } from "utils/finder";
import { profiler } from "../utils/profiler";

interface ITruckDestination {}

interface IJobSource {
  targetSource?: string;
  jobNeededAmount: number;
  jobTag: string | undefined;
  resource: ResourceConstant;
  emoji?: string;
}

interface IJobDestination {
  targetDestination?: string;
  jobDepositAmount: number;
  jobTag: string | undefined;
  resource: ResourceConstant;
  emoji?: string;
}

interface ITruckMemory extends CreepMemory {
  sources: IJobSource[];
  destinations: IJobDestination[];

  isDepositing?: boolean;
  idle: boolean;
  lastJobRefreshTime: number | undefined;
  isDepositingEnergy: boolean;
}

interface IJob {
  targetSource: string | undefined;
  targetDestination: string;
  jobResource: ResourceConstant;
  jobNeededAmount: number;
  isUnique?: boolean;

  jobTag: string;
  emoji?: string;
}

class RoleTruck implements IRole {
  static hasActiveTruckJobs(room: Room) {
    return;
  }

  run(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    if (!memory.sources) {
      memory.sources = [];
      memory.destinations = [];
      memory.idle = true;
      this.setJob(creep);
    }

    const totalCargoContent = _.sum(creep.carry);

    if (!memory.idle) {
      this.displayJobQueue(creep, memory);
      this.setJob(creep);
      let target: AnyStructure;
      if (memory.isDepositing) {
        const firstTarget = memory.destinations[0];
        target = firstTarget && (Game.getObjectById(firstTarget.targetDestination) as AnyStructure);
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);
          const maxDeposit = creep.carry[firstTarget.resource] || 0;

          const depositResult = creep.transfer(
            target,
            firstTarget.resource,
            Math.min(firstTarget.jobDepositAmount, maxDeposit)
          );
          if (depositResult === OK || maxDeposit === 0) {
            memory.destinations.unshift();
          }

          if (totalCargoContent === 0 || memory.destinations.length === 0) {
            memory.isDepositing = false;

            // job is complete.
            this.endJob(creep);
          } else if (depositResult === ERR_FULL) {
            this.restartJob(creep);
          }
        }
      } else {
        const sourceJob = memory.sources[0];
        target = sourceJob && (Game.getObjectById(sourceJob.targetSource) as AnyStructure);
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);

          let currentlyInStock = 100000;
          const store = (target as any).store;
          if (store) {
            currentlyInStock = store[sourceJob.resource] || 0;
          }

          // var currentlyCarrying = creep.carry[memory.jobResource] || 0;
          var needsToWithdraw = sourceJob.jobNeededAmount;
          let withdrawResult: ScreepsReturnCode = -1;
          if (needsToWithdraw <= 0) {
            withdrawResult = OK;
          }

          if (withdrawResult != OK) {
            withdrawResult = creep.withdraw(target, sourceJob.resource, Math.min(needsToWithdraw, currentlyInStock));
          }

          if (withdrawResult === ERR_INVALID_TARGET) {
            // maybe it's a dropped resource
            withdrawResult = creep.pickup(target as any);
          }

          if (withdrawResult === OK) {
            memory.sources = _.tail(memory.sources);
            memory.isDepositing = memory.sources.length === 0;
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

        const checkTime = "sim" in Game.rooms ? 1 : 2;
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

  displayJobQueue(creep: Creep, memory: ITruckMemory) {
    const text = memory.sources
      .map(i => i.emoji)
      .concat("➡️")
      .concat(memory.destinations.map(i => i.emoji))
      .join("");
    creep.say(text);
  }

  restartJob(creep: Creep, { forceEmptying }: { forceEmptying?: boolean } = { forceEmptying: false }) {
    const memory: ITruckMemory = creep.memory as any;
    memory.idle = true;
    memory.sources = [];
    if (creep.room.energyAvailable === creep.room.energyCapacityAvailable) {
      this.setJob(creep, { assumeEmpty: !forceEmptying });
    }
  }

  endJob(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    memory.isDepositing = false;
    memory.sources = [];
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
    emoji?: string;
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
        jobTag: params.tag,
        emoji: params.emoji
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
          jobTag: params.tag,
          emoji: params.emoji
        };
      }
    }
    return null;
  }

  createRefillJob(params: {
    creep: Creep;
    tag: string;
    targetId: string;
    amount: number;
    resource: ResourceConstant;
    emoji?: string;
  }) {
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
        jobTag: params.tag,
        emoji: params.emoji
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
          jobTag: params.tag,
          emoji: params.emoji
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
        sourceId: droppedResource.id,
        emoji: "💢"
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
        sourceId: filledContainer.id,
        emoji: "⭐️"
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
        sourceId: containerWithMultipleResources.id,
        emoji: "⚜️"
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
            sourceId: linkThatNeedsEmptying.id,
            emoji: "⚡️"
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
            targetId: linkThatNeedsRefill.id,
            emoji: "⚡️"
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
          isUnique: true,
          targetSource: storage.id,
          targetDestination: terminal.id,
          jobResource: "energy",
          jobNeededAmount: desiredEnergyInTerminal - terminal.store.energy,
          jobTag: "refill-terminal-energy",
          emoji: "🌕"
        };
      }

      if (
        terminal &&
        terminal.store.energy > desiredEnergyInTerminal &&
        storage &&
        _.sum(storage.store) < storage.storeCapacity - 10000
      ) {
        yield {
          isUnique: true,
          targetSource: terminal.id,
          targetDestination: storage.id,
          jobResource: "energy",
          jobNeededAmount: terminal.store.energy - desiredEnergyInTerminal,
          jobTag: "empty-terminal-energy",
          emoji: "🌑"
        };
      }

      if (terminal && storage) {
        var nonEnergyInStorage = Object.keys(storage.store).filter(i => i !== "energy")[0] as
          | ResourceConstant
          | undefined;
        if (nonEnergyInStorage) {
          yield {
            isUnique: true,
            targetSource: storage.id,
            targetDestination: terminal.id,
            jobResource: nonEnergyInStorage,
            jobNeededAmount: storage.store[nonEnergyInStorage] as any,
            jobTag: "empty-storage",
            emoji: "⬜️"
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
              isUnique: true,
              targetSource: storage.id,
              targetDestination: nucker.id,
              jobResource: "energy",
              jobNeededAmount: nucker.energyCapacity - nucker.energy,
              jobTag: "refill-e-nuker-" + nucker.id,
              emoji: "💥"
            };
          }
          const availableGhodium = terminal.store[RESOURCE_GHODIUM] || 0;
          if (nucker.ghodium < nucker.ghodiumCapacity && availableGhodium > 0) {
            yield {
              isUnique: true,
              targetSource: terminal.id,
              targetDestination: nucker.id,
              jobResource: RESOURCE_GHODIUM,
              jobNeededAmount: nucker.ghodiumCapacity - nucker.ghodium,
              jobTag: "refill-g-nuker-" + nucker.id,
              emoji: "☄️"
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
          jobTag: "refill-lab-" + lab.obj.id,
          emoji: "⚗️"
        };
      }

      if (labThatNeedsEmptying && terminal) {
        const lab = labThatNeedsEmptying;
        yield {
          targetSource: lab.obj.id,
          targetDestination: terminal.id,
          jobResource: lab.obj.mineralType as ResourceConstant,
          jobNeededAmount: lab.obj.mineralAmount,
          jobTag: "empty-lab-" + lab.obj.id,
          emoji: "💎"
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
          targetDestination: tower.id,
          emoji: "📡"
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
        tag: "empty-container",
        emoji: "🛒"
      });
    }
  }

  setJob(creep: Creep, { assumeEmpty }: { assumeEmpty?: boolean } = { assumeEmpty: false }) {
    const memory: ITruckMemory = creep.memory as any;

    if (!memory.idle && memory.lastJobRefreshTime && memory.lastJobRefreshTime + 100 > Game.time) {
      // don't do anything if we already have a job or if we are not stuck
      return;
    } else {
      memory.lastJobRefreshTime = Game.time;
    }

    var jobIterator = this.getJobs(creep);
    const otherTrucksJobs = _.flatten(
      creep.room
        .find(FIND_MY_CREEPS, { filter: c => c.memory.role === "truck" && c.name !== creep.name })
        .map(i => i.memory as ITruckMemory)
        .map(i => (i.sources ? i.sources.map(j => j.jobTag) : []))
    );

    // find a job that is not assigned to another truck
    var result = jobIterator.next();
    let firstJob: IJob | null = null;
    while (result.value) {
      if (otherTrucksJobs.indexOf(result.value.jobTag) >= 0) {
        result = jobIterator.next();
      } else {
        firstJob = result.value;
        break;
      }
    }

    const totalCargoContent = _.sum(creep.carry);
    const carrying = Object.keys(creep.carry).find(i => (creep.carry as any)[i] > 0) as ResourceConstant | undefined;
    const storage = creep.room.storage;

    if (!assumeEmpty && storage && totalCargoContent > 0 && firstJob && carrying) {
      // if we carry something, deposit it before starting a new job.
      firstJob = {
        jobNeededAmount: creep.carry[carrying] as any,
        jobResource: carrying,
        targetDestination: storage.id,
        targetSource: undefined,
        jobTag: "empty-truck-" + creep.id,
        emoji: "🔽"
      };
    }

    if (firstJob) {
      let currentJobCarry = Math.min(firstJob.jobNeededAmount, creep.carryCapacity);
      if (firstJob.targetSource) {
        memory.sources = [
          {
            jobNeededAmount: currentJobCarry,
            jobTag: firstJob.jobTag,
            targetSource: firstJob.targetSource,
            resource: firstJob.jobResource,
            emoji: firstJob.emoji
          }
        ];
      } else {
        memory.sources = [];
      }
      memory.destinations = [
        {
          jobDepositAmount: currentJobCarry,
          jobTag: firstJob.jobTag,
          resource: firstJob.jobResource,
          targetDestination: firstJob.targetDestination,
          emoji: firstJob.emoji
        }
      ];
      memory.isDepositing = !firstJob.targetSource;
      memory.idle = false;
      memory.lastJobRefreshTime = Game.time;

      const debugMode = firstJob.jobTag.startsWith("refill-lab") || firstJob.jobTag.startsWith("empty-lab");

      if (!firstJob.isUnique) {
        // let's see if we can find another source job on our path
        // find a job that is not assigned to another truck
        var result = jobIterator.next();
        const sourceStructure = Game.getObjectById(firstJob.targetSource) as Structure;
        const destinationStructure = Game.getObjectById(firstJob.targetDestination) as Structure;
        while (result.value && currentJobCarry < creep.carryCapacity) {
          if (debugMode) {
            console.log("Trying to add job ", result.value.jobTag, creep.name);
          }
          let canDo = otherTrucksJobs.indexOf(result.value.jobTag) === 0;
          if (debugMode) {
            console.log("Can do 1 ", canDo);
          }
          canDo = canDo && !result.value.isUnique;
          if (debugMode) {
            console.log("Can do 2 ", canDo);
          }
          canDo =
            canDo && (Game.getObjectById(result.value.targetSource) as Structure).pos.inRangeTo(sourceStructure, 4);
          if (debugMode) {
            console.log("Can do 3 ", canDo);
          }
          canDo =
            canDo &&
            (Game.getObjectById(result.value.targetDestination) as Structure).pos.inRangeTo(destinationStructure, 4);
          if (debugMode) {
            console.log("Can do 4 ", canDo);
          }

          if (canDo) {
            const jobAmount = Math.min(creep.carryCapacity - currentJobCarry, result.value.jobNeededAmount);
            currentJobCarry += jobAmount;
            if (result.value.targetSource) {
              memory.sources.push({
                jobNeededAmount: jobAmount,
                jobTag: result.value.jobTag,
                targetSource: result.value.targetSource,
                resource: result.value.jobResource,
                emoji: result.value.emoji
              });
            }
            memory.destinations.push({
              jobDepositAmount: jobAmount,
              jobTag: result.value.jobTag,
              targetDestination: result.value.targetDestination,
              resource: result.value.jobResource,
              emoji: result.value.emoji
            });
          }

          if (currentJobCarry >= creep.carryCapacity) {
            break;
          }

          result = jobIterator.next();
        }
      }
    } else {
      memory.idle = true;
    }
  }

  getLabs(room: Room) {
    var groups = room.memory.labGroups || [];
    return _.flatten(groups.map(i => i.labResults.concat([i.labSource1, i.labSource2])));
  }
}

profiler.registerClass(RoleTruck, "RoleTruck");
export const roleTruck = new RoleTruck();
