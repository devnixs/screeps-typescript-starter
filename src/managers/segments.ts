export const Segments = {
  CachedRoutes: 1
};

interface ILoadQueue {
  segment: number;
  callback: (data: any) => void;
}

export class SegmentManager {
  private static lastRunTick = Game.time;

  private static loadQueue: ILoadQueue[] = [];
  private static nextAvailable: ILoadQueue[] = [];

  public static run() {
    if (SegmentManager.lastRunTick === Game.time) {
      console.log("Do not run SegmentManager.run() twice");
      // This can only run once per tick.
      return;
    }

    SegmentManager.lastRunTick = Game.time;

    SegmentManager.nextAvailable.forEach(q => {
      console.log("Segment ", q.segment, " has been loaded. Calling callback");
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
  }

  public static loadSegment<T>(segment: number, callback: (data: T | null) => void) {
    SegmentManager.loadQueue.push({ segment, callback });
  }

  static saveSegment<T>(segment: number, data: T) {
    var rawData = JSON.stringify(data);
    console.log("Saving segment", segment, "data. Size:", rawData.length);
    RawMemory.segments[segment] = rawData;
  }
}
