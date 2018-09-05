import { Promise } from "es6-promise";
import { KalturaFilterPager } from "kaltura-typescript-client/api/types/KalturaFilterPager";
import {
  KalturaAPIException,
  KalturaClient,
  KalturaClientException
} from "kaltura-typescript-client";
import { KalturaFileAsset } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAsset";
import { FileAssetListAction } from "../node_modules/kaltura-typescript-client/api/types/FileAssetListAction";
import { KalturaFileAssetFilter } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetFilter";
import { KalturaFileAssetObjectType } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetObjectType";
import { KalturaFileAssetListResponse } from "../node_modules/kaltura-typescript-client/api/types/KalturaFileAssetListResponse";
import { Dispatcher } from "./helpers/Dispatcher";
import { KipEvent } from "./helpers/KipEvents";

interface clientConfig {
  ks?: string;
  serviceUrl?: string;
}

export class RaptClient extends Dispatcher {
  kClient: KalturaClient;
  serviceUrl: string;
  clientTag: string = "rapt-v3-app";
  config: clientConfig;
  ks: string;

  constructor(config: clientConfig) {
    super();
    this.serviceUrl = config.serviceUrl
      ? config.serviceUrl
      : "http://www.kaltura.com";
    this.ks = config.ks;
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
      //todo handle widgetSession later
      this.kClient = this.initClient(
        this.config.serviceUrl,
        this.clientTag,
        this.config.ks
      );

      const pager: KalturaFilterPager = new KalturaFilterPager();
      pager.pageSize = 1;
      pager.pageIndex = 1;

      const filter: KalturaFileAssetFilter = new KalturaFileAssetFilter();
      filter.objectIdEqual = raptPlaylistId;
      filter.fileAssetObjectTypeEqual = KalturaFileAssetObjectType.entry;

      const request = new FileAssetListAction({ filter: filter, pager: null });

      this.kClient.request(request).then(
        (data: KalturaFileAssetListResponse) => {
          // extract the graph-data asset
          let graphDataFileAsset: any = data.objects.find(
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
            reject("API error, check your KS and Playlist data validation");
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

      // TODO handle errors
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
