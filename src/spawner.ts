interface RoleRequirement {
  role: roles;
  percentage: number;
  maxCount?: number;
  body: BodyPartConstant[];
}

class Spawner {
  run() {
    const roles: RoleRequirement[] = [
      {
        percentage: 10,
        role: "harvester",
        maxCount: 5,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 4,
        role: "builder",
        maxCount: 2,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 4,
        role: "upgrader",
        maxCount: 1,
        body: [MOVE, WORK, CARRY]
      },
      {
        percentage: 1,
        role: "fighter",
        maxCount: 4,
        body: [TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK]
      }
    ];

    const allCreeps = _.values(Game.creeps) as Creep[];
    const counts = _.countBy(allCreeps, i => i.memory.role);

    const firstSpawnName = Object.keys(Game.spawns)[0];
    if (!firstSpawnName) {
      console.log("No spawn found");
      return;
    }
    const firstSpawn = Game.spawns[firstSpawnName];

    const totalPercentage = _.sum(roles.map(i => i.percentage));

    const roleInfos = roles.map(role => {
      const currentPercentage = allCreeps.length > 0 ? (counts[role.role] || 0) / allCreeps.length : 0;
      const desiredPercentage = role.percentage / totalPercentage;

      return {
        currentPercentage,
        desiredPercentage,
        currentCount: counts[role.role] || 0,
        requirement: role
      };
    });

    const roleNeededToBeCreated = roleInfos.filter(i => i.currentPercentage < i.desiredPercentage)[0];
    const roleThatCanBeCreated = roleInfos.filter(
      i => i.requirement.maxCount === undefined || i.currentCount < i.requirement.maxCount
    )[0];

    if (roleNeededToBeCreated) {
      this.spawnRole(firstSpawn, roleNeededToBeCreated.requirement);
    } else if (roleThatCanBeCreated) {
      this.spawnRole(firstSpawn, roleThatCanBeCreated.requirement);
    }
  }

  private spawnRole(spawn: StructureSpawn, role: RoleRequirement) {
    let creepsCounter = Object.keys(Game.creeps).length + 1;

    while (Game.creeps[role.role + (creepsCounter + 1)]) {
      creepsCounter++;
    }
    const creepName = role.role + (creepsCounter + 1);

    spawn.spawnCreep(role.body, creepName, {
      memory: { role: role.role } as any
    });
  }
}

export const spawner = new Spawner();
