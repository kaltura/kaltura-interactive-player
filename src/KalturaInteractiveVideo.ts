import { PlayersManager, RaptNode } from "./PlayersManager";
import { KipClient } from "./KipClient";
import { createElement } from "./helpers/CreateElement";
import { Dispatcher, KivEvent } from "./helpers/Dispatcher";
import { PlayersDomManager } from "./PlayersDomManager";
import { enable as enableLog, log } from "./helpers/logger";
import { VERSION } from "../version";

const API_EVENTS = [
  "browser:hidden",
  "browser:open",
  "cue:forward",
  "cue:reverse",
  "hotspot:click",
  "node:enter",
  "node:ended",
  "node:exit",
  "project:load",
  "project:ready",
  "project:start",
  "project:ended",
  "project:unload",
  "player:play",
  "player:pause",
  "player:progress",
  "player:ratechange",
  "player:timeupdate",
  "player:volumechange"
];

export enum RaptProjectStatus {
  preInitialized = "preInitialized", // before loadMedia
  loading = "loading", // after loadMedia - before data load
  ready = "ready", // ideal. Project is running
  error = "error"
}

class KalturaInteractiveVideo extends Dispatcher {
  private playerManager: PlayersManager;
  private mainDiv: HTMLElement; // TODO 6 should move all executions to use the playerDomManager and remove this property
  private playlistId: string = "";
  private client: KipClient; // Backend Client
  private _data: any; // container to data API
  private legacyCallback: (event: any) => void; // legacy API generic callback func
  private playerDomManager: PlayersDomManager;
  private kalturaInteractiveStatus: RaptProjectStatus = RaptProjectStatus.preInitialized;

  constructor(private config: any, private playerLibrary: any) {
    super();

    if (config && config.rapt && config.rapt.debug) {
      enableLog();
      log(
        "log",
        "KalturaInteractiveVideo",
        "log enabled by config version " + VERSION
      );
    }
  }

  private isInitialized = false;

  // enable log-open externally
  public enableLog() {
    enableLog();
  }

  // expose version
  public get version() {
    return VERSION;
  }

  loadMedia(obj: any): void {
    this.kalturaInteractiveStatus = RaptProjectStatus.loading;
    if (!obj || (!obj.entryId && !obj.playlistId)) {
      this.printMessage("Error", "missing rapt project id");
      this.kalturaInteractiveStatus = RaptProjectStatus.error;
      return;
    }

    if (this.isInitialized) {
      throw new Error(
        'currently cannot load media twice to the same instance. Please use "setup" method again'
      );
    }
    this.dispatchApi({ type: "project:load", payload: obj.playlistId });
    this.isInitialized = true;

    this.playerDomManager = new PlayersDomManager(this.config.targetId);
    this.mainDiv = this.playerDomManager.getContainer();

    let ks: string =
      this.config.session && this.config.session.ks
        ? this.config.session.ks
        : "";
    let envUrl = "https://cdnapisec.kaltura.com";
    if (
      this.config.provider &&
      this.config.provider.env &&
      this.config.provider.env.serviceUrl
    ) {
      // player config serviceUrl is expected with "/api_v3" while the app client doesn't
      envUrl = this.config.provider.env.serviceUrl.split("/api_v3")[0];
    }

    this.client = new KipClient({
      ks: ks,
      partnerId: this.config.provider.partnerId,
      serviceUrl: envUrl
    });
    this.playlistId = obj.playlistId || obj.entryId;
    this.client
      .loadRaptData(this.playlistId)
      .then(graphData => {
        this.dataLoaded(graphData);
      })
      .catch((err: string) => {
        this.kalturaInteractiveStatus = RaptProjectStatus.error;
        this.printMessage("Error", err);
        this.dispatchApi({ type: "Error" });
      });
  }

