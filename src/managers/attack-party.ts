import { findRestSpot, findEmptySpotCloseTo } from "utils/finder";
import { Cartographer } from "utils/cartographer";
import { Traveler } from "utils/Traveler";
import { isFunction } from "util";
import { getUsername } from "utils/misc-utils";
import { IAttackerMemory } from "roles/attacker";
import { RoomAnalyzer } from "./room-analyzer";
import { ExplorationCache } from "utils/exploration-cache";
import { whitelist } from "constants/misc";

export class AttackPartyManager {
  constructor(private attackParty: AttackParty, private attack: AttackSetup) {}

  public static runForAllAttackParties() {
    AttackPartyManager.testAttackPath();

    const attack = Memory.attack;
    if (attack) {
      for (const party of attack.parties) {
        new AttackPartyManager(party, attack).run();
      }
    }
  }

  public run() {
    const creeps = this.creeps();

    // check death
    if (creeps.length === 0 && this.attackParty.status !== "forming") {
      this.attackParty.status = "dead";
      if (this.attackParty.ttl > 200) {
        this.attackParty.failed = true;
      }
    }

    const targetRoom = Game.rooms[this.attack.toRoom];
    if (targetRoom && targetRoom.controller && targetRoom.controller.safeMode) {
      this.attackParty.status = "safemode";
    }
    if (targetRoom && targetRoom.controller && !targetRoom.controller.owner) {
      this.attackParty.status = "complete";
    }

    if (this.attackParty.status === "forming") {
      this.runFormingParty();
    } else if (this.attackParty.status === "moving") {
      this.runMovingParty();
    } else if (this.attackParty.status === "regrouping") {
      this.runRegroupingParty();
    } else if (this.attackParty.status === "attacking" || this.attackParty.status === "camping") {
      this.runAttackingParty();
    }

    this.setTimeToLive();
    this.sayStatus();
  }

  private setTimeToLive() {
    if (Game.time % 10 > 0 || this.attackParty.status === "dead") {
      return;
    }

    var lowestTtl = _.min(this.creeps().map(i => i.creep.ticksToLive || 1500)) || 0;
    this.attackParty.ttl = lowestTtl;
  }

  private sayStatus() {
    const creeps = this.creeps();
    const leader = creeps[0];
    if (leader) {
      if (this.attackParty.status === "forming") {
        leader.creep.say("🙌 ");
      }
      if (this.attackParty.status === "moving") {
        leader.creep.say("👣");
      }
      if (this.attackParty.status === "regrouping") {
        leader.creep.say("👬");
      }
      if (this.attackParty.status === "camping") {
        leader.creep.say("🌋");
      }
      if (this.attackParty.status === "safemode") {
        leader.creep.say("🌌");
      }
      if (this.attackParty.status === "attacking") {
        if (this.attackParty.retreat) {
          leader.creep.say("🐔");
        } else {
          leader.creep.say("☠️");
        }
      }
      if (this.attackParty.status === "complete") {
        leader.creep.say("😎");
      }
    }
  }

  private healSelves(creeps: AttackPartyCreepLoaded[]) {
    for (const creepInfo of creeps) {
      if (creepInfo.creep.hits < creepInfo.creep.hitsMax) {
        if (creepInfo.creep.getActiveBodyparts(HEAL)) {
          creepInfo.creep.heal(creepInfo.creep);
        }
      } else {
        const otherCreepDamaged = creeps.find(
          i => i.creep.hits < i.creep.hitsMax && i.creep.pos.inRangeTo(creepInfo.creep, 3)
        );
        if (otherCreepDamaged) {
          if (creepInfo.creep.getActiveBodyparts(HEAL)) {
            creepInfo.creep.rangedHeal(otherCreepDamaged.creep);
          }
        }
      }
    }
  }

