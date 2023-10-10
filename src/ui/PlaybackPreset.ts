export class PlaybackPreset {
  preset: (props: any) => any;
  presetWithPlayButton: (props: any) => any;
  // TODO - when we have more time - switch to TSX
  constructor(
    h: any,
    c: any,
    fullscreenCallback: () => void,
    private raptData: any,
    private deviceModel: string | undefined
  ) {
    let customSeekbarContainer: any;
    let customLeftControls: any[];
    let customRightControls: any[];


    let showFullscreenClass = "show-fullscreen";
    if (this.deviceModel === "iPhone" || raptData.showFullscreen === false) {
      showFullscreenClass = "hide-fullscreen";
    }

    // switch showScrubber
    if (raptData.showScrubber) {
      customSeekbarContainer = function(props: any) {
        return h(c.SeekBarPlaybackContainer, {
          showFramePreview: false,
          showTimeBubble: false,
          player: props.player,
          playerContainer: props.playerContainer
        });
      };
    } else {
      customSeekbarContainer = function(props: any) {
        return null;
      };
    }

    // define the app fullscreen button
    let customFullScreenButton;

    if (
      this.deviceModel === "iPhone" ||
      this.raptData.showFullscreen === false
    ) {
      // do not render the fullscreen button - return null as the button
      customFullScreenButton = function () {
        return null;
      };
    } else {
      customFullScreenButton = function () {
        return h(
          "div",
          {
            className:
              "playkit-control-button-container playkit-control-fullscreen",
          },
          h(
            "button",
            {
              tabIndex: "0",
              "aria-label": "controls.fullscreen",
              className: "playkit-control-button",
              onClick: () => {
                fullscreenCallback();
              },
            },
            h("icon", {
              className: "playkit-icon playkit-icon-maximize",
              style: "transform: rotate(90deg)",
            }),
            h("icon", {
              className: "playkit-icon playkit-icon-minimize",
              style: "transform: rotate(90deg)",
            })
          )
        );
      };
    }

    customLeftControls = [c.PlayPauseControl, c.RewindControl];
    if (this.raptData.showTimers) {
      customRightControls = [c.TimeDisplayPlaybackContainer, c.VolumeControl, c.SettingsControl, customFullScreenButton]
    } else {
      customRightControls = [c.VolumeControl, c.SettingsControl, customFullScreenButton]
    }

    const customControllers = function (props: any) {
      return h(
          c.BottomBar,
          {leftControls: customLeftControls, rightControls: customRightControls},
          customSeekbarContainer(props),
      );
    };

    this.presetWithPlayButton = function (props: any) {
      //if U change this change the other preset
      return h(
        "div",
        null,
        h(c.KeyboardControl, { player: props.player, config: props.config }),
        h(c.Loading, { player: props.player }),
        h(
          "div",
          {
            className: "playkit-player-gui " + showFullscreenClass,
            id: "player-gui",
          },
          h(c.OverlayPortal, null),
          h(c.UnmuteIndication, { player: props.player }),
          h(c.OverlayAction, { player: props.player }),
          customControllers(props)
        ),
        h(c.PrePlaybackPlayOverlay, { player: props.player })
      );
    };
    this.preset = function (props: any) {
      //if U change this change the other preset
      return h(
        "div",
        null,
        h(c.KeyboardControl, { player: props.player, config: props.config }),
        h(c.Loading, { player: props.player }),
        h(
          "div",
          {
            className: "playkit-player-gui " + showFullscreenClass,
            id: "player-gui",
          },
          h(c.OverlayPortal, null),
          h(c.UnmuteIndication, { player: props.player }),
          h(c.OverlayAction, { player: props.player }),
          customControllers(props)
        )
      );
    };
  }
}
