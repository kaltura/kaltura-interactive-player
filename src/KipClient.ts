import {
  KalturaAPIException,
  KalturaClient,
  KalturaClientException,
  KalturaMultiRequest,
  KalturaRequestOptions,
} from "kaltura-typescript-client";
import { Dispatcher } from "./helpers/Dispatcher";
import { KalturaPlaylist } from "kaltura-typescript-client/api/types/KalturaPlaylist";
import { KalturaPlaylistType } from "kaltura-typescript-client/api/types/KalturaPlaylistType";
import { KalturaFileAsset } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAsset";
import { PlaylistGetAction } from "../node_modules/kaltura-typescript-client/api/types/PlaylistGetAction";
import { FileAssetListAction } from "../node_modules/kaltura-typescript-client/api/types/FileAssetListAction";
import { KalturaFileAssetFilter } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetFilter";
import { KalturaInteractivityNodeFilter } from "kaltura-typescript-client/api/types/KalturaInteractivityNodeFilter";
import { KalturaInteractivityDataFilter } from "kaltura-typescript-client/api/types/KalturaInteractivityDataFilter";
import { KalturaInteractivityRootFilter } from "kaltura-typescript-client/api/types/KalturaInteractivityRootFilter";
import { InteractivityGetAction } from "../node_modules/kaltura-typescript-client/api/types/InteractivityGetAction";
import { KalturaFileAssetObjectType } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetObjectType";
import { SessionStartWidgetSessionAction } from "../node_modules/kaltura-typescript-client/api/types/SessionStartWidgetSessionAction";

interface ClientConfig {
  ks?: string;
  serviceUrl?: string;
  partnerId?: string;
  widgetId?: string;
  capabilityCheck?: boolean;
}

/**
 * This class handles all BE callbacks API
 */

export class KipClient extends Dispatcher {
  kClient: KalturaClient;
  serviceUrl: string;
  partnerId: string;
  clientTag: string = "rapt-v3-app";
  config: ClientConfig;
  ks: string;
  widgetId: string;
  capabilityCheck: boolean;

  constructor(config: ClientConfig) {
    super();
    this.serviceUrl = config.serviceUrl;
    this.ks = config.ks;
    this.partnerId = config.partnerId;
    this.widgetId = config.widgetId;
    this.capabilityCheck = config.capabilityCheck;
    this.config = { ks: this.ks, serviceUrl: this.serviceUrl };
  }

  /**
   * Initialize Kaltura client
   * @param serviceUrl
   * @param clientTag
   * @param ks
   */
  initClient(serviceUrl: string, clientTag: string, ks: string): KalturaClient {
    return new KalturaClient(
      {
        endpointUrl: serviceUrl,
        clientTag: clientTag,
      },
      {
        ks: ks,
      }
    );
  }

