import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { wantsToSell, desiredStocks, desiredEnergyInTerminal } from "../constants/misc";
import { findRestSpot } from "utils/finder";

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

    if (creep.room.storage && !memory.idle) {
      this.setJob(creep);
      let target: AnyStructure;
      if (memory.isDepositing) {
        target = Game.getObjectById(memory.targetDestination) as AnyStructure;
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);
          if (totalCargoContent === 0 || creep.transfer(target, memory.jobResource) === OK) {
            memory.isDepositing = false;

            // job is complete.
            this.restartJob(creep);
          }
        }
      } else {
        target = Game.getObjectById(memory.targetSource) as AnyStructure;
        if (!target) {
          this.restartJob(creep);
        } else {
          creep.goTo(target);

          const currentlyInStock = creep.room.storage.store[memory.jobResource] || 0;

          let withdrawResult = creep.withdraw(
            target,
            memory.jobResource,
            Math.min(memory.jobNeededAmount, currentlyInStock)
          );

          if (withdrawResult === ERR_INVALID_TARGET) {
            // maybe it's a dropped resource
            withdrawResult = creep.pickup(target as any);
          }

          if (withdrawResult === OK) {
            memory.isDepositing = true;
          } else if (creep.pos.getRangeTo(target.pos.x, target.pos.y) <= 1) {
            // if it fails but we're in range, abort the job.

            this.restartJob(creep);
          }
        }
      }
    } else {
      const checkTime = "sim" in Game.rooms ? 1 : 10;
      if (Game.time % checkTime === 0) {
        // periodically check for jobs
        this.setJob(creep);
      }

      if (memory.idle) {
        if (this.runEnergyTruck(creep) !== OK) {
          this.goToRestSpot(creep);
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

  restartJob(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;
    memory.idle = true;
    memory.jobTag = undefined;
    this.setJob(creep);
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
    const storage = creep.room.storage as StructureStorage;
    var droppedResource = creep.room.find(FIND_DROPPED_RESOURCES)[0];

    if (droppedResource) {
      return {
        targetSource: droppedResource.id,
        targetDestination: storage.id,
        jobResource: droppedResource.resourceType,
        jobNeededAmount: droppedResource.amount,
        jobTag: "dropped-resource-" + droppedResource.id
      };
    }

    var labs = this.getLabs(creep.room).map(i => ({ memory: i, obj: Game.getObjectById(i.id) as StructureLab }));
    var labThatNeedsEmptying = labs.filter(i => i.memory.state === "needs-emptying" && i.obj.mineralAmount > 0)[0];

    var assets = storage.store;
    var labThatNeedsRefills = labs.filter(i => {
      if (!i.memory.needsResource) {
        return;
      }
      const availableResource = assets[i.memory.needsResource] || 0;
      return (
        i.memory.state === "waiting-for-resource" && availableResource > 0 && i.memory.needsAmount > i.obj.mineralAmount
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

    return null;
  }

  setJob(creep: Creep) {
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

    if (storage && totalCargoContent > 0 && job && carrying && job.jobResource != carrying) {
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
      memory.targetSource = job.targetSource;
      memory.targetDestination = job.targetDestination;
      memory.jobResource = job.jobResource;
      memory.jobNeededAmount = Math.min(job.jobNeededAmount, creep.carryCapacity);
      memory.isDepositing = false;
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

export const roleTruck = new RoleTruck();
