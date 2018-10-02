import INode from "./interfaces/INode";
import { BufferState, PlaybackState } from "./helpers/States";
import { BufferManager } from "./BufferManager";
import { Dispatcher } from "./helpers/Dispatcher";
import { BufferEvent, KipEvent, KipFullscreen } from "./helpers/KipEvents";
import ICachingPlayer from "./interfaces/ICachingPlayer";

/**
 * This class manages players, and places and interact with the Rapt engine layer
 * This class creates and manages BufferManager
 */
export class PlayersManager extends Dispatcher {
  playerLibrary: any; // playkit-js library ref'
  raptData: any;
  raptEngine: any; // rapt engine library ref'
  bufferManager: BufferManager;
  currentPlayer: any;
  currentNode: any;
  element: any; // must be called 'element' because rapt delegate implementation
  playbackState: string;
  raptProjectId: string;
  mainDiv: HTMLElement; // the parent id that holds all layers
  PLAYER_TICK_INTERVAL: number = 250;

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

    // create a container to all players
    const playerContainer: HTMLElement = document.createElement("div");
    playerContainer.setAttribute(
      "id",
      this.raptProjectId + "-kip-players-container"
    );
    playerContainer.setAttribute("style", "width:100%;height:100%");
    // adding the rapt layer to the main-app div
    this.mainDiv.appendChild(playerContainer);

    // init bufferManager
    this.bufferManager = new BufferManager(
      this.playerLibrary,
      playerContainer,
      raptProjectId,
      conf,
      this.raptData
    );

    // listen to all BufferEvent types
    for (let o of Object.values(BufferEvent)) {
      this.bufferManager.addListener(o, (event: KipEvent) => {
        this.dispatch(event);
      });
    }

    // TODO - move to fullscreenManager?
    document.addEventListener("fullscreenchange", () => this.exitHandler());
    document.addEventListener("webkitfullscreenchange", () =>
      this.exitHandler()
    );

    // listen to fullscreen clicks
    this.bufferManager.addListener(KipFullscreen.FULL_SCREEN_CLICKED, () => {
      this.toggleFullscreenState();
    });
  }

  // TODO - move to fullscreenManager?
  toggleFullscreenState() {
    let element: HTMLElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } else {
      element = this.mainDiv;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      }
    }
    setTimeout(() => {
      this.resizeEngine();
    }, 100);
  }

  // TODO - move to fullscreenManager?
  exitHandler() {
    if (!document.fullscreenElement && !document.webkitIsFullScreen) {
      this.toggleFullscreenState();
    }
  }

  resizeEngine() {
    this.raptEngine.resize({
      width: this.mainDiv.offsetWidth,
      height: this.mainDiv.offsetHeight
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
      this.dispatch({ type: KipEvent.FIRST_PLAY_ERROR });
    }
    // load the 1st media
    this.currentNode = firstNode;
    this.currentPlayer = this.bufferManager.loadPlayer(firstNode, () => {
      // create the rapt-engine layer
      this.element = document.createElement("div");
      this.element.setAttribute("id", this.raptProjectId + "-rapt-engine");
      this.element.setAttribute(
        "style",
        "width:100%;height:100%;z-index:9999;background:green"
      );
      // adding the rapt layer to the main-app div
      mainDiv.appendChild(this.element);
      this.initRapt();
    });
  }

  /**
   * Switch to a new player, by the Kaltura Entry id
   * @param id
   */
  switchPlayer(id: string) {
    this.currentPlayer.pause();
    const nextPlayer: ICachingPlayer = this.bufferManager.getPlayerByKalturaId(
      id
    );
    if (!nextPlayer) {
      // TODO next player was not created. handle new node
    } else {
      // switch players according to the player BufferState
      switch (nextPlayer.status) {
        // the next player is already buffered
        case BufferState.READY:
          nextPlayer.player.play();
          this.currentNode = nextPlayer.node;
          this.currentPlayer = nextPlayer.player;
          const node: INode = nextPlayer.node;
          this.bufferManager.cacheNodes(node);
          // TODO handle z-index later
          break;
        // the next player is created but still buffering
        case BufferState.CACHING:
          nextPlayer.player.play();
          break;
      }
    }
  }

  // initiate Rapt-engine layer
  initRapt() {
    this.raptEngine = new this.raptEngine.Engine(this);
    this.raptEngine.load(this.raptData);
    this.resizeEngine();
    setInterval(
      () => this.tick(this.currentPlayer, this.raptEngine),
      this.PLAYER_TICK_INTERVAL
    );
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

  event(event: any, o?: any) {
    if (event.type != "player:timeupdate") {
      this.dispatch(event);
    }
  }

  tick(currentPlayer: any, raptEngine: any) {
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
