import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent } from "./helpers/KipEvents";
import { KalturaPlayer, PlayersFactory } from "./PlayersFactory";
import { PlayersBufferManager } from "./PlayersBufferManager";
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
  textStyle = "textStyle",
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
  private clickedHotspotId: string = undefined;
  private activeNode: RaptNode = null;
  static playerTickInterval: number = 250;
  public raptEngine: any;
  private analyticsModel: any = undefined;
  private isAvailable: boolean;
  private firstPlay: boolean = true;
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
      setTimeout(() => {
        this.isAvailable = this.initRaptEngine();
        // responsiveness resize support
        this.resizeInterval = setInterval(
          this.handleWindowResized.bind(this),
          250
        );
      });
    }
  }

  private initPlayersBufferManager(): boolean {
    // create the PlayersBufferManager
    this.playersBufferManager = new PlayersBufferManager(
      this.raptData,
      this.playersFactory
    );
    if (
      this.config.rapt &&
      this.config.rapt.hasOwnProperty("bufferNextNodes") &&
      this.config.rapt.bufferNextNodes === false
    ) {
      this.playersBufferManager.disable();
    } else {
      const bufferingEvents = ["buffer:prebuffer","buffer:bufferend","buffer:bufferstart","buffer:allbuffered"];
      for (let bufferEvent of bufferingEvents){
        this.playersBufferManager.addListener(bufferEvent , (event) => {
          this.dispatch(event);
        })
      }
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
      if (!this.analyticsModel) {
        this.analyticsModel = model; // store model data for future use of Rapt sending data
      }
      model.rootEntryId = this.raptProjectId;
      model.nodeId = this.activeNode.id;
      model.entryId = this.activeNode.entryId;
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

    // apply google-analytics track id if exist
    const options: any = {};
    if (this.config.gaTrackId) {
      options.$ga = this.config.gaTrackId;
    }
    this.raptEngine = new Rapt.Engine(this, options);
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
          // TODO 1 must destroy active player
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

  /**
   * This will send the first nodePlay event only if it has analytics model.
   * If it doesn't have a model it will try again later.
   */
  private trySendingFirstEvent(entryId: string) {
    setTimeout(() => {
      if (this.analyticsModel) {
        this.sendAnalytics(44, { entryId: entryId });
      } else {
        this.trySendingFirstEvent(entryId);
      }
    }, 250);
  }
  ////////////////////////////////////////////

  private projectStarted() {
    // project had started - unhide the rapt layer now and hide the large-play-button layer
    this.domManager.showRaptLayer();
    this.domManager.addClass("kiv-initiated");
    this.removeListener("project:start", () => this.projectStarted);
    // make sure we are setting the current player to autoplay. For both non-buffered path and in case we reuse this player as a buffered player
    try {
      this.activePlayer.player.configure({ playback: { autoplay: true } });
    } catch (e) {
      log("log", "pm_projectStarted", "Could not apply autoplay to player", e);
    }
  }

  // called by Rapt on first-node, user click, defaultPath and external API "jump"
  private switchPlayer(media: any): void {
    const newEntryId = media.sources[0].src;
    const nextRaptNode: RaptNode = media.node;
    const raptLayer:HTMLElement = document.querySelector(" .kiv-rapt-engine");

    // send analytics of nodePlay - event44
    if (this.analyticsModel) {
      this.sendAnalytics(44, { entryId: newEntryId });
    } else {
      // At this point we do not have the 1st player nor analytics model. This will make sure to send the 44 event when
      // we have a model.
      this.trySendingFirstEvent(newEntryId);
    }

    if (this.activeNode) {
      let params: any = {
        entryId: newEntryId,
        fromNodeId: this.activeNode.id,
        toNodeId: nextRaptNode.id
      };
      if (this.clickedHotspotId) {
        params.hotspotId = this.clickedHotspotId;
        // clear saved hotspotId
        this.clickedHotspotId = undefined;
      }
      this.sendAnalytics(48, params);
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

    // autoplay false detection
    let shouldPlayNow = true;
    if (
      this.firstPlay &&
      this.config.playback &&
      this.config.playback.autoplay === false
    ) {
      shouldPlayNow = false;
      log(
        "log",
        "pm_switchPlayer",
        "setting autoplay to false on first node with playersBufferManager",
        {
          entryId: newEntryId
        }
      );
    }
    if (!shouldPlayNow && this.firstPlay) {
      // autoplay = false. Hide the rapt layer until the project is started
      this.domManager.hideRaptLayer();
      this.addListener("project:start", () => this.projectStarted());
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
        shouldPlayNow,
        this.firstPlay && !shouldPlayNow
      );
      this.firstPlay = false;
      this.updateActiveItems(bufferedPlayer, nextRaptNode);
    } else {
      log(
        "log",
        "pm_switchPlayer",
        "buffer manager not available, switch media on current player"
      );

      if (!this.activePlayer) {
        log("log", "pm_switchPlayer", "no player found, create main player", {
          entryId: newEntryId
        });

        const newPlayer = this.playersFactory.createPlayer(
          newEntryId,
          shouldPlayNow,
          null,
          this.firstPlay && !shouldPlayNow
        );

        this.firstPlay = false;

        this.updateActiveItems(newPlayer, nextRaptNode);
      } else {
        log("log", "pm_switchPlayer", "switch media on main player", {
          entryId: newEntryId
        });
        // Even if autoplay was set to false, any next video must be played automaticaly
        if (this.firstPlay && this.config.playback.autoplay === false) {
          this.activePlayer.player.configure({ playback: { autoplay: true } });
          // this is a >= 2nd entry - from here on we do not need the poster for nxt entries
          this.activePlayer.player.configure({ sources: { poster: "" } });
          log(
            "log",
            "pm_switchPlayer",
            "setting autoplay to true (after first load) and poster to off"
          );
        }
        this.firstPlay = false;
        this.updateActiveItems(this.activePlayer, nextRaptNode);
        this.activePlayer.player.loadMedia({
          entryId: newEntryId
        });
      }
    }
    // reparenting rapt layer on mobile.
    if (this.playersFactory.playerLibrary.core.Env.device.model) {
      this.domManager.reparentRaptLayer(raptLayer);
    }
  }

  public execute(command: any) {
    if (!this.raptEngine) {
      log(
        "error",
        "pm_execute",
        "Error: Rapt Media commands received before initialization is complete"
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

  private handleTrackStyleChanged = (event: any) => {
    this.playersBufferManager.syncPlayersStatus(
        Persistency.textStyle,
        this.activePlayer.player._localPlayer.textStyle.clone(),
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
          player.Event.Core.TEXT_STYLE_CHANGED,
          this.handleTrackStyleChanged
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
        player.Event.Core.PLAY,
          () => {
          const tracks = player.getTracks();
          const audioTracks = tracks.find(track => (track._kind !== "subtitles" && !track._bandwidth ));
          const captionsTracks = tracks.find(track => (track._kind === "subtitles" ))
          if(audioTracks || captionsTracks){
            // this video has captions or audio
            const view = player.getView().parentElement.parentElement.parentElement;
            view.classList.add("has-extra-tracks")
          }
        })
      ;
      player.addEventListener(
        player.Event.Core.TEXT_TRACK_CHANGED,
        this.handleTextTrackChanged
      );

      player.addEventListener(
        player.Event.Core.AUDIO_TRACK_CHANGED,
        this.handleAudiotrackChanged
      );

      player.addEventListener(
        player.Event.Core.TEXT_STYLE_CHANGED,
        this.handleTrackStyleChanged
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
    if (event.type === "hotspot:click") {
      // save the hotspot id so we can send it to analytics
      this.clickedHotspotId = event.payload.hotspot.id;
    }
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
    if (!this.analyticsModel) {
      log(
        "error",
        "pm_sendAnalytics",
        "Missing basic event model - cannot send analytics"
      );
      return;
    }
    let tmpModel = Object.assign({}, this.analyticsModel);
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
