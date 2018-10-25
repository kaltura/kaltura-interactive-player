import { Dispatcher } from "./helpers/Dispatcher";
import { PlayersFactory } from "./PlayersFactory";

export interface PlayerElement {
  id: string;
  player: any;
  readyFunc?: () => string;
}

export const BufferEvent = {
  BUFFERING: "buffering", // buffered a specific entry - argument will be the entry id
  DESTROYING: "destroying", // about to destroy a specific player - argument will be the entry id
  DESTROYED: "destroyed", // done with destroying a specific player - argument will be the entry id
  DONE_BUFFERING: "doneBuffering", // Done buffering a specific entry - argument will be the entry id
  CATCHUP: "catchup", // When an unbuffered video was requested to play is loaded and first played
  ALL_BUFFERED: "allBuffered", // Done buffering all relevant entries of a given node argument will be the node entry id
  ALL_UNBUFFERED: "allUnbuffered" // when no need to buffer use this event to declare of readiness of players.
};

export class PlayersBufferManager extends Dispatcher {
  readonly SECONDS_TO_BUFFER: number = 6;
  private BUFFER_CHECK_INTERVAL: number = 100;
  private BUFFER_DONE_TIMEOUT: number = 100;
  private players: any[] = [];

  constructor(private playersFactory: PlayersFactory) {
    super();
  }

  /**
   * Look if there is a relevant player that was created already
   * @param entryId
   */
  getPlayer(entryId: string): any | null {
    // look if there is a player with this entry-id
    return null;
  }

  /**
   * Create a player by the entryId. If playImmediate is set to true play it, if not - this is a cache player
   * @param entryId
   * @param playImmediate
   */
  createPlayer(
    entryId: string,
    playImmediate: boolean = false,
    readyFunc?: (data?: any) => any
  ): any {
    const newPlayer = this.playersFactory.createPlayer(entryId, playImmediate);
    // store locally
    const playerElement: PlayerElement = {
      id: entryId,
      player: newPlayer,
      readyFunc
    };
    this.players.push(playerElement);
    this.checkIfBuffered(newPlayer, entryId => {
      // call the function
      debugger;
      const playerEl = this.getPlayerByEntryId(entryId);
      if (playerEl && playerEl.readyFunc) {
        playerEl.readyFunc();
      }
      this.dispatch({ type: BufferEvent.DONE_BUFFERING, payload: entryId });
    });
    return newPlayer;
  }
  /**
   * Check if the current content of bufferPlayer was loaded;
   * @param callback
   * @param bufferPlayer
   */
  checkIfBuffered(bufferPlayer: any, callback: (entryId: string) => void) {
    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end &&
      bufferPlayer.buffered.end(0) > this.SECONDS_TO_BUFFER - 1
    ) {
      setTimeout(() => {
        if (
          bufferPlayer.config &&
          bufferPlayer.config.sources &&
          bufferPlayer.config.sources.id
        )
          callback(bufferPlayer.config.sources.id); // optimize later
      }, this.BUFFER_DONE_TIMEOUT);
    } else {
      // not buffered yet - check again
      setTimeout(() => {
        this.checkIfBuffered(callback, bufferPlayer);
      }, this.BUFFER_CHECK_INTERVAL);
    }
  }

  /**
   * Clear all current players
   * @param entryId
   */
  purgePlayers(entryId: string) {}

  prepareNext() {}

  getPlayerByEntryId(entryId: string): PlayerElement | null {
    const player: PlayerElement = this.players.find(id => id === entryId);
    if (player) {
      return player;
    }
    return null;
  }
}
