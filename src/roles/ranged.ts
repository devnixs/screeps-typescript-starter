interface IRangedMemory extends CreepMemory {}

class RoleRanged implements IRole {
  run(creep: Creep) {
    var hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      if (creep.rangedAttack(hostiles[0]) == ERR_NOT_IN_RANGE) {
        creep.goTo(hostiles[0]);
      }
    } else {
      // move to flag
      var restFlag = creep.room.find(FIND_FLAGS, { filter: i => i.name === "rest" })[0];
      if (restFlag) {
        creep.goTo(restFlag);
      }
    }
  }
}

export const roleRanged = new RoleRanged();
