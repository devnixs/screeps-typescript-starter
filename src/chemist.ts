import { REAGENTS, RESOURCE_IMPORTANCE, boostResources } from "constants/resources";
import { minMax } from "./utils/misc-utils";
import { desiredStocks, boostsLimitations } from "constants/misc";
import { profiler } from "./utils/profiler";

export const wantedBoosts: { [roomName: string]: { [body: string]: ResourceConstant[] } } = {
  E27N47: {
    [HEAL]: [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, RESOURCE_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_GHODIUM_OXIDE]
  },
  E19N37: {
    [HEAL]: [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE],
    [MOVE]: ["XZHO2", RESOURCE_ZYNTHIUM_ALKALIDE, "ZO"],
    [WORK]: ["XZH2O", "ZH2O", "ZH"]
  },
  E22N36: {
    [HEAL]: [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE],
    [MOVE]: ["XZHO2", RESOURCE_ZYNTHIUM_ALKALIDE, "ZO"],
    [WORK]: ["XZH2O", "ZH2O", "ZH"]
  },
  E22N35: {
    [HEAL]: [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_CATALYZED_GHODIUM_ALKALIDE],
    [MOVE]: ["XZHO2", RESOURCE_ZYNTHIUM_ALKALIDE, "ZO"],
    [WORK]: ["XZH2O", "ZH2O", "ZH"]
  },
  sim: {
    [HEAL]: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_LEMERGIUM_ALKALIDE],
    [TOUGH]: [RESOURCE_GHODIUM_OXIDE],
    [MOVE]: [RESOURCE_ZYNTHIUM_ALKALIDE]
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
  assets: { [key: string]: number } = {};
  assetsWithAllLabs: { [key: string]: number } = {};
  constructor(private room: Room) {}

  initializeAssets() {
    this.assets = this.getAssets();
    this.assetsWithAllLabs = this.getAssetsWithAllLabs();
  }

  static settings = {
    minBatchSize: 400, // anything less than this wastes time
    maxBatchSize: 1000,
    sleepTime: 100 // sleep for this many ticks once you can't make anything
  };

  static runForAllRooms() {
    var rooms = _.values(Game.rooms) as Room[];
    for (let i in rooms) {
      const room = rooms[i];
      if (room.controller && room.controller.my) {
        // if all labs are on cooldown, skip room
        const chemist = new Chemist(room);
        chemist.run();
      }
    }
  }

  run() {
    const checkTime = "sim" in Game.rooms ? 1 : 10;
    if (Game.time % checkTime === 0) {
      this.setupLabGroups();
    }

    if (Game.time % 20 === 0) {
      this.checkBoostMode();
    }

    if (this.isBoostMode()) {
      // boost mode
      if (Game.time % 10 === 0) {
        this.initializeAssets();
        this.assignBoosts();
      }
      this.runAllBoostLabs();
    } else {
      // chemistry mode
      if (Game.time % 5 === 0) {
        this.initializeAssets();
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
      const maxBoostedBodyParts = labMemory.boostBodyType && boostsLimitations[labMemory.boostBodyType];
      const adjascentCreepsWithRightBody = adjascentCreeps.find(i => {
        if (!i.memory.boostable) {
          return false;
        }
        const hasBodyThatCanReceiveBoost = !!i.body.find(
          bodyPart => bodyPart.type === labMemory.boostBodyType && !bodyPart.boost
        );
        const boostedBodyParts = i.body.filter(bodyPart => bodyPart.type === labMemory.boostBodyType && bodyPart.boost)
          .length;
        return (
          hasBodyThatCanReceiveBoost && (maxBoostedBodyParts === undefined || boostedBodyParts < maxBoostedBodyParts)
        );
      });
      if (adjascentCreepsWithRightBody) {
        if (maxBoostedBodyParts) {
          const boostedBodyParts = adjascentCreepsWithRightBody.body.filter(
            bodyPart => bodyPart.type === labMemory.boostBodyType && bodyPart.boost
          ).length;
          lab.boostCreep(adjascentCreepsWithRightBody, maxBoostedBodyParts - boostedBodyParts);
        } else {
          lab.boostCreep(adjascentCreepsWithRightBody);
        }
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
          const resource = resources.filter(i => this.assetsWithAllLabs[i] > boostResourceNeeded * 30)[0];
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
          lab.needsAmount = boostResourceNeeded * 60;
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
    const labsInRoom = this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === "lab"
    }) as StructureLab[];
    if (this.labs.length === labsInRoom.length) {
      // no need to do anything
      return;
    }

    this.room.memory.labGroups = [];
    var labs = this.room.find(FIND_MY_STRUCTURES, {
      filter: structure => structure.structureType === "lab"
    }) as StructureLab[];

    // TODO: Create packs of groups

    console.log("Setting up lab groups");
    this.setupLabGroup(labs);
  }

  setupLabGroup(labs: StructureLab[]) {
    // find the 2 labs that are in range of most other labs
    const orderedLabs = _.sortBy(
      labs,
      l => -1 * l.pos.findInRange(FIND_MY_STRUCTURES, 2, { filter: j => j.structureType === "lab" }).length
    );
    if (orderedLabs.length >= 3) {
      const results = orderedLabs
        .filter((l, index) => index >= 2)
        .map(l => ({
          id: l.id,
          state: "idle" as LabState,
          canRun: true,
          needsAmount: 0,
          needsResource: "energy" as ResourceConstant
        }));

      this.room.memory.labGroups.push({
        currentState: "idle",
        currentTarget: undefined,
        lastActivity: Game.time,
        remainingAmountToProduce: 0,
        labResults: results,
        labSource1: {
          id: orderedLabs[0].id,
          state: "idle",
          canRun: true,
          needsAmount: 0,
          needsResource: "energy"
        },
        labSource2: {
          id: orderedLabs[1].id,
          state: "idle",
          canRun: true,
          needsAmount: 0,
          needsResource: "energy"
        }
      });
    }
  }

  runLabs() {
    var activeGroups = this.labGroups.filter(i => i.currentState === "running");

    for (let grpId in activeGroups) {
      const group = activeGroups[grpId];

      const resultLabs = group.labResults.map(l => Game.getObjectById(l.id) as StructureLab);
      const source1 = Game.getObjectById(group.labSource1.id) as StructureLab;
      const source2 = Game.getObjectById(group.labSource2.id) as StructureLab;

      if (resultLabs.find(i => i.cooldown > 0) || source1.cooldown || source2.cooldown) {
        // lab is busy.
        // Maybe only the result lab needs to not be cooling down.
        continue;
      }

      this.assignLabGroupState(group, resultLabs, source1, source2);
      const canRun = group.labSource1.canRun && group.labSource2.canRun && !group.labResults.find(i => !i.canRun);
      let hasRun = false;
      if (canRun) {
        let result: ScreepsReturnCode = OK;
        resultLabs.forEach(r => {
          result = r.runReaction(source1, source2);
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
        });
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
    group.labResults.forEach(lab => {
      lab.state = "needs-emptying";
      lab.boostResource = undefined;
      lab.needsAmount = 0;
    });
    group.labSource1.state = "needs-emptying";
    group.labSource1.needsAmount = 0;
    group.labSource1.boostResource = undefined;
    group.labSource2.state = "needs-emptying";
    group.labSource2.needsAmount = 0;
    group.labSource2.boostResource = undefined;
  }

  checkLabs() {
    // All source labs must be defined
    this.room.memory.labGroups = this.labGroups.filter(
      i => Game.getObjectById(i.labSource1.id) && Game.getObjectById(i.labSource2.id) // && Game.getObjectById(i.labResult.id)
    );
    // All result labs must be defined
    this.room.memory.labGroups.forEach(labGroup => {
      labGroup.labResults = labGroup.labResults.filter(i => Game.getObjectById(i.id));
    });
  }

  assignLabGroupState(group: LabGroup, resultLabs: StructureLab[], source1: StructureLab, source2: StructureLab) {
    this.assignLabResultState(resultLabs, group);
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

  assignLabResultState(resultLabs: StructureLab[], group: LabGroup) {
    resultLabs.forEach((resultLab: StructureLab) => {
      const labResult = group.labResults.find(i => i.id === resultLab.id);
      if (labResult) {
        if (resultLab.mineralAmount > 300 || resultLab.mineralType !== group.currentTarget) {
          labResult.state = "needs-emptying";
        } else {
          labResult.state = "running";
        }

        labResult.canRun =
          (resultLab.mineralType === group.currentTarget || resultLab.mineralType === null) &&
          resultLab.mineralAmount < resultLab.mineralCapacity - labProduceByTick;
      }
    });
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
    group.labResults.forEach(l => (l.boostBodyType = undefined));
    group.labSource1.boostBodyType = undefined;
    group.labSource2.boostBodyType = undefined;
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
    return _.sortBy(_.flatten(this.labGroups.map(i => i.labResults.concat([i.labSource1, i.labSource2]))), i => i.id);
  }

  get runningLabGroups() {
    return this.labGroups.filter(i => i.currentState != "idle");
  }

  getAssets() {
    if (!this.room.terminal) {
      return {};
    } else {
      // resultLabs should be counted as assets
      const resultLabs = _.flatten(
        this.labGroups.map(i => i.labResults.map(l => Game.getObjectById(l.id))).filter(i => i)
      ) as StructureLab[];

      const resultLabAssets = resultLabs
        .filter(i => i.mineralAmount > 0)
        .map(i => ({ [i.mineralType as any]: i.mineralAmount }));

      const allAssets = _.merge(
        {},
        this.room.terminal.store,
        ...resultLabAssets,
        (i: any, j: any) => (i || 0) + (j || 0)
      ) as { [key: string]: number };

      return allAssets;
    }
  }

  getAssetsWithAllLabs() {
    if (!this.room.terminal) {
      return {};
    } else {
      // resultLabs should be counted as assets
      const labs = this.labs.map(i => Game.getObjectById(i.id)).filter(i => i) as StructureLab[];
      const labAssets = labs.filter(i => i.mineralAmount > 0).map(i => ({ [i.mineralType as any]: i.mineralAmount }));

      const allAssets = _.merge(
        {},
        this.room.terminal.store,
        ...labAssets,
        (i: any, j: any) => (i || 0) + (j || 0)
      ) as {
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
      .map(resource => {
        const desiredStock = this.desiredStocks(resource as any);
        const currentStock = this.getAssetStock(resource as ResourceConstant);
        return {
          resource: resource as ResourceConstant,
          desiredStock,
          currentStock,
          neededStock: desiredStock - currentStock,
          achievedPercent: desiredStock > 0 ? currentStock / desiredStock : 1
        };
      })
      .filter(i => i.currentStock < i.desiredStock && i.desiredStock > 0);

    const resourcesByImportance = _.sortBy(allNeededResources, i => i.achievedPercent);
    const reactions = resourcesByImportance.map(i => this.getReaction(i.resource, i.neededStock));
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

profiler.registerClass(Chemist, "Chemist");
