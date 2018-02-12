var runAutomatic = false;
var suppressUpdate = false;
var update; 
var map;
var panorama;


function initialize() {
    var sv = new google.maps.StreetViewService();
    var start = {lat: 33.5190755, lng:-111.9253654};
        //lat: 43.36730798597097, 
        //lng: -5.834250420142922
    
    map = new google.maps.Map(document.getElementById('map'),{
        center: start,
        zoom: 14
    });
    panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'),{
        position: start,
        pov: {
            heading: 0,
            pitch: 0
        }
    });

    map.setStreetView(panorama);

    map.data.setControls(['Polygon']);
        map.data.setStyle({
        editable: true,
        draggable: true
    });

//     watchdog();

    update = function() {

        lastUpdate = new Date();
        console.log("updating " + (suppressUpdate && runAutomatic));
        
        if (suppressUpdate && runAutomatic)
            return;
        suppressUpdate = true;
        panoid = panorama.getPano();
        if (seen[panoid]) {
            console.log("seen " + panoid);
            nextTodo(false);
            return;
        }
        seen[panoid] = 1;
        console.log("update on " + panoid);
        document.getElementById('panoid').innerHTML = "id: " + (panoid ? panoid : "move pegman first");
        if (panorama.location) {
            document.getElementById('panolat').innerHTML = "lat/long: " + panorama.location.latLng.lat() + "," + panorama.location.latLng.lng();
        } else {
            $("#panlat").empty();
            $("#heading").empty();
        }
        parameters = null ;
        getExact(panoid, function(v) {

            parameters = v;
            if (v) {

                document.getElementById('full').innerHTML = "lat_long_height?_roty_rotx?_rotz?: " + v.join("_");
                // listLocal(v);

                if (runAutomatic) {
                    var latLongKey = toLatLongKey(parameters);
                    if (!seen[latLongKey] && parameters[0] >= minLat && parameters[0] <= maxLat && parameters[1] >= minLong && parameters[1] <= maxLong) {
                        fileSystemHas(v.join("_"), function(has) {
                            seen[latLongKey] = 1;
                            if (!has ) {
                                addTodo(panorama.getLinks());
                                process();
                            } else
                                nextTodo(false);
                        });
                    } else
                        nextTodo(false);
                } else
                    nextTodo(false);
            } else {
               document.getElementById('full').innerHTML = "parameters not found (inside pano?)"
                nextTodo(false);
            }
        });
    }
    //    google.maps.event.addListener(panorama, "visible_changed", update);
    google.maps.event.addListener(panorama, "position_changed", update);


    $("#save").click(function() {
         map.data.toGeoJson(function (json) {
            localStorage.setItem('geoData', JSON.stringify(json));
        });

        localStorage.setItem('center', JSON.stringify(map.getCenter()));
        localStorage.setItem('zoom'  , JSON.stringify(map.getZoom()));
        localStorage.setItem('pegman', JSON.stringify(panorama.getPosition()));
    });

    $("#load").click(function() {
        var data = JSON.parse(localStorage.getItem('geoData'));
        map.data.forEach(function (f) {
            map.data.remove(f);
        });

        map.data.addGeoJson(data);
        map.panTo ( JSON.parse(localStorage.getItem('center')));
        map.setZoom ( JSON.parse(localStorage.getItem('zoom')));
        panorama.setPosition ( JSON.parse(localStorage.getItem('pegman')));
    });

    $("#go2").click(function() {
        
        outside = {};
        toProcess = {};
        processed = {};

        var first = [];

        first.id = panorama.getPano();
        first.lat = panorama.getPosition().lat();
        first.lng = panorama.getPosition().lng();
        first.height = parameters[2];
        first.a = parameters[3];
        first.b = parameters[4];
        first.c = parameters[5];


        toProcess[first.id] = first;


        next2();
    });

    $("#clear2").click(function() {
        map.data.forEach (function (f) {
            map.data.remove (f);
        })
    });
}

var outside, toProcess, processed;

function next2() {

    console.log("toProcess " + Object.keys(toProcess).length +" processed " +Object.keys(processed).length + " outside " + Object.keys(outside).length);

    if ( Object.keys(toProcess).length == 0) {
        console.log("all done");
        done2(processed);
        return;
    }

    var k = Object.keys(toProcess)[0];
    var next = toProcess[k];
    delete (toProcess[k]);
    processed[k] = next;

    listLocal (next, function(neu) {

        if (outside.hasOwnProperty(neu.id) || processed.hasOwnProperty(neu.id) || toProcess.hasOwnProperty(neu.id) )
            return;

        if ( drawnContains ( neu ) )
            toProcess[neu.id] = neu;
        else
            outside[neu.id] = neu;
    });
}

