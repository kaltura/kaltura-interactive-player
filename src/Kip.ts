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
      
      .kiv-rapt-engine{
        z-index: 1000;
        position: absolute;
      }
      .kiv-container{
        position: relative;
      }
      .kiv-container,
      .kiv-rapt-engine,
      .kiv-player,
      .kiv-players-container
      {
        width: 100%;
        height: 100%;
      }
    `;
    document.head.appendChild(css);
    this.cssInjected = true;
  }

  constructor() {
    this.injectCss();
  }

  setup(
    config: RaptConfig,
    playerLibrary: any,
    rapt: any
  ): KalturaInteractiveVideo {
    return new KalturaInteractiveVideo(config, playerLibrary, rapt);
  }

}
export default new Kip();
