import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";
import { wantsToSell } from "../constants/misc";
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

  isDepositingEnergy: boolean;
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
    this.setJob(creep);
  }

  getResource(store: StoreDefinition, res: string) {
    return (store as any)[res] || 0;
  }

  getWantsToSellForThisRoom(room: string) {
    return wantsToSell[room] || {};
  }

  setJob(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;

    if (!memory.idle && memory.lastJobRefreshTime && memory.lastJobRefreshTime + 100 > Game.time) {
      // don't do anything if we already have a job or if we are not stuck
      return;
    } else {
      memory.lastJobRefreshTime = Game.time;
    }

    const storage = creep.room.storage as StructureStorage;

    const totalCargoContent = _.sum(creep.carry);

    var labs = this.getLabs(creep.room).map(i => ({ memory: i, obj: Game.getObjectById(i.id) as StructureLab }));
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

    let terminalOversupply: string | undefined;
    let terminalUndersupply: string | undefined;

    const wantsToSellForThisRoom = this.getWantsToSellForThisRoom(creep.room.name);

    const terminal = creep.room.terminal;
    if (terminal) {
      const resources = _.uniq(Object.keys(wantsToSellForThisRoom).concat(Object.keys(terminal.store)));

      terminalOversupply = resources.filter(
        i => this.getResource(wantsToSellForThisRoom, i) < this.getResource(terminal.store, i)
      )[0];
      terminalUndersupply = resources.filter(
        i =>
          this.getResource(wantsToSellForThisRoom, i) > this.getResource(terminal.store, i) &&
          this.getResource(storage.store, i) > 0
      )[0];
    }

    var droppedResource = creep.room.find(FIND_DROPPED_RESOURCES)[0];

    var labThatNeedsEmptying = labs.filter(i => i.memory.state === "needs-emptying" && i.obj.mineralAmount > 0)[0];

    var linkThatNeedsEmptying =
      creep.room.memory.links && creep.room.memory.links.find(i => i.state == "needs-emptying");

    var linkThatNeedsRefill =
      creep.room.memory.links &&
      creep.room.memory.links.find(i => i.state == "needs-refill" && i.type === "input-output");

    var jobAvailable =
      labThatNeedsEmptying ||
      labThatNeedsRefills ||
      terminalOversupply ||
      terminalUndersupply ||
      linkThatNeedsEmptying ||
      linkThatNeedsRefill;

    if (totalCargoContent > 0 && jobAvailable) {
      // if we carry something, deposit it before starting a new job.
      memory.targetDestination = storage.id;
      memory.jobResource = Object.keys(creep.carry).filter((i: any) => (creep.carry as any)[i] > 0)[0] as any;
      memory.jobNeededAmount = creep.carry[memory.jobResource] as any;
      memory.isDepositing = true;
      memory.idle = false;
    } else if (droppedResource) {
      memory.targetSource = droppedResource.id;
      memory.targetDestination = storage.id;
      memory.jobResource = droppedResource.resourceType;
      memory.jobNeededAmount = Math.min(droppedResource.amount, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (labThatNeedsRefills) {
      const lab = labThatNeedsRefills;
      memory.targetSource = storage.id;
      memory.targetDestination = lab.obj.id;
      memory.jobResource = lab.memory.needsResource;
      memory.jobNeededAmount = Math.min(lab.memory.needsAmount - lab.obj.mineralAmount, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (labThatNeedsEmptying) {
      const lab = labThatNeedsEmptying;
      memory.targetSource = lab.obj.id;
      memory.targetDestination = storage.id;
      memory.jobResource = lab.obj.mineralType as ResourceConstant;
      memory.jobNeededAmount = Math.min(lab.obj.mineralAmount, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (terminalOversupply && terminal) {
      memory.targetSource = terminal.id;
      memory.targetDestination = storage.id;
      memory.jobResource = terminalOversupply as ResourceConstant;
      const oversupply =
        this.getResource(terminal.store, terminalOversupply) -
        this.getResource(wantsToSellForThisRoom, terminalOversupply);
      memory.jobNeededAmount = Math.min(oversupply, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (terminalUndersupply && terminal) {
      memory.targetSource = storage.id;
      memory.targetDestination = terminal.id;
      memory.jobResource = terminalUndersupply as ResourceConstant;
      const underSupply =
        this.getResource(wantsToSellForThisRoom, terminalUndersupply) -
        this.getResource(terminal.store, terminalUndersupply);
      memory.jobNeededAmount = Math.min(underSupply, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (linkThatNeedsEmptying && linkThatNeedsEmptying.needsAmount !== undefined) {
      memory.targetSource = linkThatNeedsEmptying.id;
      memory.targetDestination = storage.id;
      memory.jobResource = "energy";
      const overSupply = linkThatNeedsEmptying.needsAmount;
      memory.jobNeededAmount = Math.min(overSupply, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
    } else if (linkThatNeedsRefill && linkThatNeedsRefill.needsAmount !== undefined) {
      memory.targetSource = storage.id;
      memory.targetDestination = linkThatNeedsRefill.id;
      memory.jobResource = "energy";
      const overSupply = linkThatNeedsRefill.needsAmount;
      memory.jobNeededAmount = Math.min(overSupply, creep.carryCapacity);
      memory.isDepositing = false;
      memory.idle = false;
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
