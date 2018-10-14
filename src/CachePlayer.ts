import { RaptNode } from "./PlayersManager";

export const enum BufferState {
  init = "init",
  caching = "caching",
  ready = "ready",
  error = "error"
}

export class CachePlayer {
  private _isActive: boolean = false;
  constructor(
    public id: string,
    public node: RaptNode,
    public status: BufferState,
    public player?: any
  ) {}

  public set isActive(isActive: boolean) {
    this._isActive = isActive;
    if (this.player) {
      debugger;
    }
  }

  public get isActive(): boolean {
    return this._isActive;
  }



}
