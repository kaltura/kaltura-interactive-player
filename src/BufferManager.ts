import { Dispatcher } from "./helpers/Dispatcher";
import INode from "./interfaces/INode";
import IRaptConfig from "./interfaces/IRaptConfig";
import { BufferState } from "./helpers/States";
import { BufferEvent } from "./helpers/KipEvents";
import ICachingPlayer from "./interfaces/ICachingPlayer";

/**
 * This class is in charge of the creation of all players, and to handle their statuses (init,caching,ready)
 */

export class BufferManager extends Dispatcher {
  players: any;
  playerLibrary: any;
  mainDiv: HTMLElement;
  raptProjectId: string;
  raptData: any;
  currentNode: INode;
  conf: any;

  constructor(
    playerLibrary: any,
    mainDiv: HTMLElement,
    raptProjectId: string,
    conf: any,
    raptData: any
  ) {
    super();
    this.playerLibrary = playerLibrary;
    this.mainDiv = mainDiv;
    this.raptProjectId = raptProjectId;
    this.conf = conf;
    this.raptData = raptData;
    this.players = [];
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
      this.cacheNodes(node, this.getNextNodes(node));
    }, player);
    return player;
  }

  cacheNodes(currentNode: INode, nodes: INode[]) {
    this.currentNode = currentNode;
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
        existingPlayer.player.currentTime = 0;
      }
    }
    this.cacheNextPlayer();
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
      this.dispatch(BufferEvent.BUFFERING, unbufferedPlayer.node);
      // update status of current player
      unbufferedPlayer.status = BufferState.CACHING;
      // create player and cache it
      this.cachePlayer(unbufferedPlayer);
    } else {
      // no more unbuffered players - we must be done
      this.dispatch(BufferEvent.ALL_DONE, this.currentNode);
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
      this.dispatch(BufferEvent.DONE, finished.node);
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
    if (bufferPlayer.buffered && bufferPlayer.buffered.length) {
      setTimeout(() => {
        callback(bufferPlayer._config.sources.id);
      }, 250);
    } else {
      setTimeout(() => {
        this.checkIfBuffered(callback, bufferPlayer);
      }, 250);
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
    newDiv.setAttribute("style", "width:100%;height:100%");
    if (isCachePlayer) {
      newDiv.setAttribute("class", "kiv-cache-player");
    }
    this.mainDiv.appendChild(newDiv);
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
    const newConf: IRaptConfig = Object.assign(this.conf);
    newConf.targetId = targetName;
    if (isCache) {
      newConf.playback = {
        autoplay: false,
        preload: "auto"
      };
    }
    delete newConf.rapt;
    return newConf;
  }

  /**
   * Retreive a player by its Kaltura entry id
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
    return node.prefetchNodeIds.length
      ? node.prefetchNodeIds.map((nodeId: string) =>
          this.getNodeByRaptId(nodeId)
        )
      : [];
  }
  /**
   * Return a rapt node
   * @param id
   */
  getNodeByRaptId(id: string): INode {
    const nodes: INode[] = this.raptData.nodes;
    return nodes.find((item: INode) => item.id === id);
  }
}
