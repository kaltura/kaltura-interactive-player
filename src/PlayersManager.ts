import INode from "./interfaces/INode";
import { PlaybackState } from "./helpers/States";
import { BufferManager } from "./BufferManager";
import { Dispatcher } from "./helpers/Dispatcher";
import { BufferEvent, KipEvent } from "./helpers/KipEvents";

/**
 * This class manages players, and places and interact with the Rapt engine layer
 * This class creates and manages BufferManager
 */
export class PlayersManager extends Dispatcher {
  playerLibrary: any;
  raptData: any;
  raptEngine: any; // library
  rapt: any; // instance of Rapt engine
  bufferManager: BufferManager;
  currentPlayer: any;
  element: any;
  playbackState: string;
  raptProjectId: string;
  mainDiv: HTMLElement;

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
    this.mainDiv = document.getElementById(conf.targetId);

    // init bufferManager
    this.bufferManager = new BufferManager(
      this.playerLibrary,
      this.mainDiv,
      raptProjectId,
      conf
    );

    this.bufferManager.addListener(BufferEvent.BUFFERING, (node: INode) => {
      this.dispatch("message", "buffering " + node.name + " "+node.entryId);
      console.log(">>>>> buffering ", node.name, node.entryId);
    });

    this.bufferManager.addListener(BufferEvent.ALL_DONE, (node: INode) => {
      this.dispatch("message", "all done " + node.name + " "+node.entryId);
      console.log(">>>>> all done for ", node.name, node.entryId);
    });

    this.bufferManager.addListener(BufferEvent.DONE, (node: INode) => {
      this.dispatch("message", "one done " + node.name + " "+node.entryId);
      console.log(">>>>> cached ", node.name, node.entryId);
    });
  }

  /**
   * Assuming we have all the data, find the 1st node and load it. Once loaded, start cache relevant entries of that
   * specific node.
   */
  init(mainDiv: HTMLElement): void {
    const { nodes, settings } = this.raptData;
    const startNodeId = settings.startNodeId;
    // retrieve the 1st node
    const firstNode = nodes.find(function(element: any) {
      return element.id === startNodeId;
    });
    if (!firstNode) {
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
      this.bufferManager.cacheNodes(this.getNextNodes(firstNode), firstNode);
    }, this.currentPlayer);
    // create the rapt-engine layer
    this.element = document.createElement("div");
    this.element.setAttribute("id", this.raptProjectId + "-rapt-engine");
    this.element.setAttribute("style", "width:0;height:0;z-index:9999");
    // adding the rapt layer to the main-app div
    mainDiv.appendChild(this.element);
    this.initRapt();
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

  /**
   * Switch to a new player, by the Kaltura Entry id
   * @param id
   */
  switchPlayer(id: string) {
    console.log(">>>>> switchPlayer", id);
    this.currentPlayer.pause();
    const nextPlayer = this.bufferManager.getPlayerByKalturaId(id);
    if (!nextPlayer) {
    } else {
      nextPlayer.play();
    }
  }

  // initiate Rapt-engine layer
  initRapt() {
    this.raptEngine = new this.raptEngine.Engine(this);
    this.raptEngine.load(this.raptData);
    this.raptEngine.resize({
      width: this.mainDiv.offsetWidth,
      height: this.mainDiv.offsetHeight
    });
    setInterval(this.tick, 500, this.currentPlayer, this.raptEngine);
  }

  //////////////////////  Rapt delegate functions  ////////////////////////
  load(media: any) {
    const id = media.sources[0].src;
    this.switchPlayer(id);
  }

  play() {
    this.playbackState = PlaybackState.PLAYING;
  }

  pause() {
    this.playbackState = PlaybackState.PAUSED;
  }

  seek(time: number) {
    //window.mainPlayer.currentTime = time;
  }

  event(_event: any) {
    if (_event.type != "player:timeupdate") {
      // console.log(">>>> Rapt event: " + _event.type);
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
}
