import { desiredStocks, buyableElements } from "constants/misc";

const minCredits = 1000;
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
      const overSupplyAmount =
        this.getResource(storage.store, overSupply) +
        this.getResource(terminal.store, overSupply) -
        this.getResource(desiredStocks, overSupply);
      const terminalAmount = this.getResource(terminal.store, overSupply);

      const sellResult = this.sellResource(overSupply, Math.min(terminalAmount, overSupplyAmount));
      if (sellResult === OK) {
        return;
      }
    }

    if (underSupply) {
      if (Game.market.credits < minCredits) {
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
        console.log("SOLD ", tradeAmount, resource, this.room.name, bestOrder.id);
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
        console.log("BOUGHT ", tradeAmount, resource, this.room.name, bestOrder.id);
      }
      //const result = OK;
      return result;
    } else {
      return -1;
    }
  }

  static runForAllRooms() {
    for (let roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (
        room.controller &&
        room.controller &&
        room.controller.my &&
        room.terminal &&
        room.terminal.cooldown === 0 &&
        room.storage
      ) {
        const manager = new Merchant(room);
        manager.run();
      }
    }
  }
}
