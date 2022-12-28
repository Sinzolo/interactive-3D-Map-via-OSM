var overpassURL = "https://overpass-api.de/api/interpreter?data=";
/* Old coords for centre of uni */
var centreLat = 54.008551;
var centreLong = -2.787395;
// var utm = convertLatLongToUTM(centreLat, centreLong);
// var pixelCoords = convertUTMToPixelCoords(utm.x, utm.y)
// var boundingBox = getBoundingBoxFromPixelCoords(pixelCoords.x, pixelCoords.y, 100)
// var centreLat = 54.010212;
// var centreLong = -2.785161;
var boundingBox = "54.002150,-2.798493,54.014962,-2.776263"
var coordsScale = 0.5;  // I think this is due to the fact that the image im using is 2m per pixel so i need to half the pixel coords i get

async function loadMap() {
    /*
        Hides the welcome screen and shows the map
    */
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    await getHeightMap();

    const watchID = setUpLocationWatcher();

    loadTerrain();
    loadBuildings();
}

const options = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: Infinity
};

function setUpLocationWatcher() {
    return navigator.geolocation.watchPosition((position) => {
        console.log("New location = ", {lat: position.coords.latitude, long: position.coords.longitude});
        placeCameraAtGPSLocation(position.coords.latitude, position.coords.longitude);
    }, function(error) {
        switch(error.code) {
            case error.PERMISSION_DENIED:
                console.log("User denied the request for Geolocation.")
                break;
            case error.POSITION_UNAVAILABLE:
                console.log("Location information is unavailable.")
                break;
            case error.TIMEOUT:
                console.log("The request to get user location timed out.")
                break;
            case error.UNKNOWN_ERROR:
                console.log("An unknown error occurred.")
                break;
            }
    }, options);
}

function placeCameraAtGPSLocation(latitude, longitude) {
    camera = document.querySelector('#rig');
    //var utm = convertLatLongToUTM(centreLat, centreLong);
    var utm = convertLatLongToUTM(latitude, longitude);
    var pixelCoords = convertUTMToPixelCoords(utm.x, utm.y);
    camera.setAttribute("position", pixelCoords.x +" "+ (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]+0.020) +" "+ pixelCoords.y);

    console.log("Changing cameras location.");
    console.log("New lat and long: ", latitude, longitude);
    console.log("camera pixel coords: ", pixelCoords.x, pixelCoords.y);
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
    feature.geometry.coordinates[0].forEach(coordinatesPair => {
        tempLat = coordinatesPair[1];
        tempLong = coordinatesPair[0];
        sumOfLatCoords += tempLat;
        sumOfLongCoords += tempLong;
        count++;
        let utm = convertLatLongToUTM(tempLat, tempLong);
        let easting = utm.x;
        let northing = utm.y;
        let pixelCoords = convertUTMToPixelCoords(easting, northing);
        outerPoints.push(new THREE.Vector2(pixelCoords.x*coordsScale, pixelCoords.y*coordsScale));
    });

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

    //console.log("building lat: ", sumOfLatCoords/count);
    //console.log("building long: ", sumOfLongCoords/count);
    
    let utm = convertLatLongToUTM(sumOfLatCoords/count, sumOfLongCoords/count);
    let easting = utm.x;
    let northing = utm.y;
    //console.log("building easting: ", easting);
    //console.log("building northing: ", northing);
    let pixelCoords = convertUTMToPixelCoords(easting, northing);
    //console.log("building pixel x: ", pixelCoords.y*coordsScale);
    //console.log("building pixel y: ", pixelCoords.x*coordsScale);

    //console.log("position: ", pixelCoords.x, pixelCoords.y);
    //console.log("building base height: ", reversedHeightMap[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]);
    //newElement.setAttribute("rotation", "90 90 90");
    //newElement.setAttribute("position", {x: (pixelCoords.x)*coordsScale, y: (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]), z: (pixelCoords.y)*coordsScale});
    newElement.object3D.position.set((pixelCoords.x*coordsScale), (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]), (pixelCoords.y*coordsScale));
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

        var geometry = new THREE.ExtrudeGeometry(shape, {depth: data.height, bevelEnabled: false});
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