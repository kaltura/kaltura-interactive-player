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
  gaTrackId?: string;
}
function setup(config: RaptConfig): KalturaInteractiveVideo {
  if (console && console.log) {
    console.log("Path player " + VERSION);
  }
  // merge uiconf rapt data with current config (priority is local config) - this is a one-level object
  // extract the uiconf JSON
  try {
    const uiconfData: any = Object.values(__kalturaplayerdata.UIConf)[0];
    const uiconfRaptData: any = uiconfData.rapt || {};
    const uiconfPlaybackData: any =
      (uiconfData.player && uiconfData.player.playback) || {};
    // todo - consider global merge and not targeted attributes
    config.rapt = {
      ...config,
      rapt: {
        ...uiconfRaptData,
        ...config.rapt
      },
      playback: {
        ...uiconfPlaybackData,
        ...config.playback
      }
    };
    // detect Google Analytics
    if (
      uiconfData.player.plugins.googleAnalytics &&
      uiconfData.player.plugins.googleAnalytics.trackingId
    ) {
      config.gaTrackId = uiconfData.player.plugins.googleAnalytics.trackingId;
      log("log", "Kip", "Google Analytics exists ");
    }
  } catch (error) {
    log("log", "Kip", "Fail to merge local config and uiconf", error);
  }
  return new KalturaInteractiveVideo(config, KalturaPlayer);
}
export { setup };
