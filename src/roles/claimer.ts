interface IClaimerMemory extends CreepMemory {}

class RoleClaimer implements IRole {
  run(creep: Creep) {
    const memory: IClaimerMemory = creep.memory as any;

    const flag = Game.flags["claimer_target"];

    if (!flag) {
      return;
    }

    if (flag.room && flag.room.name == creep.room.name) {
      if (!flag.room.controller) {
        return;
      }
      if (creep.claimController(flag.room.controller) === ERR_NOT_IN_RANGE) {
        creep.goTo(flag);
      }
    } else {
      creep.goTo(flag);
    }
  }
}

export const roleClaimer = new RoleClaimer();
