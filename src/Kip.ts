import { RaptClient } from "./RaptClient";
import { KipState } from "./helpers/States";
import { PlayersManager } from "./PlayersManager";
import { Dispatcher } from "./helpers/Dispatcher";
import IRaptConfig from "./interfaces/IRaptConfig";
import { BufferEvent } from "./helpers/KipEvents";

/**
 * Main app class. This class is in charge of initiating everything and orchestrate tha API, the data-fetching and
 * the app bootstrap flow.
 */

class Kip extends Dispatcher {
  config: any;
  playerManager: PlayersManager;
  playerLibrary: any;
  mainDiv: HTMLElement;
  rapt: any; // TODO - optimize
  playlistId: string;
  client: RaptClient; // Backend Client
  state: string;

  API_EVENTS: string[] = [
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
        z-index: 9999;
      }
      .kip-players-container{
       
      }
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

  setup(config: IRaptConfig, playerLibrary: any, rapt: any): Kip {
    this.state = KipState.INIT;
    this.config = config;
    this.rapt = rapt;
    this.playerLibrary = playerLibrary;
    this.mainDiv = document.getElementById(this.config.targetId);
    return this;
  }

  loadMedia(obj: any): void {
    let ks: string =
      this.config.session && this.config.session.ks
        ? this.config.session.ks
        : "";
    this.client = new RaptClient({
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
      this.rapt
    );

    // reflect all buffering evnets to the API
    for (let o of Object.values(BufferEvent)) {
      this.playerManager.addListener(o, (data?: any) => {
        this.dispatchApi(o, data);
      });
    }

    for (let eventName of this.API_EVENTS) {
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
    const messageDiv = document.createElement("div");
    const titleDiv = document.createElement("div");
    const bodeDiv = document.createElement("div");
    messageDiv.classList.add("kip-message__message");
    titleDiv.classList.add("kip-message__title");
    titleDiv.innerHTML = title;
    bodeDiv.classList.add("kip-message__body");
    bodeDiv.innerHTML = text;
    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(bodeDiv);
    this.mainDiv.appendChild(messageDiv);
  }
}
export default new Kip();
