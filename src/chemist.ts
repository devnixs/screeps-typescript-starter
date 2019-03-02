import { REAGENTS, RESOURCE_IMPORTANCE, boostResources } from "constants/resources";
import { minMax } from "./utils/misc-utils";
import { desiredStocks } from "constants/misc";
import { cpus } from "os";

export const wantedBoosts: { [roomName: string]: { [body: string]: ResourceConstant[] } } = {
  E27N47: {
    [HEAL]: [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_GHODIUM_OXIDE]
  },
  sim: {
    [HEAL]: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_GHODIUM_OXIDE]
  }
};

interface Reaction {
  target: ResourceConstant;
  source1: ResourceConstant;
  source2: ResourceConstant;
  amount: number;
}

const labProduceByTick = 5;
export const boostResourceNeeded = 30;

export class Chemist {
  assets: { [key: string]: number };
  assetsWithAllLabs: { [key: string]: number };
  constructor(private room: Room) {
    this.assets = this.getAssets();
    this.assetsWithAllLabs = this.getAssetsWithAllLabs();
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

    if (Game.time % 10 === 0) {
      this.checkBoostMode();
    }

    if (this.isBoostMode()) {
      // boost mode
      if (Game.time % 10 === 0) {
        this.assignBoosts();
      }
      this.runAllBoostLabs();
    } else {
      // chemistry mode
      if (Game.time % 5 === 0) {
        this.checkLabs();
        this.assignJobs();
        this.runLabs();
      }
    }
  }

  checkBoostMode() {
    const previousMode = this.room.memory.isBoostMode;
    const newMode = !!Object.keys(Game.flags)
      .filter(i => i.indexOf("boostmode_") === 0)
      .map(i => Game.flags[i])
      .filter(i => i && i.room && i.room.name === this.room.name)[0];

    this.room.memory.isBoostMode = newMode;

    if (previousMode && !newMode) {
      this.stopBoostMode();
    }
    if (newMode && !previousMode) {
      this.setupBoostMode();
    }
  }

  isBoostMode() {
    return !!this.room.memory.isBoostMode;
  }

  setupBoostMode() {
    console.log("Swithing to boost mode");
    this.labGroups.forEach(group => this.returnLabToIdleState(group));
    this.assignBoosts();
  }

  runAllBoostLabs() {
    const labs = this.labs;
    labs.forEach(lab => this.runSingleBoostLab(lab));
  }

  runSingleBoostLab(labMemory: LabMemory) {
    var lab = Game.getObjectById(labMemory.id) as StructureLab;

    if (lab.mineralAmount > 0 && lab.mineralType !== labMemory.boostResource) {
      labMemory.state = "needs-emptying";
    } else if (lab.mineralAmount < labMemory.needsAmount && labMemory.boostResource) {
      labMemory.state = "waiting-for-resource";
      labMemory.needsResource = labMemory.boostResource;
    } else {
      labMemory.state = "running";
    }

    if (lab.mineralAmount >= boostResourceNeeded && lab.mineralType === labMemory.boostResource) {
      const adjascentCreeps = lab.pos.findInRange(FIND_MY_CREEPS, 1);
      const adjascentCreepsWithRightBody = adjascentCreeps.find(
        i => !!i.body.find(bodyPart => bodyPart.type === labMemory.boostBodyType && !bodyPart.boost)
      );
      if (adjascentCreepsWithRightBody) {
        lab.boostCreep(adjascentCreepsWithRightBody);
      }
    }
  }

  assignBoosts() {
    debugger;
    const boostsForThisRoom = wantedBoosts[this.room.name];
    if (boostsForThisRoom) {
      const boosts = Object.keys(boostsForThisRoom)
        .map(bodyPart => {
          const resources = boostsForThisRoom[bodyPart];
          const resource = resources.filter(i => this.assetsWithAllLabs[i] > boostResourceNeeded)[0];
          return {
            bodyPart: bodyPart as BodyPartConstant,
            resource: resource
          };
        })
        .filter(i => i.resource);

      if (boosts.length === 0) {
        return;
      }

      const labs = this.labs;
      for (let labIndex in labs) {
        const lab = labs[labIndex];
        const boost = boosts[labIndex];
        if (boost) {
          lab.boostResource = boost.resource;
          lab.needsResource = boost.resource;
          lab.needsAmount = boostResourceNeeded * 10;
          lab.boostBodyType = boost.bodyPart;
        } else {
          // this lab is not useful
          lab.state = "needs-emptying";
          lab.boostResource = undefined;
          lab.needsResource = "energy";
          lab.needsAmount = 0;
          lab.boostBodyType = undefined;
        }
      }
    }
  }

