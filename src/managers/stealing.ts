import { getMyRooms, paddingLeft } from "utils/misc-utils";
import { Cartographer } from "utils/cartographer";
import { IPokerMemory } from "roles/poker";
import { ExplorationCache } from "utils/exploration-cache";

export class StealingManager {
  constructor(private room: Room) {}

  public static runForAllRooms() {
    getMyRooms().forEach(room => new StealingManager(room).run());
  }

  run() {
    this.assign();
    this.reduceStats();
  }

  reduceStats() {
    if (Game.time % 1009 > 0) {
      return;
    }

    const stats = this.room.memory.stealingStats;
    if (!stats) {
      return;
    }

    for (const stat of stats) {
      if (stat.cost > 50000) {
        // reduce the stats so they can update over time suddenly it becomes harder to steal
        stat.brought = stat.brought * 0.8;
        stat.cost = stat.cost * 0.8;
      }
    }
  }

  assign() {
    if (Game.time % 12 > 0) {
      return;
    }

    if (this.room.controller && this.room.controller.level < 4) {
      return;
    }

    var explorations = ExplorationCache.getAllExplorations();
    if (!explorations) {
      return;
    } else {
      const remoteContainers = _.flatten(
        explorations
          .map(i =>
            i.er && Cartographer.findRoomDistanceSum(i.r, this.room.name) <= 5 && i.erc
              ? i.erc.map(rc => ({ ...rc, roomName: i.r }))
              : null
          )
          .filter(i => i)
          .map(i => i as SimplePosWithRoomName[])
      );

      this.room.memory.stealingStats = this.room.memory.stealingStats || [];
      this.room.memory.needsStealers = remoteContainers.filter(r => {
        const stat = this.room.memory.stealingStats.find(
          i => i.pos.x === r.x && i.pos.y === r.y && i.pos.roomName === r.roomName
        );
        if (stat) {
          if (stat.cost < 5000) {
            return true;
          } else if (stat.cost < 12000) {
            const ratio = stat.brought / stat.cost;
            return ratio > 0.5;
          } else {
            const ratio = stat.brought / stat.cost;
            return ratio > 1.2;
          }
        } else {
          return true;
        }
      });
    }
  }

  static outputStats() {
    getMyRooms().forEach(room => {
      if (!room.memory || !room.memory.stealingStats || !room.memory.stealingStats.length) {
        return;
      }
      console.log("### " + room.name + " ###");
      const text = _.sortBy(room.memory.stealingStats.filter(i => i.brought && i.brought > 0), i =>
        i.brought && i.cost ? i.brought / i.cost : 0
      )
        .map(
          i =>
            paddingLeft("      ", i.pos.roomName) +
            paddingLeft("       ", ":" + i.pos.x + "," + i.pos.y) +
            paddingLeft("         ", Math.round((i.brought || 0) / 1000)) +
            "K" +
            paddingLeft("         ", Math.round((i.cost || 0) / 1000)) +
            "K" +
            paddingLeft("         ", Math.round(((i.brought || 0) / (i.cost || 0)) * 100) / 100)
        )
        .join("\n");
      console.log(text);
    });
  }
}

(global as any).StealingManager = StealingManager;

(global as any).outputStealingStats = StealingManager.outputStats;
