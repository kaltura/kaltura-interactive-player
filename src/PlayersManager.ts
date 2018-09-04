import INode from "./interfaces/INode";
import IRaptConfig from "./interfaces/IRaptConfig";
import { PlaybackState, States } from "./helpers/States";
import {BufferManager} from "./BufferManager";

/**
 * This class manages players creations and additions to DOM, as well as the Rapt layer
 */
export class PlayersManager {
  conf: any;
  nodes: [];
  players: any; // hold references to loaded players
  playerLibrary: any;
  raptData: any;
  raptEngine: any; // library
  rapt: any; // instance of Rapt engine
  raptProjectId: string;
  bufferManager: BufferManager;
  mainDiv: HTMLElement;
  currentPlayer: any;
  element: any;
  playbackState: string;

  constructor(
    conf: any,
    playerLibrary: any,
    raptProjectId: string,
    raptData: any,
    raptEngine: any
  ) {
    this.conf = conf;
    this.raptData = raptData;
    this.players = {};
    this.playerLibrary = playerLibrary;
    this.raptProjectId = raptProjectId;
    this.raptEngine = raptEngine;
    this.bufferManager = new BufferManager();
    this.mainDiv = document.getElementById(this.conf.targetId);
  }

  /**
   * Assuming we have all the data, find the 1st node and load it. Once loaded, start cache relevant entries of that
   * specific node.
   */
  init(): void {
    this.log("log");
    const { nodes, settings } = this.raptData;
    this.nodes = nodes;
    const startNodeId = settings.startNodeId;
    // retrieve the 1st node
    const firstNode = nodes.find(function(element: any) {
      return element.id === startNodeId;
    });
    if (!firstNode) {
      //TODO - handle error
      dispatchEvent(new Event(States.ERROR));
    }
    dispatchEvent(new Event(States.LOADING));

    // load the 1st media
    const nodeDiv: HTMLElement = this.createNodesDiv(firstNode);
    const nodeConf: object = this.getPlayerConf(firstNode, nodeDiv.id);
    this.currentPlayer = this.playerLibrary.setup(nodeConf);
    // save the player for later use
    this.players[firstNode.entryId] = {
      player: this.currentPlayer,
      state: States.LOADING
    };
    this.currentPlayer.loadMedia({ entryId: firstNode.entryId });
    this.checkIfBuffered((entryId: string) => {
      console.log(">>>>> FIRST LOADED", firstNode);
      const nextNodes = this.getNextNodes(firstNode);
      this.cacheNode(nextNodes[0]);
    }, this.currentPlayer);
    this.initRapt();
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
   * Create a player-per-node to a list of IV nodes and stack them beneath the current players
   */
  cacheNodes() {}

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

  /**
   * Load a specific player per-node in "cache" mode
   * @param node
   */
  cacheNode(node: INode): void {
    const nodesDiv: HTMLElement = this.createNodesDiv(node, true);
    const nodeConf: object = this.getPlayerConf(node, nodesDiv.id, true);
    const player = this.playerLibrary.setup(nodeConf);
    this.checkIfBuffered(function(entryId: string) {
      console.log(">>>>> $$$", entryId);
    }, player);
    player.loadMedia({ entryId: node.entryId });
  }

  /**
   * Switch to a new player, by the Kaltura Entry id
   * @param id
   */
  switchPlayer(id: string) {
    console.log(">>>>> switchPlayer", id);
    this.currentPlayer.pause();
  }

  initRapt() {
    // create the rapt-engine layer
    this.element = document.createElement("div");
    this.element.setAttribute("id", this.raptProjectId + "-rapt-engine");
    this.element.setAttribute("style", "width:100%;height:100%;z-index:9999");
    this.mainDiv.appendChild(this.element);
    this.raptEngine = new this.raptEngine.Engine(this);
    this.raptEngine.load(this.raptData);
    this.raptEngine.resize({ width: 500, height: 300 });
    setInterval(this.tick, 500, this.currentPlayer, this.raptEngine);
  }

  // Check if the current content of bufferPlayer was loaded;
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

  //////////////////////  Rapt delegate functions  ////////////////////////
  load(media: any) {
    var id = media.sources[0].src;
    this.switchPlayer(id);
  }

  play() {
    console.log(">>>>> play");
    this.playbackState = PlaybackState.PLAYING;
    //window.mainPlayer.play();
  }

  pause() {
    this.playbackState = PlaybackState.PAUSED;
    console.log(">>>>> pause");
    //window.mainPlayer.pause();
  }

  seek(time: number) {
    console.log(">>>>> seek ", time);
    //window.mainPlayer.currentTime = time;
  }

  event(_event: any) {
    if (_event.type != "player:timeupdate") {
      console.log(">>>> Rapt event: " + _event.type);
    }
  }

  tick(currentPlayer: any, raptEngine: any) {
    if (this.playbackState === PlaybackState.PAUSED) {
      return; // no point updating when video is paused
    }
    const currentPlayingVideoElement: any = currentPlayer.getVideoElement();
    if (currentPlayingVideoElement) {
      raptEngine.update({
        currentTime: currentPlayingVideoElement.currentTime,
        duration: currentPlayingVideoElement.duration,
        ended: currentPlayingVideoElement.ended,
        videoWidth: currentPlayingVideoElement.videoWidth,
        videoHeight: currentPlayingVideoElement.videoHeight,
        paused: currentPlayingVideoElement.paused,
        readyState: currentPlayingVideoElement.readyState
      });
    }
  }
  /////////////////////////////////////////////////////////////////////////

  log(str: string) {
    // if (window.logMsg) {
    //   window.logMsg(str);
    // }
  }
}
