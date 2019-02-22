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
  XLH2O: 0, // For repair (or build)
  LH: 0, // (+50 % build and repair)
  XUHO2: 0, // For harvest
  XKH2O: 0, // For carry
  XGH2O: 0, // For upgraders
  [RESOURCE_LEMERGIUM_OXIDE]: 1000,
  [RESOURCE_GHODIUM_OXIDE]: 1000,
  [RESOURCE_GHODIUM]: 1000,
  [RESOURCE_HYDROXIDE]: 1000,
  [RESOURCE_ZYNTHIUM_KEANITE]: 1000,
  [RESOURCE_UTRIUM_LEMERGITE]: 1000,
  [RESOURCE_LEMERGIUM_ALKALIDE]: 1000,
  [RESOURCE_GHODIUM_ALKALIDE]: 1000
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
    maxBatchSize: 400, // manager/queen carry capacity
    sleepTime: 100 // sleep for this many ticks once you can't make anything
  };

  static runForAllRooms() {
    var rooms = _.values(Game.rooms) as Room[];
    for (let i in rooms) {
      const room = rooms[i];
      const chemist = new Chemist(room);
      chemist.run();
    }
  }

  run() {
    const checkTime = "sim" in Game.rooms ? 1 : 200;
    if (Game.time % checkTime === 0) {
      this.setupLabGroups();
    }

    if (Game.time % 5 === 0) {
      this.checkLabs();
      this.assignJobs();
      this.runLabs();
    }
  }

  setupLabGroups() {
    var labs = this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === "lab"
    }) as StructureLab[];
    var labsInGroups = _.flatten(this.labGroups.map(i => [i.labResult.id, i.labSource1.id, i.labSource2.id]));
    var labsNotInAnyGroup = labs.filter(lab => labsInGroups.indexOf(lab.id) === -1);

    for (let i in labsNotInAnyGroup) {
      var labNotInAnyGroup = labsNotInAnyGroup[i];
      var neigboorLabNotInAnyGroup = labNotInAnyGroup.pos.findInRange(FIND_MY_STRUCTURES, 2, {
        filter: lab =>
          lab.structureType === "lab" && lab.id !== labNotInAnyGroup.id && labsInGroups.indexOf(lab.id) === -1
      }) as StructureLab[];

      if (neigboorLabNotInAnyGroup.length >= 2) {
        this.setupLabGroup(labNotInAnyGroup, neigboorLabNotInAnyGroup[0], neigboorLabNotInAnyGroup[1]);
        return;
      }
    }
  }

  setupLabGroup(lab1: StructureLab, lab2: StructureLab, lab3: StructureLab) {
    this.room.memory.labGroups.push({
      currentState: "idle",
      currentTarget: undefined,
      lastActivity: Game.time,
      remainingAmountToProduce: 0,
      labResult: {
        id: lab1.id,
        state: "idle",
        canRun: true,
        needsAmount: 0,
        needsResource: "energy"
      },
      labSource1: {
        id: lab2.id,
        state: "idle",
        canRun: true,
        needsAmount: 0,
        needsResource: "energy"
      },
      labSource2: {
        id: lab3.id,
        state: "idle",
        canRun: true,
        needsAmount: 0,
        needsResource: "energy"
      }
    });
  }

  runLabs() {
    var activeGroups = this.labGroups.filter(i => i.currentState === "running");

    for (let grpId in activeGroups) {
      const group = activeGroups[grpId];

      const resultLab = Game.getObjectById(group.labResult.id) as StructureLab;
      const source1 = Game.getObjectById(group.labSource1.id) as StructureLab;
      const source2 = Game.getObjectById(group.labSource2.id) as StructureLab;

      if (resultLab.cooldown || source1.cooldown || source2.cooldown) {
        // lab is busy.
        // Maybe only the result lab needs to not be cooling down.
        continue;
      }

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
    group.labSource1.state = "needs-emptying";
    group.labSource1.needsAmount = 0;
    group.labSource2.state = "needs-emptying";
    group.labSource2.needsAmount = 0;
  }

  checkLabs() {
    // All three labs must be defined
    this.room.memory.labGroups = this.labGroups.filter(
      i =>
        Game.getObjectById(i.labSource1.id) && Game.getObjectById(i.labSource2.id) && Game.getObjectById(i.labResult.id)
    );
  }

  assignLabGroupState(group: LabGroup, resultLab: StructureLab, source1: StructureLab, source2: StructureLab) {
    this.assignLabResultState(resultLab, group);
    this.assignLabSourceState(source1, group, group.labSource1);
    this.assignLabSourceState(source2, group, group.labSource2);
  }

  assignLabSourceState(source: StructureLab, group: LabGroup, memory: LabMemory) {
    if (source.mineralType && source.mineralType !== memory.needsResource) {
      memory.state = "needs-emptying";
    } else if (source.mineralAmount < memory.needsAmount) {
      memory.state = "waiting-for-resource";
    } else if (group.currentState != "idle") {
      memory.state = "running";
    } else {
      memory.state = "idle";
    }
    memory.canRun = source.mineralAmount >= labProduceByTick && source.mineralType === memory.needsResource;
  }

  assignLabResultState(resultLab: StructureLab, group: LabGroup) {
    if (resultLab.mineralAmount > 300 || resultLab.mineralType !== group.currentTarget) {
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
    console.log("Starting job : " + reaction.amount + " " + reaction.target);

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
      // resultLabs should be counted as assets
      const resultLabs = this.labGroups.map(i => Game.getObjectById(i.labResult.id)).filter(i => i) as StructureLab[];
      const resultLabAssets = resultLabs
        .filter(i => i.mineralAmount > 0)
        .map(i => ({ [i.mineralType as any]: i.mineralAmount }));

      const allAssets = _.merge(
        {},
        this.room.storage.store,
        ...resultLabAssets,
        (i: any, j: any) => (i || 0) + (j || 0)
      ) as { [key: string]: number };
      // console.log("All assets are ", JSON.stringify(allAssets));

      return allAssets;
    }
  }

  getAssetStock(res: ResourceConstant) {
    return this.assets[res] || 0;
  }

  getPossibleReactions() {
    const allNeededResources = Object.keys(wantedStockAmounts).filter(
      i => wantedStockAmounts[i] > this.getAssetStock(i as ResourceConstant)
    ) as ResourceConstant[];
    const resourcesByImportance = _.sortBy(allNeededResources, i => RESOURCE_IMPORTANCE.indexOf(i));
    const reactions = resourcesByImportance.map(i =>
      this.getReaction(i, wantedStockAmounts[i] - this.getAssetStock(i))
    );
    const possibleReactions = reactions.filter(
      i =>
        this.getAssetStock(i.source1) >= i.amount &&
        this.getAssetStock(i.source2) >= i.amount &&
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
