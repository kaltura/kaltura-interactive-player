import { PlayersManager, RaptNode } from "./PlayersManager";
import { KipClient } from "./KipClient";
import { CreateElement } from "./helpers/CreateElement";
import { Dispatcher, KivEvent } from "./helpers/Dispatcher";
import { BufferEvent } from "./PlayersBufferManager";

const API_EVENTS = [
  "browser:hidden",
  "browser:open",
  "cue:forward",
  "cue:reverse",
  "hotspot:click",
  "node:enter",
  "node:ended",
  "node:exit",
  "project:load",
  "project:ready",
  "project:start",
  "project:ended",
  "project:unload",
  "player:play",
  "player:pause",
  "player:progress",
  "player:ratechange",
  "player:timeupdate",
  "player:volumechange"
];

export const enum KipState {
  "preinit",
  "init",
  "loading",
  "playing",
  "error"
}

class KalturaInteractiveVideo extends Dispatcher {
  private playerManager: PlayersManager;
  private mainDiv: HTMLElement;
  private playlistId: string = "";
  private client: KipClient; // Backend Client
  public state: KipState = KipState.preinit;
  private _data: any; // container to data API

  constructor(
    private config: any,
    private playerLibrary: any
  ) {
    super();
    this.state = KipState.init;
  }

  loadMedia(obj: any): void {
    // if (this.state !== KipState.init) {
    //   // todo - handle errors API
    //   this.printMessage("Error", "loadMedia should be called after setup");
    //   return;
    // }
    if (!obj || !obj.entryId) {
      // todo - handle errors API
      this.printMessage("Error", "missing rapt project id");
      return;
    }
    // create a top-level container
    this.mainDiv = CreateElement(
      "div",
      "kiv-container__" + obj.entryId,
      "kiv-container"
    );
    document.getElementById(this.config.targetId).appendChild(this.mainDiv);

    let ks: string =
      this.config.session && this.config.session.ks
        ? this.config.session.ks
        : "";
    this.client = new KipClient({
      ks: ks,
      partnerId: this.config.provider.partnerId
    }); //TODO add serviceUrl
    this.playlistId = obj.entryId;
    this.client
      .loadRaptData(this.playlistId)
      .then(graphData => {
        this.dataLoaded(graphData);
      })
      .catch((err: string) => {
        this.printMessage("API Error", err);
        this.dispatchApi({ type: "Error" });
      });
  }

  /**
   * Once the graph-data is loaded - load the 1st media and place the rapt-engine layer
   * @param raptGraphData
   */
  dataLoaded(raptGraphData: object): void {
    this._data = raptGraphData;
    this.playerManager = new PlayersManager(
      Object.assign({}, this.config),
      this.playerLibrary,
      this.playlistId,
      raptGraphData,
      this.mainDiv
    );

    // reflect all buffering evnets to the API
    for (let o of Object.values(BufferEvent)) {
      this.playerManager.addListener(o, (event: KivEvent) => {
        // translate to
        this.dispatchApi(event);
      });
    }

    for (let eventName of API_EVENTS) {
      this.playerManager.addListener(eventName, (event: KivEvent) => {
        this.dispatchApi(event);
      });
    }
    this.playerManager.init();
  }
  /**
   * Expose API to the wrapping page/app
   * @param event
   * @param data
   */
  dispatchApi(event: KivEvent) {
    if (this.config.rapt.debug) {
      // debug mode - print to console
      if (event.type === "player:timeupdate") {
        return;
      }
      console.warn(
        // "Rapt: > " + event.type + event.payload ? event.payload : ""
        "Rapt: > ",
        event
      );
    }
    // expose API, add the current node and
    this.dispatch(event);
  }

  /**
   * Print a message on the main div, usually used to show error messages to the end-user (E.G. missing rapt data)
   * @param title
   * @param text
   */
  printMessage(title: string, text: string = "") {
    const messageDiv = CreateElement("div", null, "kiv-message__message");
    const titleDiv = CreateElement("div", null, "kiv-message__title");
    const bodeDiv = CreateElement("div", null, "kiv-message__body");
    titleDiv.innerHTML = title;
    bodeDiv.innerHTML = text;
    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(bodeDiv);
    this.mainDiv.appendChild(messageDiv);
  }
  /**
   * Legacy API support
   */
  public pause() {
    this.playerManager.currentPlayer.pause();
  }

  public play() {
    this.playerManager.currentPlayer.play();
  }

  public seek(n: number) {
    this.playerManager.currentPlayer.currentTime = n;
  }

  public replay() {
    this.playerManager.execute({
      type: "project:replay"
    });
  }
  public reset() {
    this.playerManager.execute({
      type: "project:reset"
    });
  }

  public get data(): any {
    return this._data;
  }

  // public get metadata(): any {
  //   debugger;
  //   if (
  //     this.playerManager &&
  //     this.playerManager.raptEngine &&
  //     this.playerManager.raptEngine.metadata
  //   ) {
  //     return this.playerManager.raptEngine.metadata;
  //   }
  //   return {};
  // }

  public get currentTime(): number {
    return this.playerManager.currentPlayer.currentTime;
  }

  public get duration(): number {
    return this.playerManager.currentPlayer.duration;
  }

  public get currentNode(): RaptNode {
    return this.playerManager.currentNode;
  }

  public get volume(): number {
    return this.playerManager.currentPlayer.volume;
  }

  public set volume(n: number) {
    this.playerManager.currentPlayer.volume = n;
  }

  public get muted(): number {
    return this.playerManager.currentPlayer.muted;
  }
  public get playbackRate(): number {
    return this.playerManager.currentPlayer.playbackRate;
  }

  public jump(locator: any, autoplay: boolean) {
    this.playerManager.execute({
      type: "project:jump",
      payload: { destination: locator }
    });
  }
}


export default KalturaInteractiveVideo;
