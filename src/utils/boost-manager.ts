import { boostParts } from "constants/resources";

export function boostCreep(creep: Creep) {
  if (!creep.room.name) {
    return -1;
  }

  if (!creep.ticksToLive || creep.ticksToLive <= 800) {
    // let's not waste time.
    return -1;
  }

  if (!creep.memory.boostable) {
    return -1;
  }

  if (!creep.room.memory.boostMode) {
    return -1;
  }

  if (creep.room.name !== creep.memory.homeRoom) {
    return -1;
  }

  const parts = creep.room.memory.boostMode.parts;
  const minerals = creep.room.memory.boostMode.minerals as MineralNeed[];
  if (!parts && !minerals) {
    return -1;
  }

  const bodyPartsThatNeedBoosts = parts || minerals.map(i => boostParts[i.mineral]);
  const nonBoostedBodyPartsThatNeedBoosts = creep.body
    .filter(i => !i.boost)
    .map(i => i.type)
    .filter(i => bodyPartsThatNeedBoosts.indexOf(i) >= 0);

  if (nonBoostedBodyPartsThatNeedBoosts.length === 0) {
    return -1;
  } else {
    const orderedBodyParts = _.sortBy(_.uniq(nonBoostedBodyPartsThatNeedBoosts), i => i !== MOVE);

    // Boost MOVE first.
    for (let bodyPartIndex = 0; bodyPartIndex < orderedBodyParts.length; bodyPartIndex++) {
      const bodyPart = orderedBodyParts[bodyPartIndex];
      const sameOfThisType = nonBoostedBodyPartsThatNeedBoosts.filter(i => i === bodyPart);

      // find lab that can boost this creep.
      const labGroups = creep.room.memory.labGroups || [];

      const labs = _.flatten(labGroups.map(i => i.labResults.concat([i.labSource1, i.labSource2])));
      const labsDoingThisBoost = labs
        .filter(lab => lab.boostBodyType === bodyPart)
        .map(i => Game.getObjectById(i.id) as StructureLab)
        .filter(i => i.mineralAmount >= LAB_BOOST_MINERAL * sameOfThisType.length);
      const labDoingThisBoost = _.sortBy(labsDoingThisBoost, lab => lab.pos.getRangeTo(creep))[0];

      if (labDoingThisBoost) {
        const labObject = labDoingThisBoost;
        creep.goTo(labObject);
        labObject.boostCreep(creep);
        return OK;
      } else {
        continue;
      }
    }

    return -1;
  }
}
