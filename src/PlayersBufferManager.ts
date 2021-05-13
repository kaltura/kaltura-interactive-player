import {Dispatcher} from "./helpers/Dispatcher";
import {KalturaPlayer, PlayersFactory} from "./PlayersFactory";
import {Persistency, RaptNode} from "./PlayersManager";
import {log} from "./helpers/logger";
import {getInternetExplorerVersion, isWindows7} from "./helpers/detectIe";

interface BufferItem {
    player: KalturaPlayer;
    isReady: boolean;
    isRunning: boolean;
    bufferingTimeoutToken: number | null;
    entryId: string;
    startTime?: number;
}

export class PlayersBufferManager extends Dispatcher {
    private shortEntryThreshold: number = 6;
    private bufferThreshold: number = 2.5;
    private isIe11Win7 = getInternetExplorerVersion() === 11 && isWindows7();
    readonly secondsToBuffer: number;
    private bufferList: BufferItem[] = [];
    private persistenceObj: {
        muted?: boolean;
        rate?: number;
        captions?: string;
        volume?: number;
        audio?: string;
    } = {};
    private _isAvailable: boolean;

    constructor(private raptData: any, private playersFactory: PlayersFactory) {
        super();
        this.secondsToBuffer = playersFactory.secondsToBuffer;
        this.initializeAvailablity();
    }

    private initializeAvailablity(): void {
        // prevent caching on Safari and IE11-Win7 and if config set to no-cache
        const browser = this.playersFactory.playerLibrary.core.Env.browser.name;
        // TODO 9 will be used later to exclude other OS & browsers
        // const browserVersion = this.playersFactory.playerLibrary.core.Env.major;
        // const os = this.playersFactory.playerLibrary.core.Env.os.name;
        const model =
            this.playersFactory.playerLibrary.core.Env.device &&
            this.playersFactory.playerLibrary.core.Env.device.model; // desktops will be undefined
        this._isAvailable = true;
        // On Safari desktop use pre-buffer, on ipad and iphone - don't because autoplay (defaultPath) needs user-gesture
        if (model === "iPad" || model === "iPhone" || model === "Nexus 9") {
            this._isAvailable = false;
            log("log", "pbm_initializeAvailablity", "disabling prefetch", model);
        }
    }

    /**
     * Look if there is a relevant player that was created already
     * @param playerId
     */
    public getPlayer(
        entryId: string,
        playImmediate: boolean,
        showPoster?: boolean,
        seekTo?: number
    ): KalturaPlayer {
        log("log", "pbm_getPlayer", "executed", {entryId, playImmediate});
        if (!this._isAvailable) {
            throw new Error("BufferManager is not available");
        }

        let result: KalturaPlayer;
        let bufferedItem = this.bufferList.find(item => item.entryId === entryId);

        if (bufferedItem) {
            if (bufferedItem.player) {
                log("log", "pbm_getPlayer", "found player in buffer list", {entryId});
                result = bufferedItem.player;

                if (result.player.currentTime > 0) {
                    log("log", "pbm_getPlayer", "seek player to the beginning or a specific time", {
                        entryId
                    });
                    result.player.currentTime = seekTo ? seekTo : 0;
                }
                // TODO 3 [eitan] for persistancy - assign only synced persistancy
                if (playImmediate && !result.player.isPlaying) {
                    log("log", "pbm_getPlayer", "execute play command", {entryId});
                    result.player.play();
                }
            } else {
                log(
                    "log",
                    "pbm_getPlayer",
                    "player buffered in pending mode, create player",
                    {entryId, trackBuffer: playImmediate}
                );
                bufferedItem.player = this.createPlayer(entryId, playImmediate, false, seekTo);
                if (playImmediate) {
                    this.trackBufferOfItem(bufferedItem);
                }
                result = bufferedItem.player;
            }
        } else {
            log(
                "log",
                "pbm_getPlayer",
                "not found in buffer list, create player for entry",
                {entryId}
            );
            result = this.createPlayer(entryId, playImmediate, showPoster, seekTo);
            const newItem = {
                entryId: entryId,
                player: result,
                isRunning: playImmediate,
                bufferingTimeoutToken: NaN,
                isReady: false
            };

            this.bufferList.push(newItem);

            if (playImmediate) {
                this.trackBufferOfItem(newItem);
            }
        }

        return result;
    }

    public isAvailable(): boolean {
        return this._isAvailable;
    }