  private attackAround(creeps: AttackPartyCreepLoaded[]) {
    for (const creep of creeps) {
      const enemies = creep.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
        filter: i => whitelist.indexOf(i.owner.username) === -1
      });
      if (enemies.length && creep.creep.getActiveBodyparts(RANGED_ATTACK)) {
        creep.creep.rangedAttack(enemies[0]);
      }
    }
  }

  private runRegroupingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];

    this.healSelves(creeps);
    this.attackAround(creeps);

    var terrain = Game.map.getRoomTerrain(leader.creep.pos.roomName);

    const regroupFlag = Game.flags["regroup"];
    if (!this.attackParty.rallyPoint && regroupFlag) {
      this.attackParty.rallyPoint = {
        x: regroupFlag.pos.x,
        y: regroupFlag.pos.y,
        roomName: regroupFlag.pos.roomName
      };
    }

    if (!this.attackParty.rallyPoint) {
      let rallyPoint = findEmptySpotCloseTo(leader.creep.pos, leader.creep.room, false, pos => {
        for (const creepInfo of creeps) {
          const isSpotAvailable = terrain.get(pos.x + creepInfo.x, pos.y + creepInfo.y) !== TERRAIN_MASK_WALL;
          if (!isSpotAvailable) {
            return false;
          }
          if (pos.x < 5 || pos.x > 45 || pos.y < 5 || pos.y > 45) {
            return false;
          }
        }
        return true;
      });

      console.log("Found rally point : ", JSON.stringify(rallyPoint));

      if (!rallyPoint) {
        console.log("Could not find rally point!");
        return;
      } else {
        this.attackParty.rallyPoint = { x: rallyPoint.x, y: rallyPoint.y, roomName: leader.creep.room.name };
      }
    }

    let allCreepsAreGrouped = true;
    for (const creepInfo of creeps) {
      const targetPos = new RoomPosition(
        this.attackParty.rallyPoint.x + creepInfo.x,
        this.attackParty.rallyPoint.y + creepInfo.y,
        this.attackParty.rallyPoint.roomName
      );
      if (
        creepInfo.creep.pos.x === targetPos.x &&
        creepInfo.creep.pos.y === targetPos.y &&
        creepInfo.creep.pos.roomName === targetPos.roomName
      ) {
        creepInfo.creep.say("👍");
      } else {
        creepInfo.creep.say("🏃🏼‍");
        allCreepsAreGrouped = false;
        creepInfo.creep.goTo(targetPos);
      }
    }

    if (allCreepsAreGrouped) {
      this.attackParty.status = "attacking";
    }
  }

  private runAttackingParty() {
    const creeps = this.creeps();
    const roomVisibility = Game.rooms[this.attack.toRoom];

    if (!this.attackParty.attackPath) {
      this.findAttackPath();
      // still no targets
      if (!this.attackParty.attackPath) {
        return;
      }
    }

    const targetFlag = Game.flags.attack_target;
    if (this.attackParty.attackPath && targetFlag) {
      // recompute path now that we have vision
      this.findAttackPath();

      targetFlag.remove();
    }

    if (this.attackParty.attackPath && this.attackParty.isApproxPath && roomVisibility) {
      // recompute path now that we have vision
      this.findAttackPath();

      // since we just entered the room, let's refresh our exploration of it
      RoomAnalyzer.analyzeRoom(roomVisibility);
    }

    const healResult = this.healEachOthers(creeps);
    if (!this.attackParty.retreat && healResult === "NeedsRetreat") {
      this.attackParty.retreat = true;
      this.findRetreatPath();
    } else if (this.attackParty.retreat && healResult === "OK") {
      this.attackParty.retreat = false;
      this.findAttackPath();
    }

    if (this.attackParty.movingTarget ? Game.time % 5 === 0 : Game.time % 33 === 0) {
      // Recompute attack path, just in case.
      if (this.attackParty.retreat) {
        this.findRetreatPath();
      } else {
        this.findAttackPath();
      }
    }

    const regroupResult = this.regroupIfNecessary(creeps);

    if (regroupResult === "needs-regroup") {
      this.attackEnemiesAround(creeps);
    } else {
      this.moveAndAttack(creeps);
    }
  }

  private healEachOthers(creeps: AttackPartyCreepLoaded[]): "OK" | "NeedsRetreat" {
    const creepsAndDamage = _.sortBy(
      creeps.map(i => ({ creepInfo: i, health: i.creep.hits / i.creep.hitsMax })),
      i => i.health
    );
    // heal most damaged creep

    for (const creepInfo of creeps) {
      if (creepInfo.creep.getActiveBodyparts(HEAL)) {
        creepInfo.creep.heal(creepsAndDamage[0].creepInfo.creep);
      }
    }

    let targetHealth = 0.7;
    if (this.attackParty.retreat) {
      targetHealth = 1;
    }
    // are creeps too badly damaged?
    if (creepsAndDamage[0] && creepsAndDamage[0].health < targetHealth) {
      return "NeedsRetreat";
    } else {
      return "OK";
    }
  }

  private regroupIfNecessary(creeps: AttackPartyCreepLoaded[]): "needs-regroup" | "ok" {
    let needRegroup = false;
    const leader = creeps[0];
    for (const creepInfo of creeps) {
      const normalPositionX = leader.creep.pos.x + creepInfo.x - leader.x;
      const normalPositionY = leader.creep.pos.y + creepInfo.y - leader.y;

      if (
        creepInfo.creep.room.name === leader.creep.room.name &&
        (normalPositionX !== creepInfo.creep.pos.x || normalPositionY !== creepInfo.creep.pos.y)
      ) {
        needRegroup = true;
        creepInfo.creep.say("🦄");
        creepInfo.creep.goTo(new RoomPosition(normalPositionX, normalPositionY, creepInfo.creep.room.name));
      }
    }

    if (needRegroup) {
      return "needs-regroup";
    } else {
      return "ok";
    }
  }

  private attackObject(creeps: AttackPartyCreepLoaded[], object: Creep | AnyStructure) {
    for (const creepInfo of creeps) {
      if (creepInfo.creep.pos.isNearTo(object)) {
        if (creepInfo.creep.getActiveBodyparts(WORK)) {
          creepInfo.creep.dismantle(object as any);
        }
        if (creepInfo.creep.getActiveBodyparts(ATTACK)) {
          creepInfo.creep.attack(object as any);
        }
        creepInfo.creep.rangedMassAttack();
      } else {
        creepInfo.creep.rangedAttack(object);
      }
    }
  }

  private moveAndAttack(creeps: AttackPartyCreepLoaded[]) {
    const attackResult = this.attackEnemiesAround(creeps);
    const blockingObject = this.moveParty(creeps);
    if (blockingObject) {
      this.swapPositionsIfNecassary(creeps, blockingObject);
    }

    if (attackResult === "OK") {
      if (blockingObject) {
        this.attackObject(creeps, blockingObject);
      }
    }
  }

  private swapPositionsIfNecassary(creeps: AttackPartyCreepLoaded[], blocking: AnyStructure | Creep) {
    // we want the dismantlers to be facing the blocking object
    const inRangeCreepsNotDismantler = creeps.filter(
      i => i.creep.pos.isNearTo(blocking) && !i.creep.body.find(i => i.type === "work" || i.type === "attack")
    );
    const dismantlersNotInRange = creeps.filter(
      i => !i.creep.pos.isNearTo(blocking) && i.creep.body.find(i => i.type === "work" || i.type === "attack")
    );

    for (let i = 0; i < Math.min(inRangeCreepsNotDismantler.length, dismantlersNotInRange.length); i++) {
      const inRangeCreep = inRangeCreepsNotDismantler[i];
      const inRangeCreepIndex = this.attackParty.creeps.findIndex(i => i.name === inRangeCreep.name);
      const dismantler = dismantlersNotInRange[i];
      const dismantlerIndex = this.attackParty.creeps.findIndex(i => i.name === dismantler.name);

      // swap them
      if (inRangeCreep.creep.pos.isNearTo(dismantler.creep.pos)) {
        const direction1 = inRangeCreep.creep.pos.getDirectionTo(dismantler.creep.pos);
        inRangeCreep.creep.move(direction1);
        const direction2 = dismantler.creep.pos.getDirectionTo(inRangeCreep.creep.pos);
        dismantler.creep.move(direction2);
      } else {
        inRangeCreep.creep.goTo(dismantler.creep.pos);
        dismantler.creep.goTo(inRangeCreep.creep.pos);
      }
      console.log("Swapped:", dismantler.creep, "with", inRangeCreep.creep);
      console.log("Which is:", inRangeCreepIndex, "with", dismantlerIndex);
      var tmp = this.attackParty.creeps[inRangeCreepIndex];
      var tmpx = tmp.x;
      var tmpy = tmp.y;

      this.attackParty.creeps[inRangeCreepIndex].x = this.attackParty.creeps[dismantlerIndex].x;
      this.attackParty.creeps[inRangeCreepIndex].y = this.attackParty.creeps[dismantlerIndex].y;
      this.attackParty.creeps[dismantlerIndex].x = tmpx;
      this.attackParty.creeps[dismantlerIndex].y = tmpy;

      this.attackParty.creeps[inRangeCreepIndex] = this.attackParty.creeps[dismantlerIndex];
      this.attackParty.creeps[dismantlerIndex] = tmp;
    }
  }

  private attackEnemiesAround(creeps: AttackPartyCreepLoaded[]): "attacked" | "OK" {
    const enemyInRange = _.flatten(
      creeps.map(creepInfos =>
        creepInfos.creep.getActiveBodyparts(RANGED_ATTACK)
          ? creepInfos.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
              filter: i => whitelist.indexOf(i.owner.username) === -1
            })
          : creepInfos.creep.getActiveBodyparts(ATTACK)
          ? creepInfos.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1, {
              filter: i => whitelist.indexOf(i.owner.username) === -1
            })
          : []
      )
    );

    const creepsNotUnderRamparts = enemyInRange.filter(
      i => !i.pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "rampart")
    );
    const closest = _.sortBy(creepsNotUnderRamparts, i => _.sum(creeps.map(c => i.pos.getRangeTo(c.creep.pos))));

    if (closest.length) {
      console.log("Attack target : ", closest[0]);
      this.attackObject(creeps, closest[0]);
      return "attacked";
    } else {
      return "OK";
    }
  }

  private getTarget(room: Room): { target: RoomPosition; movingTarget: boolean } | undefined {
    let target: AnyStructure | Creep | ConstructionSite | undefined = undefined;
    if (room.controller && room.controller.owner.username !== getUsername()) {
      const structures = room.find(FIND_HOSTILE_STRUCTURES);
      target = target || structures.find(i => i.structureType === "tower");
      target = target || room.spawns[0];
      target = target || room.storage;
      target = target || room.terminal;
      target = target || structures.find(i => i.structureType === "extension");
      target = target || structures.find(i => i.structureType === "extractor");
      target = target || structures.find(i => i.structureType === "lab");
    }
    /*
    target =
      target ||
      room.find(FIND_CONSTRUCTION_SITES, {
        filter: i => whitelist.indexOf(i.owner.username) === -1 && i.structureType === "spawn"
      })[0]; */
    target = target || room.find(FIND_HOSTILE_CREEPS, { filter: i => whitelist.indexOf(i.owner.username) === -1 })[0];

    return target && { target: target.pos, movingTarget: target instanceof Creep };
  }

  private moveParty(creeps: AttackPartyCreepLoaded[]) {
    const leader = creeps[0];
    if (this.attackParty.blocker && Game.time % 15 > 0) {
      var obj = Game.getObjectById(this.attackParty.blocker) as AnyStructure | Creep;
      if (obj) {
        leader.creep.room.visual.circle(obj.pos.x, obj.pos.y, {
          radius: 0.2,
          opacity: 0.8,
          fill: "transparent",
          lineStyle: "solid",
          stroke: "red",
          strokeWidth: 0.1
        });
        return obj;
      } else {
        delete this.attackParty.blocker;
      }
    } else {
      delete this.attackParty.blocker;
    }

    const tiredCreep = creeps.find(i => i.creep.fatigue > 0);
    if (tiredCreep) {
      // creeps are tired. wait.
      return undefined;
    }

    if (this.attackParty.attackPath && "show_visuals" in Game.flags) {
      let currentPos: RoomPosition | void = creeps[0].creep.pos;
      for (let index = 0; index < this.attackParty.attackPath.length; index++) {
        const dir = this.attackParty.attackPath[index];
        currentPos = Traveler.positionAtDirection(currentPos, parseInt(dir));
        if (!currentPos) {
          break;
        }
        creeps[0].creep.room.visual.circle(currentPos.x, currentPos.y, {
          radius: 0.2,
          opacity: 0.8,
          fill: "transparent",
          lineStyle: "solid",
          stroke: "green",
          strokeWidth: 0.1
        });
      }
    }

    if (!this.attackParty.attackPath || this.attackParty.attackPath.length === 0 || !this.attackParty.currentPos) {
      return;
    }

    // consume path
    if (this.attackParty.currentPos.x !== leader.creep.pos.x || this.attackParty.currentPos.y !== leader.creep.pos.y) {
      this.attackParty.attackPath = this.attackParty.attackPath.substr(1);
      this.attackParty.currentPos = {
        x: leader.creep.pos.x,
        y: leader.creep.pos.y,
        roomName: leader.creep.pos.roomName
      };
    }

    if (!this.attackParty.attackPath || this.attackParty.attackPath.length === 0 || !this.attackParty.currentPos) {
      return;
    }

    let nextDirection = parseInt(this.attackParty.attackPath[0]);
    console.log("Moving", nextDirection, leader.creep.pos);

    const nextPositions = creeps
      .map(creepInfo => {
        return Traveler.positionAtDirection(creepInfo.creep.pos, nextDirection);
      })
      .filter(i => i)
      .map(i => i as RoomPosition);

    const obstacles = nextPositions
      .map(pos => {
        const rampart = pos
          .lookFor(LOOK_STRUCTURES)
          .find(i => i.structureType !== "road" && i.structureType !== "container");
        if (rampart && !(rampart as any).my) {
          return rampart;
        }
        const creep = pos.lookFor(LOOK_CREEPS).find(i => i.owner && i.owner.username !== getUsername());
        return creep;
      })
      .filter(i => i);

    const firstObstacle = obstacles[0];
    if (firstObstacle) {
      leader.creep.room.visual.circle(firstObstacle.pos.x, firstObstacle.pos.y, {
        radius: 0.2,
        opacity: 0.8,
        fill: "transparent",
        lineStyle: "solid",
        stroke: "red",
        strokeWidth: 0.1
      });
      this.attackParty.blocker = firstObstacle.id;

      return firstObstacle as AnyStructure | Creep;
    } else {
      delete this.attackParty.blocker;

      // make sure all creeps are not going in an exit tile wall
      for (const creepInfo of creeps) {
        const nextPos = Traveler.positionAtDirection(creepInfo.creep.pos, nextDirection);
        if (!nextPos) {
          console.log("Creep", creepInfo.creep, "cannot move into a wall. Waiting.");
          return undefined;
        }
      }

      for (const creepInfo of creeps) {
        const result = creepInfo.creep.move(nextDirection as DirectionConstant);
        if (result === OK && creepInfo === creeps[0]) {
        }
      }
      return undefined;
    }
  }

  private getAttackMatrixForRoom(creeps: AttackPartyCreepLoaded[], room: string, matrix: CostMatrix) {
    const roomVisibility = Game.rooms[room];
    const terrain = Game.map.getRoomTerrain(room);
    const showVisuals = "show_visuals" in Game.flags;
    // make sure floor is walkable at creep locations

    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        const isWall = terrain.get(i, j) === TERRAIN_MASK_WALL;
        const isSwamp = terrain.get(i, j) === TERRAIN_MASK_SWAMP;
        for (const creep of creeps) {
          const x = i - creep.x;
          const y = j - creep.y;
          if (x < 0 || x > 49 || y < 0 || y > 49) {
            continue;
          }
          if (isWall) {
            if (showVisuals) {
              new RoomVisual(room).circle(x, y);
            }
            matrix.set(x, y, 0xff);
          } else if (isSwamp && matrix.get(x, y) < 0xff) {
            matrix.set(x, y, 0x05);
          }
        }
      }
    }

    if (roomVisibility && room === roomVisibility.name) {
      // add ramparts and walls are hard to walk on
      const walls = roomVisibility.find(FIND_STRUCTURES, {
        filter: i => (i.structureType === "rampart" && !i.my) || i.structureType === "constructedWall"
      }) as (StructureWall | StructureRampart)[];
      for (const wall of walls) {
        for (const creep of creeps) {
          const x = wall.pos.x - creep.x;
          const y = wall.pos.y - creep.y;
          const currentValue = matrix.get(x, y);
          if (currentValue < 0xff) {
            matrix.set(x, y, currentValue + AttackPartyManager.wallHitToCost(wall.hits));
            if (showVisuals) {
              new RoomVisual(room).circle(x, y, {
                radius: 0.2,
                opacity: 0.8,
                fill: "transparent",
                lineStyle: "solid",
                stroke: "yellow",
                strokeWidth: 0.1
              });
            }
          }
        }
      }
    }
    return matrix;
  }

  pathMatrixInTargetRoom: CostMatrix | null = null;
  private getAttackPath(from: RoomPosition, to: RoomPosition, creeps: AttackPartyCreepLoaded[]) {
    return Traveler.findTravelPath(from, to, {
      ignoreCreeps: true,
      ignoreStructures: true,
      range: 0,
      ignoreRoads: true,
      allowHostile: true,

      roomCallback: (room, matrix) => {
        if (room === this.attack.toRoom) {
          if (this.pathMatrixInTargetRoom) {
            return this.pathMatrixInTargetRoom;
          } else {
            this.pathMatrixInTargetRoom = this.getAttackMatrixForRoom(creeps, room, matrix);
            return this.pathMatrixInTargetRoom;
          }
        } else {
          return this.getAttackMatrixForRoom(creeps, room, matrix);
        }
      }
    });
  }

  private findAttackPath() {
    const roomVisibility = Game.rooms[this.attack.toRoom];

    const isInTargetRoom = this.creeps()[0].creep.pos.roomName === this.attack.toRoom;

    let target: RoomPosition | undefined;
    let movingTarget = false;
    if (roomVisibility) {
      const targetInfos = this.getTarget(roomVisibility);
      const isEnemyRoom = roomVisibility.controller && roomVisibility.controller.owner.username !== getUsername();

      const flag = Game.flags.attack;
      if (!targetInfos && !isInTargetRoom && flag) {
        target = flag.pos;
      } else if (!targetInfos) {
        if (isEnemyRoom) {
          console.log("Cannot find target in room ", roomVisibility.name);
        }
        // no more target in this room.
        if (Game.time % 10 === 0 && isEnemyRoom) {
          // we don't want this to happen in the firt shot. I noticed a time where it was triggered but it shouldn't have
          this.attackParty.status = "camping";
        }
        return;
      } else {
        target = targetInfos.target;
        movingTarget = targetInfos.movingTarget;
      }
    } else {
      let targetLocation: SimplePos;
      const roomInformations = ExplorationCache.getExploration(this.attack.toRoom);
      targetLocation =
        roomInformations && roomInformations.es && roomInformations.es.length
          ? roomInformations.es[0]
          : { x: 25, y: 25 };
      target = new RoomPosition(targetLocation.x, targetLocation.y, this.attack.toRoom);
    }

    this.setPathTo(target);

    this.attackParty.movingTarget = movingTarget;
    this.attackParty.isApproxPath = roomVisibility ? false : true;
  }

  private findRetreatPath() {
    if (this.attackParty.rallyPoint) {
      this.setPathTo(
        new RoomPosition(
          this.attackParty.rallyPoint.x,
          this.attackParty.rallyPoint.y,
          this.attackParty.rallyPoint.roomName
        )
      );
    } else {
      this.setPathTo(new RoomPosition(25, 25, this.attack.fromRoom));
    }
  }

  private setPathTo(target: RoomPosition) {
    const creeps = this.creeps();
    const leader = creeps[0];
    console.log("Going to target ", target);
    var attackPath = this.getAttackPath(leader.creep.pos, target, creeps);
    console.log("Attack path is incomplete?", attackPath.incomplete);
    let pathSerialized = Traveler.serializePath(leader.creep.pos, attackPath.path);

    if (attackPath.incomplete) {
      console.log("WARNING: attack path is incomplete");
    }

    this.attackParty.attackPath = pathSerialized;
    this.attackParty.currentPos = {
      x: leader.creep.pos.x,
      y: leader.creep.pos.y,
      roomName: leader.creep.pos.roomName
    };
    this.attackParty.targetPos = { x: target.x, y: target.y, roomName: target.roomName };
  }

  public static wallHitToCost(hits: number) {
    let value = 0;
    if (hits < 1000000) {
      // 1M
      value = 10 + hits / 10000;
    } else if (hits < 10000000) {
      // 10M
      value = 110 + hits / 100000;
    } else if (hits < 20000000) {
      // 20M
      value = 220;
    } else if (hits < 30000000) {
      // 30M
      value = 230;
    } else {
      value = 249;
    }

    return value / 4;
  }

  private runMovingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];
    const otherCreeps = _.tail(creeps);

    this.healSelves(creeps);
    this.attackAround(creeps);

    const regroupFlag = Game.flags["regroup"];
    const defaultPos = new RoomPosition(25, 25, this.attack.toRoom);
    const maxDistance = creeps.length + 1;
    let leaderWait = false;

    for (const creep of creeps) {
      if (
        leader.creep.pos.getRangeTo(creep.creep.pos) > maxDistance &&
        leader.creep.pos.roomName === creep.creep.pos.roomName
      ) {
        leaderWait = true;
      }
    }

    if (!leaderWait) {
      leader.creep.goTo(regroupFlag ? regroupFlag.pos : defaultPos, { allowSK: true });
    }
    if (!this.attackParty.distance) {
      this.attackParty.distance =
        leader.creep.memory._trav && leader.creep.memory._trav.path ? leader.creep.memory._trav.path.length : 0;
    }

    for (const creep of otherCreeps) {
      creep.creep.goTo(leader.creep, { movingTarget: true });
    }

    if (regroupFlag) {
      if (leader.creep.pos.inRangeTo(regroupFlag.pos, 4)) {
        this.attackParty.status = "regrouping";
      }
    } else {
      const rightRoomIsTarget =
        Cartographer.findRelativeRoomName(leader.creep.pos.roomName, 1, 0) === this.attack.toRoom &&
        leader.creep.pos.x >= 45;
      const leftRoomIsTarget =
        Cartographer.findRelativeRoomName(leader.creep.pos.roomName, -1, 0) === this.attack.toRoom &&
        leader.creep.pos.x <= 5;
      const topRoomIsTarget =
        Cartographer.findRelativeRoomName(leader.creep.pos.roomName, 0, -1) === this.attack.toRoom &&
        leader.creep.pos.y <= 5;
      const bottomRoomIsTarget =
        Cartographer.findRelativeRoomName(leader.creep.pos.roomName, 0, 1) === this.attack.toRoom &&
        leader.creep.pos.y >= 45;

      if (rightRoomIsTarget || leftRoomIsTarget || topRoomIsTarget || bottomRoomIsTarget) {
        this.attackParty.status = "regrouping";
      }
    }
  }

  private onCreepDied() {
    if (this.attackParty.status === "moving") {
      // go back home
      this.attackParty.status = "forming";
    }
    if (this.attackParty.status === "attacking") {
      // reset computed path, since now the leader is at another position.
      this.attackParty.attackPath = undefined;
    }
  }

  private creeps(): AttackPartyCreepLoaded[] {
    let creeps: AttackPartyCreepLoaded[] = [];
    for (const creepInfo of this.attackParty.creeps) {
      const creep = Game.creeps[creepInfo.name] as Creep | undefined;
      if (!creep) {
        this.attackParty.creeps = this.attackParty.creeps.filter(i => i.name !== creepInfo.name);
        this.onCreepDied();
        continue;
      }
      creeps.push({
        ...creepInfo,
        creep: creep
      });
    }
    return creeps;
  }

  private runFormingParty() {
    let readyCount = 0;
    for (const creepInfo of this.attackParty.creeps) {
      const creep = Game.creeps[creepInfo.name] as Creep | undefined;
      if (!creep) {
        this.attackParty.creeps = this.attackParty.creeps.filter(i => i.name !== creepInfo.name);
        continue;
      }
      if ((creep.memory as IAttackerMemory).ready) {
        readyCount++;
        this.goToRest(creep);
      }
    }

    if (readyCount === this.attackParty.count) {
      this.attackParty.status = "moving";
    }
  }

  private goToRest(creep: Creep) {
    if (creep.room.name !== this.attack.fromRoom) {
      const homeSpawn = Game.rooms[creep.memory.homeRoom].spawns[0];
      creep.goTo(homeSpawn);
    } else {
      const restSpot = findRestSpot(creep);
      if (restSpot) {
        creep.goTo(restSpot, { range: 3 });
      }
    }
  }

  public static testAttackPath() {
    if (!Game.flags.start || !Game.flags.end) {
      return;
    }
    const start = Game.flags.start;
    const end = Game.flags.end;

    var party = new AttackPartyManager(null as any, { toRoom: end.pos.roomName } as any);
    const path = party.getAttackPath(start.pos, end.pos, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ] as any);
    for (const pos of path.path) {
      new RoomVisual(pos.roomName).circle(pos, {
        radius: 0.4,
        fill: "transparent",
        stroke: "blue",
        strokeWidth: 0.15,
        opacity: 1,
        lineStyle: "solid"
      });
    }
  }
}

interface AttackPartyCreepLoaded extends AttackPartyCreep {
  creep: Creep;
}

(global as any).testAttackPath = AttackPartyManager.testAttackPath;
(global as any).AttackPartyManager = AttackPartyManager;
