import KalturaInteractiveVideo from "./KalturaInteractiveVideo";
import "./Kip.scss";
import "script-loader!../libs/engine.min.js";

declare var KalturaPlayer: any;

export interface RaptConfig {
  ui?: any;
  rapt: any;
  targetId: string;
  playback?: any;
  provider?: any;
  plugins?: any;
}
function setup(config: RaptConfig): KalturaInteractiveVideo {
  return new KalturaInteractiveVideo(config, KalturaPlayer);
}
export { setup };
