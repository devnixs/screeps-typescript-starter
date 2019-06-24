export interface IReserverMemory extends CreepMemory {
  targetRoomName: string;
}

class RoleReserver implements IRole {
  run(creep: Creep) {
    const memory: IReserverMemory = creep.memory as any;

    if (creep.room.name !== memory.targetRoomName) {
      creep.goTo(new RoomPosition(20, 20, memory.targetRoomName));
    } else {
      var ctrl = creep.room.controller;

      if (ctrl && creep.reserveController(ctrl) === ERR_NOT_IN_RANGE) {
        creep.goTo(ctrl);
      }
    }
  }
}

export const roleReserver = new RoleReserver();