  stopBoostMode() {
    console.log("Stopping to boost mode");
    // shutdown all labs groups
    this.labGroups.forEach(group => this.returnLabToIdleState(group));
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
    group.labResult.boostResource = undefined;
    group.labResult.needsAmount = 0;
    group.labSource1.state = "needs-emptying";
    group.labSource1.needsAmount = 0;
    group.labSource1.boostResource = undefined;
    group.labSource2.state = "needs-emptying";
    group.labSource2.needsAmount = 0;
    group.labSource2.boostResource = undefined;
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
    if (availableGroups.length === 0) {
      return;
    }
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

  get idleEmptyLabs() {
    return this.labs.filter(
      i =>
        i.state === "idle" ||
        (i.state === "needs-emptying" && (Game.getObjectById(i.id) as StructureLab).mineralAmount === 0)
    );
  }

  get labGroups() {
    return this.room.memory.labGroups || [];
  }

  get labs() {
    return _.sortBy(_.flatten(this.labGroups.map(i => [i.labResult, i.labSource1, i.labSource2])), i => i.id);
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

      return allAssets;
    }
  }

  getAssetsWithAllLabs() {
    if (!this.room.storage) {
      return {};
    } else {
      // resultLabs should be counted as assets
      const labs = this.labs.map(i => Game.getObjectById(i.id)).filter(i => i) as StructureLab[];
      const labAssets = labs.filter(i => i.mineralAmount > 0).map(i => ({ [i.mineralType as any]: i.mineralAmount }));

      const allAssets = _.merge({}, this.room.storage.store, ...labAssets, (i: any, j: any) => (i || 0) + (j || 0)) as {
        [key: string]: number;
      };
      // console.log("All assets are ", JSON.stringify(allAssets));

      return allAssets;
    }
  }

  getAssetStock(res: ResourceConstant) {
    return this.assets[res] || 0;
  }

  desiredStocks(resource: _ResourceConstantSansEnergy) {
    const wantedStocks = desiredStocks || {};
    return wantedStocks[resource] || 0;
  }

  getPossibleReactions() {
    const allNeededResources = Object.keys(desiredStocks)
      .filter(i => this.isCraftable(i as ResourceConstant))
      .filter(i => this.desiredStocks(i as any) > this.getAssetStock(i as ResourceConstant)) as ResourceConstant[];

    const resourcesByImportance = _.sortBy(allNeededResources, i => RESOURCE_IMPORTANCE.indexOf(i));
    const reactions = resourcesByImportance.map(i =>
      this.getReaction(i, this.desiredStocks(i as any) - this.getAssetStock(i))
    );
    const possibleReactions = reactions.filter(
      i =>
        this.getAssetStock(i.source1) >= i.amount &&
        this.getAssetStock(i.source2) >= i.amount &&
        !this.runningLabGroups.find(l => l.currentTarget === i.target)
    );

    return possibleReactions;
  }

  isCraftable(mineral: ResourceConstant) {
    return !!REAGENTS[mineral];
  }

  getReaction(mineral: ResourceConstant, amount: number): Reaction {
    const [source1, source2] = this.getIngredients(mineral);

    const availableAmount1 = this.getAssetStock(source1);
    const availableAmount2 = this.getAssetStock(source2);

    var maximumAmount = _.min([availableAmount1, availableAmount2, Chemist.settings.maxBatchSize]);

    return {
      source1,
      source2,
      amount: minMax(amount, Chemist.settings.minBatchSize, maximumAmount),
      target: mineral
    };
  }

  getIngredients(mineral: ResourceConstant) {
    return REAGENTS[mineral];
  }
}
