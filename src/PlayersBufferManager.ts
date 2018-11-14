import { Dispatcher } from "./helpers/Dispatcher";
import { KalturaPlayer, PlayersFactory } from "./PlayersFactory";
import { Persistency, RaptNode } from "./PlayersManager";
import { log } from "./helpers/logger";

interface BufferItem {
  player: KalturaPlayer;
  isReady: boolean;
  isRunning: boolean;
  bufferingTimeoutToken: number;
  entryId: string;
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
  private shortEntryThreshold: number = 6;
  private secondsToBuffer: number = 6;
  private bufferList: BufferItem[] = [];
  private persistenceObj: {
    rate?: number;
    captions?: string;
    volume?: number;
    audio?: string;
  } = {};
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
  public getPlayer(entryId: string, playImmediate: boolean): KalturaPlayer {
    log("log", "pbm_getPlayer", "executed", { entryId, playImmediate });
    if (!this._isAvailable) {
      throw new Error("BufferManager is not available");
    }

    let result: KalturaPlayer;
    let bufferedItem = this.bufferList.find(item => item.entryId === entryId);

    if (bufferedItem) {
      if (bufferedItem.player) {
        log("log", "pbm_getPlayer", "found player in buffer list", { entryId });
        result = bufferedItem.player;

        if (result.player.currentTime > 0) {
          log("log", "pbm_getPlayer", "seek player to the beginning", {
            entryId
          });
          result.player.currentTime = 0;
        }

        // TODO [eitan] for persistancy - assign only synced persistancy

        if (playImmediate && !result.player.isPlaying) {
          log("log", "pbm_getPlayer", "execute play command", { entryId });
          result.player.play();
        }
      } else {
        log(
          "log",
          "pbm_getPlayer",
          "player buffered in pending mode, create player",
          { entryId, trackBuffer: playImmediate }
        );
        bufferedItem.player = this.createPlayer(entryId, playImmediate);
        if (playImmediate) {
          this.trackBufferOfItem(bufferedItem);
        }
        result = bufferedItem.player;
      }
    } else {
      log(
        "log",
        "pbm_getPlayer",
        "not found in buffer list, create player for entry",
        { entryId }
      );
      result = this.createPlayer(entryId, playImmediate);

      const newItem = {
        entryId: entryId,
        player: result,
        isRunning: playImmediate,
        bufferingTimeoutToken: null,
        isReady: false
      };

      this.bufferList.push(newItem);

      if (playImmediate) {
        this.trackBufferOfItem(newItem);
      }
    }

    return result;
  }

  public isAvailable(): boolean {
    return this._isAvailable;
  }

  public disable(): void {
    this._isAvailable = false;
  }

  private createPlayer(entryId: string, playImmediate: boolean): KalturaPlayer {
    log("log", "pbm_createPlayer", "create player for entry", {
      entryId,
      playImmediate
    });

    // TODO [eitan] for persistancy - apply async info

    const kalturaPlayer = this.playersFactory.createPlayer(
      entryId,
      playImmediate,
      this.persistenceObj
    );
    return kalturaPlayer;
  }

  public switchPlayer(nextNode?: RaptNode) {
    if (!this._isAvailable) {
      log(
        "warn",
        "pbm_switchPlayer",
        "buffer manager is disabled, ignore switch player request"
      );
      return;
    }

    if (nextNode) {
      const nodesToBuffer = [nextNode, ...this.getNextNodes(nextNode)];
      const prevItemsMap = this.bufferList.reduce((acc, item) => {
        acc[item.entryId] = item;
        return acc;
      }, {});
      const prevItemsCount = this.bufferList.length;

      this.bufferList = [];

      log("log", "pbm_switchPlayer", "rebuliding buffer list", {
        prevCount: prevItemsCount,
        newCount: nodesToBuffer.length
      });
      nodesToBuffer.forEach(node => {
        const existinItem = prevItemsMap[node.entryId];
        if (existinItem) {
          log(
            "log",
            "pbm_switchPlayer",
            "entry id was in previous buffer list, copy to current list",
            { entryId: node.entryId }
          );
          this.bufferList.push(existinItem);
          delete prevItemsMap[node.entryId];
        } else {
          log("log", "pbm_switchPlayer", "add entry to buffer queue", {
            entryId: node.entryId
          });
          this.bufferList.push({
            entryId: node.entryId,
            player: null,
            isRunning: false,
            bufferingTimeoutToken: null,
            isReady: false
          });
        }
      });
      this.destroyBufferedItems(Object.values(prevItemsMap));
    } else {
      this.destroyBufferedItems(this.bufferList);
    }
    this.handleBufferList();
  }

  private handleBufferList(): void {
    log("log", "pbm_handleBufferList", "executed");
    const allReady =
      this.bufferList.length === 0 ||
      this.bufferList.every(item => item.isReady);
    if (allReady) {
      log("log", "pbm_handleBufferList", "all items are buffered", {
        count: this.bufferList.length
      });
      this.dispatch({
        type: BufferEvent.ALL_BUFFERED
      });
      return;
    }

    const isSomeoneBuffering = this.bufferList.some(item => item.isRunning);
    // check if need to buffer an item (has items, no one is running and someone is not ready)
    if (!isSomeoneBuffering) {
      // find the 1st item on the list that is not buffering (list is ordered)
      const unbufferedItem = this.bufferList.find(item => !item.isReady);
      log("log", "pbm_handleBufferList", "start track item", {
        entryId: unbufferedItem.entryId
      });
      this.executeItemBuffering(unbufferedItem);
    } else {
      log(
        "log",
        "pbm_handleBufferList",
        "an item is already in buffer mode, nothing to do"
      );
    }
  }

