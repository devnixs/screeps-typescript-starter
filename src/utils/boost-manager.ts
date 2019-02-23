import { wantedBoosts, boostResourceNeeded } from "../chemist";

export function boostCreep(creep: Creep) {
  debugger;
  if (creep.room.name !== creep.memory.homeRoom) {
    return;
  }
  const bodyPartsThatNeedBoosts = Object.keys(wantedBoosts[creep.room.name] || {});
  const nonBoostedBodyPartsThatNeedBoosts = creep.body
    .filter(i => !i.boost)
    .map(i => i.type)
    .filter(i => bodyPartsThatNeedBoosts.indexOf(i) >= 0);

  if (nonBoostedBodyPartsThatNeedBoosts.length === 0) {
    return -1;
  } else {
    const bodyPart = nonBoostedBodyPartsThatNeedBoosts[0];

    // find lab that can boost this creep.
    const labGroups = creep.room.memory.labGroups || [];

    const labs = _.flatten(labGroups.map(i => [i.labResult, i.labSource1, i.labSource2]));
    const labDoingThisBoost = labs.find(lab => lab.boostBodyType === bodyPart);
    if (labDoingThisBoost) {
      const labObject = Game.getObjectById(labDoingThisBoost.id) as StructureLab;
      if (labObject && labObject.mineralAmount >= boostResourceNeeded) {
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
