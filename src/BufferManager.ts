import { Dispatcher } from "./helpers/Dispatcher";
import { KipFullscreen } from "./helpers/KipEvents";
import { PlaybackPreset } from "./ui/PlaybackPreset";
import { RaptConfig } from "./Kip";
import { RaptNode } from "./PlayersManager";
import { BufferState, CachePlayer } from "./CachePlayer";

export const BufferEvent = {
  BUFFERING: "buffering", // buffered a specific entry - argument will be the entry id
  DESTROYING: "destroying", // about to destroy a specific player - argument will be the entry id
  DESTROYED: "destroyed", // done with destroying a specific player - argument will be the entry id
  DONE_BUFFERING: "doneBuffering", // Done buffering a specific entry - argument will be the entry id
  CATCHUP: "catchup", // When an unbuffered video was requested to play is loaded and first played
  ALL_BUFFERED: "allBuffered", // Done buffering all relevant entries of a given node argument will be the node entry id
  ALL_UNBUFFERED: "allUnbuffered" // when no need to buffer use this event to declare of readiness of players.
};

/**
 * This class is in charge of the creation of all players, and to handle their statuses (init,caching,ready)
 */

export class BufferManager extends Dispatcher {
  private players: CachePlayer[];
  readonly shouldBufferVideos: boolean;
  private currentNode: RaptNode;
  readonly playbackPreset: any;
  readonly SECONDS_TO_BUFFER: number = 6;
  private BUFFER_CHECK_INTERVAL: number = 100;
  private BUFFER_DONE_TIMEOUT: number = 100;

  constructor(
    private playerLibrary: any,
    private playersContainer: HTMLElement,
    private raptProjectId: string,
    private config: any,
    private raptData: any
  ) {
    super();
    this.shouldBufferVideos = config.rapt.hasOwnProperty("bufferNextNodes")
      ? config.rapt.bufferNextNodes
      : true;

    if (config.rapt.bufferTime) {
      this.SECONDS_TO_BUFFER = config.rapt.bufferTime;
    }
    this.players = [];
    // UI intervention: remove the original fullscreen and replace with a local FS // TODO - function, no need for class
    this.playbackPreset = new PlaybackPreset(
      this.playerLibrary.ui.h,
      this.playerLibrary.ui.Components,
      () => this.toggleFullscreen()
    ).preset;
  }

  // User had clicked on a player that was not cached yet. Make this player load its content immediately and notify
  // the player manager when it is played
  playImmediate(cachingPlayer: CachePlayer): void {
    const node: RaptNode = cachingPlayer.node;
    const nodeDiv: HTMLElement = this.createNodesDiv(node);
    let nodeConf: any = this.getPlayerConf(node, nodeDiv.id);
    // autoplay !
    nodeConf.playback.autoplay = true;
    const player = this.playerLibrary.setup(nodeConf);
    player.loadMedia({ entryId: node.entryId });
    cachingPlayer.status = BufferState.caching;
    cachingPlayer.player = player;
    // when buffered and played - notify
    this.checkIfBuffered(player, (entryId: string) => {
      this.dispatch({ type: BufferEvent.CATCHUP, payload: cachingPlayer });
    });
  }

  toggleFullscreen(): void {
    this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
  }

  /**
   * Load a player by rapt node, once buffered call the callback function. Also, once done, start caching the
   * next items.
   * @param node
   * @param callback
   */
  init(node: RaptNode, callback: () => void = null): any {
    const nodeDiv: HTMLElement = this.createNodesDiv(node);
    const nodeConf: object = this.getPlayerConf(node, nodeDiv.id);
    const player = this.playerLibrary.setup(nodeConf);

    // with 1st node we do not want to start caching other nodes. First get playback, then start caching other nodes
    player.loadMedia({ entryId: node.entryId });

    // store the player
    this.players.push(
      new CachePlayer(node.id, node, BufferState.caching, player)
    );

    this.checkIfBuffered(player, (entryId: string) => {
      // cache next entries;
      if (callback) {
        callback();
      }
      const firstPlayer: CachePlayer | false = this.getPlayerByKalturaId(
        node.entryId
      );
      if (firstPlayer) {
        firstPlayer.status = BufferState.ready;
      }
      this.cacheNodes(node);
    });
    return player;
  }

  /**
   * Stop the current buffering player, unless it is the one that was requested to play.
   * @param nodeToPlay
   */
  stopCurrentCachedPlayer(nodeToPlay: RaptNode) {
    const cachingNow: CachePlayer = this.players.find(
      (player: CachePlayer) => player.status === BufferState.caching
    );
    if (cachingNow && cachingNow.player && cachingNow.id !== nodeToPlay.id) {
      cachingNow.player.destroy();
      cachingNow.player = null;
      cachingNow.status = BufferState.init;
    }
  }

