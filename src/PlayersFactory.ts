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
    this.player.destroy();

    const parentElement = this.container.parentElement;
    if (parentElement) {
      parentElement.removeChild(this.container);
    }
  }
}

export class PlayersFactory extends Dispatcher {
  readonly secondsToBuffer: number = 6;
  readonly playbackPreset: any;

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
  }

  /**
   *
   * @param entryId
   * @param cachePlayer - whether this player is a cache-player or not. If not - it will set autoplay to true
   */
  public createPlayer(
    entryId: string,
    playImmediate: boolean,
    persistencyObject?: any
  ): KalturaPlayer {
    // TODO 3 check if the id already exists and if so throw exception
    const {
      id: playerContainerId,
      container: playerContainer
    } = this.domManager.createKalturaPlayerContainer();
    let conf: any = this.getPlayerConf(playerContainerId, playImmediate);
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

    const newPlayer = this.playerLibrary.setup(conf);

    // @ts-ignore
    newPlayer._uiWrapper._uiManager.store.dispatch({
      type: "shell/UPDATE_PRE_PLAYBACK",
      prePlayback: false
    });

    newPlayer.loadMedia({ entryId: entryId });
    return new KalturaPlayer(newPlayer, playerContainer);
  }

  /**
   * Extract the player configuration from the KIV generic config: remove the rapt element and add specific target id
   * @param entryId
   * @param playImmediate - if set to true, the config will use autoPlay=true;
   */
  private getPlayerConf(
    divName: string,
    playImmediate: boolean = false
  ): object {
    // clone the base config
    let newConf: RaptConfig = Object.assign({}, this.config);
    newConf.targetId = divName;
    // > v 0.35
    newConf.plugins = newConf.plugins ? newConf.plugins : {};
    newConf.plugins.kava = newConf.plugins.kava ? newConf.plugins.kava : {};
    newConf.plugins.kava.tamperAnalyticsHandler = this.analyticsInterruptFunc;

    let playback = newConf.playback ? newConf.playback : {};

    if (!playImmediate) {
      newConf.sources = { poster: "" }; // for buffering players - we do not need to load the poster
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

    try {
      let uis = [
        {
          template: props => this.playbackPreset(props)
        }
      ];
      newConf.ui = newConf.ui || {};
      newConf.ui.customPreset = uis;
    } catch (e) {
      log("log", "pf_getPlayerConf", "failed applying V3 custom preset");
    }
    delete newConf.rapt;
    return newConf;
  }

  toggleFullscreen(): void {
    this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
  }
}
