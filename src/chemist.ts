import { REAGENTS } from "constants/resources";

export const wantedStockAmounts: { [key: string]: number } = {
  UH: 0, // (+100 % attack)
  KO: 0, // (+100 % ranged attack)
  XGHO2: 0, // For toughness
  XLHO2: 0, // For healing
  XZHO2: 0, // For speed
  XZH2O: 0, // For dismantling
  XKHO2: 0, // For ranged attackers
  XUH2O: 0, // For attacking
  G: 0, // For nukes
  XLH2O: 0, // For repair (or build)
  LH: 0, // (+50 % build and repair)
  XUHO2: 0, // For harvest
  XKH2O: 0, // For carry
  XGH2O: 0, // For upgraders
  LO: 1000
};

interface ReactionQueue {
  target: MineralConstant;
  source1: MineralConstant;
  source2: MineralConstant;
  amount: number;
}

class Chemist {
  run(room: Room) {}

  getReactionQueue(mineral: MineralConstant, amount: number) {
      const [source1, source2] : this.getIngredients()
      return {

      }
  }

  getIngredients(mineral: MineralConstant) {
    return REAGENTS[mineral];
  }
}

export const chemist = new Chemist();
