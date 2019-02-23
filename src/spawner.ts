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
    if (Game.time % 5 > 0) {
      return;
    }

    for (const spawnName in Game.spawns) {
      this.handleSingleSpawn(Game.spawns[spawnName]);
    }
  }

  getBodyPartCombinationFromTemplate(parts: BodyPartConstant[], maxEnergy: number, sortOrder?: BodyPartConstant[]) {
    const current: BodyPartConstant[] = [];
    let cost = 0;

    cost = _.sum(current.map(i => costs[i]));
    let counter = 0;
    while (cost <= maxEnergy && current.length <= 50) {
      current.push(parts[counter % parts.length]);
      counter++;
      cost = _.sum(current.map(i => costs[i]));
    }
    current.pop();

    if (current.length < parts.length) {
      // We want at least one repetition
      return null;
    } else {
      const sorted = sortOrder ? _.sortBy(current, bodyPart => sortOrder.indexOf(bodyPart)) : current;
      return sorted;
    }
  }

  getRoleSlug(role: string, subRole: string | undefined) {
    return [role, subRole].filter(i => i).join("-");
  }

  handleSingleSpawn(spawn: StructureSpawn) {
    let requirements = getSpawnerRequirements(spawn);

    requirements = requirements.filter(i => !i.onlyRoom || i.onlyRoom === spawn.room.name);

    const allCreeps = _.values(Game.creeps) as Creep[];
    const creepsInThisRoom = allCreeps.filter(i => i.memory.homeRoom === spawn.room.name);

    const counts = _.countBy(creepsInThisRoom, i => this.getRoleSlug(i.memory.role, i.memory.subRole));
    const totalPercentage = _.sum(requirements.map(i => i.percentage));
    const debugMode = false;

    const roleInfos = requirements.map(role => {
      const roleSlug = this.getRoleSlug(role.role, role.subRole);
      const currentCount = counts[roleSlug] || 0;
      const currentPercentage = creepsInThisRoom.length > 0 ? currentCount / creepsInThisRoom.length : 0;
      const desiredPercentage = role.percentage / totalPercentage;
      if (debugMode) {
        console.log(
          `${this.getRoleSlug(role.role, role.subRole)}(${currentCount}): has ${(currentPercentage * 100).toFixed(
            2
          )}% needs ${(desiredPercentage * 100).toFixed(2)}%`
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
        "Role needed to be created: " +
          (roleNeededToBeCreated
            ? roleNeededToBeCreated.requirement.role + "-" + roleNeededToBeCreated.requirement.subRole
            : "N/A")
      );
      console.log(
        "Role that can be needed  : " +
          (roleThatCanBeCreated
            ? roleThatCanBeCreated.requirement.role + "-" + roleThatCanBeCreated.requirement.subRole
            : "N/A")
      );
    }

    if (roleNeededToBeCreated) {
      this.spawnRole(spawn, roleNeededToBeCreated.requirement, debugMode);
    } else if (roleThatCanBeCreated) {
      this.spawnRole(spawn, roleThatCanBeCreated.requirement, debugMode);
    }
  }

  private spawnRole(spawn: StructureSpawn, role: RoleRequirement, debug: boolean = false) {
    let creepsCounter = Object.keys(Game.creeps).length + 1;

    while (Game.creeps[role.role + (creepsCounter + 1)]) {
      creepsCounter++;
    }
    const creepName = role.role + (creepsCounter + 1);

    // const maxEnergyPossible = spawn.room.energyCapacityAvailable;
    const maxEnergyPossible = spawn.room.energyAvailable;

    if (role.minEnergy && maxEnergyPossible < role.minEnergy) {
      console.log("Not enough energy to create the body. Required=", role.minEnergy);
    }

    if (debug) {
      console.log("Max energy possible : ", maxEnergyPossible);
    }

    let body: BodyPartConstant[] | null;
    if (role.exactBody) {
      body = role.exactBody;
      if (debug) {
        console.log("Spawning exact body : ", role.exactBody);
      }
    } else if (role.bodyTemplate) {
      if (debug) {
        console.log("Spawning body template : ", role.bodyTemplate);
      }
      const maxEnergy = role.capMaxEnergy || 1000000;
      body = this.getBodyPartCombinationFromTemplate(
        role.bodyTemplate,
        Math.min(maxEnergyPossible, maxEnergy),
        role.sortBody
      );
      if (debug) {
        console.log("-- Result : ", body);
      }
    } else {
      return;
    }

    if (!body) {
      console.log("Not enough energy to create the body");
      return;
    }

    // console.log("Abount to spawn : ", JSON.stringify(role));
    const result = spawn.spawnCreep(body, creepName, {
      memory: {
        ...role.additionalMemory,
        homeRoom: spawn.room.name,
        role: role.role,
        subRole: role.subRole,
        lastPos: { x: spawn.pos.x, y: spawn.pos.y },
        noMovementTicksCount: 0
      } as CreepMemory
    });

    if (debug) {
      console.log("Spawning result ", result);
    }
  }
}

export const spawner = new Spawner();