function done2(results) {

    var out = [];

    for (var j in results) {
        var l = results[j];
        out.push (l.lat+"_"+l.lng+"_"+l.height+"_"+l.a+"_"+l.b+"_"+l.c+"_"+j );

        var marker = new google.maps.Marker({
                            position: new google.maps.LatLng( l.lat, l.lng ),
                            map: map,
                            title:  j
                          });

    };

    window.open("data:application/octet-stream," + encodeURIComponent(out.join("\n")), 'new');

}

function listLocal(origin, found) {
    var xhttp = new XMLHttpRequest();
    // extract the exact GPS, height & orientation info
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.status == 200) {
                //console.log(this.responseText);
                
                //[[2,"wKYVjI6DN7DjFqXYgo-zOw"],null,[[null,null,43.36667006893445,-5.832748233898315],
                // [183.7556304931641],[206.2729644775391,90.45455169677734,2.180722951889038]]]
                var myRegexp = /.*?(\[\[2,\"(?:(?!\[\[2).)+?en\"\]\]\]\])/gy;
                 // /.*\[\[2,\"([^\"]+)\"\],null,\[\[null,null,([^,]+),([^,]+)\],\[([^,]+)\],.*/;
                 var match;
                 
                 do {
                     match = myRegexp.exec(this.responseText);
                     if (match)  {

                        if (match[1].includes(",90,") || match[0].length > 6000)
                            break;

                         //console.log( match[1] +"]");
                         try {
                         var loc = JSON.parse ( "["+match[1] +"]" )[0]
                         
                         
                            var parsed = {
                             lat:loc[2][0][2], lng:loc[2][0][3], id:loc[0][1],
                             height: loc[2][1][0],
                             a:loc[2][2][0],
                             b:loc[2][2][1],
                             c:loc[2][2][2],
                             }

                            found ( parsed );

                        } catch (err) {
                             console.log("skipping " + match[1]);
                        }

//                         var ll = new google.maps.LatLng( loc[2][0][2], loc[2][0][3] );

//                         console.log ( loc  );
 //                        console.log (drawnContains(ll));

                         //var marker = new google.maps.Marker({
                         //   position: ll,
                         //   map: map,
                         //   title:  ll.toString()
                         // });
                     }
                } while (match);
                
	            next2();
	         } 
        }
    }
    xhttp.open("GET", "https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m4!1m2!3d"+origin.lat+"!4d"+origin.lng+"!2d50!3m10!2m2!1sen!2sGB!9m1!1e2!11m4!1m3!1e2!2b1!3e2!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=_xdc_._v2mub5", true);
    xhttp.send();
}

function drawnContains (loc ) {
    var inside = false;
    map.data.forEach(function(t) {
        if (!inside && t.getGeometry().getType() == "Polygon") {
            if ( google.maps.geometry.poly.containsLocation( 
                new google.maps.LatLng(loc.lat, loc.lng),
                new google.maps.Polygon({paths:t.getGeometry().getAt(0).getArray()}) ))
                inside = true;
        }
    });

   return inside;
}

function toLatLongKey(parameters) {
    return parameters[0] + "_" + parameters[1]
}
var seen = {}
  , todo = {}
function addTodo(links) {
    var c = 0;
    for (var i in links) {
        // stash links for future processing
        var p = links[i].pano;
        if (!seen[p]) {
            todo[p] = 1;
            c = c + 1;
        }
    }
    console.log("added " + c + " from " + links.length);
}
function nextTodo(delay) {
    var remaining = Object.keys(todo).length;
    console.log("remaining size " + remaining);
    $("#togo").html("togo: " + remaining);
    if (remaining == 0) {
        //         alert("all done");

        if (!runAutomatic) {
            seen = {};
            todo = {};
        }

        return;
    }
    do {
        var key = Object.keys(todo)[0];
        var value = todo[key];
        delete (todo[key]);
        if (!seen[key]) {
            fileSystemHas(key, function(has) {
                if (has) {
                    seen[key] = 1;
                    console.log("seen " + key);
                    nextTodo(false);
                    return;
                }
                repeat = false;
                setTimeout(function() {
                    if (Array.isArray(value)) {
                        // lat/long
                        console.log("saving empty " + key);
                        saveEmptyFile(key);
                        panorama.setPosition({
                            lat: value[0],
                            lng: value[1]
                        });
                    } else
                        // is a panorama id: sometimes fires update twice, sometimes once
                        
                        panorama.setPano(key);
                    suppressUpdate = false;

                }, delay ? 2000 : 0);
            });
            return;
        }
    } while (true);
}

