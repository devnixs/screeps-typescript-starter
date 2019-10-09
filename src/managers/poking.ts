import { getMyRooms } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { IPokerMemory } from "roles/poker";
import { ExplorationCache } from "utils/exploration-cache";
import { whitelist } from "constants/misc";
import { getUsedPercentage } from "utils/cpu";

export class PokingManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => new PokingManager(room).run());
  }

  run() {
    if (Game.time % 23 > 0) {
      return;
    }

    if (this.room.controller && this.room.controller.level < 4) {
      return;
    }

    if (getUsedPercentage() > 0.5) {
      this.room.memory.poker = undefined;
      return;
    }

    // find enemy remotes not too far

    var explorations = ExplorationCache.getAllExplorations();
    if (!explorations) {
      return;
    } else {
      const stealTargets = _.flatten(getMyRooms().map(i => i.memory.needsStealers || []));
      const remotes = explorations
        .filter(
          i =>
            i.er &&
            Cartographer.findRoomDistanceSum(i.r, this.room.name) <= 11 &&
            Cartographer.findRoomDistanceSum(i.r, this.room.name) > 3 &&
            (i.o && whitelist.indexOf(i.o) === -1)
        )
        .filter(i => !stealTargets.find(s => s.roomName === i.r));

      if (remotes.length === 0) {
        return;
      }
      const chosen = _.sample(remotes);
      this.room.memory.poker = chosen.r;
    }
  }

  static reassign(creep: Creep) {
    var explorations = ExplorationCache.getAllExplorations();
    if (!explorations) {
      return;
    } else {
      const stealTargets = _.flatten(getMyRooms().map(i => i.memory.needsStealers));
      const memory = creep.memory as IPokerMemory;
      const remotes = explorations
        .filter(i => i.er)
        .filter(
          i =>
            i.r !== memory.targetRoom &&
            !stealTargets.find(s => s && s.roomName === i.r) &&
            (i.o && whitelist.indexOf(i.o) === -1)
        )
        .map(i => ({
          room: i.r,
          distance: Cartographer.findRoomDistanceSum(i.r, creep.room.name)
        }));

      if (remotes.length === 0) {
        memory.targetRoom = null;
        return;
      } else {
        const closest = _.sortBy(remotes, i => i.distance)[0];
        console.log("Poker", creep, "reassigned to", closest.room);
        memory.targetRoom = closest.room;
      }
    }
  }
}

(global as any).PokingManager = PokingManager;