  private trackBufferOfItem(item: BufferItem) {
    item.isRunning = true;
    item.bufferingTimeoutToken = setTimeout(
      this.executeItemBuffering.bind(this, item),
      200
    );
  }
  private executeItemBuffering(item: BufferItem): void {
    item.bufferingTimeoutToken = null;

    if (!item.isRunning) {
      log("log", "pbm_executeItemBuffering", "start buffering entry", {
        entryId: item.entryId
      });

      item.player = this.createPlayer(item.entryId, false);
      this.trackBufferOfItem(item);
    } else {
      // has player ! find if we have duration
      const player = item.player.player;
      if (
        player.duration &&
        player.duration !== NaN &&
        player.duration < this.shortEntryThreshold
      ) {
        log(
          "log",
          "pbm_executeItemBuffering",
          "buffered not needed, mark entry as ready",
          { entryId: item.entryId }
        );
        item.isReady = true;
        item.isRunning = false;
        this.handleBufferList();
      } else if (
        item.isRunning &&
        player.buffered &&
        player.buffered.length &&
        player.buffered.end &&
        player.buffered.end(0) > this.secondsToBuffer - 1
      ) {
        log(
          "log",
          "pbm_executeItemBuffering",
          "buffer completed, mark entry as ready",
          { entryId: item.entryId }
        );
        item.isRunning = false;
        item.isReady = true;
        this.handleBufferList();
      } else {
        this.trackBufferOfItem(item);
      }
    }

    // if has not running -> set running, create player and set a timeout on that item which will execute executeItemBuffering(item)
    // if item is too short => set is ready and reexecute handlebufferlist
    // if running -> check if ready mark as is ready and not running, and execute handleBufferList, otherwise, reset timeout
  }
  /**
   * Clear all current players (but the players that are relevant for next node)
   * @param nextNode
   */
  private destroyBufferedItems(items: BufferItem[]) {
    log("log", "pbm_destroyBufferedItems", "executed", {
      entries: items.map(item => item.entryId)
    });
    items.forEach(item => {
      if (item.player) {
        log(
          "log",
          "pbm_destroyBufferedItems",
          "remove entry from buffer queue",
          { entryId: item.entryId }
        );
        this.dispatch({
          type: BufferEvent.DESTROYING,
          payload: { entryId: item.entryId }
        });
        item.player.destroy();
        this.dispatch({
          type: BufferEvent.DESTROYED,
          payload: { entryId: item.entryId }
        });
      }

      if (item.bufferingTimeoutToken) {
        log(
          "log",
          "pbm_destroyBufferedItems",
          "cancel running buffer for entry",
          { entryId: item.entryId }
        );
        clearTimeout(item.bufferingTimeoutToken);
      }
    });
  }

  public applyToPlayers(arg) {
    // TODO [eitan] for persistancy
    // store new persistance info
    // if changing async info
    // 3. re-run buffering logic
    //
    // if a-synced issue,
  }

  public syncPlayersStatus(
    attribute: Persistency,
    value: number | string,
    currentPlayer: any
  ) {
    log("log", "pbm_applyToPlayers", "executed", {
      attribute,
      value,
      currentPlayer
    });
    // store to local
    this.persistenceObj[attribute] = value;

    const availablePlayers = this.bufferList
      .filter(item => item.player)
      .map(item => item.player);

    //if (attribute === Persistency.audioTrack) {
    // handle async if necessary

    // 1. cancel active buffering (except for the active)
    // 2. for all players in buffer list which are not the active one:
    // 2.1 revoke them (remove player and set isReady to false) <--- relevant only if once changing audio etc the player starts to buffer automatically
    // 2.2 apply async information

    //return;
    //}

    availablePlayers.forEach(kalturaPlayer => {
      const player: any = kalturaPlayer.player;
      switch (attribute) {
        case Persistency.captions:
          // iterate all buffered players
          const textTracks = player.getTracks(
            this.playersFactory.playerLibrary.core.TrackType.TEXT
          );
          const textTrack = textTracks.find(
            track => track.language === this.persistenceObj.captions
          );
          if (textTrack) {
            player.selectTrack(textTrack);
          }
          break;

        case Persistency.audioTrack:
          // iterate all buffered players
          const audioTracks = player.getTracks(
            this.playersFactory.playerLibrary.core.TrackType.AUDIO
          );
          const audioTrack = audioTracks.find(
            track => track.language === this.persistenceObj.audio
          );
          if (audioTrack) {
            player.selectTrack(audioTrack);
          }
          break;

        case Persistency.rate:
          player.playbackRate = this.persistenceObj.rate;
          break;
        case Persistency.volume:
          player.volume = this.persistenceObj.volume;
          break;
      }
    });
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
