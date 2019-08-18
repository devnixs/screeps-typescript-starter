"use strict";

import { whitelist, desiredEnergyInTerminal } from "constants/misc";
import { getMyRooms, runFromTimeToTime } from "utils/misc-utils";
import { SegmentManager } from "./segments";
import { profiler } from "utils/profiler";

// This is completely unencrypted and in the clear. Maybe it shouldn't be :D
const segmentID = 98;
const allyList = whitelist;
// It's kinda important everybody has the same enums here.
const enum RequestType {
  RESOURCE = 0,
  DEFENSE = 1
}
interface ResourceRequest {
  requestType: RequestType.RESOURCE;
  resourceType: ResourceConstant;
  roomName: string;
  priority: number;
}
interface DefenseRequest {
  requestType: RequestType.DEFENSE;
  roomName: string;
  priority: number;
}
type Request = ResourceRequest | DefenseRequest;
type RequestCallback = (request: Request) => void;

let myRooms: Room[] = [];

function allyRequestCallback(request: Request) {
  /*   switch (request.requestType) {
    case RequestType.RESOURCE:
      if (request.resourceType === "energy") {
        const highEnergyRoom = myRooms.find(i => i.storage && i.storage.store.energy > 600000 - request.priority * 500000 && i.terminal && i.terminal.store.energy > desiredEnergyInTerminal);
       if(highEnergyRoom && highEnergyRoom.terminal){
        highEnergyRoom.terminal
       }
      }
      break;
    case RequestType.DEFENSE:
      // Send some resources or whatever
      break;
  } */
}
var allyRequests: Request[] | undefined;
var requestArray: Request[];
var simpleAllies = {
  run() {
    if (runFromTimeToTime(whitelist.length, whitelist.length * 10)) {
      this.checkAllies(allyRequestCallback);
    }
  },
  // This sets foreign segments. Maybe you set them yourself for some other reason
  // Up to you to fix that.
  checkAllies(callback: RequestCallback) {
    myRooms = getMyRooms().filter(i => i.controller && i.terminal && i.storage && i.storage && !i.terminal.cooldown);
    let currentAllyName = allyList[Game.time % allyList.length];
    if (RawMemory.foreignSegment && RawMemory.foreignSegment.username === currentAllyName) {
      const rawData = RawMemory.foreignSegment.data;
      allyRequests = allyRequests || (JSON.parse(rawData) as Request[]);
      //console.log("Request from ", currentAllyName, rawData);
      for (let request of allyRequests) {
        callback(request);
      }
    } else {
      console.log("Simple allies either has no segment or has the wrong name?", currentAllyName);
    }
    let nextAllyName = allyList[(Game.time + 1) % allyList.length];
    RawMemory.setActiveForeignSegment(nextAllyName, segmentID);
  },
  // Call before making any requests
  startOfTick() {
    requestArray = [];
    allyRequests = undefined;
  },
  // Call after making all your requests
  endOfTick() {
    if (Game.time % 5) {
      SegmentManager.saveSegment(segmentID, requestArray);
    }
    // If you're already setting public segements somewhere this will overwrite that. You should
    // fix that yourself because I can't fix it for you.
    RawMemory.setPublicSegments([segmentID]);
  },
  // Priority is unbounded. It's up to you and your allies to sort out what you want it to mean
  requestHelp(roomName: string, priority?: number) {
    requestArray.push({
      requestType: RequestType.DEFENSE,
      roomName: roomName,
      priority: priority || 0
    });
  },
  requestResource(roomName: string, resourceType: ResourceConstant, priority?: number) {
    requestArray.push({
      requestType: RequestType.RESOURCE,
      resourceType: resourceType,
      roomName: roomName,
      priority: priority || 0
    });
  }
};
export { simpleAllies };

simpleAllies.run = profiler.registerFN(simpleAllies.run, "simpleAllies.run");
simpleAllies.endOfTick = profiler.registerFN(simpleAllies.endOfTick, "simpleAllies.endOfTick");
simpleAllies.startOfTick = profiler.registerFN(simpleAllies.startOfTick, "simpleAllies.startOfTick");
