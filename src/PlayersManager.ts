import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent } from "./helpers/KipEvents";
import { CreateElement } from "./helpers/CreateElement";
import {PlayersFactory, playerTuple, RaptPlayer} from "./PlayersFactory";
import {
  BufferEvent,
  PersistencyType,
    PlayersBufferManager
} from "./PlayersBufferManager";
import {PlayersDomManager} from "./PlayersDomManager";

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

export const PlaybackState = {
  PLAYING: "playing",
  PAUSED: "paused"
};

/**
 * This class manages players, and places and interact with the Rapt engine layer
 * This class creates and manages BufferManager
 */
export class PlayersManager extends Dispatcher {
  private playersBufferManager: PlayersBufferManager;
  readonly playersFactory: PlayersFactory;
  private activePlayer: RaptPlayer;
  private activeNode: RaptNode;
  public element: HTMLElement; // must be called 'element' because rapt delegate implementation
  private playbackState: string;
  static PLAYER_TICK_INTERVAL: number = 250;
  private clickedHotspotId: String = undefined;
  public raptEngine: any;
  private model: any = undefined;


  constructor(
    private config: any,
    private playerLibrary: any,
    readonly raptProjectId: string,
    private raptData: any,
    private domManager: PlayersDomManager
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

    /**
     * This function interrupts the player kava beacons, alter some attributes (in case of need) and prevents some
     * of the events.
     * @param model
     */
    const analyticsInterruptFunc = (model: any): boolean => {
      //TODO - fix
      if (!this.model) {
        this.model = model; // store model data for future use of Rapt sending data
      }
      model.rootEntryId = this.raptProjectId;
      model.nodeId = this.activeNode.id;
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

    // create the PlayersBufferManager
    this.playersBufferManager = new PlayersBufferManager(this.playersFactory);
    // listen to all BufferEvent types from PlayersBufferManager
    for (let o of Object.values(BufferEvent)) {
      this.playersBufferManager.addListener(o, (event: any) => {
        // bubble up all events
        this.dispatch(event);
      });
    }

    document.addEventListener("fullscreenchange", () => this.exitHandler());
    document.addEventListener("webkitfullscreenchange", () =>
      this.exitHandler()
    );

    // listen to fullscreen events from the players
    this.playersFactory.addListener(KipFullscreen.FULL_SCREEN_CLICKED, () => {
      this.toggleFullscreenState();
    });
  }

  public getPlayer(throwOnEmpty = false): any {
    // TODO make this.currentItem scope private
  }

  public init() {
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

  private toggleFullscreenState() {
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

  private exitHandler() {
    const doc: any = document;
    if (!doc.fullscreenElement && !doc.webkitIsFullScreen) {
      this.toggleFullscreenState();
    }
  }

  // initiate Rapt-engine layer
  private initRapt() {
    this.raptEngine = new Rapt.Engine(this);
    this.raptEngine.load(this.raptData);
    this.resizeEngine();
    setInterval(
      () => this.tick(),
      PlayersManager.PLAYER_TICK_INTERVAL
    );
  }
  private resizeEngine() {
    this.raptEngine.resize({
      width: this.mainDiv.offsetWidth,
      height: this.mainDiv.offsetHeight
    });
  }

  ////////////////////////////////////////////
  // store the player and the node
  private updateCurrentPlayer(
      nextPlayer: RaptPlayer,
      nextNode: RaptNode
  ): void {
    const hasActivePlayer = this.activePlayer;
      const hasActiveNode = this.activeNode;
    const isSwitchingPlayer =
        !hasActivePlayer || this.activePlayer != nextPlayer;
    const isSwitchingRaptNode =
          !hasActiveNode || this.activeNode !== nextNode;

    // TODO stop checking for buffer completed of current played entry
    // whatever.stopCheckTimeout();

      if (hasActivePlayer) {
          this.activePlayer.player.pause();

          if (isSwitchingPlayer) {
              // remove listeners
              this.removeListeners(); // todo - safer to send reference ?

              if (!this.playersBufferManager.isAvailable()) {
                  // TODO must destroy active player
              }
          }
      }

    if (isSwitchingRaptNode) {
      // purge players from bufferManager
      const expectList = this.getNextNodes(this.activeNode).map(
        node => node.entryId
      );
      this.playersBufferManager.purgePlayers(expectList);
    }


    this.activePlayer = nextPlayer;
    this.activeNode = nextNode;

    if (isSwitchingPlayer) {
        // remove player from ui
        this.domManager.changeActivePlayer(this.activePlayer);
      // register listeners
      this.addListenersToPlayer(); // todo - safer to send reference ?
    }

    // TODO start checking for buffer completed of current played entry
    // utils.onPlaying(playerEl.player, () => {
    // this.startBufferCheck()
    // });
  }
  ////////////////////////////////////////////

  // called by Rapt on first-node, user click, defaultPath and external API "jump"
  public switchPlayer(newEntryId: string): void {
      const nextRaptNode: RaptNode = this.getNodeByEntryId(newEntryId);

      if (this.activePlayer && this.activeNode === nextRaptNode) {
          // node is "switched" to itself
          this.activePlayer.player.currentTime = 0;
          this.activePlayer.player.play();
          return;
      }

      // check if bufferManager has a ready-to-play player
      const bufferedPlayer = this.playersBufferManager.getPlayer(newEntryId);
      if (bufferedPlayer) {
          this.updateCurrentPlayer(bufferedPlayer, nextRaptNode);
          this.activePlayer.player.play();
      }
      else if (!this.activePlayer || this.playersBufferManager.isAvailable()) {
          const newPlayer = this.playersFactory.createPlayer(
              newEntryId,
              true,
              {}
          );
          this.updateCurrentPlayer(newPlayer, nextRaptNode);
      } else {
          this.updateCurrentPlayer(this.activePlayer, nextRaptNode);

          // fallback to re-use of active player (allowed ONLY IF buffer manager is not available)
          this.activePlayer.player.loadMedia({
              entryId: this.activeNode.entryId
          })
      }
  }

  /**
   * Start the sequence of caching next entries from a given node
   * @param node
   */
  private loadNextByNode(node: RaptNode) {
    return;

    // TODO move logic to buffer manager .isAvailable() method
    // prevent caching on Safari and if config set to no-cache
    const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(
      navigator.userAgent
    );
    if (
      isSafari ||
      (this.config.rapt &&
        this.config.rapt.hasOwnProperty("bufferNextNodes") &&
        this.config.rapt.bufferNextNodes === false)
    ) {
      return;
    }
    // end of todo

    // this.playersBufferManager.prepareNext(nextEntries);
  }

  /**
   * Get a list of optional nodes for the given node
   *  @param node
   */
  private getNextNodes(node: RaptNode): RaptNode[] {
    let nodes: RaptNode[] = node.prefetchNodeIds.length
      ? node.prefetchNodeIds.map((nodeId: string) =>
          this.getNodeByRaptId(nodeId)
        )
      : [];
    // at this point we have a list of next nodes without default-path and without order according to appearance time
    nodes = this.sortByApearenceTime(nodes, node);
    return nodes;
  }

  private getNodeByEntryId(entryId: string): RaptNode {
    // TODO - optimize using this.clickedHotspotId in case there are more than one nodes with the same entry-id
    const newNode: RaptNode = this.raptData.nodes.find(
      (node: RaptNode) => node.entryId === entryId
    );
    return newNode;
  }

  /**
   * Return a rapt node
   * @param id
   */
  private getNodeByRaptId(id: string): RaptNode {
    const nodes: RaptNode[] = this.raptData.nodes;
    return nodes.find((item: RaptNode) => item.id === id);
  }

  /**
   * Sort a given nodes-array by the appearance-order of the hotspots in that node
   * @param arr of Nodes
   * @param givenNode
   */
  private sortByApearenceTime(
    arr: RaptNode[],
    givenNode: RaptNode
  ): RaptNode[] {
    // get relevant hotspots (that has the givenNode as 'nodeId' ) and sort them by their showAt time
    const hotspots: any[] = this.raptData.hotspots
      .filter((hotSpot: any) => {
        return (
          hotSpot.nodeId === givenNode.id &&
          hotSpot.onClick &&
          hotSpot.onClick.find((itm: any) => itm.type === "project:jump") // filter out only-URL clicks
        );
      })
      .sort((a: any, b: any) => a.showAt > b.showAt); // sort by appearance time

    const arrayToCache: RaptNode[] = [];
    for (const hotSpot of hotspots) {
      arrayToCache.push(
        arr.find((itm: RaptNode) => {
          // extract the onClick element with type 'project:jump'
          const clickItem: any = hotSpot.onClick.find(
            (itm: any) => itm.type === "project:jump"
          );
          return clickItem.payload.destination === itm.id;
        })
      );
    }
    // if there was a default-path on the current node - make sure it is returned as well
    const defaultPath: any = givenNode.onEnded.find(
      (itm: any) => itm.type === "project:jump"
    );
    if (defaultPath) {
      const defaultPathNodeId: string = defaultPath.payload.destination;
      const defaultPathNode: RaptNode = this.raptData.nodes.find(
        n => n.id === defaultPathNodeId
      );
      arrayToCache.push(defaultPathNode);
    }
    return arrayToCache;
  }

  public execute(command: any) {
    if (!this.raptEngine) {
      console.log(
        "WARNING: Rapt Media commands received before initialization is complete"
      );
      return;
    }
    this.raptEngine.execute(command);
  }

  removeListeners() {
    // todo - implement removeEventsListeners
    const player: any = this.activePlayer.player;
    if (player) {
      player.removeEventListener(
        player.Event.Core.TEXT_TRACK_CHANGED,
        event => {
          // todo - switch to external func to ease the removeEvList
          this.playersBufferManager.applyToPlayers(
            PersistencyType.captions,
            event.payload.selectedTextTrack._language,
            player
          );
        }
      );
      player.removeEventListener(
        player.Event.Core.AUDIO_TRACK_CHANGED,
        event => {
          this.playersBufferManager.applyToPlayers(
            PersistencyType.audioTrack,
            event.payload.selectedAudioTrack._language,
            player
          );
        }
      );
      player.removeEventListener(player.Event.Core.RATE_CHANGE, () => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.rate,
          this.activePlayer.player.playbackRate,
          player
        );
      });
      player.removeEventListener(player.Event.Core.VOLUME_CHANGE, () => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.volume,
          this.activePlayer.player.volume,
          player
        );
      });
      player.addEventListener(player.Event.Core.VIDEO_TRACK_CHANGED, event => {
        // TODO handle quality later
        // this.playersBufferManager.applyToPlayers(
        //   PersistencyType.quality,
        //   event.payload
        //     ,player
        // );
      });
    }
  }

  addListenersToPlayer() {
    if (this.activePlayer) {
      // // todo - switch to external func to ease the removeEvList
      // player.addEventListener(player.Event.Core.TEXT_TRACK_CHANGED, event => {
      //   this.playersBufferManager.applyToPlayers(
      //     PersistencyType.captions,
      //     event.payload.selectedTextTrack._language,
      //     player
      //   );
      // });
      //
      // player.addEventListener(player.Event.Core.AUDIO_TRACK_CHANGED, event => {
      //   this.playersBufferManager.applyToPlayers(
      //     PersistencyType.audioTrack,
      //     event.payload.selectedAudioTrack._language,
      //     player
      //   );
      // });
      // player.addEventListener(player.Event.Core.RATE_CHANGE, () => {
      //   this.playersBufferManager.applyToPlayers(
      //     PersistencyType.rate,
      //     this.activePlayer2.player.playbackRate,
      //     player
      //   );
      // });
      // player.addEventListener(player.Event.Core.VOLUME_CHANGE, () => {
      //   this.playersBufferManager.applyToPlayers(
      //     PersistencyType.volume,
      //     this.activePlayer2.player.volume,
      //     player
      //   );
      // });
      // player.addEventListener(player.Event.Core.VIDEO_TRACK_CHANGED, event => {
      //   // TODO handle quality later
      //   // this.playersBufferManager.applyToPlayers(
      //   //   PersistencyType.quality,
      //   //   event.payload
      //   //     ,player
      //   // );
      // });
    }
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
    if (event.type === "hotspot:click") {
      let tmpModel = Object.assign({}, this.model);
      tmpModel.eventType = 44;
      // this.activePlayer2.player.plugins.kava.sendAnalytics(tmpModel);
      this.clickedHotspotId = event.payload.hotspot.id;
    }
    if (event.type === "project:ready") {
      this.raptEngine.metadata.account = this.config.partnetId;
    }
    this.dispatch(event);
  }

  private tick() {
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
  /////////////////////////////////////////////////////////////////////////
}
