import { getSpawnerRequirements, RoleRequirement } from "spawner-requirements";

class Spawner {
  run() {
    // Do the spawning logic once every 20 ticks
    if (Game.time % 30 > 0) {
      return;
    }

    for (const spawnName in Game.spawns) {
      this.handleSingleSpawn(Game.spawns[spawnName]);
    }
  }

  handleSingleSpawn(spawn: StructureSpawn) {
    const requirements = getSpawnerRequirements(spawn);

    const creepsInThisRoom = spawn.room.find(FIND_MY_CREEPS);
    const counts = _.countBy(creepsInThisRoom, i => i.memory.role);
    const totalPercentage = _.sum(requirements.map(i => i.percentage));
    const debugMode = false;

    const roleInfos = requirements.map(role => {
      const currentCount = counts[role.role] || 0;
      const currentPercentage = creepsInThisRoom.length > 0 ? currentCount / creepsInThisRoom.length : 0;
      const desiredPercentage = role.percentage / totalPercentage;
      if (debugMode) {
        console.log(
          `${role.role}(${currentCount}): has ${(currentPercentage * 100).toFixed(2)}% needs ${(
            desiredPercentage * 100
          ).toFixed(2)}%`
        );
      }
      return {
        currentPercentage,
        desiredPercentage,
        currentCount: currentCount,
        requirement: role
      };
    });

    const roleNeededToBeCreated = roleInfos.filter(
      i =>
        i.currentPercentage < i.desiredPercentage &&
        (i.requirement.maxCount === undefined || i.currentCount < i.requirement.maxCount)
    )[0];

    const roleThatCanBeCreated = roleInfos.filter(
      i => i.requirement.maxCount === undefined || i.currentCount < i.requirement.maxCount
    )[0];

    if (debugMode) {
      console.log(
        "Role needed to be created: " + (roleNeededToBeCreated ? roleNeededToBeCreated.requirement.role : "N/A")
      );
      console.log(
        "Role that can be needed  : " + (roleThatCanBeCreated ? roleThatCanBeCreated.requirement.role : "N/A")
      );
    }

    if (roleNeededToBeCreated) {
      this.spawnRole(spawn, roleNeededToBeCreated.requirement);
    } else if (roleThatCanBeCreated) {
      this.spawnRole(spawn, roleThatCanBeCreated.requirement);
    }
  }

  private spawnRole(spawn: StructureSpawn, role: RoleRequirement) {
    let creepsCounter = Object.keys(Game.creeps).length + 1;

    while (Game.creeps[role.role + (creepsCounter + 1)]) {
      creepsCounter++;
    }
    const creepName = role.role + (creepsCounter + 1);

    spawn.spawnCreep(role.body, creepName, {
      memory: {
        ...role.additionalMemory,
        role: role.role
      } as any
    });
  }
}

export const spawner = new Spawner();