  /**
   * Create relevant players from a given rapt node, order them by importance/appearance-time and
   * start cache them one-by-one according to the order.
   * @param currentNode
   */
  cacheNodes(currentNode: RaptNode) {
    // in case there is a caching player - stop caching it.
    this.stopCurrentCachedPlayer(currentNode);
    this.currentNode = currentNode;
    let nodes: RaptNode[] = this.getNextNodes(currentNode);

    // optimization 1 - find items that are cached/created but not relevant for this current node and destroy them

    // helper - extract the nodes from the currentPlayers
    const currentPlayersNodes: RaptNode[] = this.players.map(
      (cachePlayer: CachePlayer) => cachePlayer.node
    );
    // find which nodes we want to destroy (nodes that do not belong to this node options)
    let nodesToDestroy = currentPlayersNodes.filter(
      (node: RaptNode) => !nodes.find((tmp: RaptNode) => node.id === tmp.id)
    );
    // ignore the current node if it is in the 'to-destroy' array
    nodesToDestroy = nodesToDestroy.filter(
      (node: RaptNode) => node.id !== currentNode.id
    );
    // Now destroy them
    for (const nodeToDestroy of nodesToDestroy) {
      this.destroyPlayer(nodeToDestroy);
    }

    // TODO - do we need this?
    // remove the current node from the next nodes to cache - it is playing and no need to cache it
    // nodes = nodes.filter((node: Node) => node.id === currentNode.id);

    // Optimization 2 - re-order nodes, depending appearance time
    nodes = this.sortByApearenceTime(nodes, currentNode);
    // store the nodes in case they are not stored yet
    for (const node of nodes) {
      // cache new players only
      if (!this.players.find((item: CachePlayer) => item.id === node.id)) {
        // use Rapt id as a key since we might have kaltura-entry in different rapt nodes

        this.players.push(new CachePlayer(node.id, node, BufferState.init));
      } else {
        // if we got here - the player for this node was already created
        const existingPlayer: CachePlayer | null = this.getPlayerByKalturaId(
          node.entryId
        );
        if (
          existingPlayer &&
          existingPlayer.player &&
          existingPlayer.player.currentTime
        ) {
          existingPlayer.player.currentTime = 0;
        }
      }
    }
    // in case of a non-caching use-case, just notify of 'all-unbuffered'
    if (!this.shouldBufferVideos) {
      this.dispatch({
        type: BufferEvent.ALL_UNBUFFERED,
        payload: this.currentNode.name
      });
      return;
    }
    this.cacheNextPlayer();
  }

  /**
   * Sort a given nodes-array by the appearance-order of the hotspots in that node
   * @param arr of Nodes
   * @param givenNode
   */
  sortByApearenceTime(arr: RaptNode[], givenNode: RaptNode): RaptNode[] {
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
    return arrayToCache;
  }

  /**
   * From current session - find if there is an unbuffered node, if so - create it and start caching it
   */
  cacheNextPlayer() {
    // find first un-cached
    let nextUnbufferedPlayer: CachePlayer = this.players.find(
      (item: CachePlayer) => item.status === BufferState.init
    );
    if (nextUnbufferedPlayer) {
      // found one - add it and start caching it. Notify PlayerManager of this
      this.dispatch({
        type: BufferEvent.BUFFERING,
        payload: nextUnbufferedPlayer.node.name
      });
      // update status of current player
      nextUnbufferedPlayer.status = BufferState.caching;
      // create player and cache it
      this.cachePlayer(nextUnbufferedPlayer);
    } else {
      // no more unbuffered players - we must be done
      this.dispatch({
        type: BufferEvent.ALL_BUFFERED,
        payload: this.currentNode.name
      });
    }
  }

  /**
   * Load a specific player per-node in "cache" mode
   * @param node
   */
  cachePlayer(player: CachePlayer): void {
    const nodesDiv: HTMLElement = this.createNodesDiv(player.node, true);
    const conf: object = this.getPlayerConf(player.node, nodesDiv.id, true);
    const newPlayer = this.playerLibrary.setup(conf);
    player.player = newPlayer; // save so we have reference later
    this.checkIfBuffered(newPlayer, (entryId: string) => {
      const finished: CachePlayer = this.players.find(
        (item: CachePlayer) => item.node.entryId === entryId
      );
      finished.status = BufferState.ready;
      this.dispatch({
        type: BufferEvent.DONE_BUFFERING,
        payload: finished.node.name
      });
      this.cacheNextPlayer();
    });
    newPlayer.loadMedia({ entryId: player.node.entryId });
  }

