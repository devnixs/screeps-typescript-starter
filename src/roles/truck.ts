import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { wantsToSell, desiredStocks, desiredEnergyInTerminal } from "../constants/misc";
import { findRestSpot, findNonEmptyResourceInStore } from "utils/finder";
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
            this.restartJob(creep);
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
        this.goToRestSpot(creep);

        const checkTime = "sim" in Game.rooms ? 1 : 10;
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
      return sourceManager.getEnergy(creep);
    }
  }

  restartJob(creep: Creep, { forceEmptying }: { forceEmptying?: boolean } = { forceEmptying: false }) {
    const memory: ITruckMemory = creep.memory as any;
    memory.idle = true;
    memory.jobTag = undefined;
    this.setJob(creep, { assumeEmpty: !forceEmptying });
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

  getJobs(creep: Creep): IJob | null {
    const storage = creep.room.storage as StructureStorage | undefined;
    var droppedResource = creep.room.find(FIND_DROPPED_RESOURCES)[0];

    if (
      droppedResource &&
      droppedResource.amount > creep.pos.getRangeTo(droppedResource.pos.x, droppedResource.pos.y) * 20 &&
      storage
    ) {
      return {
        targetSource: droppedResource.id,
        targetDestination: storage.id,
        jobResource: droppedResource.resourceType,
        jobNeededAmount: droppedResource.amount,
        jobTag: "dropped-resource-" + droppedResource.id
      };
    }

    const filledContainer: StructureContainer | undefined = creep.room.find(FIND_STRUCTURES, {
      filter: i => i.structureType === "container" && _.sum(i.store) >= i.storeCapacity / 2
    })[0] as StructureContainer;

    if (filledContainer) {
      const resourceType = findNonEmptyResourceInStore(filledContainer.store) as ResourceConstant;
      if (storage) {
        return {
          jobNeededAmount: filledContainer.store[resourceType] as any,
          jobResource: resourceType,
          jobTag: "empty-container-" + filledContainer.id,
          targetSource: filledContainer.id,
          targetDestination: storage.id
        };
      } else if (resourceType === "energy") {
        const structureThatNeedsEnergy = sourceManager.getStructureThatNeedsEnergy(creep) as StructureExtension;
        if (resourceType && structureThatNeedsEnergy) {
          return {
            jobNeededAmount: Math.min(
              filledContainer.store.energy,
              structureThatNeedsEnergy.energyCapacity - structureThatNeedsEnergy.energy
            ) as any,
            jobResource: resourceType,
            jobTag: "empty-container-" + filledContainer.id,
            targetSource: filledContainer.id,
            targetDestination: structureThatNeedsEnergy.id
          };
        }
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
      var assets = storage.store;
      var labThatNeedsRefills = labs.filter(i => {
        if (!i.memory.needsResource) {
          return;
        }
        const availableResource = assets[i.memory.needsResource] || 0;
        return (
          i.memory.state === "waiting-for-resource" &&
          availableResource > 0 &&
          i.memory.needsAmount > i.obj.mineralAmount
        );
      })[0];

      if (labThatNeedsRefills) {
        const lab = labThatNeedsRefills;
        return {
          targetSource: storage.id,
          targetDestination: lab.obj.id,
          jobResource: lab.memory.needsResource,
          jobNeededAmount: lab.memory.needsAmount - lab.obj.mineralAmount,
          jobTag: "refill-lab-" + lab.obj.id
        };
      }

      if (labThatNeedsEmptying) {
        const lab = labThatNeedsEmptying;
        return {
          targetSource: lab.obj.id,
          targetDestination: storage.id,
          jobResource: lab.obj.mineralType as ResourceConstant,
          jobNeededAmount: lab.obj.mineralAmount,
          jobTag: "empty-lab-" + lab.obj.id
        };
      }

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
        return {
          targetSource: storage.id,
          targetDestination: terminal.id,
          jobResource: "energy",
          jobNeededAmount: desiredEnergyInTerminal - terminal.store.energy,
          jobTag: "refill-terminal-energy"
        };
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

      if (terminalOversupply && terminal) {
        const needsAmount =
          this.getResource(wantsToKeepForThisRoom, terminalOversupply) -
          this.getResource(storage.store, terminalOversupply);

        const terminalHasAmount = this.getResource(terminal.store, terminalOversupply);

        const overSupply = Math.min(needsAmount, terminalHasAmount);

        return {
          targetSource: terminal.id,
          targetDestination: storage.id,
          jobResource: terminalOversupply as ResourceConstant,
          jobNeededAmount: overSupply,
          jobTag: "empty-terminal-" + terminalOversupply
        };
      }

      if (terminalUndersupply && terminal) {
        const underSupply =
          this.getResource(storage.store, terminalUndersupply) -
          this.getResource(wantsToKeepForThisRoom, terminalUndersupply);

        return {
          targetSource: storage.id,
          targetDestination: terminal.id,
          jobResource: terminalUndersupply as ResourceConstant,
          jobNeededAmount: underSupply,
          jobTag: "refill-terminal-" + terminalOversupply
        };
      }

      var linkThatNeedsEmptying =
        creep.room.memory.links && creep.room.memory.links.find(i => i.state == "needs-emptying");

      var linkThatNeedsRefill =
        creep.room.memory.links &&
        creep.room.memory.links.find(i => i.state == "needs-refill" && i.type === "input-output");

      if (linkThatNeedsEmptying && linkThatNeedsEmptying.needsAmount !== undefined) {
        const overSupply = linkThatNeedsEmptying.needsAmount;
        return {
          targetSource: linkThatNeedsEmptying.id,
          targetDestination: storage.id,
          jobResource: "energy",
          jobNeededAmount: Math.min(overSupply, creep.carryCapacity),
          jobTag: "empty-link-" + linkThatNeedsEmptying.id
        };
      }

      if (linkThatNeedsRefill && linkThatNeedsRefill.needsAmount !== undefined) {
        const overSupply = linkThatNeedsRefill.needsAmount;
        return {
          targetSource: storage.id,
          targetDestination: linkThatNeedsRefill.id,
          jobResource: "energy",
          jobNeededAmount: overSupply,
          jobTag: "refill-link-" + linkThatNeedsRefill.id
        };
      }

      if (creep.room.controller && creep.room.controller.level === 8) {
        var nucker: StructureNuker | undefined = creep.room.find(FIND_STRUCTURES, {
          filter: i => i.structureType === "nuker"
        })[0] as any;
        if (nucker) {
          if (nucker.energy < nucker.energyCapacity && storage.store.energy > 100000) {
            return {
              targetSource: storage.id,
              targetDestination: nucker.id,
              jobResource: "energy",
              jobNeededAmount: nucker.energyCapacity - nucker.energy,
              jobTag: "refill-e-nuker-" + nucker.id
            };
          }
          const availableGhodium = storage.store[RESOURCE_GHODIUM] || 0;
          if (nucker.ghodium < nucker.ghodiumCapacity && availableGhodium > 0) {
            return {
              targetSource: storage.id,
              targetDestination: nucker.id,
              jobResource: RESOURCE_GHODIUM,
              jobNeededAmount: nucker.ghodiumCapacity - nucker.ghodium,
              jobTag: "refill-g-nuker-" + nucker.id
            };
          }
        }
      }
    }

    return null;
  }

  setJob(creep: Creep, { assumeEmpty }: { assumeEmpty?: boolean } = { assumeEmpty: false }) {
    const memory: ITruckMemory = creep.memory as any;

    if (!memory.idle && memory.lastJobRefreshTime && memory.lastJobRefreshTime + 100 > Game.time) {
      // don't do anything if we already have a job or if we are not stuck
      return;
    } else {
      memory.lastJobRefreshTime = Game.time;
    }

    let job = this.getJobs(creep);

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
