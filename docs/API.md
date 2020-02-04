# API
The API of the Kaltura Interactive Player is constructed to 2 main options. You can listen to player events, and you can command the player to preform an action. 

## [Commanding the player](#Commands)
The API of the player in fact a reflection of playkit-js API and can be seen here: 
https://github.com/kaltura/playkit-js

Example:
```
 // setup 
 var kalturaInteractivePlayer = Kip.setup(config);

 // Media-load
 kalturaInteractivePlayer.loadMedia({ "entryId" : "0_dm5h0dD" });
 
 // play the current video
 kalturaInteractivePlayer.play();
 
 // pause the current video
 kalturaInteractivePlayer.pause();
  
 // Set volume to 50%  
 kalturaInteractivePlayer.volume = 0.5;

 // Seek current video to sec 10 
 kalturaInteractivePlayer.seek(10);
 
```

## [Extracting data from the player]()
Once we have a reference to the player we can just use one of the getters function to access the data

Example:
```
 // setup 
 var kalturaInteractivePlayer = Kip.setup(config);

 // Media-load
 kalturaInteractivePlayer.loadMedia({ "entryId" : "0_dm5h0dD" });
 
  // get the current video playhead-position  
 const currentTime = kalturaInteractivePlayer.currentTime   
 
 // get the current video volume 
 const currentVolume = kalturaInteractivePlayer.volume   
  
```

## [Events Listening](#Events)

Events are published from the player and can be subscribed to in order to extend the interactive experience or inform analytics services. 
Every event is an object with type and payload properties. 
The payload property will return information about the project, it’s current state, and, depending on the event, custom data fed from fields in the Rapt Media composer.

Example:
```
 // setup 
 var kalturaInteractivePlayer = Kip.setup(config);
 // Event listening
 kalturaInteractivePlayer.addListener("project:load" , function (event) {
    console.log(event.type); // project:load
    console.log(event.payload); // project:load
 });
 // Media-load
 kalturaInteractivePlayer.loadMedia({ "entryId" : "0_dm5h0dD" });
  
```
<br/>

## Commands 
  
#### function play();
Play the current video

#### function pause();
Pause the current video

#### function seek(n);
Seek current video to a specific second. 

#### function volume(n);
Set the volume of the player. value need to be between 0 to 1.

## Events
#### project:load
A new project is loading. Project data will not be available.
#####payload
None

#### project:ready
A new project has been loaded.
##### payload
None

#### project:start
The project has started. Triggered on the first media play event of a given play through (will re-trigger on replay’s).
##### payload
None

####project:ended
The project has reached the end of a given branching structure.
##### payload
None

#### project:replay
The project is being reset for replay.
##### payload
None

#### project:unload
The project has been unloaded.
##### payload
None

#### project:reset
The project has been reset to the beginning.
##### payload
None

####node:enter
A new node has been loaded.
#####payload
kind - only on the 1st node will be "start". All other will be "jump"
```
{
 kind: "jump" || "start" ,
 node: [THE_NODE_OBJECT],
 prevNode: [THE_PREVIOUS_NODE] / undefine in case of first node  
}
```

####node:exit
The current node will be unloaded.
#####payload
```
{
 kind:  "jump",
 node: [THE_NODE_OBJECT],
 nextNode: [THE_NEXT_NODE]  
}
```

#### node:ended
The current node has ended.
##### payload
```
{
 kind: [THE_NODE_NAME],
 node: [THE_NODE_OBJECT],
 prevNode: [THE_PREVIOUS_NODE] / undefine in case of first node  
}
```

#### hotspot:click
The user has clicked on a hotspot.
##### payload
```
{
 hotspot: [THE_HOTSPOT_OBJECT] 
}
```

#### browser:open
The project has opened a new window.
##### payload
```
{
 href: [URL_TO_OPEN],
 target: "_blank" 
}
```

#### browser:hidden
The browser window has been hidden. The interactive video will be paused.
##### payload
None

#### cue:forward
Playback has crossed over a cue point. Cue points are custom api events that can be added using the Rapt Media composer by entering the node editor and turning on the api event timeline. Custom data can be added to each cue point and is passed through in the payloadproperty.
##### payload
```
{
 cue: {
        customData : [THE_CUEPOINT_STRING],
        id : [THE_CUEPOINT_ID]
      }
}
```

#### cue:reverse
Playback has reversed passed a cue point. Cue points are custom api events that can be added using the Rapt Media composer by entering the node editor and turning on the api event timeline. Custom data can be added to each cue point and is passed through in the payload property.
##### payload
```
{
 cue: {
        customData : [THE_CUEPOINT_STRING],
        id : [THE_CUEPOINT_ID]
      }
}
```

#### player:play
The current video has started playing.
##### payload
None

#### player:pause
The current video has been paused.
##### payload
None

#### player:progress
The playhead has crossed a predefined progress point. Event fires at 25%, 50%, 75% and 98% of every node.
##### payload
The percentage are in format of decimal fraction (E.G. 0.5 = 50%)
```
{
    progress: [DECIMAL_PERCENTAGE]
}
```


