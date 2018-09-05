import INode from "./interfaces/INode";
import IRaptConfig from "./interfaces/IRaptConfig";
import { PlaybackState } from "./helpers/States";
import { BufferManager } from "./BufferManager";
import { Dispatcher } from "./helpers/Dispatcher";
import { BufferEvent, KipEvent } from "./helpers/KipEvents";

/**
 * This class manages players, placing and managing the Rapt engine layer
 */
export class PlayersManager extends Dispatcher {
  nodes: [];
  // players: any; // hold references to loaded players
  playerLibrary: any;
  raptData: any;
  raptEngine: any; // library
  rapt: any; // instance of Rapt engine
  bufferManager: BufferManager;
  currentPlayer: any;
  element: any;
  playbackState: string;
  raptProjectId: string;

  constructor(
    conf: any,
    playerLibrary: any,
    raptProjectId: string,
    raptData: any,
    raptEngine: any
  ) {
    super();
    // set data to class
    this.raptData = raptData;
    this.playerLibrary = playerLibrary;
    this.raptProjectId = raptProjectId;
    this.raptEngine = raptEngine;
    const mainDiv = document.getElementById(conf.targetId);

    // init bufferManager
    this.bufferManager = new BufferManager(
      this.playerLibrary,
      mainDiv,
      raptProjectId,
      conf
    );

    this.bufferManager.addListener(BufferEvent.BUFFERED, (entryId: string) => {
      console.log(">>>>> BUFFERED ", entryId);
    });

    this.bufferManager.addListener(BufferEvent.DONE, (nodeEntryId: string) => {
      console.log(">>>>> DONE buffering for node ", nodeEntryId);
    });
  }

  /**
   * Assuming we have all the data, find the 1st node and load it. Once loaded, start cache relevant entries of that
   * specific node.
   */
  init(mainDiv: HTMLElement): void {
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
      this.dispatch(KipEvent.FIRST_PLAY_ERROR);
    }

    // load the 1st media
    const nodeDiv: HTMLElement = this.bufferManager.createNodesDiv(firstNode);
    const nodeConf: object = this.bufferManager.getPlayerConf(
      firstNode,
      nodeDiv.id
    );
    this.currentPlayer = this.playerLibrary.setup(nodeConf);
    this.currentPlayer.loadMedia({ entryId: firstNode.entryId });

    this.bufferManager.checkIfBuffered((entryId: string) => {
      console.log(">>>>> FIRST LOADED", firstNode);
      const nextNodes = this.getNextNodes(firstNode);
      //this.cacheNode(nextNodes[0]);
    }, this.currentPlayer);
    // create the rapt-engine layer
    this.element = document.createElement("div");
    this.element.setAttribute("id", this.raptProjectId + "-rapt-engine");
    this.element.setAttribute("style", "width:100%;height:100%;z-index:9999");
    // adding the rapt layer to the main-app div
    mainDiv.appendChild(this.element);

    this.initRapt();
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
   * Switch to a new player, by the Kaltura Entry id
   * @param id
   */
  switchPlayer(id: string) {
    console.log(">>>>> switchPlayer", id);
    this.currentPlayer.pause();
  }

  // initiate Rapt-engine layer
  initRapt() {
    this.raptEngine = new this.raptEngine.Engine(this);
    this.raptEngine.load(this.raptData);
    this.raptEngine.resize({ width: 500, height: 300 });
    setInterval(this.tick, 500, this.currentPlayer, this.raptEngine);
  }

  //////////////////////  Rapt delegate functions  ////////////////////////
  load(media: any) {
    const id = media.sources[0].src;
    this.switchPlayer(id);
  }

  play() {
    // console.log(">>>>> play");
    this.playbackState = PlaybackState.PLAYING;
    //window.mainPlayer.play();
  }

  pause() {
    this.playbackState = PlaybackState.PAUSED;
    // console.log(">>>>> pause");
    //window.mainPlayer.pause();
  }

  seek(time: number) {
    // console.log(">>>>> seek ", time);
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
