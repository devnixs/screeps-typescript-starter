import { getMyRooms, getUsername } from "utils/misc-utils";
import { profiler } from "utils/profiler";

const exploreTimeout = 10000;

export class ConquestManager {
  constructor(private room: Room) {}

  public static run() {
    if (Game.time % 1003 > 0) {
      return;
    }

    Memory.lastConquestTime = Memory.lastConquestTime || -100000;

    const gcl = Game.gcl.level;
    const rooms = getMyRooms().length;
    const flag = Game.flags["claimer_target"];

    if (rooms > gcl && !flag) {
      console.log("Colonizing new room");

      const bestRoom = _.sortBy(Memory.explorations.filter(i => i.c), i => i.c && i.c.s);

      if (bestRoom[0] && bestRoom[0].c) {
        const settings = bestRoom[0].c;
        if (settings) {
          new Flag("claimer_target", 1, 2, bestRoom[0].r, settings.x, settings.y).setPosition(
            new RoomPosition(settings.x, settings.y, bestRoom[0].r)
          );
          console.log("Colonizing ", bestRoom[0].r);
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
}

profiler.registerClass(ConquestManager, "ConquestManager");
