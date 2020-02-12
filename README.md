# rapt-player
'Rapt' is an interactive way to consume video, where the end-user can make decisions along the video or navigate to 
external web pages. We will use the term 'interactive-video' or IV (and KIP for Kaltura-Interactive-Player) 

## Description 
The KIP is in fact a code that switches players at runtime. Each video node is loaded in its own player so
it caches the first few seconds of that video to get an immediate playback experience. The KIP receives
a rapt playlist-id as a starting-point, loads Rapt metadata (the mapping of the rapt project), loads the initial video,
places the Rapt-engine layer (the layer that shows the IV UI) and in the background caches the relevant videos. Once 
the user interacts with the Rapt engine layer, the KIP will move the next video to the front and play it.    
    

## Install: 
```
git clone https://github.com/kaltura/kaltura-interactive-player.git
cd kaltura-interactive-player
npm install
```

## Dev setup 
Since most Interactive Videos today are generated in MediaSpace™, they are KS protected. This means that the index.html
is expected to have a valid KS in it. The default entry is of partner-id 27017 and the hard-coded KS will expire around
Sep 23 2019. Please do not edit this entry as it is designed to cover many use cases.  
The default index.html also has an example of how to embed a KIV, and how to integrate with it and listen to events
                                                                  

## Run: 
```
npm start
```

## Embed: 
This library will be bundled inside the Kaltura playkit-js library and served by it. 
In most cases, KMS will generate the player uiconf for you, in case you create the player maually, you will need to make sure that the player V3 version incluses the Rapt V3 "plugin". You do that by setting the 'Additional flashvars' field to something that looks like this template:
```
{"kaltura-ovp-player":"V3_PLAYER_VERSION","path" : "PATH_VERSION"}
```
E.G. {"kaltura-ovp-player":"0.37.2","path" : "0.1.5"}

This next snippet will show a typical embed code of a rapt player

 ```
<!-- playkit-js library code and Rapt  -->
<script src="http://cdnapisec.kaltura.com/p/27017/embedPlaykitJs/uiconf_id/42897631"></script>

<!-- The div that hosts the rapt project-->
<div id="player"></div>

<!-- embed-code  --> 
<script>
    // Rapt config
    var config = {
		targetId: 'player',
		playback:{
			autoplay:true,
			preload:"auto"
		},
		provider: {
			partnerId: 27017,
			uiConfId: 43533251,
			ks: "Zjk0YmQwZTRkZDFjOTE1MGEwMWYwMmEzYzE4ODI4ZTA1YzFkNjRjNHwyNzAxNzsyNzAxNzsxNTM1NzE5NTAyOzI7NzU0MztfX0FETUlOX18yNjY4NzsqLGRpc2FibGVlbnRpdGxlbWVudA=="
		},
        rapt:{}
	};
	var raptPlayer = PathKalturaPlayer.setup(config);
	raptPlayer.loadMedia({playlistId: '1_4377j2jl'});

</script>
```


## Configrations:
The Rapt configuration is in fact an extension of the playkit-js configuration with the addition of the rapt section. 

## API 
#####Event Listening:
The embed code shows how to create a Rapt-player instance. Once you have that instance you can listen to events and 
query the player for information

Assuming the name of the player instance is 'raptPlayer' like the demo, here's how to add listeners to it:

raptPlayer.addListener(EVENT_TYPE, event => {
    
})

Some events has payload, some don't. Her's an example for listening to a hotspot click, and retrieving 
the hotspot object from the payload, which is the hotspot object
```
raptPlayer.addListener("hotspot:click", event => {
    const hotspot = event.payload; 
    /* E.G. 
    {
        "id": "24070b0a-c332-4a89-bb4f-27114a7eb94c",
        "name": "Snail",
        "nodeId": "e14d8699-52dc-495c-bf25-6cf49e71dec1",
        "label": "Snail",
        "showAt": 0,
        "hideAt": 1,
        "style": {...},
        "position": {
            "left": 30,
            "top": 27,
            "width": 133,
            "height": 57
        },
        "onClick": [],
        "customData": null
    }
    */ 
})
```
Another common action is to know when a node is played: 
```
raptPlayer.addListener("node:enter", event => {
    const node = event.payload;
    /* E.G. 
    {
        "id": "e14d8699-52dc-495c-bf25-6cf49e71dec1",
        "xref": null,
        "name": "Hens",
        "customData": "whatever",
        "entryId": "1_b29y3jnj",
        "onEnded": [{
            "type": "project:stop",
            "payload": {}
        }],
        "prefetchNodeIds": [] 
    }
    */    
    
})
```


####Events
Event String   | Description                                         | Payload
-------------- | ---------------                                     | --------
browser:hidden | when the player focuses a new tab                   | 
browser:open   |  when the player focuses a new tab                  | 
cue:forward    |  when a node goes pass a code-cue point             | 
cue:reverse    |  when a node goes back a code-cue point             | 
hotspot:click  | user clicked a hotspot                              | the hotspot object 
node:enter     |  A node started to play                             | the node object that had started to play
node:ended     |  A node had reached its end                         | the node object that reached the end of video
node:exit      |   when a user left a node                           | the node object that was left to another node
project:load   | triggered once when the player loaded               | 
project:ready  | triggered when the data was loaded                  | 
project:start  | triggered when the start-node had started playing   | 
 
####Query Rapt data
We can access the rapt raw data, as it is saved on the database by writing this phrase: 

```
raptPlayer.data 

// print all hotspots 
console.table(raptPlayer.data.hotspots);

// print all nodes 
console.table(raptPlayer.data.nodes);

// get the starting node id
console.log(raptPlayer.data.settings.startNodeId);
```
####Commands 
We can command the player to preform some playback actions (on the current played video) and also to tell the rapt player
to "jump" to a different node. 

Here are the supported actions:
```
raptPlayer.pause(); // pause current video 
raptPlayer.play(); // play current video
raptPlayer.seek(50); // seek the current video to sec 50
raptPlayer.volume(0); mute the player (will effect all next nodes as well)
raptPlayer.jump({name:'Start'}); // Switch the content to play a node that has the name 'start'
raptPlayer.jump({id:'7354fd9b-6401-4c10-b261-99b4d183d07e'}); // Switch the content to play a node that has the given id 
```

## Limitations 
Iphone cannot buffer less than 30 minutes of video, meaning that it will consume a big bandwidth. 
For iphone we have disabled the pre-buffering mechanism.  

### Locked kaltura player version
> Kaltura Player must be 0.40.8 (Relies on internal API that might not be guarantee forward comp')
- [ ] Black-rectangle hides the player when no thumbnail - used CSS to hide it (Rapt-217)
- [ ] __kalturaplayerdata.UIConf (Kip.ts) to read uiconf data 
- [ ] Open a pull request


  


## Licensing
