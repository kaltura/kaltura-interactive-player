import { log } from "../helpers/logger";

const get = (
  obj: Record<string, any>,
  path: string,
  defaultValue: any
): any => {
  function stringToPath(path: string) {
    const output = [];
    path.split(".").forEach((item) => {
      item.split(/\[([^}]+)\]/g).forEach((key) => {
        if (key.length > 0) {
          output.push(key);
        }
      });
    });
    return output;
  }
  const pathArray = stringToPath(path);
  let current = obj;
  for (let i = 0; i < pathArray.length; i++) {
    if (!current[pathArray[i]]) return defaultValue;
    current = current[pathArray[i]];
  }
  return current;
};

const addSettings = (newData) => {
  return {
    settings: {
      startNodeId: get(newData, "pathData.startNodeId", ""),
      stageWidth: 720,
      stageHeight: 405,
    },
  };
};

const addVersion = () => {
  return {
    version: "1.0.0-rc.4",
  };
};

const makeNodesAndHotspots = (newData) => {
  const nodes = [];
  const hotspots = [];
  const cues = [];
  get(newData, "nodes", []).forEach((node) => {
    let onEnded = [
      {
        type: "project:stop",
        payload: {},
      },
    ];

    const prefetchNodeIds = [];
    const duration = get(node, "pathData.msDuration", 0);
    get(node, "interactions", []).forEach((interaction) => {
      const behavior = get(interaction, "data.behavior", {});
      if (interaction.type === "@@core/postPlay") {
        if (behavior.type === "GoToNode") {
          prefetchNodeIds.push(behavior.nodeId);
          onEnded = [
            {
              type: "project:jump",
              payload: {
                destination: behavior.nodeId,
                startFrom: behavior.startTime ? behavior.startTime / 1000 : 0,
              },
            },
          ];
        }
        if (behavior.type === "Loop") {
          onEnded = [
            {
              type: "project:jump",
              payload: {
                destination: node.id,
              },
            },
          ];
        }
      } else if (interaction.type === "@@core/cue") {
        cues.push({
          at: interaction.startTime / 1000 / duration,
          customData: get(interaction, "data.customData", ""),
          id: interaction.id,
          nodeId: node.id,
        });
      } else if (interaction.type === "@@core/hotspot") {
        const data = get(interaction, "data", {});
        const label = get(data, "text.label", "");
        const hotspot: any = {
          id: interaction.id,
          name: label,
          nodeId: node.id,
          label,
          showAt: interaction.startTime ? interaction.startTime / duration : 0,
          hideAt: interaction.endTime ? interaction.endTime / duration : 0,
          style: data.styles || {},
          position: data.position ? convertPosition(data.position) : {},
          customData: get(interaction, "pathData.customData", null),
          onClick: [],
        };
        if (behavior.type === "Pause") {
          hotspot.onClick = [
            {
              type: "player:pause",
              payload: {},
            },
          ];
        } else if (behavior.type === "GoToNode") {
          prefetchNodeIds.push(behavior.nodeId);
          hotspot.onClick = [
            {
              type: "project:jump",
              payload: {
                destination: behavior.nodeId,
                startFrom: behavior.startTime ? behavior.startTime / 1000 : 0,
              },
            },
          ];
        } else if (behavior.type === "GoToUrl") {
          hotspot.onClick = [
            {
              type: "player:pause",
              payload: {},
            },
            {
              type: "browser:open",
              payload: {
                href: behavior.url,
              },
            },
          ];
        } else if (behavior.type === "GoToTime") {
          hotspot.clickSeek = behavior.time / 1000;
        }
        hotspots.push(hotspot);
      }
    });
    nodes.push({
      id: node.id,
      xref: null,
      name: node.name,
      customData: get(node, "pathData.customData", null),
      entryId: node.entryId,
      onEnded,
      prefetchNodeIds,
      startFrom: node.startTime / 1000,
    });
  });
  return [nodes, hotspots, cues];
};

const convertPosition = (position) => {
  const newPosition = { ...position };
  newPosition.width = 720 * position.width;
  newPosition.height = 405 * position.height;
  newPosition.top = 405 * position.top;
  newPosition.left = 720 * position.left;
  return newPosition;
};

const addFonts = (newData) => {
  return {
    fonts: get(newData, "pathData.fonts", []),
  };
};

const addSkins = (newData) => {
  const result = {};
  get(newData, "pathData.skins", []).forEach((skin) => {
    result[skin.id] = skin;
  });
  return {
    __skins: result,
  };
};

const addAcconunt = (newData) => {
  return {
    account: {
      id: get(newData, "account.id", ""),
    },
  };
};

const convertApiResponce = (newData) => {
  try {
    log("log", "Converting Vegiterians ", "Original Data:", newData);
    const [nodes, hotspots, cues] = makeNodesAndHotspots(newData);
    const result = {
      ...addVersion(),
      ...addSettings(newData),
      ...addFonts(newData),
      ...addSkins(newData),
      ...addAcconunt(newData),
      nodes,
      hotspots,
      cues,
    };
    return result;
  } catch (e) {
    console.error("Failed to convert data", e, newData);
  }
};

export default convertApiResponce;
