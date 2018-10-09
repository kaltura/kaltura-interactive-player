## API
The API of the Kaltura Interactive Player is constructed to 2 main options. You can listen to player events, and you can command the player to preform an action. 

###Commanding the player
The API of the player in fact a reflection of playkit-js API and can be seen here: 
https://github.com/kaltura/playkit-js

Example of use:

```
 // setup 
 var kalturaInteractivePlayer = Kip.setup(config);

 // Media-load
 kalturaInteractivePlayer.loadMedia({ "entryId" : "0_dm5h0dD" });
 
 // play the current video
 kalturaInteractivePlayer.api.play();
 
 // Set volume to 50%  
 kalturaInteractivePlayer.api.setVolume(0.5)
 
 
```
###list of commands  

####function raptor.api.play();
#####Description
Method starts playback of current media/node for the Rapt Media Player.






### Events
Events are published from the player and can be subscribed to in order to extend the interactive experience or inform analytics services. Every event is an object with type and payload properties. The payload property will return information about the project, it’s current state, and, depending on the event, custom data fed from fields in the Rapt Media composer.

Example of use:

```
 // setup 
 var kalturaInteractivePlayer = Kip.setup(config);
 // Event listening
 kalturaInteractivePlayer.addListener("project:load" , function (a) {
    console.log("project:load",a);
 });
 // Media-load
 kalturaInteractivePlayer.loadMedia({ "entryId" : "0_dm5h0dD" });
  
```

####project:load
A new project is loading. Project data will not be available.

####project:ready
A new project has been loaded.

####project:start
The project has started. Triggered on the first media play event of a given play through (will re-trigger on replay’s).

project:ended
The project has reached the end of a given branching structure.

####project:replay
The project is being reset for replay.

####project:unload
The project has been unloaded.

####project:reset
The project has been reset to the beginning.

####node:enter
A new node has been loaded.

####node:exit
The current node will be unloaded.

####node:ended
The current node has ended.

####hotspot:click
The user has clicked on a hotspot.

####browser:open
The project has opened a new window.

####browser:hidden
The browser window has been hidden. The interactive video will be paused.

####cue:forward
Playback has crossed over a cue point. Cue points are custom api events that can be added using the Rapt Media composer by entering the node editor and turning on the api event timeline. Custom data can be added to each cue point and is passed through in the payloadproperty.

####cue:reverse
Playback has reversed passed a cue point. Cue points are custom api events that can be added using the Rapt Media composer by entering the node editor and turning on the api event timeline. Custom data can be added to each cue point and is passed through in the payload property.

####player:play
The current video has started playing.

####player:pause
The current video has been paused.

####player:progress
The playhead has crossed a predefined progress point. Event fires at 25%, 50%, 75% and 98% of every node.