    public disable(): void {
        this._isAvailable = false;
    }

    private createPlayer(
        entryId: string,
        playImmediate: boolean,
        showPoster?: boolean,
        startTime?: number
    ): KalturaPlayer {
        log("log", "pbm_createPlayer", "create player for entry", {
            entryId,
            playImmediate,
            showPoster,
            startTime
        });

        // TODO 3 [eitan] for persistancy - apply async info
        const kalturaPlayer = this.playersFactory.createPlayer(
            entryId,
            playImmediate,
            this.persistenceObj,
            showPoster,
            startTime
        );
        return kalturaPlayer;
    }

    /**
     * Anytime a new entry is requested to play (1st node, or on any nodeChange, by user or by defaultPath
     * The function loads/play the nodes entry-player and handles buffering of next optional entries players
     * @param nextNode
     */
    public switchPlayer(nextNode?: RaptNode) {
        if (!this._isAvailable) {
            log(
                "warn",
                "pbm_switchPlayer",
                "buffer manager is disabled, ignore switch player request"
            );
            return;
        }
        if (nextNode) {
            const nodesToBuffer = [nextNode, ...this.getNextNodes(nextNode)];
            this.dispatch({type: "buffer:prebuffer", payload: nodesToBuffer});
            const prevItemsMap = this.bufferList.reduce((acc, item) => {
                acc[item.entryId] = item;
                return acc;
            }, {});

            const prevItemsCount = this.bufferList.length;

            this.bufferList = [];

            log("log", "pbm_switchPlayer", "rebuliding buffer list", {
                prevCount: prevItemsCount,
                newCount: nodesToBuffer.length
            });
            nodesToBuffer.forEach(node => {
                const existinItem = prevItemsMap[node.entryId];
                if (existinItem) {
                    log(
                        "log",
                        "pbm_switchPlayer",
                        "entry id was in previous buffer list, copy to current list",
                        {entryId: node.entryId}
                    );
                    this.bufferList.push(existinItem);
                    delete prevItemsMap[node.entryId];
                } else {
                    log("log", "pbm_switchPlayer", "add entry to buffer queue", {
                        entryId: node.entryId
                    });
                    this.bufferList.push({
                        entryId: node.entryId,
                        player: null,
                        isRunning: false,
                        bufferingTimeoutToken: null,
                        isReady: false,
                        startTime: node.startFrom
                    });
                }
            });
            this.destroyBufferedItems(Object.values(prevItemsMap));
        } else {
            this.destroyBufferedItems(this.bufferList);
        }
        // remove duplicity items //todo 4 - prefer items that are better ready (has players, has token or isReady / isRunning
        this.bufferList = this.bufferList.reduce((acc, item) => {
            if (
                !acc.some(
                    (bufferItem: BufferItem) => bufferItem.entryId === item.entryId
                )
            ) {
                acc.push(item);
            }
            return acc;
        }, []);
        this.handleBufferList();
    }

    private handleBufferList(): void {
        log("log", "pbm_handleBufferList", "executed");
        const allReady =
            this.bufferList.length === 0 ||
            this.bufferList.every(item => item.isReady);
        if (allReady) {
            log("log", "pbm_handleBufferList", "all items are buffered", {
                count: this.bufferList.length
            });
            this.dispatch({type: "buffer:allbuffered"});
            return;
        }

        const isSomeoneBuffering = this.bufferList.some(item => item.isRunning);
        // check if need to buffer an item (has items, no one is running and someone is not ready)
        if (!isSomeoneBuffering) {
            // find the 1st item on the list that is not buffering (list is ordered)
            const unbufferedItem = this.bufferList.find(item => !item.isReady);
            log("log", "pbm_handleBufferList", "start track item", {
                entryId: unbufferedItem.entryId
            });
            this.executeItemBuffering(unbufferedItem);
        } else {
            log(
                "log",
                "pbm_handleBufferList",
                "an item is already in buffer mode, nothing to do"
            );
        }
    }

    private trackBufferOfItem(item: BufferItem) {
        item.isRunning = true;
        item.bufferingTimeoutToken = window.setTimeout(
            this.executeItemBuffering.bind(this, item),
            200
        );
    }

