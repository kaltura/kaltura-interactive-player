import { Dispatcher } from "./helpers/Dispatcher";
import { BufferState } from "./helpers/States";

export class BufferManager extends Dispatcher {
  players: [];

  constructor() {
    super();
    this.players = [];
  }

  bufferPlayer() {
    //this.dispatch(BufferState.CACHING, { a: 2 });
  }
}
