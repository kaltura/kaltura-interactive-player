import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent } from "./helpers/KipEvents";
import { CreateElement } from "./helpers/CreateElement";
import { PlayersFactory } from "./PlayersFactory";
import {
  BufferEvent,
  PersistencyType,
  PlayersBufferManager
} from "./PlayersBufferManager";

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
  public currentPlayer: any;
  public currentNode: RaptNode;
  public element: HTMLElement; // must be called 'element' because rapt delegate implementation
  private playbackState: string;
  static PLAYER_TICK_INTERVAL: number = 250;
  private clickedHotspotId: String = undefined;
  private raptEngine: any;
  private model: any = undefined;

  constructor(
    private config: any,
    private playerLibrary: any,
    private raptProjectId: string,
    private raptData: any,
    private mainDiv: HTMLElement
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
      this.mainDiv,
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

    document.addEventListener("fullscreenchange", () => this.exitHandler());
    document.addEventListener("webkitfullscreenchange", () =>
      this.exitHandler()
    );

    // listen to fullscreen events from the players
    this.playersFactory.addListener(KipFullscreen.FULL_SCREEN_CLICKED, () => {
      this.toggleFullscreenState();
    });
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
      () => this.tick(this.currentPlayer, this.raptEngine),
      PlayersManager.PLAYER_TICK_INTERVAL
    );
  }
  private resizeEngine() {
    this.raptEngine.resize({
      width: this.mainDiv.offsetWidth,
      height: this.mainDiv.offsetHeight
    });
  }

  public switchPlayer(id: string): void {
    if (id === this.currentNode.entryId && this.currentPlayer !== undefined) {
      this.currentPlayer.currentTime = 0;
      this.currentPlayer.play();
      return;
    }
    const nextPlayer = this.playersBufferManager.getPlayer(id);
    // edge case where node is "switching" to itself
    if (nextPlayer) {
      this.removeListeners();
      this.addListenersToPlayer(nextPlayer);
      // found a player !
      const nextPlayersDivId = this.playersBufferManager.getPlayerDivId(id);
      const prevPlayerDivId = this.playersBufferManager.getPlayerDivId(
        this.currentNode.entryId
      );

      // pause current player and play next player
      this.currentPlayer.pause();

      // in case the next player was already played - seek to 0, else play it
      if (nextPlayer.currentTime > 0) {
        nextPlayer.currentTime = 0;
      }
      nextPlayer.play();
      this.currentPlayer = nextPlayer;

      // pop it to the front of the stack and move back the current
      this.mainDiv
        .querySelector("[id='" + nextPlayersDivId + "']")
        .classList.add("current-playing");
      this.mainDiv
        .querySelector("[id='" + prevPlayerDivId + "']")
        .classList.remove("current-playing");
      // now we can start buffer the next items
      this.currentNode = this.getNodeByEntryId(id);
      this.loadNextByNode(this.currentNode);
    } else {
      if (this.currentPlayer) {
        this.currentPlayer.pause();
      }
      this.currentNode = this.getNodeByEntryId(id);

      // in case we are in the middle of cache - purge it and only then ask for player creation
      const nextNodes: RaptNode[] = this.getNextNodes(this.currentNode);
      // convert to a list of entryIds
      let nextEntries: string[] = nextNodes.map(
        (node: RaptNode) => node.entryId
      );
      this.playersBufferManager.purgePlayers(id, nextEntries);

      // player does not exist - create it in autoplay mode
      this.currentPlayer = this.playersBufferManager.createPlayer(
        id,
        true,
        (entryId: string) => {
          this.loadNextByNode(this.currentNode);
        }
      );
      this.removeListeners();
      this.addListenersToPlayer(this.currentPlayer);
    }
  }

  /**
   * Start the sequence of caching next entries from a given node
   * @param node
   */
  private loadNextByNode(node: RaptNode) {
    const nextNodes: RaptNode[] = this.getNextNodes(node);
    // convert to a list of entryIds
    let nextEntries: string[] = nextNodes.map((node: RaptNode) => node.entryId);
    this.playersBufferManager.purgePlayers(node.entryId, nextEntries);
    this.playersBufferManager.prepareNext(nextEntries);
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

  public execute(command) {
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
  }

  addListenersToPlayer(player: any) {
    if (player) {
      player.addEventListener(player.Event.Core.TEXT_TRACK_CHANGED, event => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.captions,
          event.payload.selectedTextTrack._language,
          player
        );
      });
      player.addEventListener(player.Event.Core.AUDIO_TRACK_CHANGED, event => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.audioTrack,
          event.payload.selectedAudioTrack._language,
          player
        );
      });
      player.addEventListener(player.Event.Core.RATE_CHANGE, () => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.rate,
          this.currentPlayer.playbackRate,
          player
        );
      });
      player.addEventListener(player.Event.Core.VOLUME_CHANGE, () => {
        this.playersBufferManager.applyToPlayers(
          PersistencyType.volume,
          this.currentPlayer.volume,
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
      this.currentPlayer.plugins.kava.sendAnalytics(tmpModel);
      this.clickedHotspotId = event.payload.hotspot.id;
    }
    if (event.type === "project:ready") {
      this.raptEngine.metadata.account = this.config.partnetId;
    }
    this.dispatch(event);
  }

  tick(currentPlayer: any, raptEngine: any) {
    if (!currentPlayer) {
      return;
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
