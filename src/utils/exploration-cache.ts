import { profiler } from "./profiler";
import { SegmentManager, RoomExplorationsSegments } from "../managers/segments";

let roomExplorations: RoomExplorationReport[] = [];
let roomsAreLoaded = false;
let roomsAreLoading = false;

(global as any).getExplorationState = function() {
  return {
    roomExplorations,
    roomsAreLoaded,
    roomsAreLoading
  };
};

export class ExplorationCache {
  public static run() {
    if (!roomsAreLoaded) {
      ExplorationCache.loadExplorationsFromSegment();
    }

    if (Game.time % 1234 === 0) {
      ExplorationCache.loadExplorationsFromSegment();
    }

    if (Game.time % 57 === 0 && roomsAreLoaded && !roomsAreLoading) {
      ExplorationCache.saveExplorationsInSegments();
    }
  }

  static loadExplorationsFromSegment() {
    if (roomsAreLoading) {
      return;
    }

    roomsAreLoading = true;
    let loadedSegments = 0;
    for (let segmentId of RoomExplorationsSegments) {
      // console.log("Loading exploration segment", segmentId);
      SegmentManager.loadSegment(segmentId, (data: RoomExplorationReport[] | null) => {
        // console.log("Exploration segment", segmentId, "loaded. with data : ", data ? data.length + "elements" : "null");
        if (data) {
          roomExplorations = roomExplorations.concat(data);
          roomExplorations = _.uniq(roomExplorations, i => i.r);
        }
        loadedSegments++;

        if (loadedSegments === RoomExplorationsSegments.length) {
          // console.log("All Exploration segments have been loaded.");
          roomsAreLoaded = true;
          roomsAreLoading = false;
        }
      });
    }
  }

  static saveExplorationsInSegments() {
    var buckets: RoomExplorationReport[][] = [];
    for (let bucketIndex = 0; bucketIndex < RoomExplorationsSegments.length; bucketIndex++) {
      buckets[bucketIndex] = [];
    }

    for (let index = 0; index < roomExplorations.length; index++) {
      var bucketIndex = index % RoomExplorationsSegments.length;
      buckets[bucketIndex].push(roomExplorations[index]);
    }

    for (let bucketIndex = 0; bucketIndex < RoomExplorationsSegments.length; bucketIndex++) {
      const segment = RoomExplorationsSegments[bucketIndex];
      const bucket = buckets[bucketIndex];
      SegmentManager.saveSegment(segment, bucket);
    }
  }

  static setExploration(exploration: RoomExplorationReport) {
    // remove existing if any
    roomExplorations = roomExplorations.filter(i => i.r !== exploration.r);
    roomExplorations.push(exploration);
  }

  static getExploration(roomName: string) {
    if (roomsAreLoaded) {
      return roomExplorations.find(i => i.r === roomName);
    } else {
      return null;
    }
  }

  static getAllExplorations() {
    if (roomsAreLoaded) {
      return roomExplorations;
    } else {
      return null;
    }
  }

  static resetAllExplorations() {
    roomExplorations = [];
    ExplorationCache.saveExplorationsInSegments();
  }
}

profiler.registerClass(ExplorationCache, "ExplorationCache");

(global as any).ExplorationCache = ExplorationCache;
