import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent, KipFullscreen } from "./helpers/KipEvents";
import { CreateElement } from "./helpers/CreateElement";
import {
  BufferEvent,
  BufferManager,
  BufferState,
  CachingPlayer
} from "./BufferManager";

export interface RaptNode {
  id: string;
  entryId: string;
  name: string;
  customData?: any;
  prefetchNodeIds?: string[];
}

export const PlaybackState = {
  PLAYING: "playing",
  PAUSED: "paused"
};

/**
 * This class manages players, and places and interact with the Rapt engine layer
 * This class creates and manages BufferManager
 */
export class PlayersManager extends Dispatcher {
  bufferManager: BufferManager;
  currentPlayer: any;
  currentNode: any;
  element: HTMLElement; // must be called 'element' because rapt delegate implementation
  playbackState: string;
  PLAYER_TICK_INTERVAL: number = 250;

  constructor(
    private config: any,
    private playerLibrary: any,
    private raptProjectId: string,
    private raptData: any,
    private mainDiv: HTMLElement,
    public raptEngine: any
  ) {
    super();
    // create a container to all players
    // set id that contains the rapt playlist-id to support multiple KIV on the same player
    const playerContainer: HTMLElement = CreateElement(
      "div",
      this.raptProjectId + "-kiv-players-container",
      "kiv-players-container"
    );
    this.mainDiv.appendChild(playerContainer);

    // create the rapt-engine layer. We must use this.element because of rapt delegate names
    this.element = CreateElement(
      "div",
      this.raptProjectId + "-rapt-engine",
      "kiv-rapt-engine"
    );
    // adding the rapt layer to the main-app div
    playerContainer.appendChild(this.element);

    // init bufferManager
    this.bufferManager = new BufferManager(
      this.playerLibrary,
      playerContainer,
      raptProjectId,
      config,
      this.raptData
    );

    // listen to all BufferEvent types
    for (let o of Object.values(BufferEvent)) {
      this.bufferManager.addListener(o, (event: any) => {
        switch (event.type) {
          // when a player was created but was not cached - this is its 'first play' event
          case BufferEvent.CATCHUP:
            this.element.classList.remove("kiv-hidden");
            this.currentNode = event.payload.node;
            this.currentPlayer = event.payload.player;
            this.bufferManager.cacheNodes(event.payload.node);
            break;
          case BufferEvent.ALL_UNBUFFERED:
            this.element.classList.remove("kiv-hidden");
            break;
        }
        // bubble up all events
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
    const doc: any = document; // todo handle more elegantly
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      element = this.mainDiv;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      }
    }
    setTimeout(() => {
      this.resizeEngine();
    }, 100); // todo - optimize / dom-event
  }

  // TODO - move to fullscreenManager?
  exitHandler() {
    const doc: any = document;
    if (!doc.fullscreenElement && !doc.webkitIsFullScreen) {
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
  init(mainDiv: HTMLElement) {
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
    this.currentPlayer = this.bufferManager.init(firstNode, () => {
      this.initRapt();
    });
  }

  /**
   * Switch to a new player, by the Kaltura Entry id
   * @param id
   */
  switchPlayer(id: string): void {
    this.currentPlayer.pause();
    const nextPlayer: CachingPlayer = this.bufferManager.getPlayerByKalturaId(
      id
    );

    // remove current player from top z-index stack
    const currentPlayingDiv = this.mainDiv.querySelector(
      "[id='" + this.raptProjectId + "__" + this.currentNode.entryId + "']"
    );
    currentPlayingDiv.classList.remove("current-playing");
    // TODO - fix flow later
    if (!nextPlayer) {
      // TODO next player was not created. handle new node
    } else {
      // switch players according to the player BufferState
      switch (nextPlayer.status) {
        case BufferState.init:
          // the next player was not created yet, hide the rapt layer and tell the bufferManager to create and 'autoplay'
          // that next player. Once played - re-show Rapt layer (via event)
          this.element.classList.add("kiv-hidden");
          this.bufferManager.playImmediate(nextPlayer);
          break;
        case BufferState.ready:
          nextPlayer.player.play();
          this.currentNode = nextPlayer.node;
          this.currentPlayer = nextPlayer.player;
          const node: RaptNode = nextPlayer.node;
          this.bufferManager.cacheNodes(node);
          // todo - make function "getPlayerDivById"
          const newPlayerDiv = this.mainDiv.querySelector(
            "[id='" + this.raptProjectId + "__" + id + "']"
          );
          newPlayerDiv.classList.add("current-playing");
          break;
        // the next player is created but still buffering
        case BufferState.caching:
          const newPlayerDiv1 = this.mainDiv.querySelector(
            "[id='" + this.raptProjectId + "__" + id + "']"
          );
          newPlayerDiv1.classList.add("current-playing");
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

  event(event: any) {
    if (event.type === "project:ready") {
      this.raptEngine.metadata.account = this.config.partnetId;
    }
    this.dispatch(event);
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