  /**
   * Load the rapt data by playlist id (Promise)
   * @param raptPlaylistId
   */
  loadRaptData(raptPlaylistId: string): Promise<object> {
    return new Promise((resolve, reject) => {
      this.kClient = this.initClient(
        this.config.serviceUrl,
        this.clientTag,
        this.config.ks
      );
      const filter: KalturaFileAssetFilter = new KalturaFileAssetFilter();
      filter.objectIdEqual = raptPlaylistId;
      filter.fileAssetObjectTypeEqual = KalturaFileAssetObjectType.entry;

      let multiRequest: KalturaMultiRequest;

      // NO KS given - build a multi request with 1st action to retrieve a KS
      if (!this.config.ks) {
        // no given KS - we need to add a widget-session request
        multiRequest = new KalturaMultiRequest(
          new SessionStartWidgetSessionAction({
            widgetId: this.widgetId || "_" + this.partnerId,
          }),
          new FileAssetListAction({
            filter: filter,
          }).setRequestOptions(
            new KalturaRequestOptions({}).setDependency(["ks", 0, "ks"])
          )
        );
      } else {
        multiRequest = new KalturaMultiRequest(
          new FileAssetListAction({
            filter: filter,
          }),
          new PlaylistGetAction({
            id: raptPlaylistId,
          })
        );
      }
      this.kClient.multiRequest(multiRequest).then(
        (data: any) => {
          // API error
          if (data[0].error) {
            console.log(data[0].error);
            reject(data[0].error);
            return;
          }
          // TODO - handle no-ks with new path data later.
          if (
            data.length === 2 &&
            data[1].result instanceof KalturaPlaylist &&
            (data[1].result.playlistType === KalturaPlaylistType.path || // path entry || capabilities check
              (data[1].result.capabilities.includes(
                "interactivity.interactivity"
              ) &&
                this.capabilityCheck))
          ) {
            // warn if capabilityCheck is set to true
            if (
              data[1].result.capabilities.includes(
                "interactivity.interactivity"
              ) &&
              this.capabilityCheck
            ) {
              console.warn(
                "Provided entry is hybrid Rapt entry. Running Rapt Player in test mode with interactivities"
              );
            }

            const dataFilter = new KalturaInteractivityDataFilter();
            dataFilter.rootFilter = new KalturaInteractivityRootFilter({
              fields: "nodes,pathData",
            });
            dataFilter.nodeFilter = new KalturaInteractivityNodeFilter({
              fields: "pathData,name,interactions,id,entryId",
            });
            const interactivityRequest = new InteractivityGetAction({
              entryId: raptPlaylistId,
              dataFilter: dataFilter,
            });
            this.kClient.request(interactivityRequest).then(
              (data: any) => {
                if (!data.data) {
                  reject(
                    "Missing data. Could not retrieve interactivity data for playlist " +
                      raptPlaylistId
                  );
                }
                resolve(JSON.parse(data.data));
              },
              () => {
                reject(
                  "Got an error during getting interactivity data for playlist " +
                    raptPlaylistId
                );
              }
            );
          } else {
            let fileAssetObjects: any;
            if (
              data.length === 2 &&
              !(data[1].result instanceof KalturaPlaylist)
            ) {
              // this was a request with a KS request - extract the KS, set it to the client and then continue with data
              if (data[0].error) {
                reject(
                  "Error with generating widget session KS for pid " +
                    this.partnerId
                );
              }

              if (!data[1].result.objects || !data[1].result.objects.length) {
                reject(
                  "Missing data. Could not retrieve attached file assets for playlist " +
                    raptPlaylistId
                );
              }

              this.ks = data[0].result.ks;
              this.kClient.setDefaultRequestOptions({ ks: this.ks });
              fileAssetObjects = data[1].result.objects;
            } else {
              // Just a FileAssetList request
              fileAssetObjects = data[0].result.objects;
            }
            const graphDataFileAsset: any = fileAssetObjects.find(
              (item: KalturaFileAsset) => item.systemName === "GRAPH_DATA"
            );
            // get the graph-data file content
            this.serveAssetById(graphDataFileAsset.id).then((res) => {
              resolve(JSON.parse(res));
            });
          }
        },
        (err) => {
          if (err instanceof KalturaClientException) {
            reject("Network/Client error");
          } else if (err instanceof KalturaAPIException) {
            reject(
              "Multirequest API error, check your KS and Playlist data validation"
            );
          }
        }
      );
    });
  }

  /**
   * Load the content of the fileAsset (Promise)
   * @param id
   */
  serveAssetById(id: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlToLoad =
        this.serviceUrl +
        "/api_v3/index.php?service=fileAsset&apiVersion=3.1&expiry=86400&clientTag=" +
        this.clientTag +
        "&format=1&ignoreNull=1&action=serve&id=" +
        id +
        "&ks=" +
        this.ks;
      fetch(urlToLoad)
        .then((response) => {
          response
            .text()
            .then((text) => {
              resolve(text);
            })
            .catch((error) => {
              reject();
            });
        })
        .catch((error) => {
          reject();
        });
    });
  }
}
