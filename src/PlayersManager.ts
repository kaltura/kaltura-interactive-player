import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent } from "./helpers/KipEvents";
import { KalturaPlayer, PlayersFactory } from "./PlayersFactory";
import { BufferEvent, PlayersBufferManager } from "./PlayersBufferManager";
import { PlayersDomManager } from "./PlayersDomManager";
import { log } from "./helpers/logger";

declare var Rapt: any;

export const KipFullscreen = {
  FULL_SCREEN_CLICKED: "fullScreenClicked",
  ENTER_FULL_SCREEN: "enterFullScreen",
  EXIT_FULL_SCREEN: "exitFullScreen"
};

export interface RaptNode {
  onEnded?: [];
  id: string;
  entryId: string;
  name: string;
  customData?: any;
  prefetchNodeIds?: string[];
}

export enum Persistency {
  mute = "mute",
  captions = "captions",
  volume = "volume",
  audioTrack = "audioTrack",
  rate = "rate"
}

/**
 * This class manages players, and places and interact with the Rapt engine layer
 * This class creates and manages BufferManager
 */
export class PlayersManager extends Dispatcher {
  private playersBufferManager: PlayersBufferManager;
  private playersFactory: PlayersFactory;
  private activePlayer: KalturaPlayer = null;
  private activeNode: RaptNode = null;
  static playerTickInterval: number = 250;
  public raptEngine: any;
  private model: any = undefined;
  readonly isAvailable: boolean;
  private playerWidth: number = NaN;
  private playerHeight: number = NaN;
  private resizeInterval: number = NaN;
  constructor(
    private config: any,
    private playerLibrary: any,
    readonly raptProjectId: string,
    private raptData: any,
    private domManager: PlayersDomManager
  ) {
    super();
    this.isAvailable =
      this.initPlayersFactory() && this.initPlayersBufferManager();

    if (this.isAvailable) {
      this.isAvailable = this.initRaptEngine();
      // responsiveness resize support
      this.resizeInterval = setInterval(this.handleWindowResized.bind(this), 250);
    }
  }

  private initPlayersBufferManager(): boolean {
    // create the PlayersBufferManager
    this.playersBufferManager = new PlayersBufferManager(
      this.raptData,
      this.playersFactory
    );
    // listen to all BufferEvent types from PlayersBufferManager
    for (let o of Object.values(BufferEvent)) {
      this.playersBufferManager.addListener(o, (event: any) => {
        // bubble up all events
        this.dispatch(event);
      });
    }
    if (
      this.config.rapt &&
      this.config.rapt.hasOwnProperty("bufferNextNodes") &&
      this.config.rapt.bufferNextNodes === false
    ) {
      this.playersBufferManager.disable();
    }
    return true;
  }

  public getActiveKalturaPlayer(): any {
    if (this.activePlayer) {
      return this.activePlayer.player;
    }
    return null;
  }

  public getActiveNode(): RaptNode {
    return this.activeNode;
  }

  private initPlayersFactory(): boolean {
    /**
     * This function interrupts the player kava beacons, alter some attributes (in case of need) and prevents some
     * of the events.
     * @param model
     */
    const analyticsInterruptFunc = (model: any): boolean => {
      if (!this.model) {
        this.model = model; // store model data for future use of Rapt sending data
      }
      model.rootEntryId = this.raptProjectId;
      model.nodeId = this.activeNode.id;
      model.entryId = this.activeNode.id;
      switch (model.eventType) {
        case 11:
        case 12:
        case 13:
        case 14:
          return false; // don't send quartiles events
        case 1:
        case 2:
        case 3:
          model.entryId = this.raptProjectId; // on these events - send the projectId instead of the entryId
          break;
      }
      return true;
    };

    // create a PlayersFactory instance
    this.playersFactory = new PlayersFactory(
      this.domManager,
      this.raptProjectId,
      this.playerLibrary,
      analyticsInterruptFunc,
      this.config
    );
    // listen to fullscreen events from the players
    this.playersFactory.addListener(KipFullscreen.FULL_SCREEN_CLICKED, () => {
      this.toggleFullscreenState();
    });

    return true;
  }

