import { getMyRooms } from "utils/misc-utils";
import { profiler } from "utils/profiler";
import { findClosestRoom } from "utils/finder";

export class RemoteCampingManager {
  static runForAllRooms(force = false) {
    if (Game.time % 220 > 0 && !force) {
      return;
    }

    const campFlags = Object.keys(Game.flags)
      .filter(i => i.startsWith("camping"))
      .map(i => Game.flags[i]);

    const myRooms = getMyRooms();
    myRooms.forEach(r => (r.memory.campedRooms = []));

    for (const flag of campFlags) {
      const closestRoom = findClosestRoom(flag.pos.roomName, r => (r.controller ? r.controller.level >= 7 : false));
      if (closestRoom) {
        Game.rooms[closestRoom].memory.campedRooms.push(flag.pos.roomName);
      }
    }
  }
}

(global as any).RemoteCampingManager = RemoteCampingManager;

profiler.registerClass(RemoteCampingManager, "RemoteCampingManager");
