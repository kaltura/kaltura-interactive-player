// import Rapt from "../libs/engine.min.js";
import KalturaInteractiveVideo from "./KalturaInteractiveVideo";

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

  injectCss() {
    // make sure this happens only once !
    if (this.cssInjected) {
      return;
    }
    const css = document.createElement("style");
    // todo - maintain as external CSS file later
    css.textContent = `
 .kiv-message__title {
}
 .kiv-message__body{
}
 .kiv-message__message{
     corner-radius:4px;
     background: #EEEEEE;
}
 .kiv-player.current-playing{
     z-index: 100;
}
 .kiv-players-container{
     position: relative;
     z-index: 500;
}
 .kiv-player{
     position: absolute 
}
 .kiv-hidden{
     display: none;
}
 .kiv-rapt-engine{
     z-index: 1000;
     position: absolute;
}
 .kiv-container{
     position: relative;
}
 .kiv-container, .kiv-player, .kiv-players-container {
     width: 100%;
     height: 100%;
}
 .kiv-container .playkit-left-controls {
     width: calc(100% - 130px);
}
 .kiv-container .playkit-player-gui {
     font-family: "courier" !important;
}
 .kiv-container .playkit-player .playkit-time-display{
     line-height: 26px;
 }
 .kiv-container .playkit-time-display {
     float: right;
     position: relative;
     left: 0px;
     font-family: sans-serif;
     padding: 0px;
     margin-right: 6px;
}
 .kiv-container .playkit-seek-bar {
     padding: 6px 0;
     cursor: pointer;
     position: relative;
     top: 20px;
     width: calc(100% - 310px);
     left: 45px;
}
 .kiv-container .playkit-icon-rewind-10 {
     display: none;
}
 .kiv-container .playkit-pre-playback-play-button {
     box-sizing: border-box;
     display: block;
     width: 95px;
     height: 95px;
     padding-top: 20px;
     padding-left: 28px;
     line-height: 20px;
     border: 6px solid #fff;
     border-radius: 50%;
     text-align: center;
     text-decoration: none;
     background-color: rgba(0, 0, 0, 0.5);
     font-size: 20px;
     font-weight: bold;
     transition: all 0.3s ease;
}
 .kiv-container .playkit-pre-playback-play-button:hover {
     background-color: rgba(0, 0, 0, 0.8);
     box-shadow: 0px 0px 10px #ffff64;
     text-shadow: 0px 0px 10px #ffff64;
}
 .kiv-container .playkit-player .playkit-bottom-bar{
     padding: 0 16px;
     height: 42px;
}
 .kiv-container .playkit-player .playkit-control-button, .kiv-container .playkit-player .playkit-control-button i {
     width: 24px;
     height: 24px;
}
 
    `;
    document.head.appendChild(css);
    this.cssInjected = true;
  }

  constructor() {
    this.injectCss();
  }

  public setup(
    config: RaptConfig,
    // playerLibrary: any,
    rapt: any
  ): KalturaInteractiveVideo {
    // console.log(">>>>>", Rapt);
    return new KalturaInteractiveVideo(config, KalturaPlayer, rapt);
  }
}
export default new Kip();

// inject KIP into player library so that KalturaPlayer.kip.setup will be available and return a new kip instance
declare var KalturaPlayer: any;
KalturaPlayer.kip = KalturaPlayer.kip || new Kip();
