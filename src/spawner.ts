import { getSpawnerRequirements, RoleRequirement } from "spawner-requirements";
import { profiler } from "./utils/profiler";
import { getCpuAverage, isLowOnCpu } from "utils/cpu";

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

var delay = "sim" in Game.rooms ? 1 : 2;

interface BodyPartCombinationResult {
  body: BodyPartConstant[] | null;
  repeats: number;
}

class Spawner {
  run() {
    // Do the spawning logic once every 20 ticks
    if (Game.time % delay > 0) {
      return;
    }

    const idleSpawns = Object.keys(Game.spawns)
      .map(i => Game.spawns[i])
      .filter(i => !i.spawning);

    const firstSpawnForEachRoom = _.uniq(idleSpawns, i => i.room.name);

    for (const spawnIndex in firstSpawnForEachRoom) {
      this.handleSingleSpawn(firstSpawnForEachRoom[spawnIndex]);
    }
  }

  getBodyPrice(parts: BodyPartConstant[]) {
    return _.sum(parts.map(i => costs[i]));
  }

  getBodyPartCombinationFromTemplate(
    parts: BodyPartConstant[],
    prependBodyTemplate: BodyPartConstant[] | undefined,
    maxEnergy: number,
    sortOrder?: BodyPartConstant[],
    maxRepeat?: number
  ): BodyPartCombinationResult {
    const current: BodyPartConstant[] = prependBodyTemplate ? prependBodyTemplate.concat() : [];
    let cost = 0;

    cost = this.getBodyPrice(current);
    let counter = 0;
    while (cost <= maxEnergy && current.length <= 50) {
      current.push(parts[counter % parts.length]);
      counter++;
      cost = this.getBodyPrice(current);
    }
    current.pop();

    const maxLength =
      (prependBodyTemplate ? prependBodyTemplate.length : 0) + (maxRepeat ? maxRepeat * parts.length : MAX_CREEP_SIZE);

    while (current.length > maxLength) {
      //  console.log("Removing parts to fit max size", current.length, maxLength, maxRepeat);
      current.pop();
    }

    // round to integer number of templates
    while ((current.length - (prependBodyTemplate || []).length) % parts.length > 0) {
      // console.log("Removing parts to fit template", current.length, parts.length);
      current.pop();
    }
    const repeats = (current.length - (prependBodyTemplate || []).length) / parts.length;

    const minParts = parts.length + (prependBodyTemplate ? prependBodyTemplate.length : 0);
    if (current.length < minParts) {
      // We want at least one repetition
      return { body: null, repeats: 0 };
    } else {
      const sorted = sortOrder ? _.sortBy(current, bodyPart => sortOrder.indexOf(bodyPart)) : current;
      return { body: sorted, repeats: repeats };
    }
  }

  getRoleSlug(role: string, subRole: string | undefined) {
    return [role, subRole].filter(i => i).join("-");
  }

  handleSingleSpawn(spawn: StructureSpawn) {
    let requirements = getSpawnerRequirements(spawn);

    requirements = requirements.filter(i => !i.onlyRooms || i.onlyRooms.indexOf(spawn.room.name) >= 0);

    const allCreeps = _.values(Game.creeps) as Creep[];
    const creepsInThisRoom = allCreeps.filter(
      i =>
        i.memory.homeRoom === spawn.room.name &&
        (i.ticksToLive === undefined ||
          i.ticksToLive > i.body.length * 3 + (i.room.name != spawn.room.name ? 100 : i.pos.getRangeTo(spawn)))
    );

    const counts = _.countBy(creepsInThisRoom, i => this.getRoleSlug(i.memory.role, i.memory.subRole));
    const totalPercentage = _.sum(requirements.map(i => i.percentage));
    const debugMode = false;

    const roleInfos = requirements.map(role => {
      const roleSlug = this.getRoleSlug(role.role, role.subRole);
      const currentCount = counts[roleSlug] || 0;
      const currentPercentage = creepsInThisRoom.length > 0 ? currentCount / creepsInThisRoom.length : 0;
      const desiredPercentage = role.percentage / totalPercentage;
      const templateRepeats = _.sum(
        creepsInThisRoom
          .filter(i => this.getRoleSlug(i.memory.role, i.memory.subRole) === roleSlug)
          .map(i => i.memory.r)
      );
      if (debugMode) {
        console.log(
          `${this.getRoleSlug(role.role, role.subRole)}(${currentCount}): has ${(currentPercentage * 100).toFixed(
            2
          )}% needs ${(desiredPercentage * 100).toFixed(2)}%`
        );
        console.log(
          `${this.getRoleSlug(role.role, role.subRole)}: has ${templateRepeats}R max ${role.maxRepatAccrossAll}`
        );
      }
      return {
        currentPercentage,
        desiredPercentage,
        currentCount: currentCount,
        requirement: role,
        templateRepeats: templateRepeats
      };
    });

    const lowOnCpu = isLowOnCpu();

    const roleNeededToBeCreated = roleInfos.filter(
      i =>
        i.currentPercentage < i.desiredPercentage &&
        (!i.requirement.disableIfLowOnCpu || !lowOnCpu) &&
        (i.requirement.maxCount === undefined || i.currentCount < i.requirement.maxCount) &&
        (i.requirement.maxRepatAccrossAll === undefined || i.templateRepeats < i.requirement.maxRepatAccrossAll)
    )[0];

    const roleThatCanBeCreated = roleInfos.filter(
      i =>
        (!i.requirement.disableIfLowOnCpu || !lowOnCpu) &&
        (i.requirement.maxCount === undefined || i.currentCount < i.requirement.maxCount) &&
        (i.requirement.maxRepatAccrossAll === undefined || i.templateRepeats < i.requirement.maxRepatAccrossAll)
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
      this.spawnRole(
        spawn,
        roleNeededToBeCreated.requirement,
        debugMode,
        counts,
        roleNeededToBeCreated.templateRepeats
      );
    } else if (roleThatCanBeCreated) {
      this.spawnRole(spawn, roleThatCanBeCreated.requirement, debugMode, counts, roleThatCanBeCreated.templateRepeats);
    }
  }

