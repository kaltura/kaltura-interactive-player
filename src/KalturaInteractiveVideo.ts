import { RaptConfig } from "./Kip";
import { PlayersManager } from "./PlayersManager";
import { KipClient } from "./KipClient";
import { CreateElement } from "./helpers/CreateElement";
import { Dispatcher } from "./helpers/Dispatcher";
import { BufferEvent } from "./BufferManager";

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

  constructor(
    private config: any,
    private playerLibrary: any,
    private rapt: any
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
        this.dispatchApi(err);
      });
  }

  /**
   * Once the graph-data is loaded - load the 1st media and place the rapt-engine layer
   * @param raptGraphData
   */
  dataLoaded(raptGraphData: object): void {
    this.playerManager = new PlayersManager(
      Object.assign({}, this.config),
      this.playerLibrary,
      this.playlistId,
      raptGraphData,
      this.mainDiv,
      this.rapt
    );

    // reflect all buffering evnets to the API
    for (let o of Object.values(BufferEvent)) {
      this.playerManager.addListener(o, (data?: any) => {
        this.dispatchApi(o, data);
      });
    }

    for (let eventName of API_EVENTS) {
      this.playerManager.addListener(eventName, (event: any) => {
        this.dispatchApi(eventName, event);
      });
    }
    this.playerManager.init(this.mainDiv);
  }

  /**
   * Expose API to the wrapping page/app
   * @param event
   * @param data
   */
  dispatchApi(event: string, data?: any) {
    if (this.config && this.config.rapt && this.config.rapt.debug) {
      // debug mode - print to console
      console.warn("Rapt: > " + event + data ? data : "");
    }
    // expose API, add the current node and
    this.dispatch({
      type: event,
      data: data
    });
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
}

export default KalturaInteractiveVideo;
