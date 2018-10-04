import INode from "./INode";
import { BufferState } from "../helpers/States";

/**
 * id: rapt id
 * node: rapt node raw data
 * status: init,caching,ready,error
 * player: the actual player instance
 */
export default interface ICachingPlayer {
  id: string; // rapt id
  node: INode; // rapt node raw data
  status: BufferState; // init,caching,ready,error
  player?: any; // the actual player
}
