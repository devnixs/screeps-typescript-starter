import { desiredStocks, buyableElements, desiredEnergyInTerminal, sellableElements } from "constants/misc";
import { profiler } from "./utils/profiler";

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

    const resources = _.uniq(Object.keys(desiredStocks).concat(Object.keys(terminal.store)));

    const overSupply = resources.find(
      i =>
        i !== "energy" &&
        sellableElements.indexOf(i) >= 0 &&
        this.getResource(terminal.store, i) > this.getResource(desiredStocks, i) &&
        this.getResource(terminal.store, i) > 300
    ) as ResourceConstant | undefined;

    const underSupply = buyableElements.find(
      i => this.getResource(terminal.store, i) < this.getResource(desiredStocks, i)
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
        console.log(this.room.name, " SOLD " + tradeAmount + resource);
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
        console.log(this.room.name, " BOUGHT " + tradeAmount + resource);
      }
      //const result = OK;
      return result;
    } else {
      return -1;
    }
  }

  static transferExcessiveResources() {
    const allRooms = Object.keys(Game.rooms).map(i => Game.rooms[i]);
    var oversuppliedRooms = allRooms.filter(
      i =>
        i.storage &&
        i.storage.store.energy >= i.storage.storeCapacity * 0.75 &&
        i.controller &&
        i.controller.my &&
        i.controller.level === 8 &&
        i.terminal &&
        i.terminal.cooldown === 0 &&
        i.terminal.store.energy >= (2 / 3) * desiredEnergyInTerminal
    );
    let undersuppliedRooms = allRooms.filter(
      i =>
        i.storage &&
        _.sum(i.storage.store) < i.storage.storeCapacity * 0.85 &&
        i.controller &&
        i.controller.my &&
        i.controller.level < 8 &&
        i.controller.level >= 6 &&
        i.terminal &&
        _.sum(i.terminal.store) < i.terminal.storeCapacity * 0.8
    );

    let undersuppliedRoom = _.sortBy(undersuppliedRooms, room => room.storage && room.storage.store.energy)[0];

    if (!undersuppliedRoom) {
      let undersuppliedRooms = allRooms.filter(
        i =>
          i.storage &&
          i.controller &&
          i.controller.my &&
          i.controller.level === 8 &&
          i.terminal &&
          i.storage.store.energy < i.storage.storeCapacity * 0.7 &&
          _.sum(i.storage.store) < i.storage.storeCapacity * 0.9 &&
          _.sum(i.terminal.store) < i.terminal.storeCapacity * 0.8
      );

      undersuppliedRoom = _.sortBy(undersuppliedRooms, room => room.storage && room.storage.store.energy)[0];
    }

    console.log("A:", oversuppliedRooms[0] && oversuppliedRooms[0].name);
    console.log("B:", undersuppliedRoom && undersuppliedRoom.name);

    _.forEach(oversuppliedRooms, oversuppliedRoom => {
      if (undersuppliedRoom) {
        var terminal1 = oversuppliedRoom.terminal;
        var terminal2 = undersuppliedRoom.terminal;

        if (terminal1 && terminal1.cooldown === 0 && terminal2) {
          console.log("Balancing energy ", oversuppliedRoom.name, "=>", undersuppliedRoom.name);
          const result = terminal1.send(RESOURCE_ENERGY, desiredEnergyInTerminal / 3, undersuppliedRoom.name);
          if (result !== OK) {
            console.log("Cannot balance : ", result);
          }
        }
      }
    });
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