  doesRoleExist(role: roles, existingRoles: _.Dictionary<number>) {
    return Object.keys(existingRoles).find(i => i.indexOf(role) === 0);
  }

  private spawnRole(
    spawn: StructureSpawn,
    role: RoleRequirement,
    debug: boolean = false,
    existingRoles: _.Dictionary<number>,
    existingTemplateRepeats: number
  ) {
    let creepsCounter = 1;

    const willTheSpawnRefill =
      this.doesRoleExist("harvester", existingRoles) ||
      (this.doesRoleExist("truck", existingRoles) && this.doesRoleExist("static-harvester", existingRoles));

    while (Game.creeps[role.role + (creepsCounter + 1)]) {
      creepsCounter++;
    }
    const creepName = role.role + (creepsCounter + 1);

    // we want the biggest creep possible if the spawn will refill itself
    const maxEnergyPossible = willTheSpawnRefill ? spawn.room.energyCapacityAvailable : spawn.room.energyAvailable;

    if (role.minEnergy && maxEnergyPossible < role.minEnergy) {
      console.log("Max energy possible = ", maxEnergyPossible);
      console.log("Not enough energy to create the body. Required=", role.minEnergy);
      return;
    }

    if (debug) {
      console.log("Max energy possible : ", maxEnergyPossible);
    }

    let body: BodyPartConstant[] | null;
    let repeats = 1;
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
      let maxRepeats: number | undefined = Math.min(
        role.maxRepeat || 1000,
        (role.maxRepatAccrossAll || 1000) - existingTemplateRepeats
      );
      maxRepeats = role.maxRepeat || role.maxRepatAccrossAll;
      if (role.maxRepatAccrossAll && debug) {
        console.log("Max repeats for role ", role.role, role.maxRepatAccrossAll, spawn.room.name);
        console.log("Current repeats for role ", role.role, existingTemplateRepeats, spawn.room.name);
        console.log("Available repeats ", role.role, maxRepeats, spawn.room.name);
      }

      const result = this.getBodyPartCombinationFromTemplate(
        role.bodyTemplate,
        role.bodyTemplatePrepend,
        Math.min(maxEnergyPossible, maxEnergy),
        role.sortBody,
        maxRepeats
      );

      body = result.body;
      repeats = result.repeats;
      if (role.maxRepatAccrossAll && debug) {
        console.log("Created repeats ", repeats);
      }

      if (debug) {
        console.log("-- Result : ", body);
      }
    } else {
      return;
    }

    if (!body) {
      console.log("Not enough energy to create the body", role.role, spawn.room.name);
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
        noMovementTicksCount: 0,
        r: repeats
      } as CreepMemory
    });

    if (result === OK && role.onSpawn) {
      const totalCost = _.sum(body.map(i => costs[i]));
      role.onSpawn(totalCost, body);
    }

    if (debug) {
      console.log("Spawning result ", result);
    }
  }
}

profiler.registerClass(Spawner, "Spawner");
export const spawner = new Spawner();
