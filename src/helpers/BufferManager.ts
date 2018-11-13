/**
 * Class is in charge of the actual buffering check
 */

export class BufferManager {
  private shortEntryThreshold: number = 6;
  private bufferDoneTimeout: number = 100;
  private bufferIntervalTimeout: number = 100;
  private currentTimeouts: number[] = [];

  constructor(private secondsToBuffer: number = 8) {}

  /**
   * Stop all current buffering processes
   */
  stopBuffer() {
    this.currentTimeouts.forEach(interval => {
      clearTimeout(interval);
    });
    this.currentTimeouts = [];
  }

  handleBuffered(bufferPlayer: any, callback: (entryId: string) => void) {
    if (!bufferPlayer) {
      return;
    }
    if (
      bufferPlayer.duration &&
      bufferPlayer.duration !== NaN &&
      bufferPlayer.duration < this.shortEntryThreshold
    ) {
      // too short entry - mark it as buffered
      setTimeout(() => {
        if (
          bufferPlayer.config &&
          bufferPlayer.config.sources &&
          bufferPlayer.config.sources.id
        )
          callback(bufferPlayer.getMediaInfo().entryId);
      }, this.bufferDoneTimeout);
      return;
    }
    if (
      bufferPlayer.buffered &&
      bufferPlayer.buffered.length &&
      bufferPlayer.buffered.end &&
      bufferPlayer.buffered.end(0) > this.secondsToBuffer - 1
    ) {
      setTimeout(() => {
        if (
          bufferPlayer.config &&
          bufferPlayer.config.sources &&
          bufferPlayer.config.sources.id
        )
          callback(bufferPlayer.getMediaInfo().entryId);
      }, this.bufferDoneTimeout);
    } else {
      // not buffered yet - check again
      this.currentTimeouts.push(
        setTimeout(() => {
          // todo do we need to remove from this.currentTimeouts ?
          this.handleBuffered(bufferPlayer, callback);
        }, this.bufferIntervalTimeout)
      );
    }
  }
}
