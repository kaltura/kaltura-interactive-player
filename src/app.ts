import { RaptClient } from "./RaptClient";
import { PlayersManager } from "./PlayersManager";
import IRaptConfig from "./interfaces/IRaptConfig";

class Rapt {
  config: any;
  playerManager: PlayersManager;
  playerLibrary: any;
  playlistId: string;
  client: RaptClient;

  constructor() {}
  setup(config: IRaptConfig, playerLibrary: any): Rapt {
    this.config = config;
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
      raptGraphData
    );
    this.playerManager.initPlayback();
  }
}
export default new Rapt();
