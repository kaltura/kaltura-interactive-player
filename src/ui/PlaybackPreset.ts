export class PlaybackPreset {
  preset: (props: any) => any;

  constructor(h: any, c: any, fullscreenCallback: () => void) {
    // define the app fullscreen button
    const customFullScreenButton: any = function() {
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
          h(
            c.BottomBar,
            null,
            h(
              "div",
              { className: "playkit-left-controls" },
              h(c.PlayPauseControl, { player: props.player }),
              h(c.RewindControl, { player: props.player, step: 10 })
            ),
            h(
              "div",
              { className: "playkit-right-controls" },
              h(c.VolumeControl, { player: props.player }),
              h(c.LanguageControl, { player: props.player }),
              h(c.SettingsControl, { player: props.player }),
              h(customFullScreenButton)
            )
          )
        )
      );
    };
    this.presetWithScrubber = function(props: any) {
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
          h(
            c.BottomBar,
            null,
            h(c.SeekBarPlaybackContainer, {
              showFramePreview: true,
              showTimeBubble: true,
              player: props.player,
              playerContainer: props.playerContainer
            }),
            h(
              "div",
              { className: "playkit-left-controls" },
              h(c.PlayPauseControl, { player: props.player }),
              h(c.RewindControl, { player: props.player, step: 10 }),
              h(c.TimeDisplayPlaybackContainer, { format: "current / total" })
            ),
            h(
              "div",
              { className: "playkit-right-controls" },
              h(c.VolumeControl, { player: props.player }),
              h(c.LanguageControl, { player: props.player }),
              h(c.SettingsControl, { player: props.player }),
              h(customFullScreenButton)
            )
          )
        )
      );
    };
  }
}
