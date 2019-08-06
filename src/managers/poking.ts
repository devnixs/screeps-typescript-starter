import { getMyRooms } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { IPokerMemory } from "roles/poker";
import { ExplorationCache } from "utils/exploration-cache";

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

    // find enemy remotes not too far

    var explorations = ExplorationCache.getAllExplorations();
    if (!explorations) {
      return;
    } else {
      const remotes = explorations.filter(i => i.er && Cartographer.findRoomDistanceSum(i.r, this.room.name) <= 11);

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
      const memory = creep.memory as IPokerMemory;
      const remotes = explorations
        .filter(i => i.er)
        .filter(i => i.r !== memory.targetRoom)
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
