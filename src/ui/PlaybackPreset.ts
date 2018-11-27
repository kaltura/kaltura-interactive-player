export class PlaybackPreset {
  preset: (props: any) => any;
  // TODO - when we have more time - switch to JSX
  constructor(
    h: any,
    c: any,
    fullscreenCallback: () => void,
    private raptData: any
  ) {
    let customSeekbarContainer: any;
    let customLeftContainer: any;
    let customRightContainer: any;

    // switch showScrubber
    if (raptData.showScrubber) {
      customSeekbarContainer = function(props: any) {
        return h(c.SeekBarPlaybackContainer, {
          showFramePreview: true,
          showTimeBubble: true,
          player: props.player,
          playerContainer: props.playerContainer
        });
      };
    } else {
      customSeekbarContainer = function(props: any) {
        return null;
      };
    }

    if (this.raptData.showTimers) {
      customLeftContainer = function(props: any) {
        return h(
          "div",
          { className: "playkit-left-controls" },
          h(c.PlayPauseControl, { player: props.player }),
          h(c.RewindControl, { player: props.player, step: 10 }),
          h(c.TimeDisplayPlaybackContainer, { format: "current / total" })
        );
      };
    } else {
      customLeftContainer = function(props: any) {
        return h(
          "div",
          { className: "playkit-left-controls" },
          h(c.PlayPauseControl, { player: props.player }),
          h(c.RewindControl, { player: props.player, step: 10 })
        );
      };
    }
    if (this.raptData.showSetting) {
      customRightContainer = function(props: any) {
        return h(
          "div",
          { className: "playkit-right-controls" },
          h(c.VolumeControl, { player: props.player }),
          h(c.LanguageControl, { player: props.player }),
          h(c.SettingsControl, { player: props.player }),
          h(customFullScreenButton)
        );
      };
    } else {
      customRightContainer = function(props: any) {
        return h(
          "div",
          { className: "playkit-right-controls" },
          h(c.VolumeControl, { player: props.player }),
          h(c.LanguageControl, { player: props.player }),
          h(customFullScreenButton)
        );
      };
    }

    const customControllers = function(props: any) {
      return h(
        c.BottomBar,
        null,
        customSeekbarContainer(props),
        customLeftContainer(props),
        customRightContainer(props)
      );
    };

    // define the app fullscreen button
    const customFullScreenButton = function() {
      return h(
        "div",
        {
          className:
            "playkit-control-button-container playkit-control-fullscreen"
        },
        h(
          "button",
          {
            tabIndex: "0",
            "aria-label": "controls.fullscreen",
            className: "playkit-control-button",
            onClick: () => {
              fullscreenCallback();
            }
          },
          h("icon", {
            className: "playkit-icon playkit-icon-maximize",
            style: "transform: rotate(90deg)"
          }),
          h("icon", {
            className: "playkit-icon playkit-icon-minimize",
            style: "transform: rotate(90deg)"
          })
        )
      );
    };
    this.preset = function(props: any) {
      return h(
        "div",
        h(c.KeyboardControl, { player: props.player, config: props.config }),
        h(c.Loading, { player: props.player }),
        h(
          "div",
          { className: "playkit-player-gui", id: "player-gui" },
          h(c.OverlayPortal, null),
          h(c.UnmuteIndication, { player: props.player }),
          h(c.OverlayAction, { player: props.player }),
          customControllers(props)
        )
      );
    };
  }
}
