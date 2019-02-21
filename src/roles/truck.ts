import { sourceManager } from "../utils/source-manager";
import { roleHarvester } from "./harvester";

interface ITruckMemory extends CreepMemory {
  targetSource?: string;
  targetDestination?: string;
  jobResource: ResourceConstant;
  jobNeededAmount: number;
  isDepositing?: boolean;
  noJob: boolean;
  lastJobRefreshTime: number | undefined;
}

class RoleTruck implements IRole {
  static hasActiveTruckJobs(room: Room) {
    return;
  }

  run(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;

    if (creep.room.storage && !memory.noJob) {
      this.setJob(creep);
      let target: AnyStructure;
      if (memory.isDepositing) {
        target = Game.getObjectById(memory.targetDestination) as AnyStructure;
        creep.goTo(target);
        if (creep.transfer(target, memory.jobResource) === OK) {
          memory.isDepositing = false;

          // job is complete.
          memory.noJob = true;
          this.setJob(creep);
        }
      } else {
        target = Game.getObjectById(memory.targetSource) as AnyStructure;
        creep.goTo(target);
        if (creep.withdraw(target, memory.jobResource, memory.jobNeededAmount) === OK) {
          memory.isDepositing = true;
        }
      }
    } else {
      if (Game.time % 10 === 0) {
        // periodically check for jobs
        this.setJob(creep);
      }
      roleHarvester.run(creep);
    }
  }

  setJob(creep: Creep) {
    const memory: ITruckMemory = creep.memory as any;

    if (!memory.noJob && memory.lastJobRefreshTime && memory.lastJobRefreshTime + 100 > Game.time) {
      // don't do anything if we already have a job or if we are not stuck
      return;
    } else {
      memory.lastJobRefreshTime = Game.time;
    }

    const storage = creep.room.storage as StructureStorage;

    const totalCargoContent = _.sum(creep.carry);

    var labs = this.getLabs(creep.room).map(i => ({ memory: i, obj: Game.getObjectById(i.id) as StructureLab }));
    var assets = storage.store;
    var labsThatNeedsRefills = labs.filter(i => {
      if (!i.memory.needsResource) {
        return;
      }
      const availableResource = assets[i.memory.needsResource] || 0;
      return i.memory.state === "waiting-for-resource" && availableResource > 0;
    });

    var labsThatNeedsEmptying = labs.filter(i => i.memory.state === "needs-emptying" && i.obj.mineralAmount > 0);

    if (totalCargoContent > 0) {
      // if we carry something, deposit it before starting a new job.
      memory.targetDestination = storage.id;
      memory.jobResource = Object.keys(creep.carry).filter((i: any) => (creep.carry as any)[i] > 0)[0] as any;
      memory.jobNeededAmount = creep.carry[memory.jobResource] as any;
      memory.isDepositing = true;
    } else if (labsThatNeedsRefills.length) {
      const lab = labsThatNeedsRefills[0];
      memory.targetSource = storage.id;
      memory.targetDestination = lab.obj.id;
      memory.jobResource = lab.memory.needsResource;
      memory.jobNeededAmount = lab.memory.needsAmount;
      memory.isDepositing = false;
    } else if (labsThatNeedsEmptying) {
      const lab = labsThatNeedsEmptying[0];
      memory.targetSource = lab.obj.id;
      memory.targetDestination = storage.id;
      memory.jobResource = lab.obj.mineralType as ResourceConstant;
      memory.jobNeededAmount = lab.obj.mineralAmount;
      memory.isDepositing = false;
    } else {
      memory.noJob = true;
    }
  }

  getLabs(room: Room) {
    var groups = room.memory.labGroups || [];
    return _.flatten(groups.map(i => [i.labResult, i.labSource1, i.labSource2]));
  }
}

export const roleTruck = new RoleTruck();
