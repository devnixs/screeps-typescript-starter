import { desiredStocks, buyableElements, desiredEnergyInTerminal, sellableElements } from "constants/misc";
import { profiler } from "../utils/profiler";
import { getMyRooms } from "utils/misc-utils";

const minCredits = 10000;
const minTradeCreditAmount = 200;
const maxTradeAmount = 500;
const maxTransferSize = 5000;

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
        this.getResource(terminal.store, i) > this.getResource(desiredStocks, i) * 15 &&
        this.getResource(terminal.store, i) > 300
    ) as ResourceConstant | undefined;

    const underSupply = buyableElements.find(
      i => this.getResource(terminal.store, i) < this.getResource(desiredStocks, i) / 5
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

    // buying is disabled

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
    const bestOrder = _.sortBy(buyOrders, i => -1 * i.price)[0];

    if (buyOrders.length >= 5 && bestOrder.price > 0.05) {
      // we need at least 5 orders
      // take the most interesting one
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
    let returns = -1;
    const myRooms = getMyRooms().filter(i => i.controller && i.terminal);
    if (myRooms.length < 2) {
      return -1;
    }
    const allResourcesKeys = _.uniq(
      _.flatten(
        myRooms.map(room => {
          const terminal = room.terminal as StructureTerminal;
          return Object.keys(terminal.store).filter(i => (terminal.store as any)[i] > 1000);
        })
      )
    ).filter(i => i !== "energy");

    const allResources = _.flatten(
      myRooms.map(room => {
        const terminal = room.terminal as StructureTerminal;

        const resources = allResourcesKeys.map(res => ({
          resource: res,
          amount: (terminal.store as any)[res as any] || 0,
          room: room,
          terminalReady: !terminal.cooldown
        }));
        return resources;
      })
    );

    const groups = _.groupBy(allResources, i => i.resource);

    for (let resourceType in groups) {
      const resources = groups[resourceType];
      const orderedLowest = _.sortBy(resources, i => i.amount);
      const orderedHighest = _.sortBy(resources.filter(i => i.terminalReady), i => -1 * i.amount);
      const lowest = orderedLowest[0];
      const highest = orderedHighest[0];

      if (highest.amount > lowest.amount * 2) {
        const sourceTerminal = highest.room.terminal as StructureTerminal;
        const amountToSend = Math.min((highest.amount - lowest.amount) / 4, maxTransferSize);
        console.log("Sending", amountToSend, resourceType, "from", highest.room.name, "to", lowest.room.name);
        const sendResult = sourceTerminal.send(resourceType as ResourceConstant, amountToSend, lowest.room.name);
        returns = returns === OK || sendResult === OK ? OK : -1;
      }
    }
    return returns;
  }

  static transferExcessiveEnergy(): number {
    const myRooms = getMyRooms().filter(i => i.controller && i.terminal && i.storage);
    if (myRooms.length < 2) {
      return -1;
    }

    const energies = myRooms.map(room => {
      const storage = room.storage as StructureStorage;
      const terminal = room.terminal as StructureTerminal;

      return {
        amount: storage.store.energy + terminal.store.energy,
        room: room,
        terminalReady: !terminal.cooldown && terminal.store.energy > desiredEnergyInTerminal / 2
      };
    });

    const orderedLowest = _.sortBy(energies, i => i.amount);
    const orderedHighest = _.sortBy(energies.filter(i => i.terminalReady), i => -1 * i.amount);
    const lowest = orderedLowest[0];
    const highest = orderedHighest[0];

    if (highest.amount > lowest.amount + 100000) {
      const sourceTerminal = highest.room.terminal as StructureTerminal;
      const amountToSend = Math.min((highest.amount - lowest.amount) / 4, maxTransferSize);
      console.log("Sending", amountToSend, "energy", "from", highest.room.name, "to", lowest.room.name);
      return sourceTerminal.send("energy" as ResourceConstant, amountToSend, lowest.room.name);
    } else {
      return -1;
    }
  }

  static runForAllRooms() {
    if (Game.time % (TERMINAL_COOLDOWN * 2) > 0) {
      return;
    }

    let transferResult = Merchant.transferExcessiveEnergy();
    if (transferResult === OK) {
      return;
    }
    transferResult = Merchant.transferExcessiveResources();
    if (transferResult === OK) {
      return;
    }

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
