import KalturaInteractiveVideo from "./KalturaInteractiveVideo";
import "./Kip.scss";

export interface RaptConfig {
  ui?: any;
  rapt: any;
  targetId: string;
  playback?: object;
  provider?: object;
}
/**
 * This class creates an instance of KalturaInteractiveVideo when called 'setup' function,
 * it also handles CSS creation (once)
 */
class Kip {
  // flag to enforce single CSS injection to page
  private cssInjected: boolean = false;

  constructor() {}

  public setup(config: RaptConfig, rapt: any): KalturaInteractiveVideo {
    return new KalturaInteractiveVideo(config, KalturaPlayer, rapt);
  }
}
export default new Kip();

// inject KIP into player library so that KalturaPlayer.kip.setup will be available and return a new kip instance
declare var KalturaPlayer: any;
KalturaPlayer.kip = KalturaPlayer.kip || new Kip();
