## Events

The KIP throws events that you can listen to. We split them to 2 groups, Rapt and Buffering events.  
Once you created the rapt javascript reference you just add a event lister like this: 

```$xslt
 var kip = Kip.setup(config);
 kip.addListener("project:load" , function (a) {
    console.log("project:load",a);
 });
```

#### Rapt-API event  
These events are thrown by the Rapt engine layer. They describe events that are relevant to the rapt project