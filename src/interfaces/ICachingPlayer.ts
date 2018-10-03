import INode from "./INode";

/**
 * id: rapt id
 * node: rapt node raw data
 * status: init,caching,ready,error
 * player: the actual player instance
 */
export default interface ICachingPlayer {
  id: string; // rapt id
  node: INode; // rapt node raw data
  status: string; // init,caching,ready,error
  player?: any; // the actual player
}


