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

const makeSettings = (newData) => {
  return {
    settings: {
      startNodeId: get(newData, "pathData.startNodeId", ""),
      stageWidth: 720,
      stageHeight: 405,
    },
  };
};

const makeVersion = () => {
  return {
    version: "1.0.0-rc.4",
  };
};

const makeNodesAndHotspots = (newData) => {
  const nodes = [];
  const hotspots = [];
  get(newData, "nodes", []).forEach((node) => {
    let onEnded = [
      {
        type: "project:stop",
        payload: {},
      },
    ];
    const prefetchNodeIds = [];
    get(node, "interactions", []).forEach((interaction) => {
      const behavior = get(interaction, "data.behavior", {});
      if (
        interaction.type === "@@core/postPlay" &&
        behavior.type === "GoToNode"
      ) {
        prefetchNodeIds.push(behavior.nodeId);
        onEnded = [
          {
            type: "project:jump",
            payload: {
              destination: behavior.nodeId,
              startFrom: behavior.startTime || 0,
            },
          },
        ];
      } else if ("@@core/hotspot") {
        const data = get(interaction, "data", {});
        const label = get(data, "text.label", "");
        const hotspot: any = {
          id: interaction.id,
          name: label,
          nodeId: node.id,
          label,
          showAt: interaction.startTime,
          hideAt: interaction.endTime,
          style: data.style || {},
          position: data.position || {},
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
                startFrom: behavior.startTime || 0,
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
      startFrom: node.startTime
    });
  });
  return [nodes, hotspots];
};

const makeCues = () => {
  return {
    cues: [],
  };
};

const makeFonts = () => {
  return {
    fonts: [],
  };
};

const makeSkins = () => {
  return {
    __skins: {},
  };
};

const makeAcconunt = (partnerId) => {
  return {
    account: {
      id: partnerId,
    },
  };
};

const convertApiResponce = (newData, partnerId) => {
  const [nodes, hotspots] = makeNodesAndHotspots(newData);
  const result = {
    ...makeVersion(),
    ...makeSettings(newData),
    ...makeCues(),
    ...makeFonts(),
    ...makeSkins(),
    ...makeAcconunt(partnerId),
    nodes,
    hotspots,
  };
  return result;
};

export default convertApiResponce;
