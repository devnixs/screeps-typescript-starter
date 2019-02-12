import { getSpawnerRequirements, RoleRequirement } from "spawner-requirements";

const costs = {
  [MOVE]: 50,
  [WORK]: 100,
  [CARRY]: 50,
  [ATTACK]: 80,
  [RANGED_ATTACK]: 150,
  [HEAL]: 250,
  [TOUGH]: 10,
  [CLAIM]: 600
};

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

  getBodyPartCombinationFromTemplate(parts: BodyPartConstant[], maxEnergy: number) {
    const current: BodyPartConstant[] = [];
    let cost = 0;

    cost = _.sum(current.map(i => costs[i]));
    let counter = 0;
    while (cost <= maxEnergy) {
      current.push(parts[counter % parts.length]);
      counter++;
      cost = _.sum(current.map(i => costs[i]));
    }
    current.pop();
    return current;
  }

  handleSingleSpawn(spawn: StructureSpawn) {
    const requirements = getSpawnerRequirements(spawn);

    // const creepsInThisRoom = spawn.room.find(FIND_MY_CREEPS);

    const allCreeps = _.values(Game.creeps) as Creep[];

    const counts = _.countBy(allCreeps, i => i.memory.role);
    const totalPercentage = _.sum(requirements.map(i => i.percentage));
    const debugMode = false;

    const roleInfos = requirements.map(role => {
      const currentCount = counts[role.role] || 0;
      const currentPercentage = allCreeps.length > 0 ? currentCount / allCreeps.length : 0;
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

    const maxEnergyPossible = spawn.room.energyCapacityAvailable;

    let body: BodyPartConstant[];
    if (role.exactBody) {
      console.log("Spawning role " + role.role, " with exact body ", role.exactBody);
      body = role.exactBody;
    } else if (role.bodyTemplate) {
      console.log("Spawning role " + role.role, " with template ", role.bodyTemplate);
      console.log("Max energy possible:", maxEnergyPossible);
      body = this.getBodyPartCombinationFromTemplate(role.bodyTemplate, maxEnergyPossible);
      console.log("Generated body", body);
    } else {
      return;
    }

    spawn.spawnCreep(body, creepName, {
      memory: {
        ...role.additionalMemory,
        role: role.role
      } as any
    });
  }
}

export const spawner = new Spawner();
