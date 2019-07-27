import { findRestSpot, findEmptySpotCloseTo } from "utils/finder";
import { Cartographer } from "utils/cartographer";
import { Traveler } from "utils/Traveler";
import { ExplorationManager } from "./exploration";
import { isFunction } from "util";
import { getUsername } from "utils/misc-utils";

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

    this.sayStatus();
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
        leader.creep.say("😵");
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
        }
        return true;
      });

      if (!rallyPoint) {
        console.log("Could not find rally point!");
        return;
      } else {
        this.attackParty.rallyPoint = { ...rallyPoint, roomName: leader.creep.room.name };
      }
    }

    let allCreepsAreGrouped = true;
    for (const creepInfo of creeps) {
      const targetPos = new RoomPosition(
        this.attackParty.rallyPoint.x + creepInfo.x,
        this.attackParty.rallyPoint.y + creepInfo.y,
        leader.creep.room.name
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

    // check death
    if (creeps.length === 0) {
      this.attackParty.status = "dead";
      return;
    }

    const roomVisibility = Game.rooms[this.attack.toRoom];

    if (!this.attackParty.attackPath) {
      this.findAttackPath();
    }

    if (this.attackParty.attackPath && this.attackParty.isApproxPath && roomVisibility) {
      // recompute path now that we have vision
      this.findAttackPath();
    }

    const healResult = this.healEachOthers(creeps);
    if (healResult === "NeedsRetreat") {
      this.attackParty.status = "retreating";
      this.runRetreatingParty();
      return;
    }

    this.moveAndAttack(creeps, "forward");
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
    if (creepsAndDamage[0].health <= 0.7) {
      return "NeedsRetreat";
    } else {
      return "OK";
    }
  }

  private runRetreatingParty() {
    const creeps = this.creeps();
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
    const enemyInRange = leader.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4);
    const blockingObject = this.moveParty(creeps, direction);
    if (enemyInRange.length) {
      this.attackObject(creeps, enemyInRange[0]);
    } else {
      if (blockingObject) {
        this.attackObject(creeps, blockingObject);
      }
    }
  }

  private moveParty(creeps: AttackPartyCreepLoaded[], direction: "forward" | "backward") {
    if (
      !this.attackParty.attackPath ||
      !this.attackParty.currentPositionIndex ||
      this.attackParty.attackPath.length <= this.attackParty.currentPositionIndex
    ) {
      return;
    }

    if (this.attackParty.currentPositionIndex === 0 && direction === "backward") {
      console.log("Cannot go backward when at rallying point");
      return;
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
      .map(creep => {
        return Traveler.positionAtDirection(creep.creep.pos, nextDirection);
      })
      .filter(i => i)
      .map(i => i as RoomPosition);

    const obstacles = nextPositions.map(
      pos =>
        pos.lookFor(LOOK_STRUCTURES).find(i => i.structureType !== "road") ||
        pos.lookFor(LOOK_CREEPS).find(i => i.owner.username !== getUsername())
    );

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
      return firstObstacle as AnyStructure | Creep;
    } else {
      for (const creepInfo of creeps) {
        creepInfo.creep.move(nextDirection as DirectionConstant);
      }
      return undefined;
    }
  }

  private findAttackPath() {
    const creeps = this.creeps();
    const leader = creeps[0];
    const otherCreeps = _.tail(creeps);
    const roomVisibility = Game.rooms[this.attack.toRoom];

    let targetLocation: SimplePos;
    if (roomVisibility) {
      targetLocation = roomVisibility.spawns[0].pos;
    } else {
      const roomInformations = ExplorationManager.getExploration(this.attack.toRoom);
      targetLocation =
        roomInformations && roomInformations.es && roomInformations.es.length
          ? roomInformations.es[0]
          : { x: 25, y: 25 };
    }

    const attackPath = Traveler.findTravelPath(
      leader.creep,
      new RoomPosition(targetLocation.x, targetLocation.y, this.attack.toRoom),
      {
        roomCallback: (room, matrix) => {
          const terrain = Game.map.getRoomTerrain(room);
          // make sure floor is walkable at creep locations

          for (let i = 0; i < 50; i++) {
            for (let j = 0; j < 50; j++) {
              const isWall = terrain.get(i, j) === TERRAIN_MASK_WALL;
              if (isWall) {
                for (const otherCreep of otherCreeps) {
                  matrix.set(i - otherCreep.x, j - otherCreep.y, 0xff);
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
              matrix.set(wall.pos.x, wall.pos.y, this.wallHitToCost(wall.hits));
            }
          }

          return matrix;
        }
      }
    );

    var pathSerialized = Traveler.serializePath(leader.creep.pos, attackPath.path);
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
      const creep = Game.getObjectById(creepInfo.id) as Creep | undefined;
      if (!creep) {
        this.attackParty.creeps = this.attackParty.creeps.filter(i => i.id !== creepInfo.id);
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
    for (const creepInfo of this.attackParty.creeps) {
      const creep = Game.getObjectById(creepInfo.id) as Creep | undefined;
      if (!creep) {
        this.attackParty.creeps = this.attackParty.creeps.filter(i => i.id !== creepInfo.id);
        continue;
      }

      this.goToRest(creep);
    }

    if (this.attackParty.creeps.length === this.attackParty.count) {
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
