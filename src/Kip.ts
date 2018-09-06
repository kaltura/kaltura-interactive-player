import { RaptClient } from "./RaptClient";
import { KipState } from "./helpers/States";
import { PlayersManager } from "./PlayersManager";
import { Dispatcher } from "./helpers/Dispatcher";
import IRaptConfig from "./interfaces/IRaptConfig";

class Kip extends Dispatcher {
  config: any;
  playerManager: PlayersManager;
  playerLibrary: any;
  rapt: any; // TODO - optimize
  playlistId: string;
  client: RaptClient; // Backend Client
  state: string;

  constructor() {
    super();
  }

  setup(config: IRaptConfig, playerLibrary: any, rapt: any): Kip {
    this.state = KipState.INIT;
    this.config = config;
    this.rapt = rapt;
    this.playerLibrary = playerLibrary;
    return this;
  }

  loadMedia(obj: any): void {
    let ks: string =
      this.config.session && this.config.session.ks
        ? this.config.session.ks
        : "";
    this.client = new RaptClient({ ks: ks });
    this.playlistId = obj.entryId;
    this.client
      .loadRaptData(this.playlistId)
      .then(graphData => {
        this.dataLoaded(graphData);
      })
      .catch((err: string) => {
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

    // this.playerManager.addEventListener(States.ERROR => {alert("ERROR")})
    const mainDiv = document.getElementById(this.config.targetId);
    this.playerManager.init(mainDiv);
  }

  dispatchApi(event: string, data?: any) {
    if (this.config && this.config.rapt && this.config.rapt.debug) {
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
}
export default new Kip();
