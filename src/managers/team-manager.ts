"use strict";

import { whitelist, desiredEnergyInTerminal, desiredStocks } from "constants/misc";
import { getMyRooms, runFromTimeToTime, createFlagAtPosition } from "utils/misc-utils";
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

function sendCallback(resource: ResourceConstant, amount: number, room: string) {
  console.log("Sent to ally ", amount, resource, "to", room);
  Memory.helps = Memory.helps || [];
  Memory.helps.push({
    a: amount,
    l: room,
    r: resource,
    t: Game.time
  });
}

function allyRequestCallback(request: Request) {
  switch (request.requestType) {
    case RequestType.RESOURCE:
      if (request.resourceType === "energy") {
        const minAmount = 100000;
        const maxAmount = 600000;

        const highEnergyRoom = myRooms.find(i =>
          i.storage &&
          i.storage.store.energy > maxAmount - request.priority * (maxAmount - minAmount) &&
          i.terminal &&
          i.terminal.store.energy > desiredEnergyInTerminal / 2
            ? true
            : false
        );
        if (highEnergyRoom && highEnergyRoom.terminal) {
          const result = highEnergyRoom.terminal.send(
            request.resourceType,
            desiredEnergyInTerminal / 4,
            request.roomName
          );
          if (result === OK) {
            sendCallback(request.resourceType, desiredEnergyInTerminal / 4, request.roomName);
          }
        }
      } else if (request.priority >= 0.1) {
        const minAmount = (desiredStocks[request.resourceType as _ResourceConstantSansEnergy] as any) * 4;
        const oversuppliedTerminal = myRooms.find(i =>
          i.terminal &&
          i.terminal.store[request.resourceType] &&
          (i.terminal.store[request.resourceType] as any) > minAmount
            ? true
            : false
        );

        if (oversuppliedTerminal && oversuppliedTerminal.terminal) {
          const availableAmount = oversuppliedTerminal.terminal.store[request.resourceType] as number;
          const sendingAmount = Math.min(1000, availableAmount - minAmount);
          const result = oversuppliedTerminal.terminal.send(request.resourceType, sendingAmount, request.roomName);
          if (result) {
            sendCallback(request.resourceType, sendingAmount, request.roomName);
          }
        }
      }
      break;
    case RequestType.DEFENSE:
      // Send some resources or whatever
      if (request.priority >= 0.8) {
        console.log("Creating defending ally attack to ", request.roomName);
        createFlagAtPosition(new RoomPosition(25, 25, request.roomName), "attack", {
          reason: "ally-defense",
          expiration: Game.time + 3000,
          priority: request.priority
        } as AttackFlagMemory);
      }
      break;
  }
}
const delay = 10;
var allyRequests: Request[] | undefined;
var requestArray: Request[];
var simpleAllies = {
  run() {
    if (runFromTimeToTime(whitelist.length, whitelist.length * 10)) {
      this.checkAllies(allyRequestCallback);
    }

    if (Game.time % delay) {
      // check energies
      const storageTargetEnergy = 100000;
      const lowEnergyRooms = getMyRooms().filter(
        i => i.storage && i.terminal && i.storage.store.energy < storageTargetEnergy
      );
      for (const room of lowEnergyRooms) {
        const storage = room.storage as StructureStorage;
        const energy = storage.store.energy;
        const priority = (storageTargetEnergy - energy) / storageTargetEnergy;
        console.log("Asking for energy in room", room.name, "with priority", priority);
        this.requestResource(room.name, "energy", priority);
      }
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
    if (Game.time % delay) {
      requestArray = [];
      allyRequests = undefined;
    }
  },
  // Call after making all your requests
  endOfTick() {
    if (Game.time % delay) {
      SegmentManager.saveSegment(segmentID, requestArray);
      // If you're already setting public segements somewhere this will overwrite that. You should
      // fix that yourself because I can't fix it for you.
      RawMemory.setPublicSegments([segmentID]);
    }
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
