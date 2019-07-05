import { getMyRooms } from "utils/misc-utils";

class StatsManager {
  getStats() {
    getMyRooms().forEach(room => {
      const storage = room.storage ? room.storage.store.energy : 0;
      const controller = room.controller ? room.controller.progress : 0;

      const total = storage + controller;
      if (room.memory.lastProgressChecktime && room.memory.lastProgress) {
        const progressDiff = total - room.memory.lastProgress;
        const timeDiff = Game.time - room.memory.lastProgressChecktime;
        const progressByTick = progressDiff / timeDiff;
        console.log(room.name, progressByTick);
      }

      room.memory.lastProgressChecktime = Game.time;
      room.memory.lastProgress = total;
    });
  }
}

(global as any).getRoomStats = new StatsManager().getStats;