  /**
   * Once the graph-data is loaded - load the 1st media and place the rapt-engine layer
   * @param raptGraphData
   */
  dataLoaded(raptGraphData: object): void {
    raptGraphData["account"] = { id: this.config.provider.partnerId };
    this._data = raptGraphData;
    this.playerManager = new PlayersManager(
      Object.assign({}, this.config),
      this.playerLibrary,
      this.playlistId,
      raptGraphData,
      this.playerDomManager
    );


    // if we got here - playerManager constructor code went well - update status
    this.kalturaInteractiveStatus = RaptProjectStatus.ready;

    for (let eventName of API_EVENTS) {
      this.playerManager.addListener(eventName, (event: KivEvent) => {
        this.dispatchApi(event);
      });
    }
  }
  /**
   * Expose API to the wrapping page/app
   * @param event
   * @param data
   */
  dispatchApi(event: KivEvent) {
    //this is a legacy API
    if (this.legacyCallback) {
      let legacyEvent: any = { type: event.type };
      // send the payload only if it exist
      if (event.payload && Object.getOwnPropertyNames(event.payload).length) {
        legacyEvent.payload = event.payload;
      }
      this.legacyCallback(legacyEvent);
    }

    // expose API, add the current node and
    this.dispatch(event);
  }

  /**
   * Print a message on the main div, usually used to show error messages to the end-user (E.G. missing rapt data)
   * @param title
   * @param text
   */
  printMessage(title: string, text: string = "") {
    const messageDiv = createElement("div", null, "kiv-message__message");
    const titleDiv = createElement("div", null, "kiv-message__title");
    const bodeDiv = createElement("div", null, "kiv-message__body");
    titleDiv.innerHTML = title;
    bodeDiv.innerHTML = text;
    messageDiv.appendChild(titleDiv);
    messageDiv.appendChild(bodeDiv);
    this.mainDiv.appendChild(messageDiv);
  }
  /**
   * Legacy API support
   */
  public pause() {
    this.playerManager.pause();
  }

  public play() {
    this.playerManager.play();
  }

  public seek(n: number) {
    this.playerManager.seek(n);
  }

  public replay() {
    this.playerManager.execute({
      type: "project:replay"
    });
  }
  public reset() {
    this.playerManager.execute({
      type: "project:reset"
    });
  }

  public get data(): any {
    return this._data;
  }

  public get currentTime(): number {
    // this.playerManager.getPlayer()
    return this.playerManager.getActiveKalturaPlayer().currentTime;
  }

  public get duration(): number {
    return this.playerManager.getActiveKalturaPlayer().duration;
  }

  public get currentNode(): RaptNode {
    return this.playerManager.getActiveKalturaPlayer().node;
  }

  public get volume(): number {
    return this.playerManager.getActiveKalturaPlayer().player.player.volume;
  }

  public set volume(n: number) {
    this.playerManager.getActiveKalturaPlayer().player.player.volume = n;
  }

  public get muted(): number {
    return this.playerManager.getActiveKalturaPlayer().player.player.muted;
  }

  public get playbackRate(): number {
    return this.playerManager.getActiveKalturaPlayer().playbackRate;
  }

  public jump(locator: any, autoplay: boolean) {
    this.playerManager.execute({
      type: "project:jump",
      payload: { destination: locator }
    });
  }

  // Legacy API - kBind support
  public kBind(eventName: string, callback: (event: any) => void) {
    if (eventName === "raptMedia_event") {
      this.legacyCallback = callback;
    } else {
      this.addListener(eventName, callback);
    }
  }
  // legacy API - sendNotification with rapt command data
  public sendNotification(doCommand: string, commandObject: any) {
    this.playerManager.execute(commandObject);
  }
  // direct execute
  public execute(commandObject: any) {
    this.playerManager.execute(commandObject);
  }

  public evaluate(key: string): any {
    // prepare the info object with legacy data structure
    if (key === "{raptMedia.info}") {
      let dataCopy = Object.assign({}, this._data);
      dataCopy.player = {
        currentNode: this.playerManager.getActiveNode(),
        currentTime: this.playerManager.getActiveKalturaPlayer().currentTime,
        currentVideo: this.playerManager.getActiveNode().entryId
      };
      dataCopy.project = {
        projectId: this.playerManager.raptProjectId
      };
      dataCopy.videos = this._data.nodes.map((item: RaptNode) => {
        let o: any = {};
        o.entryId = item.entryId;
        o.id = item.id;
        o.name = item.name;
        if (o.customData) {
          o.customData = item.customData;
        }
        return o;
      });
      return dataCopy;
    } else if (key === "{raptMedia.status}") {
      return this.kalturaInteractiveStatus;
    } else if (this.data[key]) {
      return this.data[key];
    }
  }
}

export default KalturaInteractiveVideo;
