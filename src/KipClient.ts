import {
  KalturaAPIException,
  KalturaClient,
  KalturaClientException,
  KalturaMultiRequest,
  KalturaRequestOptions
} from "kaltura-typescript-client";
import { KalturaFileAsset } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAsset";
import { FileAssetListAction } from "../node_modules/kaltura-typescript-client/api/types/FileAssetListAction";
import { KalturaFileAssetFilter } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetFilter";
import { KalturaFileAssetObjectType } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetObjectType";
import { Dispatcher } from "./helpers/Dispatcher";
import { SessionStartWidgetSessionAction } from "../node_modules/kaltura-typescript-client/api/types/SessionStartWidgetSessionAction";

interface ClientConfig {
  ks?: string;
  serviceUrl?: string;
  partnerId?: string;
  widgetId?: string;
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

  constructor(config: ClientConfig) {
    super();
    this.serviceUrl = config.serviceUrl;
    this.ks = config.ks;
    this.partnerId = config.partnerId;
    this.widgetId = config.widgetId;
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
        clientTag: clientTag
      },
      {
        ks: ks
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

      if (!this.config.ks) {
        // no given KS - we need to add a widget-session request
        multiRequest = new KalturaMultiRequest(
          new SessionStartWidgetSessionAction({
            widgetId: this.widgetId || "_" + this.partnerId
          }),
          new FileAssetListAction({
            filter: filter
          }).setRequestOptions(
            new KalturaRequestOptions({}).setDependency(["ks", 0, "ks"])
          )
        );
      } else {
        multiRequest = new KalturaMultiRequest(
          new FileAssetListAction({
            filter: filter
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
          let fileAssetObjects: any;
          if (data.length === 2) {
            // this was a request with a KS request - extract the KS, set it to the client and then continue with data
            if (data[0].error) {
              reject(
                "Error with generating widget session KS for pid " +
                  this.partnerId
              );
            }

            if (!data[1].result.objects || !data[1].result.objects.length) {
              reject("Missing data. Could not retrieve attached file assets for playlist "+raptPlaylistId);
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
          this.serveAssetById(graphDataFileAsset.id).then(res => {
            resolve(JSON.parse(res));
          });
        },
        err => {
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
        .then(response => {
          response
            .text()
            .then(text => {
              resolve(text);
            })
            .catch(error => {
              reject();
            });
        })
        .catch(error => {
          reject();
        });
    });
  }
}
