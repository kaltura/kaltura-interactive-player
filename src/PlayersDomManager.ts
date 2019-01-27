import { createElement } from "./helpers/CreateElement";
import { KalturaPlayer } from "./PlayersFactory";
import { log } from "./helpers/logger";

export class PlayersDomManager {
  private static raptPlayerCounter = 1;
  private static kalturaPlayerCounter = 1;

  private namespace: string;
  private raptContainer: HTMLElement;

  public getContainer() {
    return this.raptContainer;
  }

  private createElementName(suffix: string) {
    return `${this.namespace}-${suffix}`;
  }

  public createDomElement(
    type: string,
    idSuffix: string,
    initialClasses?: string
  ): { id: string; domElement: HTMLElement } {
    const newElement = document.createElement(type);
    const newElementId = this.createElementName(idSuffix);
    newElement.setAttribute("id", newElementId);

    if (initialClasses) {
      newElement.setAttribute("class", initialClasses);
    }

    this.raptContainer.appendChild(newElement);
    return { id: newElementId, domElement: newElement };
  }

  constructor(parentId: string) {
    this.createRaptPlayerElement(parentId);
  }

  public requestFullscreen(): void {
    if (this.raptContainer && this.raptContainer.requestFullscreen) {
      this.raptContainer.requestFullscreen();
    }
  }

  public changeActivePlayer(player: KalturaPlayer): void {
    log("log", "dm_changeActivePlayer", "executed", { id: player.id });
    const allMarkedPlayers = this.raptContainer.querySelectorAll(
      ".current-playing"
    );
    // IE cannot iterate normally with forEach
    [].forEach.call(allMarkedPlayers, function(div) {
      // do whatever
      div.classList.remove("current-playing");
    });
    if (player) {
      player.container.classList.add("current-playing");
    }
  }

  public showRaptLayer() {
    const mainContainerId = this.getContainer().id;
    const raptLayer = document.querySelector(
      "#" + mainContainerId + " .kiv-rapt-engine"
    );
    // project had started - unhide the rapt layer now
    raptLayer.classList.remove("kiv-hidden");
  }
  public hideRaptLayer() {
    const mainContainerId = this.getContainer().id;
    const raptLayer = document.querySelector(
      "#" + mainContainerId + " .kiv-rapt-engine"
    );
    // project had started - unhide the rapt layer now
    raptLayer.classList.add("kiv-hidden");
  }

  public createKalturaPlayerContainer(): {
    id: string;
    container: HTMLElement;
  } {
    const containerId = `kaltura-container__${
      PlayersDomManager.kalturaPlayerCounter
    }`;
    PlayersDomManager.kalturaPlayerCounter++;

    let playerClass = "kiv-player kiv-cache-player";
    const kalturaContainer = createElement("div", containerId, playerClass);
    this.raptContainer.appendChild(kalturaContainer);

    return { id: containerId, container: kalturaContainer };
  }

  private createRaptPlayerElement(parentId: string) {
    this.namespace = "kiv-container__" + PlayersDomManager.raptPlayerCounter;

    // create a top-level container
    this.raptContainer = createElement("div", this.namespace, "kiv-container");

    PlayersDomManager.raptPlayerCounter++;
    document.getElementById(parentId).appendChild(this.raptContainer);
  }
}
