import { desiredStocks, buyableElements, desiredEnergyInTerminal } from "constants/misc";
import { profiler } from "./utils/profiler";
import { allRooms } from "utils/misc-utils";

const minCredits = 10000;
const minTradeCreditAmount = 200;
const maxTradeAmount = 500;

export class Merchant {
  constructor(private room: Room) {}

  getResource(store: StoreDefinition | StoreDefinitionWithoutEnergy, res: string) {
    return (store as any)[res] || 0;
  }

  run() {
    const storage = this.room.storage as StructureStorage;
    const terminal = this.room.terminal as StructureTerminal;

    const resources = _.uniq(
      Object.keys(desiredStocks)
        .concat(Object.keys(terminal.store))
        .concat(Object.keys(storage.store))
    );

    const overSupply = resources.find(
      i =>
        i !== "energy" &&
        this.getResource(storage.store, i) + this.getResource(terminal.store, i) > this.getResource(desiredStocks, i) &&
        this.getResource(terminal.store, i) > 300
    ) as ResourceConstant | undefined;

    const underSupply = buyableElements.find(
      i => this.getResource(storage.store, i) + this.getResource(terminal.store, i) < this.getResource(desiredStocks, i)
    ) as ResourceConstant | undefined;

    if (overSupply) {
      // console.log("Oversupply", this.room.name, overSupply);
      const overSupplyAmount =
        this.getResource(storage.store, overSupply) +
        this.getResource(terminal.store, overSupply) -
        this.getResource(desiredStocks, overSupply);
      const terminalAmount = this.getResource(terminal.store, overSupply);
      if (overSupplyAmount > 50) {
        const sellResult = this.sellResource(overSupply, Math.min(terminalAmount, overSupplyAmount));
        if (sellResult === OK) {
          return;
        }
      }
    }

    if (underSupply) {
      if (Game.market.credits < minCredits + minTradeCreditAmount) {
        return;
      }

      const underSupplyAmount =
        this.getResource(desiredStocks, underSupply) -
        (this.getResource(storage.store, underSupply) + this.getResource(terminal.store, underSupply));

      const buyResult = this.buyResource(underSupply, underSupplyAmount);
      if (buyResult === OK) {
        return;
      }
    }
  }

  sellResource(resource: ResourceConstant, amount: number) {
    const buyOrders = Game.market.getAllOrders(
      i => i.resourceType === resource && i.type === ORDER_BUY && i.remainingAmount >= 500
    );

    if (buyOrders.length >= 5) {
      // we need at least 5 orders
      // take the most interesting one
      const bestOrder = _.sortBy(buyOrders, i => -1 * i.price)[0];
      const tradeAmount = Math.min(bestOrder.remainingAmount, amount, maxTradeAmount);

      const result = Game.market.deal(bestOrder.id, tradeAmount, this.room.name);
      if (result === OK) {
      }
      return result;
    } else {
      return -1;
    }
  }

  buyResource(resource: ResourceConstant, amount: number) {
    const sellOrders = Game.market.getAllOrders(
      i => i.resourceType === resource && i.type === ORDER_SELL && i.remainingAmount > 500
    );

    if (sellOrders.length >= 5) {
      // we need at least 5 orders
      // take the most interesting one
      const bestOrder = _.sortBy(sellOrders, i => i.price)[0];

      const availableCredits = Game.market.credits - minCredits;
      const howMuchWeCanBuy = Math.floor(availableCredits / bestOrder.price);

      const tradeAmount = Math.min(bestOrder.remainingAmount, amount, howMuchWeCanBuy, maxTradeAmount);

      const result = Game.market.deal(bestOrder.id, tradeAmount, this.room.name);
      if (result === OK) {
      }
      //const result = OK;
      return result;
    } else {
      return -1;
    }
  }

  static transferExcessiveResources() {
    var oversuppliedRoom = allRooms.filter(
      i =>
        i.storage &&
        i.storage.store.energy >= i.storage.storeCapacity * 0.75 &&
        i.controller &&
        i.controller.my &&
        i.controller.level === 8
    )[0];
    var undersuppliedRoom = allRooms.filter(
      i =>
        i.storage &&
        i.storage.store.energy < i.storage.storeCapacity * 0.35 &&
        i.controller &&
        i.controller.my &&
        i.controller.level < 8 &&
        i.controller.level >= 6
    )[0];

    if (oversuppliedRoom && undersuppliedRoom) {
      var terminal1: StructureTerminal | undefined = oversuppliedRoom.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "terminal"
      })[0] as any;
      var terminal2: StructureTerminal | undefined = undersuppliedRoom.find(FIND_MY_STRUCTURES, {
        filter: i => i.structureType === "terminal"
      })[0] as any;

      if (terminal1 && terminal1.cooldown === 0 && terminal2) {
        console.log("Balancing energy ", oversuppliedRoom.name, "=>", undersuppliedRoom.name);
        const result = terminal1.send(RESOURCE_ENERGY, desiredEnergyInTerminal / 3, undersuppliedRoom.name);
        if (result !== OK) {
          console.log("Cannot balance : ", result);
        }
      }
    }
  }

  static runForAllRooms() {
    if (Game.time % 20 > 0) {
      return;
    }

    Merchant.transferExcessiveResources();

    const roomNames = Object.keys(Game.rooms)
      .map(room => Game.rooms[room])
      .filter(
        room =>
          room.controller &&
          room.controller &&
          room.controller.my &&
          room.terminal &&
          room.terminal.cooldown === 0 &&
          room.storage
      );

    const shuffled = _.shuffle(roomNames);

    for (let roomIndex in shuffled) {
      const room = shuffled[roomIndex];
      const manager = new Merchant(room);
      manager.run();
    }
  }
}

profiler.registerClass(Merchant, "Merchant");
