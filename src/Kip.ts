import KalturaInteractiveVideo from "./KalturaInteractiveVideo";
import "./Kip.scss";
import "script-loader!../libs/engineWithNodeId.min.js";
import { VERSION } from "../version";
import { log } from "./helpers/logger";

declare var KalturaPlayer: any;
declare var __kalturaplayerdata: any;

export interface RaptConfig {
  abr?: any;
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
    const uiconfData: any = __kalturaplayerdata.UIConf && __kalturaplayerdata.UIConf.playback ? Object.values(__kalturaplayerdata.UIConf)[0] : __kalturaplayerdata;
    const uiconfRaptData: any = uiconfData.rapt || {};
    const uiconfPlaybackData: any =
        (uiconfData.player && uiconfData.player.playback) || uiconfData.playback || {};
    const { serviceUrl } = uiconfData.provider?.env;

    // local config will override uiconf properties.
    config = {
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

    if (serviceUrl && !config.provider?.env?.serviceUrl) {
      if (!config.provider) {
        config.provider = {};
      }
      if (!config.provider.env) {
        config.provider.env = {};
      }
      config.provider.env.serviceUrl = serviceUrl;
    }

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
