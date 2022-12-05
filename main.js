var overpassURL = "https://overpass-api.de/api/interpreter?data=";
var centreLat = 54.008551;
var centreLong = -2.787395;
var boundingBox = "54.002150,-2.798493,54.014962,-2.776263"
var boundingBox = [2.0000000000, 0.0000000000, 0.0000000000, -2.0000000000, 345001.0000000000, 459999.0000000000]

async function loadMap() {
    /*
        Hides the welcome screen and shows the map
    */
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    camera = document.querySelector('#rig');
    camera.setAttribute("position", centreLat+" 0 "+centreLong);

    await getHeightMap();
    loadTerrain();
    //loadBuildings();
}

function loadMenu() {
    /*
        Hides the map and shows the welcome screen
    */
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "none";
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "block";
}


async function loadBuildings() {
    console.log(twoDHeightMapArray);

    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    var overpassQuery = overpassURL +
    encodeURIComponent(
        "(way[building]("+boundingBox+");" +
        "rel[building]("+boundingBox+"););" +
        "out geom;>;out skel qt;"
    );
    console.log(overpassQuery);

    // let geoJSON = await fetch(overpassQuery).then((response) => {
    let geoJSON = await fetch("interpreter.xml").then((response) => {
        if(!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
    })
    .then((response) => {
        var parser = new DOMParser();
        var itemData = parser.parseFromString(response, "application/xml");
        console.log(response);
        console.log(itemData);
        var itemJSON = osmtogeojson(itemData);
        console.log(itemJSON);
        return itemJSON
    });

    var count = 0;
    geoJSON.features.forEach(feature => {
        if (feature.geometry.type == "Polygon") {
            addBuilding(feature);
            count = count + 1;
        } else {
        }
    });

    console.log("Number of buidlings: ", count);
}


async function addBuilding(feature) {
    var tags = feature.properties;
    var height = tags.height ? tags.height : tags["building:levels"];
    if(tags.amenity == "shelter" && !height) height = 1;
    else if(!height) height = 2;

    var color = "#FFFFFF";
    if (tags["building:colour"]) {
      color = tags["building:colour"];
    }

    var outerPoints = [];
    var sumOfLatCoords = 0;
    var sumOfLongCoords = 0;
    var count = 0;
    await fetch("uniTiff/SD45ne_DTM_2m.tfw").then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.text();
    })
    .then((data) => {
        feature.geometry.coordinates[0].forEach(coordinatesPair => {
            //relativePos = getRelativePosition(coordinatesPair[1], coordinatesPair[0]);
            //relativePos.x = relativePos.x*20000
            //relativePos.z = relativePos.z*20000
            tempLat = coordinatesPair[1];
            tempLong = coordinatesPair[0];
            sumOfLatCoords += tempLat;
            sumOfLongCoords += tempLong;
            count++;
            let temp = convertLatLongToUTM(tempLat, tempLong);
            console.log(temp);
            let easting = temp.x;
            let northing = temp.y;
            let twfData = data.split("\n");
            let x = (twfData[3]*easting-twfData[2]*northing+twfData[2]*twfData[5]-twfData[3]*twfData[4])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
            let y = (-twfData[1]*easting+twfData[0]*northing+twfData[1]*twfData[4]-twfData[0]*twfData[5])/(twfData[0]*twfData[3]-twfData[1]*twfData[2]);
            console.log(x, y);
            let xy = convertToNewPixelCoords(x, y);
            console.log(xy);
            x = Math.round(xy.x);
            y = Math.round(xy.y);
            console.log({x: x, y: y});
            return {x: x, y: y};
        });
    }).catch((err) => {console.error(err)});

    //console.log(outerPoints);
    // for (let way of feature.geometry.coordinates) {
    //   let wayPoints = [];
    //   for (let point of way) {
    //     let tpos = tileposFromLatlon(latlonFromJSON(point));
    //     let ppos = getRelativePositionFromTilepos(tpos, itemPos);
    //     wayPoints.push({x: ppos.x, y: ppos.z});
    //   }
    //   if (!outerPoints.length) {
    //     outerPoints = wayPoints;
    //   }
    //   else {
    //     innerWays.push(wayPoints);
    //   }
    // }

    var buildingProperties = {primitive: "building", outerPoints: outerPoints, height: height};

    var sceneElement = document.querySelector('a-scene');
    var newElement = document.createElement('a-entity');
    newElement.setAttribute("class", "building");
    newElement.setAttribute("geometry", buildingProperties);
    newElement.setAttribute("material", {color: color});

    // var buildingCentreLatLong = getLatLongFromRelativePosition((sumOfLatCoords/count), (sumOfLongCoords/count));
    // var buildingUTM = convertLatLongToUTM(buildingCentreLatLong.lat, buildingCentreLatLong.long);
    // var pixelCoords = convertUTMToPixelCoords(buildingUTM.x, buildingUTM.y);        // Has to be y because of proj4

    // pixelCoords.then((coords) => {
    //     //console.log(pixelCoords);
    //     // var height = twoDHeightMapArray.length;
    //     // var width = twoDHeightMapArray[0].length;
    //     // console.log(coords);
    //     //var correctY = (width/2)-coords.y
    //     // coords.x += height/2;
    //     // coords.y += width/2;
    //     if(twoDHeightMapArray[coords.x][coords.y/*+correctY*/] != undefined) {
    //         //console.log("Test");
    //         newElement.setAttribute("position", {x: (sumOfLatCoords/count), y: 0/*-1*yScale*(twoDHeightMapArray[coords.x][coords.y/*+correctY])*/, z: (sumOfLongCoords/count)});
    //         return Promise.resolve();
    //     }
    // }).catch((coords) => {
    //     while(twoDHeightMapArray[coords.x][coords.y+correctY] == undefined){
    //         coords.y++;
    //         if(coords.y > twoDHeightMapArray[x].length) {
    //             coords.y=0;
    //             coords.x++;
    //         }
    //     }
    //     console.log("hello");
    //     newElement.setAttribute("position", {x: (xCoords/count), y: 100/*(twoDHeightMapArray[coords.x][coords.y])*/, z: (zCoords/count)});
    //     return Promise.reject();
    // });

    //newElement.setAttribute("scale", "40 7 33");
    newElement.setAttribute("position", {x: (sumOfLatCoords/count), y: 0/*(twoDHeightMapArray[coords.x][coords.y])*/, z: (sumOfLongCoords/count)});
    sceneElement.appendChild(newElement);
}


