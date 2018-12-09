import KalturaInteractiveVideo from "./KalturaInteractiveVideo";
import "./Kip.scss";
import "script-loader!../libs/engineWithNodeId.min.js";
import { VERSION } from "../version";
import { log } from "./helpers/logger";

declare var KalturaPlayer: any;
declare var __kalturaplayerdata: any;

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
  // merge uiconf rapt data with current config (priority is local config) - this is a one-level object
  config.rapt = config.rapt || {};
  // extract the uiconf JSON
  try {
    const uiconfData: any = Object.values(__kalturaplayerdata.UIConf)[0];
    const uiconfRaptData: any = uiconfData.rapt || {};
    // apply attributes from uiconf to local config, only if they do not exist in the local config
    Object.keys(uiconfRaptData).forEach(key => {
      if (!config.rapt.hasOwnProperty(key)) {
        config.rapt[key] = uiconfRaptData[key];
      }
    });
  } catch (error) {
    log("log", "Kip", "Fail to merge local config and uiconf", error);
  }
  return new KalturaInteractiveVideo(config, KalturaPlayer);
}
export { setup };
