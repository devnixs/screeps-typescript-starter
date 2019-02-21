import { REAGENTS, RESOURCE_IMPORTANCE } from "constants/resources";
import { minMax } from "./utils/misc-utils";

export const wantedStockAmounts: { [key: string]: number } = {
  UH: 0, // (+100 % attack)
  KO: 0, // (+100 % ranged attack)
  XGHO2: 0, // For toughness
  XLHO2: 0, // For healing
  XZHO2: 0, // For speed
  XZH2O: 0, // For dismantling
  XKHO2: 0, // For ranged attackers
  XUH2O: 0, // For attacking
  G: 0, // For nukes
  XLH2O: 0, // For repair (or build)
  LH: 0, // (+50 % build and repair)
  XUHO2: 0, // For harvest
  XKH2O: 0, // For carry
  XGH2O: 0, // For upgraders
  LO: 1000
};

interface Reaction {
  target: ResourceConstant;
  source1: ResourceConstant;
  source2: ResourceConstant;
  amount: number;
}

const labProduceByTick = 5;

export class Chemist {
  assets: { [key: string]: number };
  constructor(private room: Room) {
    this.assets = this.getAssets();
  }

  static settings = {
    minBatchSize: 100, // anything less than this wastes time
    maxBatchSize: 800, // manager/queen carry capacity
    sleepTime: 100 // sleep for this many ticks once you can't make anything
  };

  run() {
    if (Game.time % 5 === 0) {
      this.checkLabs();
      this.assignJobs();
      this.runLabs();
    }
  }

  runLabs() {
    var activeGroups = this.labGroups.filter(i => i.currentState === "running");

    for (let grpId in activeGroups) {
      const group = activeGroups[grpId];

      const resultLab = Game.getObjectById(group.labResult.id) as StructureLab;
      const source1 = Game.getObjectById(group.labSource1.id) as StructureLab;
      const source2 = Game.getObjectById(group.labSource1.id) as StructureLab;

      this.assignLabGroupState(group, resultLab, source1, source2);
      const canRun = group.labSource1.canRun && group.labSource2.canRun && group.labResult.canRun;
      let hasRun = false;
      if (canRun) {
        const result = resultLab.runReaction(source1, source2);
        if (result === OK) {
          hasRun = true;
          group.lastActivity = Game.time;
          group.labSource1.needsAmount -= labProduceByTick;
          group.labSource2.needsAmount -= labProduceByTick;
          group.remainingAmountToProduce -= labProduceByTick;

          if (group.remainingAmountToProduce <= 0) {
            this.returnLabToIdleState(group);
          }
        } else {
          console.log("Cannot run lab reaction : ", result);
        }
      }

      if (!hasRun && (!group.lastActivity || Game.time > group.lastActivity + 400)) {
        // if nothing happened in a while, delete job.
        console.log("Lab job has been deleted because it has been idle for too long");
        this.returnLabToIdleState(group);
      }
    }
  }

  returnLabToIdleState(group: LabGroup) {
    group.currentState = "idle";
    group.currentTarget = undefined;
    group.remainingAmountToProduce = 0;
    group.labResult.state = "needs-emptying";
    group.labResult.needsAmount = 0;
    group.labResult.needsResource = null;
    group.labSource1.state = "needs-emptying";
    group.labSource1.needsAmount = 0;
    group.labSource1.needsResource = null;
    group.labSource2.state = "needs-emptying";
    group.labSource2.needsAmount = 0;
    group.labSource2.needsResource = null;
  }

  checkLabs() {
    // All three labs must be defined
    this.room.memory.labGroups = this.labGroups.filter(
      i =>
        Game.getObjectById(i.labSource1.id) && Game.getObjectById(i.labSource2.id) && Game.getObjectById(i.labResult.id)
    );
  }

  assignLabGroupState(group: LabGroup, resultLab: StructureLab, source1: StructureLab, source2: StructureLab) {
    this.assignLabSourceState(resultLab, group, group.labResult);
    this.assignLabSourceState(source1, group, group.labSource1);
    this.assignLabSourceState(source2, group, group.labSource2);
  }

  assignLabSourceState(source: StructureLab, group: LabGroup, memory: LabMemory) {
    if (source.mineralType !== memory.needsResource) {
      memory.state = "needs-emptying";
    } else if (source.mineralAmount < memory.needsAmount) {
      memory.state = "waiting-for-resource";
    } else if (group.currentState != "idle") {
      memory.state = "running";
    } else {
      memory.state = "idle";
    }
    memory.canRun = source.mineralAmount > labProduceByTick && source.mineralType === memory.needsResource;
  }

  assignLabResultState(resultLab: StructureLab, group: LabGroup) {
    if (resultLab.mineralAmount > resultLab.mineralCapacity / 2 || resultLab.mineralType !== group.currentTarget) {
      group.labResult.state = "needs-emptying";
    } else {
      group.labResult.state = "running";
    }

    group.labResult.canRun =
      (resultLab.mineralType === group.currentTarget || resultLab.mineralType === null) &&
      resultLab.mineralAmount < resultLab.mineralCapacity - labProduceByTick;
  }

  assignJobs() {
    var availableGroups = this.room.memory.labGroups.filter(i => i.currentState === "idle");
    var possibleReactions = this.getPossibleReactions();

    for (let grpIndex in availableGroups) {
      const group = availableGroups[grpIndex];
      const reaction = possibleReactions[grpIndex];
      if (!reaction) {
        break;
      }

      this.assignReactionToGroup(group, reaction);
    }
  }

  assignReactionToGroup(group: LabGroup, reaction: Reaction) {
    group.currentState = "running";
    group.labSource1.state = "waiting-for-resource";
    group.labSource2.state = "waiting-for-resource";
    group.labSource1.needsResource = reaction.source1;
    group.labSource2.needsResource = reaction.source2;
    group.labSource1.needsAmount = reaction.amount;
    group.labSource2.needsAmount = reaction.amount;
    group.remainingAmountToProduce = reaction.amount;
    group.currentTarget = reaction.target;
    group.lastActivity = Game.time;
  }

  get labGroups() {
    return this.room.memory.labGroups || [];
  }

  get runningLabGroups() {
    return this.labGroups.filter(i => i.currentState != "idle");
  }

  getAssets() {
    if (!this.room.storage) {
      return {};
    } else {
      return this.room.storage.store;
    }
  }

  getPossibleReactions() {
    const allNeededResources = Object.keys(wantedStockAmounts).filter(
      i => wantedStockAmounts[i] > 0
    ) as ResourceConstant[];
    const resourcesByImportance = _.sortBy(allNeededResources, i => RESOURCE_IMPORTANCE.indexOf(i));
    const reactions = resourcesByImportance.map(i => this.getReaction(i, wantedStockAmounts[i] - this.assets[i]));
    const possibleReactions = reactions.filter(
      i =>
        this.assets[i.source1] >= i.amount &&
        this.assets[i.source2] >= i.amount &&
        !this.runningLabGroups.find(l => l.currentTarget === i.target)
    );

    return possibleReactions;
  }

  getReaction(mineral: ResourceConstant, amount: number): Reaction {
    const [source1, source2] = this.getIngredients(mineral);

    return {
      source1,
      source2,
      amount: minMax(amount, Chemist.settings.minBatchSize, Chemist.settings.maxBatchSize),
      target: mineral
    };
  }

  getIngredients(mineral: ResourceConstant) {
    return REAGENTS[mineral];
  }
}