    private executeItemBuffering(item: BufferItem): void {
        if (item.bufferingTimeoutToken >= 100) {
            log(
                "log",
                "pbm_executeItemBuffering",
                "failed to prebuffer - release player",
                {entryId: item.entryId}
            );
            item.isRunning = false;
            item.isReady = true; 
            item.bufferingTimeoutToken = null;
            this.dispatch({type: "buffer:bufferend", payload: item.entryId});
            this.handleBufferList();
            // stop! dont continue to loop on this entry. Let it go... 
            return;
        }
        item.bufferingTimeoutToken = null;

        if (!item.isRunning) {
            log("log", "pbm_executeItemBuffering", "start buffering entry", {
                entryId: item.entryId
            });
            this.dispatch({type: "buffer:bufferstart", payload: item.entryId});
            item.player = this.createPlayer(item.entryId, false, false, item.startTime);
            this.trackBufferOfItem(item);
        } else {
            // has player ! find if we have duration
            const player = item.player.player;
            if (
                player.duration &&
                player.duration !== NaN &&
                player.duration < this.shortEntryThreshold
            ) {
                log(
                    "log",
                    "pbm_executeItemBuffering",
                    "buffered not needed, mark entry as ready",
                    {entryId: item.entryId}
                );
                item.isReady = true;
                item.isRunning = false;
                this.handleBufferList();
            } else if (
                item.isRunning &&
                player.buffered &&
                player.buffered.length &&
                player.buffered.end
            ) {
                // if we reached here we have something in the buffer. Let's check now if that's enough
                // IE11 on Win7 sometimes has a very low buffer - it gets a special case
                if (player.buffered.end(0) > this.secondsToBuffer - this.bufferThreshold ||
                    (this.isIe11Win7 && player.buffered.end(0) > 0.8)) {
                    log(
                        "log",
                        "pbm_executeItemBuffering",
                        "buffer completed, mark entry as ready",
                        {entryId: item.entryId}
                    );
                    item.isRunning = false;
                    item.isReady = true;
                    this.dispatch({type: "buffer:bufferend", payload: item.entryId});
                    this.handleBufferList();
                } else {
                    this.trackBufferOfItem(item);
                }
            } else {
                this.trackBufferOfItem(item);
            }
        }

        // if has not running -> set running, create player and set a timeout on that item which will execute executeItemBuffering(item)
        // if item is too short => set is ready and reexecute handlebufferlist
        // if running -> check if ready mark as is ready and not running, and execute handleBufferList, otherwise, reset timeout
    }

    /**
     * Clear all current players (but the players that are relevant for next node)
     * @param nextNode
     */
    private destroyBufferedItems(items: BufferItem[]) {
        log("log", "pbm_destroyBufferedItems", "executed", {
            entries: items.map(item => item.entryId)
        });
        items.forEach(item => {
            if (item.player) {
                log(
                    "log",
                    "pbm_destroyBufferedItems",
                    "remove entry from buffer queue",
                    {entryId: item.entryId}
                );
                // TODO - maybe find a better way to unregister this. Consult Eran when we have more time
                item.player.player.removeEventListener(
                    item.player.player.Event.Core.FIRST_PLAY,
                    e => this.playersFactory.onFirstPlay(e)
                );
                try {
                    item.player.destroy();
                } catch (e) {
                    log(
                    "log",
                    "pbm_destroyBufferedItems",
                    "Failed to destroy player ",
                    {entryId: item.entryId , error : e}
                );
                }
            }

            if (item.bufferingTimeoutToken) {
                log(
                    "log",
                    "pbm_destroyBufferedItems",
                    "cancel running buffer for entry",
                    {entryId: item.entryId}
                );
                clearTimeout(item.bufferingTimeoutToken);
            }
        });
    }

