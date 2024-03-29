import { RaptConfig } from "./Kip";
import { PlaybackPreset } from "./ui/PlaybackPreset";
import { Dispatcher } from "./helpers/Dispatcher";
import { KipFullscreen } from "./PlayersManager";
import { PlayersDomManager } from "./PlayersDomManager";
import { log } from "./helpers/logger";

export class KalturaPlayer {
  private static instanceCounter = 1;
  public id;
  private isDestroyed = false;

  constructor(public player: any, public container: HTMLElement) {
    this.id = `kaltura-player__${KalturaPlayer.instanceCounter}`;
    KalturaPlayer.instanceCounter++;
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    try {
      this.player.destroy();
    }catch(e){
      log("log", "pf_destroy", "could not destroy ",this.player);
    }

    const parentElement = this.container.parentElement;
    if (parentElement) {
      parentElement.removeChild(this.container);
    }
  }
}

export class PlayersFactory extends Dispatcher {
  readonly secondsToBuffer: number = 6;
  readonly playbackPreset: any;
  readonly playbackPresetWithPlayButton: any;

  constructor(
    readonly domManager: PlayersDomManager,
    readonly raptProjectId: string,
    readonly playerLibrary: any,
    private analyticsInterruptFunc: any,
    private config: any
  ) {
    super();
    if (config.rapt && config.rapt.bufferTime) {
      this.secondsToBuffer = parseInt(config.rapt.bufferTime);
    }
    let deviceModel = undefined;
    try {
      deviceModel =
        playerLibrary.core.Env.device && playerLibrary.core.Env.device.model; // desktops will be undefined
    } catch (error) {
      log("log", "pf_constructor", "could not get device model");
    }

    this.playbackPreset = new PlaybackPreset(
      this.playerLibrary.ui.h,
      this.playerLibrary.ui.Components,
      () => this.toggleFullscreen(),
      config.rapt,
      deviceModel
    ).preset;
    // this is for autoplay=false. We want to show the large play button
    this.playbackPresetWithPlayButton = new PlaybackPreset(
      this.playerLibrary.ui.h,
      this.playerLibrary.ui.Components,
      () => this.toggleFullscreen(),
      config.rapt,
      deviceModel
    ).presetWithPlayButton;
  }

  /**
   *
   * @param entryId
   * @param cachePlayer - whether this player is a cache-player or not. If not - it will set autoplay to true
   */
  public createPlayer(
    entryId: string,
    playImmediate: boolean,
    persistencyObject?: any,
    showPoster?: boolean,
    startTime?: number
  ): KalturaPlayer {
    // TODO 3 check if the id already exists and if so throw exception
    const {
      id: playerContainerId,
      container: playerContainer
    } = this.domManager.createKalturaPlayerContainer();

    if(this.config.rapt.showTimers){
      playerContainer.classList.add("has-timers");
    }

    let conf: any = this.getPlayerConf(
      playerContainerId,
      playImmediate,
      showPoster
    );
    
    // persistancy logic of new creation. If a new player is created - push the relevant persistancy attribute to config
    if (persistencyObject) {
      if (persistencyObject) {
        conf.playback.audioLanguage = persistencyObject.audio;
      }
      if (persistencyObject.captions) {
        conf.playback.textLanguage = persistencyObject.captions;
      }
      if (persistencyObject.rate) {
        // todo 5 - find how to initiate this
      }
      // only if this was set, change the logic. If this is not defined leave it as-is
      if (persistencyObject.mute !== undefined) {
        conf.playback.muted = persistencyObject.mute;
      }
    }
    if(startTime){
        conf.playback.startTime = startTime;
    }
    
    const newPlayer = this.playerLibrary.setup(conf);
    // if initialBitrate was define, switch back to ABR mode
    if (this.config.rapt.initialBitrate) {
      newPlayer.addEventListener(newPlayer.Event.Core.FIRST_PLAY, e =>
        this.onFirstPlay(e)
      );
    }

    newPlayer.loadMedia({ entryId: entryId });
    return new KalturaPlayer(newPlayer, playerContainer);
  }

  // Resets the ABR to work as default.
  public onFirstPlay(e) {
    try {
      e.target.removeEventListener(e.target.Event.Core.FIRST_PLAY, e =>
        this.onFirstPlay(e)
      );
      // TODO - follow up with player team - once they expose this with a method - we will switch this ugly code
      e.target._localPlayer._engine._mediaSourceAdapter._hls.config.minAutoBitrate = 0;
    } catch (e) {
      log("log", "pf_createPlayer", "couldn't switch to ABR ", e);
    }
  }

  /**
   * Extract the player configuration from the KIV generic config: remove the rapt element and add specific target id
   * @param entryId
   * @param playImmediate - if set to true, the config will use autoPlay=true;
   */
  private getPlayerConf(
    divName: string,
    playImmediate: boolean = false,
    showPoster: boolean = false,
  ): object {
    // clone the base config
    let newConf: RaptConfig = Object.assign({}, this.config);
    newConf.targetId = divName;
    // > v 0.35
    newConf.plugins = newConf.plugins ? newConf.plugins : {};
    newConf.plugins.kava = newConf.plugins.kava ? newConf.plugins.kava : {};
    newConf.plugins.kava.tamperAnalyticsHandler = this.analyticsInterruptFunc;

    let playback = newConf.playback ? newConf.playback : {};
    if (!showPoster) {
      newConf.sources = { poster: "" }; // for buffering players - we do not need to load the poster
    }
    if (!playImmediate) {
      playback = {
        autoplay: false,
        preload: "auto",
        options: {
          html5: {
            hls: {
              maxMaxBufferLength: this.secondsToBuffer
            }
          }
        }
      };
    } else {
      playback.autoplay = true;
    }
    newConf.playback = playback;
    if (this.config.rapt.initialBitrate) {
      log(
        "error",
        "pf_getPlayerConf",
        "setting initialBitrate to " + this.config.rapt.initialBitrate
      );
      newConf.abr = {
        defaultBandwidthEstimate: this.config.rapt.initialBitrate,
        restrictions: {
          minBitrate: this.config.rapt.initialBitrate
        }
      };
    }
    
    try {
      let uis;
      if (showPoster) {
        // this is autoplay=false
        uis = [
          {
            template: props => this.playbackPresetWithPlayButton(props)
          }
        ];
      } else {
        uis = [
          {
            template: props => this.playbackPreset(props)
          }
        ];
      }
      newConf.ui = newConf.ui || {};
      newConf.ui.components = {
        fullscreen: {
          disableDoubleClick: true
        }
      },
      newConf.ui.customPreset = uis;
    } catch (e) {
      log("error", "pf_getPlayerConf", "failed applying V3 custom preset");
    }
    delete newConf.rapt;
    return newConf;
  }

  toggleFullscreen(): void {
    this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
  }
}
