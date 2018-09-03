import { States } from "./helpers/States";
import { RaptClient } from "./RaptClient";
import { PlayersManager } from "./PlayersManager";
import IRaptConfig from "./interfaces/IRaptConfig";

class Kip {
  config: any;
  playerManager: PlayersManager;
  playerLibrary: any;
  rapt: any; // TODO - optimize
  playlistId: string;
  client: RaptClient; // Backend Client
  state: string;

  constructor() {}

  setup(config: IRaptConfig, playerLibrary: any, rapt: any): Kip {
    this.state = States.INIT;
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
      .catch(err => {
        //todo handle err later
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
    // this.playerManager.addEventListener(States.ERROR => {alert("ERROR")})
    this.playerManager.init();
  }
}
export default new Kip();
