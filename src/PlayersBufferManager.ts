import { Dispatcher } from "./helpers/Dispatcher";
import { persistancy, PlayersFactory, KalturaPlayer } from "./PlayersFactory";
import { RaptNode } from "./PlayersManager";

export const BufferEvent = {
  BUFFERING: "buffering", // buffered a specific entry - argument will be the entry id
  DESTROYING: "destroying", // about to destroy a specific player - argument will be the entry id
  DESTROYED: "destroyed", // done with destroying a specific player - argument will be the entry id
  DONE_BUFFERING: "doneBuffering", // Done buffering a specific entry - argument will be the entry id
  CATCHUP: "catchup", // When an unbuffered video was requested to play is loaded and first played
  ALL_BUFFERED: "allBuffered", // Done buffering all relevant entries of a given node argument will be the node entry id
  ALL_UNBUFFERED: "allUnbuffered" // when no need to buffer use this event to declare of readiness of players.
};

export const enum PersistencyType {
  // todo - post debug - remove values
  captions = "captions",
  audioTrack = "audioTrack",
  rate = "rate",
  volume = "volume",
  quality = "quality"
}

export class PlayersBufferManager extends Dispatcher {
  readonly SECONDS_TO_BUFFER: number = 6;
  private BUFFER_CHECK_INTERVAL: number = 100;
  private BUFFER_DONE_TIMEOUT: number = 100;
  private players: { [id: string]: KalturaPlayer } = {};
  private entriesToCache: string[] = []; // array of entry-ids to cache

  // playback persistency
  private currentAudioLanguage: string = undefined;
  private currentCaptionsLanguage: string = undefined;
  private currentPlaybackRate: number = 1;
  private currentVolume: number = undefined;
  private _isAvailable: boolean;

  constructor(private raptData: any, private playersFactory: PlayersFactory) {
    super();
    this.initializeAvailablity();
  }

  private initializeAvailablity(): void {
    // prevent caching on Safari and if config set to no-cache
    const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(
      navigator.userAgent
    );

    this._isAvailable = !isSafari;
  }
  /**
   * Look if there is a relevant player that was created already
   * @param playerId
   */
  public getPlayer(playerId: string): KalturaPlayer | null {
    const result = this.players[playerId] || null;

    if (result && result.player.currentTime > 0) {
      result.player.currentTime = 0;
    }

    return result;
  }

  public isAvailable(): boolean {
    return this._isAvailable;
  }

  public disable(): void {
    this._isAvailable = false;
  }

