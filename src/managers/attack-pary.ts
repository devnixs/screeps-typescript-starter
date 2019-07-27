import { findRestSpot, findEmptySpotCloseTo } from "utils/finder";
import { Cartographer } from "utils/cartographer";
import { Traveler } from "utils/Traveler";
import { ExplorationManager } from "./exploration";

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
      this.runMovingParty();
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
    }
  }

  private runRegroupingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];

    var terrain = Game.map.getRoomTerrain(leader.creep.pos.roomName);

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
    }

    let allCreepsAreGrouped = true;
    for (const creepInfo of creeps) {
      const targetPos = new RoomPosition(
        rallyPoint.x + creepInfo.x,
        rallyPoint.y + creepInfo.y,
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
    }
  }

  private runAttackingParty() {
    const creeps = this.creeps();
    const leader = creeps[0];
    const otherCreeps = _.tail(creeps);

    const roomInformations = ExplorationManager.getExploration(this.attack.toRoom);

    const attackPath = Traveler.findTravelPath(leader.creep, new RoomPosition(25, 25, this.attack.toRoom));

    leader.creep.goTo(new RoomPosition(25, 25, this.attack.toRoom));
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
