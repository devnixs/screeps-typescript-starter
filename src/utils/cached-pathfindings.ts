import { Traveler } from "./Traveler";

const cachedPathfindings: { [tag: string]: PathfinderReturn } = {};

export function findOrCachePathfinding(
  source: RoomPosition,
  destination: RoomPosition,
  options?: TravelToOptions
): PathfinderReturn {
  const tag =
    source.roomName +
    ":" +
    source.x +
    "-" +
    source.y +
    ";" +
    destination.roomName +
    ":" +
    destination.x +
    "-" +
    destination.y;

  if (!cachedPathfindings[tag]) {
    cachedPathfindings[tag] = Traveler.findTravelPath(source, destination, options);
  }

  return cachedPathfindings[tag];
}