AFRAME.registerGeometry('building', {
    schema: {
        outerPoints: {
            default: [new THREE.Vector2(0, 0), new THREE.Vector2(0, 1), new THREE.Vector2(1, 0), new THREE.Vector2(1, 1)],
        },
        height: { type: 'number', default: 1 },
    },

    init: function (data) {

        var shape = new THREE.Shape(data.outerPoints);
        shape.color = data.color;

        var geometry = new THREE.ExtrudeGeometry(shape, {amount: data.height, bevelEnabled: false});
        // As Y is the coordinate going up, let's rotate by 90° to point Z up.
        geometry.rotateX(-Math.PI / 2);
        // Rotate around Y and Z as well to make it show up correctly.
        geometry.rotateY(Math.PI);
        geometry.rotateZ(Math.PI);
        // Now we would point under ground, move up the height, and any above-ground space as well.
        geometry.translate (0, data.height, 0);
        geometry.center;
        this.geometry = geometry;
    }
});











// window.addEventListener("keydown", (event) => {
//     if (event.defaultPrevented) {
//       return; // Do nothing if the event was already processed
//     }
  
//     switch (event.key) {
//       case "Shift":
//         console.log("shift");
//         this.dVelocity.y -= 1;
//         break;
//       case "Space":
//         console.log("Space");
//         this.dVelocity.y += 1;
//         break;
//     }
// });
AFRAME.registerComponent('flight-controls', {
    getVelocityDelta: function () {
        var data = this.data,
        keys = this.getKeys();

        this.dVelocity.set(0, 0, 0);
        if (data.enabled) {
            // NEW STUFF HERE
            if (keys.KeySpaceBar)  { console.log("Space"); this.dVelocity.y += 1; }
            if (keys.KeyShift) { console.log("Shift"); this.dVelocity.y -= 1; }
        }

    return this.dVelocity.clone();
    },
});