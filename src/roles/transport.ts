import { profiler } from "../utils/profiler";
import { desiredEnergyInTerminal } from "constants/misc";
import { findRestSpot } from "utils/finder";

export interface ITransportMemory extends CreepMemory {
  isDepositing?: boolean;
  targetRoom: string;
  targetContainer?: string;
}

class RoleTransport implements IRole {
  run(creep: Creep) {
    const memory: ITransportMemory = creep.memory as any;

    const totalCargoContent = _.sum(creep.carry);

    if (memory.isDepositing && totalCargoContent === 0) {
      creep.say("Getting Energy");
      memory.isDepositing = false;
    }

    if (!memory.isDepositing && totalCargoContent === creep.carryCapacity) {
      creep.say("Depositing Energy");
      memory.isDepositing = true;
    }

    if (!memory.isDepositing) {
      // harvest phase
      const homeRoom = Game.rooms[creep.memory.homeRoom];

      let homeStorage: StructureStorage | StructureTerminal | null = null;
      if (!homeStorage && homeRoom.terminal && homeRoom.terminal.store.energy > desiredEnergyInTerminal * 1.2) {
        homeStorage = homeRoom.terminal;
      }
      if (!homeStorage && homeRoom.storage && homeRoom.storage.store.energy > homeRoom.storage.storeCapacity * 0.05) {
        homeStorage = homeRoom.storage;
      }

      if (homeStorage) {
        if (!creep.pos.isNearTo(homeStorage)) {
          creep.goTo(homeStorage);
        } else {
          creep.withdraw(homeStorage, "energy");
        }
      } else {
        const restSpot = findRestSpot(creep, { x: 25, y: 25 });
        if (restSpot) {
          creep.goTo(restSpot, { range: 3 });
        }
      }
    } else {
      const targetRoom = Game.rooms[memory.targetRoom];
      if (targetRoom) {
        let container: StructureContainer | undefined | null = Game.getObjectById(memory.targetContainer);

        if (container && _.sum(container.store) >= container.storeCapacity) {
          delete memory.targetContainer;
          container = null;
        }

        if (!container) {
          container = targetRoom.find(FIND_STRUCTURES, {
            filter: i =>
              (i.structureType === "container" || i.structureType === "storage") && _.sum(i.store) < i.storeCapacity
          })[0] as any;
        }

        if (container) {
          memory.targetContainer = container.id;
        }

        if (container) {
          if (creep.pos.isNearTo(container)) {
            creep.transfer(container, "energy");
          } else {
            creep.goTo(container);
          }
        }
      }
    }
  }
}

profiler.registerClass(RoleTransport, "RoleTransport");
export const roleTransport = new RoleTransport();
