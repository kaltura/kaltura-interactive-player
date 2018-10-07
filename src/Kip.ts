import { KipClient } from "./RaptClient";
import { PlayersManager } from "./PlayersManager";
import { Dispatcher } from "./helpers/Dispatcher";
import { BufferEvent } from "./helpers/KipEvents";
import { CreateElement } from "./helpers/CreateElement";

const API_EVENTS = [
  "project:load",
  "project:ready",
  "project:start",
  "player:play",
  "player:pause",
  "player:progress",
  "node:enter",
  "node:ended",
  "node:exit",
  "hotspot:click",
  "browser:hidden",
  "browser:open"
];

export const enum KipState {
    "preinit",
    "init",
    "loading",
    "playing",
    "error"
}

export interface RaptConfig {
  ui?: any;
  rapt: any;
  targetId: string;
  playback?: object;
  provider?: object;
}

/**
 * Main app class. This class is in charge of initiating everything and orchestrate tha API, the data-fetching and
 * the app bootstrap flow.
 */

class Kip extends Dispatcher {
  private config: any;
  private playerManager: PlayersManager;
  private playerLibrary: any;
  private mainDiv: HTMLElement;
  private rapt: any; // TODO - optimize
  private playlistId: string;
  private client: KipClient; // Backend Client
  public state: KipState = KipState.preinit;

  constructor() {
    super();
    const css = document.createElement("style");
    css.textContent = `
      .kip-message__title {
      }
      
      .kip-message__body{
      
      }
      
      .kip-message__message{
          corner-radius:4px;
          background: #EEEEEE;
      }
      
      .kiv-cache-player{
        
      }
      .current-playing{
        z-index: 99;
      }
      .kip-players-container{
          position: relative;
           z-index: 500;
      }
      .kiv-player{
        position: absolute
      }
      .kiv-rapt-engine{
        z-index: 1000;
        position: absolute;
      }
      .kiv-container{
        position: relative;
      }
      .kiv-container,
      .kiv-rapt-engine,
      .kiv-player,
      .kip-players-container
      {
        width: 100%;
        height: 100%;
      }
    `;
    document.head.appendChild(css);
  }

  setup(config: RaptConfig, playerLibrary: any, rapt: any): Kip {
    if (this.state !== KipState.preinit) {
      // todo - handle errors
      this.printMessage("Error", "Setup should be called once!");
      return;
    }
    this.state = KipState.init;
    this.config = config;
    this.rapt = rapt;
    this.playerLibrary = playerLibrary;
    return this;
  }

  loadMedia(obj: any): void {
    if (this.state !== KipState.init) {
      // todo - handle errors
      this.printMessage("Error", "loadMedia should be called after setup");
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
    const messageDiv = CreateElement("div", null, "kip-message__message");
    const titleDiv = CreateElement("div", null, "kip-message__title");
    const bodeDiv = CreateElement("div", null, "kip-message__body");
    titleDiv.innerHTML = title;
    bodeDiv.innerHTML = text;
    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(bodeDiv);
    this.mainDiv.appendChild(messageDiv);
  }
}
export default new Kip();
