import { SegmentManager, Segments } from "managers/segments";

interface IPath {
  path: string;
  date: number;
}

interface ICachePath {
  [key: string]: IPath;
}

const maxPaths = 450;
const cacheDuration = 10000;
const enablePathCaching = true;

let cache: ICachePath | null = null;
(global as any).getCachedPaths = () => cache;

export class CachedPaths {
  private static serializeRoomPos(pos: RoomPosition) {
    return `${pos.roomName}-${pos.x}-${pos.y}`;
  }
  private static serializeStartEnd(start: RoomPosition, end: RoomPosition) {
    return `${CachedPaths.serializeRoomPos(start)}:${CachedPaths.serializeRoomPos(end)}`;
  }

  static storePath(start: RoomPosition, end: RoomPosition, path: string) {
    if (!enablePathCaching) {
      return;
    }
    if (!cache) {
      // console.log("Path cache is not loaded yet. Aborting");
      return;
    }

    if (Object.keys(cache).length >= maxPaths) {
      return;
    }

    if (start.roomName === end.roomName) {
      // only store path in different rooms
      return;
    }

    const key = CachedPaths.serializeStartEnd(start, end);
    const existing = cache[key];
    if (existing) {
      // console.log("path ", key, "already exists. Updating.");
      existing.date = Game.time;
      existing.path = path;
    } else {
      // console.log("Saving path ", key);
      cache[key] = {
        date: Game.time,
        path: path
      };
    }
  }

  static getPath(start: RoomPosition, end: RoomPosition): string | null {
    if (!enablePathCaching) {
      return null;
    }
    if (!cache) {
      // console.log("Path cache is not loaded yet. Aborting");
      return null;
    }
    if (start.roomName === end.roomName) {
      // only store path in different rooms
      return null;
    }

    // look around start and end
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          for (let l = -1; l <= 1; l++) {
            const x1 = start.x + i;
            const y1 = start.y + j;
            const x2 = end.x + k;
            const y2 = end.y + l;
            if (x1 < 0 || x1 > 49 || y1 < 0 || y1 > 49 || x2 < 0 || x2 > 49 || y2 < 0 || y2 > 49) {
              continue;
            }
            const realStart = new RoomPosition(x1, y1, start.roomName);
            const realEnd = new RoomPosition(x2, y2, end.roomName);

            const key = CachedPaths.serializeStartEnd(realStart, realEnd);
            const existing = cache[key];

            if (existing) {
              let prepend = "";
              let append = "";
              if (i !== 0 || j !== 0) {
                // add movement to go to path start
                prepend = start.getDirectionTo(realStart).toString();
              }
              if (k !== 0 || l !== 0) {
                // add movement to go to path start
                prepend = realEnd.getDirectionTo(end).toString();
              }

              return prepend + existing.path + append;
            }
          }
        }
      }
    }

    return null;
  }

  static run() {
    if (!enablePathCaching) {
      return;
    }

    if (!cache) {
      SegmentManager.loadSegment<ICachePath>(Segments.CachedRoutes, cachedRoutes => {
        if (cachedRoutes) {
          cache = cachedRoutes;
        } else {
          cache = {};
        }
      });
    }

    if (cache && Game.time % 1000 === 0) {
      // console.log("Cleaning up old paths...");
      // cleanup old paths
      Object.keys(cache).forEach(key => {
        const cacheNotNull = cache as ICachePath;
        const path = cacheNotNull[key];
        if (path.date < Game.time - cacheDuration) {
          // console.log("Deleted old path ", key);
          delete cacheNotNull[key];
        }
      });

      while (Object.keys(cache).length > maxPaths) {
        var rnd = _.sample(Object.keys(cache));
        delete cache[rnd];
      }
    }

    if (cache && Game.time % 1000 === 0) {
      SegmentManager.saveSegment<ICachePath>(Segments.CachedRoutes, cache);
    }
  }
}
