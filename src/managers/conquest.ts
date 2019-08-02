import { getMyRooms, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { ExplorationManager } from "./exploration";

const exploreTimeout = 10000;

export class ConquestManager {
  constructor(private room: Room) {}

  public static run() {
    if (Game.time % 13 > 0) {
      return;
    }

    // disable on screeps plus
    if ("E13S15" in Game.rooms && "E16S17" in Game.rooms) {
      return;
    }

    Memory.lastConquestTime = Memory.lastConquestTime || -100000;

    const gcl = Game.gcl.level;
    const rooms = getMyRooms().length;
    const flag = Game.flags["claimer_target"];
    Memory.roomsCount = Memory.roomsCount || rooms;

    if (Memory.roomsCount > rooms) {
      ConquestManager.onRoomLost();
      Memory.roomsCount = rooms;
    }

    if (rooms < gcl && !flag) {
      console.log("Colonizing new room");

      const explorations = ExplorationManager.getAllExplorations();
      if (explorations === null) {
        // explorations are not loaded yet. aborting.
        return;
      }

      const bestRoom = _.sortBy(explorations.filter(i => i.c && !i.eb && !i.er), i => i.c && i.c.s);

      if (bestRoom[0] && bestRoom[0].c) {
        const settings = bestRoom[0].c;
        if (settings) {
          new Flag("claimer_target", 1, 2, bestRoom[0].r, settings.x, settings.y).setPosition(
            new RoomPosition(settings.x, settings.y, bestRoom[0].r)
          );
          console.log("Colonizing ", bestRoom[0].r);
          Game.notify("Colonizing new room " + bestRoom[0].r);
        }
      }

      Memory.lastConquestTime = Game.time;
    }

    if (Memory.lastConquestTime && Memory.lastConquestTime < Game.time - 10000 && flag) {
      // abort conquest if it's stale
      if (flag) {
        flag.remove();
      }
    }
  }

  static onNewRoom(room: Room) {
    console.log("Successfuly claimed room", room.name);
    // recompute all explorations, as they might be closer to this room
    ExplorationManager.resetAllExplorations();
    Memory.closestRooms = {};
  }

  static onRoomLost() {
    console.log("Lost a room");
    // recompute all explorations, as they might be further to this room
    ExplorationManager.resetAllExplorations();
    Memory.closestRooms = {};
  }
}

profiler.registerClass(ConquestManager, "ConquestManager");
