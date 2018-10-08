export const KipEvent = {
  API_ERROR: "apiError",
  MISSING_FIRST_NODE: "missingFirstNode",
  FIRST_PLAY_ERROR: "firstPlayError",
  RAPT_DATA_LOAD_ERROR: "raptDataLoadError"
};

export const BufferEvent = {
  BUFFERING: "buffering", // buffered a specific entry - argument will be the entry id
  DESTROYING: "destroying", // about to destroy a specific player
  DESTROYED: "destroyed", // done with destroying a specific player
  DONE: "done", // Done buffering all relevant entries of this node
  CATCHUP: "catchup", // When an unbuffered video was requested to play - once played dispatch this event
  ALL_BUFFERED: "allBuffered" // Done buffering all relevant entries of this node
};

export const KipFullscreen = {
  FULL_SCREEN_CLICKED: "fullScreenClicked",
  ENTER_FULL_SCREEN: "enterFullScreen",
  EXIT_FULL_SCREEN: "exitFullScreen"
};
