import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent, KipFullscreen } from "./helpers/KipEvents";
import { CreateElement } from "./helpers/CreateElement";
import { PlayersFactory } from "./PlayersFactory";
import { BufferEvent, PlayersBufferManager } from "./PlayersBufferManager";

export interface RaptNode {
  onEnded?: [];
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
  private PlayersBufferManager: PlayersBufferManager;
  private playersFactory: PlayersFactory;
  public currentPlayer: any;
  public currentNode: RaptNode;
  public element: HTMLElement; // must be called 'element' because rapt delegate implementation
  private playbackState: string;
  static PLAYER_TICK_INTERVAL: number = 250;

  constructor(
    private config: any,
    private playerLibrary: any,
    private raptProjectId: string,
    private raptData: any,
    private mainDiv: HTMLElement,
    public raptEngine: any
  ) {
    super();

    // create the rapt-engine layer. We must use this.element because of rapt delegate names
    this.element = CreateElement(
      "div",
      this.raptProjectId + "-rapt-engine",
      "kiv-rapt-engine"
    );
    // adding the rapt layer to the main-app div
    this.mainDiv.appendChild(this.element);

    // create a PlayersFactory instance
    this.playersFactory = new PlayersFactory(
      this.mainDiv,
      this.raptProjectId,
      this.playerLibrary,
      this.config
    );

    // create the PlayersBufferManager
    this.PlayersBufferManager = new PlayersBufferManager(this.playersFactory);
    // listen to all BufferEvent types from PlayersBufferManager
    for (let o of Object.values(BufferEvent)) {
      this.PlayersBufferManager.addListener(o, (event: any) => {
        switch (event.type) {
          // when a player was created but was not cached - this is its 'first play' event
          case BufferEvent.CATCHUP:
            // this.element.classList.remove("kiv-hidden");
            // this.currentNode = event.payload.node;
            // this.currentPlayer = event.payload.player;
            // this.bufferManager.cacheNodes(event.payload.node);
            break;
          case BufferEvent.ALL_UNBUFFERED:
            // this.element.classList.remove("kiv-hidden");
            break;
        }
        // bubble up all events
        this.dispatch(event);
      });
    }
  }

  init() {
    const { nodes, settings } = this.raptData;
    const startNodeId = settings.startNodeId;
    // retrieve the 1st node
    const firstNode: RaptNode = nodes.find(function(element: any) {
      return element.id === startNodeId;
    });

    if (!firstNode) {
      this.dispatch({ type: KipEvent.FIRST_PLAY_ERROR });
    }
    // load the 1st media
    this.currentNode = firstNode;
    this.initRapt();
  }

  // initiate Rapt-engine layer
  initRapt() {
    this.raptEngine = new this.raptEngine.Engine(this);
    this.raptEngine.load(this.raptData);
    this.resizeEngine();
    setInterval(
      () => this.tick(this.currentPlayer, this.raptEngine),
      PlayersManager.PLAYER_TICK_INTERVAL
    );
  }
  resizeEngine() {
    this.raptEngine.resize({
      width: this.mainDiv.offsetWidth,
      height: this.mainDiv.offsetHeight
    });
  }

  switchPlayer(id: string): void {
    if (this.PlayersBufferManager.getPlayer(id)) {
      // found a player !
    } else {
      // player does not exist - create it
      this.currentPlayer = this.PlayersBufferManager.createPlayer(
        this.currentNode.entryId,
        true,
        () => {
          debugger;
        }
      );
    }
    console.log(">>>>> switchPlayer");
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