var watchDogRunning = false;

function watchdog() {
    if(watchDogRunning)
        return;
    watchDogRunning = true;
    setInterval( function() {
        if (new Date() - lastUpdate > 20 * 1000) {
            console.log("watchdog biting update");
            suppressUpdate = false;
            update();
        }
    }, 5000 );
}

function fileSystemHas(key, after) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            after.call(this, xhttp.responseText == "True");
        }
    }
    xhttp.open("POST", "http://localhost:8080/query");
    xhttp.send(key);
}
var minLat, maxLat, minLong, maxLong;
function bulk() {
    var lat1 = parseFloat($("#lat1").val())
      , long1 = parseFloat($("#long1").val())
      , lat2 = parseFloat($("#lat2").val())
      , long2 = parseFloat($("#long2").val());
    // beware the meridian
    minLong = Math.min(long1, long2);
    maxLong = Math.max(long1, long2);
    minLat = Math.min(lat1, lat2);
    maxLat = Math.max(lat1, lat2);
    var step = 0.0001;
    for (var x = minLong; x <= maxLong; x += step)
        for (var y = minLat; y <= maxLat; y += step)
            todo[toLatLongKey([y, x])] = [y, x];
    suppressUpdate = false;
    panorama.setPosition({
        lat: lat1,
        lng: long1
    });
}
var lastExactId, lastExactResult;
function getExact(id, ondone) {
    if (id == lastExactId) {
        ondone(lastExactResult);
        return;
    }
    lastExactId = id;
    var xhttp = new XMLHttpRequest();
    // extract the exact GPS, height & orientation info
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4) {
            if (this.responseText.length > 100 && this.responseText.indexOf("googleusercontent") == -1 && this.status == 200) {
                // reference to user photo: ignore these as they are often inside...
                var myRegexp = /\[\[null,null,([^\"]*)/;
                var match = myRegexp.exec(this.responseText);
                if (match) {
                    //                 console.log("::"+match[1]+"::");
                    var strs = match[1].split(/[,\[\]]+/);
                    ondone(lastExactResult = strs.map(parseFloat).filter(function(x) {
                        return !isNaN(x);
                    }));
                }
            } else
                ondone.call();
        }
    }
    xhttp.open("GET", "https://maps.googleapis.com/maps/api/js/GeoPhotoService.GetMetadata?pb=!1m5!1sapiv3!5sUS!11m2!1m1!1b0!2m1!1sen!3m3!1m2!1e2!2s" + id + "!4m10!1e1!1e2!1e3!1e4!1e8!1e6!5m1!1e2!6m1!1e2&callback=_xdc_._misdlu", true);
    xhttp.send();
}
PANO_X = 13312;
PANO_Y = 6656;
TILE = 512;
function process() {
    console.log("process started");
    if (!parameters) {
        alert("didn't find parameters. cors? network issue? try moving the yellow man a bit.");
        return;
    }
    $("#images").empty();
    canvas = document.createElement("canvas");
    // $('<canvas/>', { id: 'canvas', height: 614, width: 1280}).get()[0];
    var resolution = parseFloat($("#resolution option:selected").text());
    $(canvas).attr("id", "canvas");
    $(canvas).attr("width", PANO_X * resolution);
    $(canvas).attr("clientWidth", PANO_X * resolution);
    $(canvas).attr("height", PANO_Y * resolution);
    $(canvas).attr("clientHeight", PANO_Y * resolution);
    $("#images").append(canvas);
    count = 26 * 13;
    for (var x = 0; x <= 25; x++)
        for (var y = 0; y <= 12; y++) {
            create(panoid, x, y, resolution);
            //             count--;
        }
}

DO_DEPTH = false;

function create(panoid, x, y, resolution) {
    var img = new Image();
    document.createElement("img");
    img.onload = function() {
        count--;
        console.log("..." + count);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, x * TILE * resolution, y * TILE * resolution, TILE * resolution, TILE * resolution);
        if (count == 0) {
            saveCanvas("canvas", "image/jpeg", buildFilename()+".jpg" );
            if (DO_DEPTH) {
                grabDepth(0);
            }
            else
            {
                nextTodo(true);
            }
            
            
        }
    }
    img.src = "http://cbk0.google.com/cbk?output=tile&panoid=" + panoid + "&zoom=5&x=" + x + "&y=" + y;
}

function buildFilename() {
    return  parameters ? parameters.join("_") + "_" + panoid : "unknown" 
}

function grabDepth(count) {
    var depthLoader = new GSVPANO.PanoDepthLoader();
    
    depthLoader.onDepthLoad = function() {
        
                var x, y, canvas, context, image, w, h, c;
                
                canvas = document.createElement("canvas");
                $(canvas).attr("id", "planeCanvas");
                context = canvas.getContext('2d');

                var depthMap = this.results['depth'];
                var planeMap = this.results['plane'];


                w = this.results['w']
                h = this.results['h']

                if (typeof w == 'undefined' && count < 5) {
                    setTimeout(function() {
                        grabDepth(count+1); }, 1234 );
                    
                    return;
                }

                if (typeof w != 'undefined') {

                    canvas.setAttribute('width', w);
                    canvas.setAttribute('height', h);
                
                    image = context.getImageData(0, 0, w, h);

                    for(y=0; y<h; ++y) {
                        for(x=0; x<w; ++x) {

                            c = planeMap[y*w + x];

                            image.data[4*(y*w + x)    ] = c;
                            image.data[4*(y*w + x) + 1] = c;
                            image.data[4*(y*w + x) + 2] = c;
                            image.data[4*(y*w + x) + 3] = 255;
                        }
                    }

                    context.putImageData(image, 0, 0);

                    $("#images").append(canvas);

                    saveCanvas("planeCanvas", "image/png", buildFilename()+".png")
                    savePlanes(this.results['tidy'], buildFilename()+".txt");
                }
                
                nextTodo(true);
            }

            depthLoader.load(panoid);
}

function setCoords(a, b) {
    $("#" + a).val(parameters[0]);
    $("#" + b).val(parameters[1]);
}
function reset(bulk) {
    runAutomatic = bulk;
    todo = {};
    seen = {};
}

function savePlanes (array, filename) {
    if ($('#saveByDownload').get()[0].checked) {
        // nada
    } else {

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                console.log("done");
            }
        }

        var s = "";

        for (var i = 0; i < array.length; i++) {
            s += array[i].join(",")+"\n";
        }

        var data = "data:image/jpeg;base64,"+window.btoa(s);
        var missing_padding = data.length % 4

        while (missing_padding != 0) {
            data += '=';
            missing_padding--;
        }

        xhttp.open("POST", "http://localhost:8080/save");
        
        xhttp.send(JSON.stringify({
            filename: filename,
            data: data
        }));

    }
}

