import { Dispatcher } from "./helpers/Dispatcher";
import INode from "./interfaces/INode";
import IRaptConfig from "./interfaces/IRaptConfig";
import { BufferState } from "./helpers/States";
import { BufferEvent, KipFullscreen } from "./helpers/KipEvents";
import ICachingPlayer from "./interfaces/ICachingPlayer";
import { PlaybackPreset } from "./ui/PlaybackPreset";

/**
 * This class is in charge of the creation of all players, and to handle their statuses (init,caching,ready)
 */

export class BufferManager extends Dispatcher {
  players: ICachingPlayer[];
  playerLibrary: any;
  playersContainer: HTMLElement;
  raptProjectId: string;
  raptData: any;
  currentNode: INode;
  conf: any;
  playbackPreset: any;

  SECONDS_TO_BUFFER: number = 6;
  BUFFER_CHECK_INTERVAL: number = 100;
  BUFFER_DONE_TIMEOUT: number = 100;

  constructor(
    playerLibrary: any,
    playersContainer: HTMLElement,
    raptProjectId: string,
    conf: any,
    raptData: any
  ) {
    super();
    this.playerLibrary = playerLibrary;
    this.playersContainer = playersContainer;
    this.raptProjectId = raptProjectId;
    this.conf = conf;
    if (conf.rapt.bufferTime) {
      this.SECONDS_TO_BUFFER = conf.rapt.bufferTime;
    }
    this.raptData = raptData;
    this.players = [];
    this.playbackPreset = new PlaybackPreset(
      this.playerLibrary.ui.h,
      this.playerLibrary.ui.Components,
      () => this.toggleFullscreen()
    ).preset;
  }

  toggleFullscreen() {
    this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
  }

  loadPlayer(node: INode, callback: () => void = null): any {
    const nodeDiv: HTMLElement = this.createNodesDiv(node);
    const nodeConf: object = this.getPlayerConf(node, nodeDiv.id);
    const player = this.playerLibrary.setup(nodeConf);

    // with 1st node we do not want to start caching other nodes. First get playback, then start caching other nodes
    player.loadMedia({ entryId: node.entryId });

    // store the player
    this.players.push({
      status: BufferState.CACHING,
      id: node.id,
      node: node,
      player: player
    });

    this.checkIfBuffered((entryId: string) => {
      // cache next entries;
      if (callback) {
        callback();
      }
      const firstPlayer: ICachingPlayer | false = this.getPlayerByKalturaId(
        node.entryId
      );
      if (firstPlayer) {
        firstPlayer.status = BufferState.READY;
      }
      this.cacheNodes(node);
    }, player);
    return player;
  }

  /**
   * Stop the current buffering player, unless it is the one that was requested to play.
   * @param nodeToPlay
   */
  stopCurrentCachedPlayer(nodeToPlay: INode) {
    const cachingNow: ICachingPlayer = this.players.find(
      (player: ICachingPlayer) => player.status === BufferState.CACHING
    );
    if (cachingNow && cachingNow.player && cachingNow.id !== nodeToPlay.id) {
      cachingNow.player.destroy();
      cachingNow.player = null;
      cachingNow.status = BufferState.INIT;
    }
  }