    public syncPlayersStatus(
        attribute: Persistency,
        value: number | string | boolean,
        currentPlayer: any
    ) {
        log("log", "pbm_applyToPlayers", "executed", {
            attribute,
            value,
            currentPlayer
        });
        // store to local
        this.persistenceObj[attribute] = value;

        const availablePlayers = this.bufferList
            .filter(item => item.player)
            .map(item => item.player);

        availablePlayers.forEach(kalturaPlayer => {
            const player: any = kalturaPlayer.player;

            // no point applying the change to the player that triggered the change - it causes infinite loops
            if (currentPlayer === player) {
                return;
            }

            switch (attribute) {
                case Persistency.captions:
                    // get current player text-tracks
                    const textTracks = player.getTracks(
                        this.playersFactory.playerLibrary.core.TrackType.TEXT
                    );
                    // find the track that has the language that the user selected
                    const textTrack = textTracks.find(
                        track => track.language === this.persistenceObj.captions
                    );
                    if (textTrack && textTrack._language !== "off") {
                        player.selectTrack(textTrack);
                    } else {
                        // if we did not find a track or if user selected "off" - turn off the captions
                        player.hideTextTrack();
                    }
                    break;

                case Persistency.audioTrack:
                    // iterate all buffered players
                    const audioTracks = player.getTracks(
                        this.playersFactory.playerLibrary.core.TrackType.AUDIO
                    );
                    const audioTrack = audioTracks.find(
                        track => track.language === this.persistenceObj.audio
                    );
                    if (audioTrack) {
                        player.selectTrack(audioTrack);
                    }
                    break;

                case Persistency.rate:
                    player.playbackRate = this.persistenceObj.rate;
                    break;
                case Persistency.volume:
                    player.volume = this.persistenceObj.volume;
                    break;
                case Persistency.mute:
                    player.muted = value;
                    break;
                case Persistency.textStyle:
                    player.textStyle = value;
                    break;
            }
        });
    }

    /**
     * Get a list of optional nodes for the given node
     *  @param node
     */
    private getNextNodes(node: RaptNode): RaptNode[] {
        let nodes: RaptNode[] = node.prefetchNodeIds.length
            ? node.prefetchNodeIds.map((nodeId: string) =>
                this.getNodeByRaptId(nodeId)
            )
            : [];
        // at this point we have a list of next nodes without default-path and without order according to appearance time
        nodes = this.sortByApearenceTime(nodes, node);
        return nodes;
    }

    /**
     * Return a rapt node
     * @param id
     */
    private getNodeByRaptId(id: string): RaptNode {
        const nodes: RaptNode[] = this.raptData.nodes;
        return nodes.find((item: RaptNode) => item.id === id);
    }

    /**
     * Sort a given nodes-array by the appearance-order of the hotspots in that node
     * @param arr of Nodes
     * @param givenNode
     */
    private sortByApearenceTime(
        arr: RaptNode[],
        givenNode: RaptNode
    ): RaptNode[] {
        // get relevant hotspots (that has the givenNode as 'nodeId' ) and sort them by their showAt time
        const hotspots: any[] = this.raptData.hotspots
            .filter((hotSpot: any) => {
                return (
                    hotSpot.nodeId === givenNode.id &&
                    hotSpot.onClick &&
                    hotSpot.onClick.find((itm: any) => itm.type === "project:jump") // filter out only-URL clicks
                );
            })
            .sort((a: any, b: any) => a.showAt > b.showAt); // sort by appearance time


        // find if there is any hotspot that has a startFrom attribute
        const hotspotsWithStartFrom = hotspots.filter((hs: any) => {
            return hs.onClick && hs.onClick.find((itm: any) => typeof itm.payload.startFrom === 'number');
        });
        const arrayToCache: RaptNode[] = [];
        for (const hotSpot of hotspots) {
            arrayToCache.push(
                arr.find((itm: RaptNode) => {
                    // extract the onClick element with type 'project:jump'
                    const clickItem: any = hotSpot.onClick.find(
                        (itm: any) => itm.type === "project:jump"
                    );
                    return clickItem.payload.destination === itm.id;
                })
            );
        }
        // if there was a default-path on the current node - make sure it is returned as well
        const defaultPathData: any = givenNode.onEnded.find(
            (itm: any) => itm.type === "project:jump"
        );
        if (defaultPathData) {
            const defaultPathNodeId: string = defaultPathData.payload.destination;
            const defaultPathNode: RaptNode = this.raptData.nodes.find(
                n => n.id === defaultPathNodeId
            );
            // add startFrom default path
            if (defaultPathData.payload.startFrom) {
                defaultPathNode.startFrom = defaultPathData.payload.startFrom
            }
            arrayToCache.push(defaultPathNode);
        }
        // add startTime if available 
        if (hotspotsWithStartFrom.length > 0) {
            // fill startFrom attributes if they match a hotspot 
            for (const hsWithStartTime of hotspotsWithStartFrom) {
                // find if we have a relevant start hotspot 
                const jumpingToData = hsWithStartTime.onClick.find((itm: any) => typeof itm.payload.startFrom === 'number').payload;
                const matchingItem = arrayToCache.find((raptNode: RaptNode) => raptNode.id === jumpingToData.destination);
                if (matchingItem) {
                    matchingItem.startFrom = jumpingToData.startFrom;
                }
            }
        }
        return arrayToCache;
    }
}