function saveCanvas(id, type, filename) {

    if ($('#saveByDownload').get()[0].checked) {

        console.log("download canvas");
        if (chrome.downloads)
            chrome.downloads.download({
                url: $("#"+id).get()[0].toDataURL(type, 1.0),
                filename: filename
            });

    } else {

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                console.log("done");
            }
        }

        var data =  $("#"+id).get()[0].toDataURL(type);
        var missing_padding = data.length % 4

        while (missing_padding != 0) {
            data += '=';
            missing_padding--;
        }

        xhttp.open("POST", "http://localhost:8080/save");
        xhttp.send(JSON.stringify({
            filename: filename,
            data: data
        }));

    }
}

function saveEmptyFile(name) {
    var xhttp = new XMLHttpRequest();
    xhttp.open("POST", "http://localhost:8080/save");
    xhttp.send(JSON.stringify({
        filename: name,
        data: ""
    }));
}
$(function() {
    //     $("#write").click(function() {
    //         var xhttp = new XMLHttpRequest();
    //         xhttp.onreadystatechange = function() {
    //             if (this.readyState == 4 && this.status == 200) {
    //                 console.log("done");
    //             }
    //         }
    //         xhttp.open("POST", "http://localhost:8080/save", true);
    //         xhttp.send(JSON.stringify({
    //             filename: parameters ? parameters.join("_") + ".jpg" : "unknown.jpg",
    //             data: canvas.toDataURL("image/jpeg")
    //         }));
    //     });
    $("#process").click(function() {
        reset(false);
        process();
    });
    $("#set1").click(function() {
        setCoords("lat1", "long1");
    });
    $("#set2").click(function() {
        setCoords("lat2", "long2");
    });
    $("#bulk").click(function() {
        reset(true);
        bulk();
    });
})
