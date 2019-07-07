import { wantedBoosts, boostResourceNeeded } from "../chemist";
import { profiler } from "../utils/profiler";
import { boostsLimitations } from "../constants/misc";

export function boostCreep(creep: Creep) {
  if (!creep.room.name) {
    return -1;
  }

  if (!creep.ticksToLive || creep.ticksToLive <= 1350) {
    // let's not waste time.
    return -1;
  }

  if (!creep.memory.boostable) {
    return -1;
  }

  if (creep.room.name !== creep.memory.homeRoom) {
    return -1;
  }
  const bodyPartsThatNeedBoosts = Object.keys(wantedBoosts[creep.room.name] || {});
  const nonBoostedBodyPartsThatNeedBoosts = creep.body
    .filter((i, index) => {
      if (boostsLimitations[i.type]) {
        return index <= boostsLimitations[i.type];
      } else {
        return true;
      }
    })
    .filter(i => !i.boost)
    .map(i => i.type)
    .filter(i => bodyPartsThatNeedBoosts.indexOf(i) >= 0);

  if (nonBoostedBodyPartsThatNeedBoosts.length === 0) {
    return -1;
  } else {
    // Boost MOVE first.
    const bodyPart = _.sortBy(nonBoostedBodyPartsThatNeedBoosts, i => i !== MOVE)[0];
    const sameOfThisType = nonBoostedBodyPartsThatNeedBoosts.filter(i => i === bodyPart);

    // find lab that can boost this creep.
    const labGroups = creep.room.memory.labGroups || [];

    const labs = _.flatten(labGroups.map(i => i.labResults.concat([i.labSource1, i.labSource2])));
    const labDoingThisBoost = labs.find(lab => lab.boostBodyType === bodyPart);
    if (labDoingThisBoost) {
      const labObject = Game.getObjectById(labDoingThisBoost.id) as StructureLab;
      if (labObject && labObject.mineralAmount >= boostResourceNeeded * sameOfThisType.length) {
        creep.goTo(labObject);
        return OK;
      } else {
        return -1;
      }
    } else {
      return -1;
    }
  }
}
