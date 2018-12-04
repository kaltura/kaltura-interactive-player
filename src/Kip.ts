import KalturaInteractiveVideo from "./KalturaInteractiveVideo";
import "./Kip.scss";
import "script-loader!../libs/engineWithNodeId.min.js";
import { VERSION } from "../version";

declare var KalturaPlayer: any;
export interface RaptConfig {
  ui?: any;
  rapt: any;
  targetId: string;
  playback?: any;
  sources?: { poster?: any };
  provider?: any;
  plugins?: any;
}
function setup(config: RaptConfig): KalturaInteractiveVideo {
  if (console && console.log) {
    console.log("Path player " + VERSION);
  }
  return new KalturaInteractiveVideo(config, KalturaPlayer);
}
export { setup };
