
var overpassURL = "https://overpass-api.de/api/interpreter?data=";
var centreLat = 54.008551;
var centreLong = -2.787395;

function loadMap() {
    /*
        Hides the welcome screen and shows the map
    */
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "none";
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "block";

    console.log("Loading Map...");

    loadBuildings();
}

function loadMenu() {
    /*
        Hides the map and shows the welcome screen
    */
    mapDivElements = document.getElementById("MapScreen")
    mapDivElements.style.display = "none";
    welcomeDivElements = document.getElementById("WelcomeScreen");
    welcomeDivElements.style.display = "block";

    console.log("Tried showing...");
}


async function loadBuildings() {
    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    var overpassQuery = overpassURL +
    encodeURIComponent(
        "(way[building](54.002150,-2.798493,54.014962,-2.776263);" +
        "rel[building](54.002150,-2.798493,54.014962,-2.776263););" +
        "out geom;>;out skel qt;"
    );
    console.log(overpassQuery);

    let geoJSON = await fetch(overpassQuery).then((response) => {
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

    console.log(geoJSON);
    console.log("hello");
    console.log("Looking for polygons...");

    var count = 0;
    geoJSON.features.forEach(feature => {
        if (feature.geometry.type == "Polygon") {
            addBuilding(feature);
            count = count + 3;
        } else {
        }
    });
}


function addBuilding(feature) {
    //console.log(feature);
    var tags = feature.properties;
    console.log("Feature:", feature);
    var height = tags.height ? tags.height : tags["building:levels"];
    if(tags.amenity == "shelter" && !height) height = 1;
    else if(!height) height = 2;
    console.log("Height:", height);

    var color = "#FFFFFF";
    if (tags["building:colour"]) {
      color = tags["building:colour"];
    }

    var outerPoints = [];
    var xCoords = 0;
    var zCoords = 0;
    var count = 0;
    console.log(feature.geometry.coordinates[0]);
    feature.geometry.coordinates[0].forEach(coordinatesPair => {
        console.log("Coords:");
        console.log(coordinatesPair);
        relativePos = getRelativePosition(coordinatesPair[1], coordinatesPair[0]);
        console.log("Relative Coords:");
        relativePos.x = relativePos.x*4000
        relativePos.z = relativePos.z*4000
        console.log(relativePos.x, relativePos.z);
        xCoords = xCoords + relativePos.x;
        zCoords = zCoords + relativePos.z;
        count++;
        outerPoints.push(new THREE.Vector2(relativePos.x, relativePos.z));
    });
    console.log(outerPoints);
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
    newElement.setAttribute("position", {x: (xCoords/count), y:0, z: (zCoords/count)});
    newElement.setAttribute("scale", "15 4 13");
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