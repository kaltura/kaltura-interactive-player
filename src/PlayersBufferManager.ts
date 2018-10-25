import { Dispatcher } from "./helpers/Dispatcher";
import { PlayersFactory } from "./PlayersFactory";

export interface PlayerElement {
  entryId: string;
  player: any;
  readyFunc?: (entryId: string) => string;
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
function getPlayerDivId() {}
export class PlayersBufferManager extends Dispatcher {
  readonly SECONDS_TO_BUFFER: number = 6;
  private BUFFER_CHECK_INTERVAL: number = 100;
  private BUFFER_DONE_TIMEOUT: number = 100;
  private players: any[] = [];
  private cachingPlayers: string[] = [];

  constructor(private playersFactory: PlayersFactory) {
    super();
  }

  /**
   * Look if there is a relevant player that was created already
   * @param entryId
   */
  getPlayer(entryId: string): any | null {
    // look if there is a player with this entry-id
    const currentPlayerEl = this.getPlayerByEntryId(entryId);
    if (currentPlayerEl) {
      return currentPlayerEl.player;
    }
    return null;
  }

  public getPlayerDivId(entryId: string): string {
    return this.playersFactory.raptProjectId + "__" + entryId;
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
      entryId: entryId,
      player: newPlayer,
      readyFunc
    };
    this.players.push(playerElement);
    this.checkIfBuffered(newPlayer, entryId => {
      // call the function
      const playerEl = this.getPlayerByEntryId(entryId);
      if (playerEl && playerEl.readyFunc) {
        playerEl.readyFunc(entryId);
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
  private checkIfBuffered(
    bufferPlayer: any,
    callback: (entryId: string) => void
  ) {
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
  purgePlayers(entryId: string) {
    this.cachingPlayers = [];
  }

  /**
   * The function starts to load the next players in cache-mode by the order of the array
   * @param entries
   */
  prepareNext(entries: string[]) {
    this.cachingPlayers = entries;
    this.cacheNextPlayer();
  }

  cacheNextPlayer() {
    if (this.cachingPlayers.length) {
      const entryToCache = this.cachingPlayers.shift();
      this.createPlayer(entryToCache, false, () => {
        this.cacheNextPlayer();
      });
    } else {
      // done caching ! notify
      console.log(">>>>> DONE CACHING ALL");
      this.dispatch({ type: BufferEvent.ALL_BUFFERED });
    }
  }

  getPlayerByEntryId(entryId: string): PlayerElement | null {
    const player: PlayerElement = this.players.find(
      (pl: PlayerElement) => pl.entryId === entryId
    );
    if (player) {
      return player;
    }
    return null;
  }

  destroyPlayer(entryId: string) {
    const playerEl: PlayerElement = this.getPlayerByEntryId(entryId);
    if (playerEl) {
      // destroy the player
      playerEl.player.destroy();
      // remove from DOM
      this.playersFactory.mainDiv
        .querySelector("[id='" + this.getPlayerDivId(entryId) + "']")
        .remove();
    }
  }
}