  cacheNodes(currentNode: INode) {
    // in case there is a caching player - stop caching it.
    this.stopCurrentCachedPlayer(currentNode);
    this.currentNode = currentNode;
    let nodes: INode[] = this.getNextNodes(currentNode);
    // optimize 1 - find items that are cached/created but not relevant for this current node

    // helper - extract the nodes from the currentPlayers
    const currentPlayersNodes: INode[] = this.players.map(
      (cachePlayer: ICachingPlayer) => cachePlayer.node
    );
    // find which nodes we want to destroy
    let nodesToDestroy = currentPlayersNodes.filter(
      (node: INode) => !nodes.find((tmp: INode) => node.id === tmp.id)
    );
    // ignore the given node
    nodesToDestroy = nodesToDestroy.filter(
      (node: INode) => node.id !== currentNode.id
    );
    // Now destroy them
    for (const nodeToDestroy of nodesToDestroy) {
      this.destroyPlayer(nodeToDestroy);
    }

    //
    // // remove the current node from the next nodes to cache - it is playing and no need to cache it
    // nodes = nodes.filter((node: INode) => node.id === currentNode.id);

    // Optimization! re-order nodes, depending appearance time
    nodes = this.sortByApearenceTime(nodes, currentNode);

    // store the nodes in case they are not stored yet
    for (const node of nodes) {
      // cache new players only
      if (!this.players.find((item: ICachingPlayer) => item.id === node.id)) {
        // use Rapt id as a key since we might have kaltura-entry in different rapt nodes
        this.players.push({
          status: BufferState.INIT,
          id: node.id,
          node: node
        });
      } else {
        // if we got here - the player for this node was already created
        const existingPlayer: ICachingPlayer | null = this.getPlayerByKalturaId(
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
    this.cacheNextPlayer();
  }

  /**
   * Sort a given nodes-array by the appearance-order of the hotspots in that node
   * @param arr of INodes
   * @param givenNode
   */
  sortByApearenceTime(arr: INode[], givenNode: INode): INode[] {
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

    const arrayToCache: INode[] = [];
    for (const hotSpot of hotspots) {
      arrayToCache.push(
        arr.find((itm: INode) => {
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
    // TODO add order logic later (or not?)
    // find first un-cached
    let unbufferedPlayer: ICachingPlayer = this.players.find(
      (item: any) => item.status === BufferState.INIT
    );
    if (unbufferedPlayer) {
      // found one - add it and start caching it. Notify PlayerManager of this
      this.dispatch({
        type: BufferEvent.BUFFERING,
        data: unbufferedPlayer.node.name
      });
      // update status of current player
      unbufferedPlayer.status = BufferState.CACHING;
      // create player and cache it
      this.cachePlayer(unbufferedPlayer);
    } else {
      // no more unbuffered players - we must be done
      this.dispatch({
        type: BufferEvent.ALL_BUFFERED,
        data: this.currentNode.name
      });
    }
  }

  /**
   * Load a specific player per-node in "cache" mode
   * @param node
   */
  cachePlayer(player: ICachingPlayer): void {
    const nodesDiv: HTMLElement = this.createNodesDiv(player.node, true);
    const conf: object = this.getPlayerConf(player.node, nodesDiv.id, true);
    const newPlayer = this.playerLibrary.setup(conf);
    player.player = newPlayer; // save so we have reference later
    this.checkIfBuffered((entryId: string) => {
      const finished: ICachingPlayer = this.players.find(
        (item: ICachingPlayer) => item.node.entryId === entryId
      );
      finished.status = BufferState.READY;
      this.dispatch({
        type: BufferEvent.DONE,
        data: finished.node.name
      });
      this.cacheNextPlayer();
    }, newPlayer);
    newPlayer.loadMedia({ entryId: player.node.entryId });
  }

  /**
   * Check if the current content of bufferPlayer was loaded;
   * @param callback
   * @param bufferPlayer
   */
  checkIfBuffered(callback: (entryId: string) => void, bufferPlayer: any) {
    // todo - remove once optomize buffer
    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end
    ) {
      console.log(">>>>>", bufferPlayer.buffered.end(0));
    }

    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end &&
      bufferPlayer.buffered.end(0) > this.SECONDS_TO_BUFFER - 1
    ) {
      setTimeout(() => {
        callback(bufferPlayer._config.sources.id);
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
  createNodesDiv(node: INode, isCachePlayer: boolean = false): HTMLElement {
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
    let newConf: IRaptConfig = Object.assign(this.conf);
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
  getPlayerByKalturaId(entryId: string): ICachingPlayer | null {
    const cachePlayer: ICachingPlayer = this.players.find(
      (item: ICachingPlayer) => item.node.entryId === entryId
    );
    if (!cachePlayer) {
      return null;
      // player was not created yet, or was created but was not initiated - force it now!
    }
    return cachePlayer;
  }

  /**
   * Get optional playable nodes of a given node
   * @param node
   */
  getNextNodes(node: INode): INode[] {
    let nodes: INode[] = node.prefetchNodeIds.length
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
  getNodeByRaptId(id: string): INode {
    const nodes: INode[] = this.raptData.nodes;
    return nodes.find((item: INode) => item.id === id);
  }

  /**
   * Destroy a player and remove it from the players list
   * @param node
   */
  destroyPlayer(node: INode): void {
    this.dispatch({ type: BufferEvent.DESTROYING, data: node.name });
    const cachingPlayer: ICachingPlayer = this.getPlayerByKalturaId(
      node.entryId
    );
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
      (item: ICachingPlayer) => item.id !== node.id
    );
    this.dispatch({ type: BufferEvent.DESTROYED, data: node.name });
  }
}
