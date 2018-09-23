import { RaptClient } from "./RaptClient";
import { KipState } from "./helpers/States";
import { PlayersManager } from "./PlayersManager";
import { Dispatcher } from "./helpers/Dispatcher";
import IRaptConfig from "./interfaces/IRaptConfig";

class Kip extends Dispatcher {
  config: any;
  playerManager: PlayersManager;
  playerLibrary: any;
  mainDiv: HTMLElement;
  rapt: any; // TODO - optimize
  playlistId: string;
  client: RaptClient; // Backend Client
  state: string;

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
      this.config,
      this.playerLibrary,
      this.playlistId,
      raptGraphData,
      this.rapt
    );

    this.playerManager.addListener("message", (data: any) => {
      this.dispatch("log", { event: "log", data: data });
    });

    this.playerManager.init(this.mainDiv);
  }

  /**
   * Expose API to the wrapping page
   * @param event
   * @param data
   */
  dispatchApi(event: string, data?: any) {
    if (this.config && this.config.rapt && this.config.rapt.debug) {
      // debug mode - print to console
      console.warn("Rapt >> ", event);
      if (data) {
        console.warn("Rapt >> >>", data);
      }
      // Log API
      this.dispatch("log", { event: event, data: data });
    }
    // expose API
    this.dispatch(event, data);
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
