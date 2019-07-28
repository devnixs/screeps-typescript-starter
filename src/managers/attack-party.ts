import { findRestSpot, findEmptySpotCloseTo } from "utils/finder";
import { Cartographer } from "utils/cartographer";
import { Traveler } from "utils/Traveler";
import { ExplorationManager } from "./exploration";
import { isFunction } from "util";
import { getUsername } from "utils/misc-utils";
import { IAttackerMemory } from "roles/attacker";

export class AttackPartyManager {
  attack: AttackSetup;
  constructor(private attackParty: AttackParty) {
    this.attack = Memory.attack as AttackSetup;
  }

  public static runForAllAttackParties() {
    const attack = Memory.attack;
    if (attack) {
      for (const party of attack.parties) {
        new AttackPartyManager(party).run();
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

    if (this.attackParty.status === "forming") {
      this.runFormingParty();
    }
    if (this.attackParty.status === "moving") {
      this.runMovingParty();
    }
    if (this.attackParty.status === "regrouping") {
      this.runRegroupingParty();
    }
    if (this.attackParty.status === "attacking") {
      this.runAttackingParty();
    }
    if (this.attackParty.status === "retreating") {
      this.runRetreatingParty();
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
      if (this.attackParty.status === "attacking") {
        leader.creep.say("☠️");
      }
      if (this.attackParty.status === "retreating") {
        leader.creep.say("🦃");
      }
    }
  }

  private runRegroupingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];

    var terrain = Game.map.getRoomTerrain(leader.creep.pos.roomName);

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
      this.attackParty.currentPositionIndex = 0;
    }
  }

  private runAttackingParty() {
    const creeps = this.creeps();
    const roomVisibility = Game.rooms[this.attack.toRoom];

    if (!this.attackParty.attackPath) {
      this.findAttackPath();
    }

    if (this.attackParty.attackPath && this.attackParty.isApproxPath && roomVisibility) {
      // recompute path now that we have vision
      this.findAttackPath();

      // since we just entered the room, let's refresh our exploration of it
      ExplorationManager.analyzeRoom(roomVisibility);
    }

    const healResult = this.healEachOthers(creeps);
    if (healResult === "NeedsRetreat") {
      this.attackParty.status = "retreating";
      this.runRetreatingParty();
      return;
    }

    const regroupResult = this.regroupIfNecessary(creeps);

    if (regroupResult === "needs-regroup") {
      this.attackEnemiesAround(creeps);
    } else {
      this.moveAndAttack(creeps, "forward");
    }
  }

  private healEachOthers(creeps: AttackPartyCreepLoaded[]): "OK" | "NeedsRetreat" {
    const creepsAndDamage = _.sortBy(
      creeps.map(i => ({ creepInfo: i, health: i.creep.hits / i.creep.hitsMax })),
      i => i.health
    );
    // heal most damaged creep

    for (const creepInfo of creeps) {
      creepInfo.creep.heal(creepsAndDamage[0].creepInfo.creep);
    }

    // are creeps too badly damaged?
    if (creepsAndDamage[0] && creepsAndDamage[0].health <= 0.7) {
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

  private runRetreatingParty() {
    const creeps = this.creeps();

    // check death
    if (creeps.length === 0) {
      this.attackParty.status = "dead";
      return;
    }

    const healResult = this.healEachOthers(creeps);
    if (healResult === "OK") {
      this.attackParty.status = "attacking";
      this.runAttackingParty();
      return;
    }

    this.moveAndAttack(creeps, "backward");
  }

  private attackObject(creeps: AttackPartyCreepLoaded[], object: Creep | AnyStructure) {
    for (const creepInfo of creeps) {
      if (creepInfo.creep.pos.isNearTo(object)) {
        creepInfo.creep.rangedMassAttack();
      } else {
        creepInfo.creep.rangedAttack(object);
      }
    }
  }

  private moveAndAttack(creeps: AttackPartyCreepLoaded[], direction: "forward" | "backward") {
    const leader = creeps[0];
    const attackResult = this.attackEnemiesAround(creeps);
    const blockingObject = this.moveParty(creeps, direction);
    if (attackResult === "OK") {
      if (blockingObject) {
        this.attackObject(creeps, blockingObject);
      }
    }
  }

  private attackEnemiesAround(creeps: AttackPartyCreepLoaded[]): "attacked" | "OK" {
    const leader = creeps[0];
    const enemyInRange = leader.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4);
    const creepsNotUnderRamparts = enemyInRange.filter(
      i => !i.pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType === "rampart")
    );
    if (creepsNotUnderRamparts.length) {
      this.attackObject(creeps, creepsNotUnderRamparts[0]);
      return "attacked";
    } else {
      return "OK";
    }
  }

  private getTargets(room: Room): RoomPosition[] {
    let targets: (AnyStructure | undefined)[] = [];
    targets = targets.concat(room.spawns);
    targets = targets.concat([room.terminal]);
    targets = targets.concat([room.storage]);
    targets = targets.concat(room.towers);

    return targets.filter(i => i).map(i => (i as AnyStructure).pos);
  }

  private moveParty(creeps: AttackPartyCreepLoaded[], direction: "forward" | "backward") {
    if (this.attackParty.blocker && this.attackParty.blocker.dir === direction) {
      var obj = Game.getObjectById(this.attackParty.blocker.obj);
      if (obj) {
        return obj as AnyStructure | Creep;
      } else {
        delete this.attackParty.blocker;
      }
    } else {
      delete this.attackParty.blocker;
    }

    if (!!creeps.find(i => i.creep.fatigue > 0)) {
      // creeps are tired. wait.
      return undefined;
    }

    if (
      !this.attackParty.attackPath ||
      this.attackParty.currentPositionIndex === undefined ||
      this.attackParty.attackPath.length <= this.attackParty.currentPositionIndex
    ) {
      return;
    }

    if (this.attackParty.currentPositionIndex === 0 && direction === "backward") {
      console.log("Cannot go backward when at rallying point");
      return;
    }

    if (this.attackParty.attackPath && "show_visuals" in Game.flags) {
      let currentPos: RoomPosition | void = creeps[0].creep.pos;
      for (let index = this.attackParty.currentPositionIndex; index < this.attackParty.attackPath.length; index++) {
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
          stroke: "blue",
          strokeWidth: 0.1
        });
      }
    }

    const leader = creeps[0];

    let nextDirection: number;
    if (direction === "forward") {
      nextDirection = parseInt(this.attackParty.attackPath[this.attackParty.currentPositionIndex]);
    } else {
      nextDirection = Traveler.invertDirection(
        parseInt(this.attackParty.attackPath[this.attackParty.currentPositionIndex - 1])
      );
    }

    const nextPositions = creeps
      .map(creepInfo => {
        return Traveler.positionAtDirection(creepInfo.creep.pos, nextDirection);
      })
      .filter(i => i)
      .map(i => i as RoomPosition);

    const obstacles = nextPositions
      .map(pos => {
        const rampart = pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType !== "road");
        if (rampart) {
          return rampart;
        }
        const creep = pos.lookFor(LOOK_CREEPS).find(i => i.owner.username !== getUsername());
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
      this.attackParty.blocker = {
        dir: direction,
        obj: firstObstacle.id
      };

      return firstObstacle as AnyStructure | Creep;
    } else {
      delete this.attackParty.blocker;
      for (const creepInfo of creeps) {
        const result = creepInfo.creep.move(nextDirection as DirectionConstant);
        if (result === OK && creepInfo === creeps[0]) {
          // leader leads the pace
          if (direction === "forward") {
            this.attackParty.currentPositionIndex++;
          } else {
            this.attackParty.currentPositionIndex--;
          }
        }
      }
      return undefined;
    }
  }

  private getAttackMatrixForRoom(creeps: AttackPartyCreepLoaded[], room: string, matrix: CostMatrix) {
    console.log("Callback for room ", room);
    const roomVisibility = Game.rooms[room];
    const terrain = Game.map.getRoomTerrain(room);
    // make sure floor is walkable at creep locations

    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 50; j++) {
        const isWall = terrain.get(i, j) === TERRAIN_MASK_WALL;
        if (isWall) {
          for (const creep of creeps) {
            matrix.set(i - creep.x, j - creep.y, 0xff);
          }
        }
      }
    }

    if (roomVisibility && room === roomVisibility.name) {
      // add ramparts and walls are hard to walk on
      const walls = roomVisibility.find(FIND_STRUCTURES, {
        filter: i => i.structureType === "rampart" || i.structureType === "constructedWall"
      }) as (StructureWall | StructureRampart)[];
      for (const wall of walls) {
        for (const creep of creeps) {
          matrix.set(wall.pos.x - creep.x, wall.pos.y - creep.y, this.wallHitToCost(wall.hits));
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
    const creeps = this.creeps();
    const leader = creeps[0];
    const roomVisibility = Game.rooms[this.attack.toRoom];

    let targets: RoomPosition[] = [];
    if (roomVisibility) {
      targets = this.getTargets(roomVisibility);
    } else {
      let targetLocation: SimplePos;
      const roomInformations = ExplorationManager.getExploration(this.attack.toRoom);
      targetLocation =
        roomInformations && roomInformations.es && roomInformations.es.length
          ? roomInformations.es[0]
          : { x: 25, y: 25 };
      targets = [new RoomPosition(targetLocation.x, targetLocation.y, this.attack.toRoom)];
    }

    var pathSerialized = "";
    let previousPosition = leader.creep.pos;

    for (const spawn of targets) {
      console.log("Adding target ", spawn);
      var attackPath = this.getAttackPath(previousPosition, spawn, creeps);
      console.log("Attack path is complete?", attackPath.incomplete);
      pathSerialized = pathSerialized + Traveler.serializePath(previousPosition, attackPath.path);

      if (attackPath.incomplete) {
        break;
      } else {
        previousPosition = spawn;
      }
    }

    // if there's already a path, truncate where we are and append the new path
    if (this.attackParty.attackPath) {
      const upToNow = this.attackParty.attackPath.slice(0, this.attackParty.currentPositionIndex);
      this.attackParty.attackPath = upToNow + pathSerialized;
    } else {
      this.attackParty.attackPath = pathSerialized;
    }
    this.attackParty.isApproxPath = roomVisibility ? false : true;
  }

  private wallHitToCost(hits: number) {
    return 10 + Math.floor((10 * Math.log(hits + 1)) / Math.LN10);
  }

  private runMovingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];
    const otherCreeps = _.tail(creeps);

    leader.creep.goTo(new RoomPosition(25, 25, this.attack.toRoom));
    if (!this.attackParty.distance) {
      this.attackParty.distance =
        leader.creep.memory._trav && leader.creep.memory._trav.path ? leader.creep.memory._trav.path.length : 0;
    }

    for (const creep of otherCreeps) {
      creep.creep.goTo(leader.creep, { movingTarget: true });
    }

    // TODO: handle case when we are attacked on the way

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

  private onCreepDied() {
    if (this.attackParty.status === "moving") {
      // go back home
      this.attackParty.status = "forming";
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
        creep.goTo(restSpot);
      }
    }
  }
}

interface AttackPartyCreepLoaded extends AttackPartyCreep {
  creep: Creep;
}
