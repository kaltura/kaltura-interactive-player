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
git clone https://github.com/eitanavgil/kaltura-typescript-boilerplate.git
cd kaltura-typescript-boilerplate
npm install
```

## Run: 
```
npm start
```

## Embed: 
This library will be bundled inside the Kaltura playkit-js library and served by it. This next snippet will show a typical embed code of a rapt player

 ```
<!-- playkit-js library code and Rapt  -->
<script src="http://cdnapisec.kaltura.com/p/27017/embedPlaykitJs/uiconf_id/42897631"></script>

<!-- The div that hosts the rapt project-->
<div id="player"></div>

<!-- embed-code  --> 
<script>
    // Rapt config
    var config = {
		session:{
			ks: "Zjk0YmQwZTRkZDFjOTE1MGEwMWYwMmEzYzE4ODI4ZTA1YzFkNjRjNHwyNzAxNzsyNzAxNzsxNTM1NzE5NTAyOzI7NzU0MztfX0FETUlOX18yNjY4NzsqLGRpc2FibGVlbnRpdGxlbWVudA=="
		},
		targetId: 'player',
		playback:{
			autoplay:true,
			preload:"auto"
		},
		provider: {
			partnerId: 27017
		},
        rapt:{}
	};
	var kalturaPlayer = KalturaPlayer;
    var rapt = Rapt.setup(config , kalturaPlayer , this);
	rapt.loadMedia({entryId: '1_4377j2jl'});

</script>
```


## Configrations:
The Rapt configuration is in fact an extension of the playkit-js configuration with the addition of the rapt section. 
The configu 
 


