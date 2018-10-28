import { CreateElement } from "./helpers/CreateElement";
import { RaptConfig } from "./Kip";
import { PlaybackPreset } from "./ui/PlaybackPreset";
import { Dispatcher } from "./helpers/Dispatcher";
import { KipFullscreen } from "./PlayersManager";

export class PlayersFactory extends Dispatcher {
  readonly SECONDS_TO_BUFFER: number = 6;
  readonly playbackPreset: any;

  constructor(
    readonly mainDiv: HTMLElement,
    readonly raptProjectId: string,
    private playerLibrary: any,
    private config: any
  ) {
    super();
    this.playbackPreset = new PlaybackPreset(
      this.playerLibrary.ui.h,
      this.playerLibrary.ui.Components,
      () => this.toggleFullscreen() // TODO - check if can be taken out?
    ).preset;
  }

  /**
   *
   * @param entryId
   * @param cachePlayer - whether this player is a cache-player or not. If not - it will set autoplay to true
   */
  public createPlayer(entryId: string, playImmediate: boolean = false): any {
    const divName: string = this.raptProjectId + "__" + entryId;
    let playerClass = "kiv-player kiv-cache-player";
    if (playImmediate) {
      playerClass += " current-playing";
    }
    const playerDiv = CreateElement("div", divName, playerClass);
    const conf: object = this.getPlayerConf(divName, playImmediate);
    this.mainDiv.appendChild(playerDiv);
    const newPlayer = this.playerLibrary.setup(conf);
    newPlayer.loadMedia({ entryId: entryId });
    return newPlayer;
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
    if (!playImmediate) {
      newConf.playback = {
        autoplay: false,
        preload: "auto",
        options: {
          html5: {
            hls: {
              maxMaxBufferLength: this.SECONDS_TO_BUFFER
            }
          }
        }
      };
    } else {
      newConf.playback = {
        autoplay: true
      };
    }

    try {
      let uis = [
        {
          template: props => this.playbackPreset(props)
        }
      ];
      newConf.ui = { customPreset: uis };
    } catch (e) {
      console.log("error in applying V3 custom preset");
    }
    delete newConf.rapt;
    return newConf;
  }

  toggleFullscreen(): void {
    this.dispatch({ type: KipFullscreen.FULL_SCREEN_CLICKED });
  }
}
