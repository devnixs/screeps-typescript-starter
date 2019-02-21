export interface IPickaBooMemory extends CreepMemory {
  isAttacking: boolean;
  homeRoom: string;
  homeRoomX: number;
  homeRoomY: number;

  targetRoomName: string;
  targetRoomX: number;
  targetRoomY: number;
  targetStructureId: string;

  targetTowers: string[];
}

class RolePickaBoo implements IRole {
  run(creep: Creep) {
    var memory: IPickaBooMemory = creep.memory as any;
    if (memory.isAttacking && creep.hits <= creep.hitsMax / 2) {
      memory.isAttacking = false;
    }

    if (!memory.isAttacking && creep.hits === creep.hitsMax) {
      memory.isAttacking = true;
    }

    if (memory.isAttacking) {
      if (creep.room.name !== memory.targetRoomName) {
        creep.goTo(new RoomPosition(memory.targetRoomX, memory.targetRoomY, memory.targetRoomName));
      } else {
        const targetTowers: StructureTower[] = (memory.targetTowers || [])
          .map(i => Game.getObjectById(i))
          .filter(i => i) as any;

        const combinedEnergy = _.sum(targetTowers.map(i => i.energy));
        if (combinedEnergy > 0) {
          // Abort!
          creep.goTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom));
          return;
        } else {
          // wait for our health to deplete
        }
      }
    } else {
      if (creep.room.name !== memory.homeRoom) {
        creep.goTo(new RoomPosition(memory.homeRoomX, memory.homeRoomY, memory.homeRoom));
      } else {
        // just wait to be healed
      }
    }
  }
}

export const rolePickaBoo = new RolePickaBoo();