  private createPlayer(entryId: string): KalturaPlayer {
    // TODO move persistence to PM
    let persistence: persistancy = {};
    if (this.currentPlaybackRate) {
      persistence.rate = this.currentPlaybackRate;
    }
    if (this.currentCaptionsLanguage) {
      persistence.captions = this.currentCaptionsLanguage;
    }
    if (this.currentAudioLanguage) {
      persistence.audio = this.currentAudioLanguage;
    }

    const kalturaPlayer = this.playersFactory.createPlayer(
      entryId,
      false,
      persistence
    );

    // store locally
    this.players[kalturaPlayer.id] = kalturaPlayer;

    // TODO move to dedicated service
    // this.checkIfBuffered(player, entryId => {
    //   this.dispatch({ type: BufferEvent.DONE_BUFFERING, payload: entryId });
    //   // call the function
    //   const playerEl = this.getPlayerByEntryId(entryId);
    //   if (playerEl && playerEl.readyFunc) {
    //     playerEl.readyFunc(entryId);
    //   }
    // });

    return kalturaPlayer;
  }
  /**
   * Check if the current content of bufferPlayer was loaded;
   * @param callback
   * @param bufferPlayer
   */
  public checkIfBuffered(
    bufferPlayer: any,
    callback: (entryId: string) => void
  ) {
    if (
      bufferPlayer.duration &&
      bufferPlayer.duration !== NaN &&
      bufferPlayer.duration < 7
    ) {
      // short entry - mark it as buffered
      setTimeout(() => {
        if (
          bufferPlayer.config &&
          bufferPlayer.config.sources &&
          bufferPlayer.config.sources.id
        )
          callback(bufferPlayer.getMediaInfo().entryId);
      }, this.BUFFER_DONE_TIMEOUT);
      return;
    }
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
          callback(bufferPlayer.getMediaInfo().entryId);
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
   * @param exceptList
   */
  public purgePlayers(nextNode?: RaptNode) {
    // purge players from bufferManager
    const exceptList = nextNode
      ? this.getNextNodes(nextNode).map(node => node.entryId)
      : [];

    const existingPlayerIds = Object.keys(this.players);
    for (let playerId of existingPlayerIds) {
      const player = this.players[playerId];
      if (exceptList.indexOf(playerId) === -1) {
        this.dispatch({ type: BufferEvent.DESTROYING, payload: player.id });
        player.destroy();
        delete this.players[playerId];
        this.dispatch({ type: BufferEvent.DESTROYED, payload: player.id });
      }
    }

    this.entriesToCache = [];
  }

  /**
   * The function starts to load the next players in cache-mode by the order of the array
   * @param entries
   */
  public prepareNext(entries: string[] = []) {
    // optimize - no-point of caching a player if it is already cached.
    this.entriesToCache = entries.filter(
      (entryId, i, all) => !!this.players[entryId] && i === all.indexOf(entryId)
    );

    this.cacheNextPlayer();
  }

  applyToPlayers(
    attribute: PersistencyType,
    value: number | string,
    currentPlayer: any
  ) {
    // switch (attribute) {
    //   case PersistencyType.captions:
    //     // iterate all buffered players
    //     this.currentCaptionsLanguage = value.toString();
    //     for (const playerElement of this.players) {
    //       if (playerElement.player === currentPlayer) {
    //         // no need to apply to the current player - if we do we get to infinity loop
    //         continue;
    //       }
    //       const textTracks = playerElement.player.getTracks(
    //         this.playersFactory.playerLibrary.core.TrackType.TEXT
    //       );
    //       const textTrack = textTracks.find(
    //         track => track.language === this.currentCaptionsLanguage
    //       );
    //       if (textTrack) {
    //         playerElement.player.selectTrack(textTrack);
    //       }
    //     }
    //     break;
    //   case PersistencyType.audioTrack:
    //     // iterate all buffered players
    //     this.currentAudioLanguage = value.toString();
    //     for (const playerElement of this.players) {
    //       if (playerElement.player === currentPlayer) {
    //         // no need to apply to the current player - if we do we get to infinity loop
    //         continue;
    //       }
    //       const audioTracks = playerElement.player.getTracks(
    //         this.playersFactory.playerLibrary.core.TrackType.AUDIO
    //       );
    //       const audioTrack = audioTracks.find(
    //         track => track.language === this.currentCaptionsLanguage
    //       );
    //       if (audioTrack) {
    //         playerElement.player.selectTrack(audioTrack);
    //       }
    //     }
    //     break;
    //   case PersistencyType.rate:
    //     this.currentPlaybackRate = Number(value);
    //     for (const playerElement of this.players) {
    //       if (playerElement.player === currentPlayer) {
    //         // no need to apply to the current player - if we do we get to infinity loop
    //         continue;
    //       }
    //       playerElement.player.playbackRate = this.currentPlaybackRate;
    //     }
    //     break;
    //   case PersistencyType.volume:
    //     this.currentVolume = currentPlayer.volume;
    //     for (const playerElement of this.players) {
    //       if (playerElement.player === currentPlayer) {
    //         // no need to apply to the current player - if we do we get to infinity loop
    //         continue;
    //       }
    //       playerElement.player.volume = this.currentVolume;
    //     }
    //     break;
    //   case PersistencyType.quality:
    //     // todo - consult product if we want to implement this
    //     break;
    // }
  }

  /**
   * Grab the next player from this.cachingPlayers and cache it. if this.cachingPlayers is empty we are done caching
   */
  private cacheNextPlayer() {
    if (this.entriesToCache.length) {
      const nextEntryId = this.entriesToCache.shift();
      const newPlayer = this.createPlayer(nextEntryId);
      this.players[newPlayer.id] = newPlayer;
    } else {
      // done caching ! notify
      this.dispatch({ type: BufferEvent.ALL_BUFFERED });
    }
  }

  /**
   * Get a list of optional nodes for the given node
   *  @param node
   */
  private getNextNodes(node: RaptNode): RaptNode[] {
    let nodes: RaptNode[] = node.prefetchNodeIds.length
      ? node.prefetchNodeIds.map((nodeId: string) =>
          this.getNodeByRaptId(nodeId)
        )
      : [];
    // at this point we have a list of next nodes without default-path and without order according to appearance time
    nodes = this.sortByApearenceTime(nodes, node);
    return nodes;
  }

  /**
   * Return a rapt node
   * @param id
   */
  private getNodeByRaptId(id: string): RaptNode {
    const nodes: RaptNode[] = this.raptData.nodes;
    return nodes.find((item: RaptNode) => item.id === id);
  }

  /**
   * Sort a given nodes-array by the appearance-order of the hotspots in that node
   * @param arr of Nodes
   * @param givenNode
   */
  private sortByApearenceTime(
    arr: RaptNode[],
    givenNode: RaptNode
  ): RaptNode[] {
    // get relevant hotspots (that has the givenNode as 'nodeId' ) and sort them by their showAt time
    const hotspots: any[] = this.raptData.hotspots
      .filter((hotSpot: any) => {
        return (
          hotSpot.nodeId === givenNode.id &&
          hotSpot.onClick &&
          hotSpot.onClick.find((itm: any) => itm.type === "project:jump") // filter out only-URL clicks
        );
      })
      .sort((a: any, b: any) => a.showAt > b.showAt); // sort by appearance time

    const arrayToCache: RaptNode[] = [];
    for (const hotSpot of hotspots) {
      arrayToCache.push(
        arr.find((itm: RaptNode) => {
          // extract the onClick element with type 'project:jump'
          const clickItem: any = hotSpot.onClick.find(
            (itm: any) => itm.type === "project:jump"
          );
          return clickItem.payload.destination === itm.id;
        })
      );
    }
    // if there was a default-path on the current node - make sure it is returned as well
    const defaultPath: any = givenNode.onEnded.find(
      (itm: any) => itm.type === "project:jump"
    );
    if (defaultPath) {
      const defaultPathNodeId: string = defaultPath.payload.destination;
      const defaultPathNode: RaptNode = this.raptData.nodes.find(
        n => n.id === defaultPathNodeId
      );
      arrayToCache.push(defaultPathNode);
    }
    return arrayToCache;
  }
}
