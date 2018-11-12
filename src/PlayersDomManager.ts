import {CreateElement} from "./helpers/CreateElement";

export class PlayersDomManager {
    private static instanceCounter = 1;
    private element: HTMLElement;

    public tempGetElement() {
        // TODO remove when you complete refactoring
        return this.element;
    }

    constructor(parentId: string) {
        this.createElement(parentId);
    }

    private createElement(parentId: string) {
        // create a top-level container
        this.element = CreateElement(
            "div",
            "kiv-container__" + PlayersDomManager.instanceCounter,
            "kiv-container"
        );

        PlayersDomManager.instanceCounter++;
        document.getElementById(parentId).appendChild(this.element);
    }
}