  /**
   * Check if the current content of bufferPlayer was loaded;
   * @param callback
   * @param bufferPlayer
   */
  checkIfBuffered(bufferPlayer: any, callback: (entryId: string) => void) {
    // todo - remove once optomize buffer
    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end
    ) {
      //console.log(">>>>>", bufferPlayer.buffered.end(0));
    }

    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end &&
      bufferPlayer.buffered.end(0) > this.SECONDS_TO_BUFFER - 1
    ) {
      setTimeout(() => {
        if (
          bufferPlayer._config &&
          bufferPlayer._config.sources &&
          bufferPlayer._config.sources.id
        )
          callback(bufferPlayer._config.sources.id); // optimize later
      }, this.BUFFER_DONE_TIMEOUT);
    } else {
      // not buffered yet - check again
      setTimeout(() => {
        this.checkIfBuffered(callback, bufferPlayer);
      }, this.BUFFER_CHECK_INTERVAL);
    }
  }

  /**
   * Creates a unique div per node by the node entryId. Concat it's name to the playlist-id so it will allow to embed
   * 2 different rapt projects on the same page.
   * @param node
   */
  createNodesDiv(node: RaptNode, isCachePlayer: boolean = false): HTMLElement {
    const newDiv = document.createElement("div");
    newDiv.setAttribute("id", this.raptProjectId + "__" + node.entryId);
    if (isCachePlayer) {
      newDiv.setAttribute("class", "kiv-player kiv-cache-player");
    } else {
      // first player
      newDiv.setAttribute("class", "kiv-player current-playing");
    }
    this.playersContainer.appendChild(newDiv);
    return newDiv;
  }

  /**
   * Extract the player configuration from the KIV generic config: remove the rapt element and add specific target id
   * @param raptNode
   * @param targetName
   * @param cache - if set to true, the config will use autoPlay=false and preload=true;
   */
  getPlayerConf(
    raptNode: any,
    targetName: string,
    isCache: boolean = false
  ): object {
    let newConf: RaptConfig = Object.assign({}, this.config);
    newConf.targetId = targetName;
    if (isCache) {
      newConf.playback = {
        autoplay: false,
        preload: "auto",
        options: {
          html5: {
            hls: {
              maxMaxBufferLength: this.SECONDS_TO_BUFFER
            }
          }
        }
      };
    }
    try {
      let uis = [
        {
          template: props => this.playbackPreset(props)
        }
      ];
      newConf.ui = { customPreset: uis };
    } catch (e) {
      alert();
    }
    delete newConf.rapt;
    return newConf;
  }

  /**
   * Retreive a player by its Kaltura entry id
   * @param entryId
   */
  getPlayerByKalturaId(entryId: string): CachePlayer | null {
    const cachePlayer: CachePlayer = this.players.find(
      (item: CachePlayer) => item.node.entryId === entryId
    );
    if (!cachePlayer) {
      return null;
      // couldn't find a player by this entryId - return null
    }
    return cachePlayer;
  }

  /**
   * Get optional playable nodes of a given node
   * @param node
   */
  getNextNodes(node: RaptNode): RaptNode[] {
    let nodes: RaptNode[] = node.prefetchNodeIds.length
      ? node.prefetchNodeIds.map((nodeId: string) =>
          this.getNodeByRaptId(nodeId)
        )
      : [];
    // remove duplicities in case of defaultPath
    return [...new Set(nodes)];
  }

  /**
   * Return a rapt node
   * @param id
   */
  getNodeByRaptId(id: string): RaptNode {
    const nodes: RaptNode[] = this.raptData.nodes;
    return nodes.find((item: RaptNode) => item.id === id);
  }

  /**
   * Destroy a player and remove it from the players list
   * @param node
   */
  destroyPlayer(node: RaptNode): void {
    this.dispatch({ type: BufferEvent.DESTROYING, payload: node.name });
    const cachingPlayer: CachePlayer = this.getPlayerByKalturaId(node.entryId);
    if (!cachingPlayer) {
      return;
    }
    // if a player was already created for this entry - destroy it.
    if (cachingPlayer.player) {
      cachingPlayer.player.destroy();
      // remove the parent id
      this.playersContainer
        .querySelector(
          "[id='" + this.raptProjectId + "__" + node.entryId + "']"
        )
        .remove();
    }
    this.players = this.players.filter(
      (item: CachePlayer) => item.id !== node.id
    );
    this.dispatch({ type: BufferEvent.DESTROYED, payload: node.name });
  }
}