  private initRaptEngine(): boolean {
    const { id: raptEngineId, domElement } = this.domManager.createDomElement(
      "div",
      "rapt-engine",
      "kiv-rapt-engine"
    );
    // create the rapt-engine layer. We must use this.element because of rapt delegate names
    this.element = domElement;
    const { nodes, settings } = this.raptData;
    const startNodeId = settings.startNodeId;
    // retrieve the 1st node
    const firstNode: RaptNode = nodes.find(function(element: any) {
      return element.id === startNodeId;
    });

    if (!firstNode) {
      this.dispatch({ type: KipEvent.FIRST_PLAY_ERROR });
      return false;
    }

    // load the 1st media
    // this.updateActiveItems(null, firstNode);
    this.raptEngine = new Rapt.Engine(this);
    this.raptEngine.load(this.raptData);
    this.resizeEngine();

    setInterval(() => this.syncRaptStatus(), PlayersManager.playerTickInterval);
    return true;
  }
  private handleWindowResized() {
    // onResize is a window event - make sure we run this only when we change the player div
    const currentWidth = this.domManager.getContainer().offsetWidth;
    const currentHeight = this.domManager.getContainer().offsetHeight;
    if (
      currentWidth !== this.playerWidth ||
      currentHeight !== this.playerHeight
    ) {
      this.playerWidth = currentWidth;
      this.playerHeight = currentHeight;
      this.resizeEngine();
    }
  }
  private syncRaptStatus() {
    if (!this.activePlayer) {
      return;
    }
    const currentPlayingVideoElement: any = this.activePlayer.player.getVideoElement();
    if (currentPlayingVideoElement) {
      this.raptEngine.update({
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

  private toggleFullscreenState() {
    const doc: any = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      this.domManager.requestFullscreen();
    }
  }

  // re-render the rapt engine according to current dimension of the main container
  private resizeEngine() {
    const raptContainer = this.domManager.getContainer();
    this.raptEngine.resize({
      width: raptContainer.offsetWidth,
      height: raptContainer.offsetHeight
    });
  }

  public destroy() {
    this.removeListeners();
    clearInterval(this.resizeInterval);
  }

  ////////////////////////////////////////////
  // store the player and the node
  private updateActiveItems(
    nextPlayer: KalturaPlayer,
    nextNode: RaptNode
  ): void {
    const hasActivePlayer = !!this.activePlayer;
    const isSwitchingPlayer = this.activePlayer !== nextPlayer;
    const isSwitchingRaptNode = this.activeNode !== nextNode;
    log("log", "pm_updateActiveItems", "executed", {
      hasActivePlayer,
      isSwitchingPlayer,
      isSwitchingRaptNode,
      nodeId: nextNode ? nextNode.id : null
    });

    if (hasActivePlayer) {
      this.activePlayer.player.pause();
      if (isSwitchingPlayer) {
        // remove listeners
        this.removeListeners();
        if (!this.playersBufferManager.isAvailable()) {
          // TODO must destroy active player
        }
      }
    }
    this.activePlayer = nextPlayer;
    this.activeNode = nextNode;
    if (isSwitchingRaptNode) {
      this.playersBufferManager.switchPlayer(this.activeNode);
    }
    if (isSwitchingPlayer) {
      this.domManager.changeActivePlayer(this.activePlayer);
      // register listeners
      this.addListenersToPlayer();
    }
  }
  ////////////////////////////////////////////

  // called by Rapt on first-node, user click, defaultPath and external API "jump"
  private switchPlayer(media: any): void {
    const newEntryId = media.sources[0].src;
    const nextRaptNode: RaptNode = media.node;

    // send analytics of nodePlay - event44
    if (this.model) {
      this.sendAnalytics(44, { entryId: newEntryId });
    } else {
      // TODO - handle analytics of first event44 later;
    }

    if (this.activeNode) {
      this.sendAnalytics(48, {
        entryId: newEntryId,
        fromNodeId: this.activeNode.entryId,
        toNodeId: newEntryId
      });
    }

    log("log", "pm_switchPlayer", "executed", {
      entryId: newEntryId,
      nodeId: nextRaptNode.id
    });
    if (this.activePlayer && this.activeNode === nextRaptNode) {
      log(
        "log",
        "pm_switchPlayer",
        "switch to same node, seek to the beginning",
        { entryId: newEntryId }
      );
      // node is "switched" to itself
      this.activePlayer.player.currentTime = 0;
      this.activePlayer.player.play();
      return;
    }

    if (this.playersBufferManager.isAvailable()) {
      log(
        "log",
        "pm_switchPlayer",
        "use buffer manager to get player for entry",
        { entryId: newEntryId }
      );
      const bufferedPlayer = this.playersBufferManager.getPlayer(
        newEntryId,
        true
      );
      this.updateActiveItems(bufferedPlayer, nextRaptNode);
    } else {
      log(
        "log",
        "pm_switchPlayer",
        "buffer manager not available, switch media on current player",
        { entryId: newEntryId }
      );

      if (!this.activePlayer) {
        log("log", "pm_switchPlayer", "no player found, create main player", {
          entryId: newEntryId
        });
        const newPlayer = this.playersFactory.createPlayer(newEntryId, true);
        this.updateActiveItems(newPlayer, nextRaptNode);
      } else {
        log("log", "pm_switchPlayer", "switch media on main player", {
          entryId: newEntryId
        });
        this.activePlayer.player.loadMedia({
          entryId: newEntryId
        });
      }
    }
  }

  public execute(command: any) {
    if (!this.raptEngine) {
      log(
        "error",
        "pm_execute",
        "WARNING: Rapt Media commands received before initialization is complete"
      );
      return;
    }
    this.raptEngine.execute(command);
  }

  private handleTextTrackChanged = (event: any) => {
    this.playersBufferManager.syncPlayersStatus(
      Persistency.captions,
      event.payload.selectedTextTrack._language,
      this.activePlayer.player
    );
  };

  private handleRateChanged = (event: any) => {
    this.playersBufferManager.syncPlayersStatus(
      Persistency.rate,
      this.activePlayer.player.playbackRate,
      this.activePlayer.player
    );
  };

  private handleAudiotrackChanged = (event: any) => {
    this.playersBufferManager.syncPlayersStatus(
      Persistency.audioTrack,
      event.payload.selectedAudioTrack._language,
      this.activePlayer.player
    );
  };
  private handleVolumeChanged = (event: any) => {
    this.playersBufferManager.syncPlayersStatus(
      Persistency.volume,
      this.activePlayer.player.volume,
      this.activePlayer.player
    );
  };
  private handleMuteChanged = (event: any) => {
    const isMuted = event.payload.mute;
    this.playersBufferManager.syncPlayersStatus(
      Persistency.mute,
      isMuted,
      this.activePlayer.player
    );
  };

  removeListeners() {
    if (this.activePlayer && this.activePlayer.player) {
      const player: any = this.activePlayer.player;
      player.removeEventListener(
        player.Event.Core.TEXT_TRACK_CHANGED,
        this.handleTextTrackChanged
      );
      player.removeEventListener(
        player.Event.Core.AUDIO_TRACK_CHANGED,
        this.handleAudiotrackChanged
      );
      player.removeEventListener(
        player.Event.Core.RATE_CHANGE,
        this.handleRateChanged
      );
      player.removeEventListener(
        player.Event.Core.VOLUME_CHANGE,
        this.handleVolumeChanged
      );
      player.removeEventListener(
        player.Event.Core.MUTE_CHANGE,
        this.handleMuteChanged
      );
    }
  }

  addListenersToPlayer() {
    if (this.activePlayer && this.activePlayer.player) {
      const player: any = this.activePlayer.player;

      player.addEventListener(
        player.Event.Core.TEXT_TRACK_CHANGED,
        this.handleTextTrackChanged
      );

      player.addEventListener(
        player.Event.Core.AUDIO_TRACK_CHANGED,
        this.handleAudiotrackChanged
      );

      player.addEventListener(
        player.Event.Core.RATE_CHANGE,
        this.handleRateChanged
      );

      player.addEventListener(
        player.Event.Core.VOLUME_CHANGE,
        this.handleVolumeChanged
      );
      player.addEventListener(
        player.Event.Core.MUTE_CHANGE,
        this.handleMuteChanged
      );
    }
  }

  // Rapt interface - don't change signature //
  private element: HTMLElement; // must be called 'element' because rapt delegate implementation

  public pause() {
    if (this.activePlayer && this.activePlayer.player) {
      this.activePlayer.player.pause();
    }
  }

  public play() {
    if (this.activePlayer && this.activePlayer.player) {
      this.activePlayer.player.play();
    }
  }

  public seek(n) {
    if (this.activePlayer && this.activePlayer.player) {
      this.activePlayer.player.currentTime = n;
    }
  }

  load(media: any) {
    this.switchPlayer(media);
  }

  // Rapt interface - don't change signature //
  event(event: any) {
    if (event.type === "browser:open") {
      // track hotspot click
      const additionalData = {
        target: event.payload.href,
        hotspotId: event.context.payload.hotspot.id
      };
      this.sendAnalytics(47, additionalData);
    }
    if (event.type === "project:ready") {
      this.raptEngine.metadata.account = this.config.partnetId;
    }
    this.dispatch(event);
  }

  /**
   * The function sends an anlytics beacon.
   * @param eventNumber
   * @param attributes - an object of attributes to send on top of the event (will override existing attr
   * @param fieldsToRemove - array of strings that are not required on the event
   */
  sendAnalytics(
    eventNumber: number,
    attributes?: object,
    fieldsToRemove?: string[]
  ) {
    if (!this.model) {
      log(
        "error",
        "pm_sendAnalytics",
        "Missing basic event model - cannot send analytics"
      );
      return;
    }
    let tmpModel = Object.assign({}, this.model);
    tmpModel.eventType = eventNumber;

    if (attributes) {
      Object.keys(attributes).forEach(item => {
        tmpModel[item] = attributes[item];
      });
    }

    if (fieldsToRemove) {
      fieldsToRemove.forEach(field => {
        delete tmpModel[field];
      });
    }
    this.activePlayer.player.plugins.kava.sendAnalytics(tmpModel);
  }
}
