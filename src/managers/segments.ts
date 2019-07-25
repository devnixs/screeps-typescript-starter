export const Segments = {
  CachedRoutes: 1,
  RoomExploration0: 2,
  RoomExploration1: 3,
  RoomExploration2: 4,
  RoomExploration3: 5,
  RoomExploration4: 6,
  RoomExploration5: 7,
  RoomExploration6: 8,
  RoomExploration7: 9,
  RoomExploration8: 10,
  RoomExploration9: 11,
  RoomExploration10: 12
};

export const RoomExplorationsSegments = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface ILoadQueue {
  segment: number;
  callback: (data: any) => void;
}

interface ISaveQueue {
  segment: number;
  data: any;
}

export class SegmentManager {
  private static lastRunTick = Game.time;

  private static loadQueue: ILoadQueue[] = [];
  private static saveQueue: ISaveQueue[] = [];
  private static nextAvailable: ILoadQueue[] = [];

  public static run() {
    if (SegmentManager.lastRunTick === Game.time) {
      console.log("Do not run SegmentManager.run() twice");
      // This can only run once per tick.
      return;
    }

    SegmentManager.lastRunTick = Game.time;

    SegmentManager.nextAvailable.forEach(q => {
      // console.log("Segment ", q.segment, " has been loaded. Calling callback");
      var data = RawMemory.segments[q.segment];
      if (!data) {
        q.callback(null);
      }
      try {
        var deserialized = JSON.parse(data);
        q.callback(deserialized);
      } catch (e) {
        console.log("Cannot deserialize segment ", q.segment, ". Cleaning segment.");
        RawMemory.segments[q.segment] = "";
        q.callback(null);
      }
    });
    SegmentManager.nextAvailable = [];

    const groups = _.pairs(_.groupBy(SegmentManager.loadQueue, i => i.segment)) as [string, ILoadQueue[]][];
    const nextActiveSegments: number[] = [];

    for (let i = 0; i < Math.min(10, groups.length); i++) {
      const group = groups[i];
      const segment = Number(group[0]);
      const queuedItems = group[1];
      nextActiveSegments.push(segment);
      queuedItems.forEach(q => {
        SegmentManager.nextAvailable.push({ segment: segment, callback: q.callback });
      });
      SegmentManager.loadQueue = SegmentManager.loadQueue.filter(i => i.segment !== segment);
    }
    RawMemory.setActiveSegments(nextActiveSegments);

    for (let i = 0; i < 9; i++) {
      const toSave = SegmentManager.saveQueue.shift();
      if (!toSave) {
        break;
      }
      var rawData = JSON.stringify(toSave.data);
      // console.log("Saving segment", toSave.segment, "data. Size:", rawData.length);
      RawMemory.segments[toSave.segment] = rawData;
    }
  }

  public static loadSegment<T>(segment: number, callback: (data: T | null) => void) {
    SegmentManager.loadQueue.push({ segment, callback });
  }

  static saveSegment<T>(segment: number, data: T) {
    SegmentManager.saveQueue.push({ data, segment });
  }
}
