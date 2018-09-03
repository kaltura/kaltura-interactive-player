import INode from "./interfaces/INode";
import IRaptConfig from "./interfaces/IRaptConfig";

/**
 * This class manages players creations and additions to DOM.
 */
export class PlayersManager {
  conf: any;
  nodes: [];
  playerLibrary: any;
  raptData: any;
  raptProjectId: string;
  mainDiv: HTMLElement;
  constructor(
    conf: any,
    playerLibrary: any,
    raptProjectId: string,
    raptData: any
  ) {
    this.conf = conf;
    this.raptData = raptData;
    this.playerLibrary = playerLibrary;
    this.raptProjectId = raptProjectId;
    this.mainDiv = document.getElementById(this.conf.targetId);
  }

  /**
   * Assuming we have all the data, find the 1st node and load it. Once loaded, start cache relevant entries of that
   * specific node.
   */
  initPlayback(): void {
    const { nodes, settings } = this.raptData;
    this.nodes = nodes;
    const startNodeId = settings.startNodeId;
    // retrieve the 1st node
    const firstNode = nodes.find(function(element: any) {
      return element.id === startNodeId;
    });
    const nodeDiv: HTMLElement = this.createNodesDiv(firstNode);
    const nodeConf: object = this.getPlayerConf(firstNode, nodeDiv.id);
    const firstPlayer = this.playerLibrary.setup(nodeConf);
    firstPlayer.loadMedia({ entryId: firstNode.entryId });
    // todo - preform this post first PLAYBACK

    const nextNodes = this.getNextNodes(firstNode);
    console.log(">>>>>", nextNodes);
  }

  /**
   * Extract the player configuration from the KIV generic config: remove the rapt element and add specific target id
   * @param raptNode
   * @param targetName
   * @param cache - if set to true, the config will use autoPlay=false and preload=true;
   */
  getPlayerConf(
    raptNode: any,
    targetName: string,
    cache: boolean = false
  ): object {
    const newConf: IRaptConfig = Object.assign(this.conf);
    newConf.targetId = targetName;
    if (cache) {
      newConf.playback = {
        autoplay: false,
        preload: "auto"
      };
    }
    delete newConf.rapt;
    return newConf;
  }

  /**
   * Creates a unique div per node by the node entryId. Concat it's name to the playlist-id so it will allow to embed
   * 2 different rapt projects on the same page.
   * @param node
   */
  createNodesDiv(node: INode): HTMLElement {
    const newDiv = document.createElement("div");
    newDiv.setAttribute("id", this.raptProjectId + "__" + node.entryId);
    newDiv.setAttribute("style", "width:100%;height:100%;background:#FF0088");
    this.mainDiv.appendChild(newDiv);
    return newDiv;
  }

  /**
   * Create a player-per-node to a list of IV nodes and stack them beneath the current players
   */
  cacheNodes() {}

  /**
   * Get optional playable nodes of a given node
   * @param node
   */
  getNextNodes(node: INode): INode[] {
    return node.prefetchNodeIds.length
      ? node.prefetchNodeIds.map((nodeId: string) =>
          this.getNodeByRaptId(nodeId)
        )
      : [];
  }

  /**
   * Return a rapt node
   * @param id
   */
  getNodeByRaptId(id: string): INode {
    const nodes: INode[] = this.raptData.nodes;
    return nodes.find((item: INode) => item.id === id);
  }

  cacheNode(node: INode): void {
    const nodesDiv: HTMLElement = this.createNodesDiv(node);
    const nodeConf: object = this.getPlayerConf(node, nodesDiv.id);
    const player = this.playerLibrary.setup(nodeConf);
    player.loadMedia({ entryId: node.entryId });
  }
}
