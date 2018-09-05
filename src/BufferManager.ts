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
  currentNode: INode;
  conf: any;

  constructor(
    playerLibrary: any,
    mainDiv: HTMLElement,
    raptProjectId: string,
    conf: any
  ) {
    super();
    this.playerLibrary = playerLibrary;
    this.mainDiv = mainDiv;
    this.raptProjectId = raptProjectId;
    this.conf = conf;
    this.players = [];
  }

  cacheNodes(nodes: INode[], currentNode: INode) {
    this.currentNode = currentNode;
    // store the nodes in case they are not stored yet
    for (const node of nodes) {
      if (!this.players.find((item: ICachingPlayer) => item.id === node.id)) {
        // use Rapt id as a key since we might have kaltura-entry in different rapt nodes
        this.players.push({
          status: BufferState.INIT,
          id: node.id,
          node: node
        });
      }
    }
    this.cacheNextUncachedPlayer();
  }

  /**
   * From current session - find if there is an unbuffered node, if so - create it and start caching it
   */
  cacheNextUncachedPlayer() {
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
      this.cacheNode(unbufferedPlayer.node);
    } else {
      this.dispatch(BufferEvent.ALL_DONE, this.currentNode);
    }
  }

  /**
   * Load a specific player per-node in "cache" mode
   * @param node
   */
  cacheNode(node: INode): void {
    const nodesDiv: HTMLElement = this.createNodesDiv(node, true);
    const nodeConf: object = this.getPlayerConf(node, nodesDiv.id, true);
    const player = this.playerLibrary.setup(nodeConf);
    this.checkIfBuffered((entryId: string) => {
      const finished: ICachingPlayer = this.players.find(
        (item: ICachingPlayer) => item.node.entryId === entryId
      );
      this.dispatch(BufferEvent.DONE, finished);
      this.cacheNextUncachedPlayer();
    }, player);
    player.loadMedia({ entryId: node.entryId });
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
}
