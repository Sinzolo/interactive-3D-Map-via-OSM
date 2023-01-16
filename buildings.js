var numberOfBuildings = 0;

async function loadBuildings(coordinate, bboxSize) {
    console.log("=== Loading Buildings ===");

    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    //var uniBoundingBox = "54.002150,-2.798493,54.014962,-2.776263"

    //console.log(bbox);
    // TODO Put this (below) into the REST DTM 2m 2020 website and it works!
    // 348391,457481,348747,456988 (just saving this for later (put this into the website))
    // https://stackoverflow.com/questions/41478249/aframe-extend-component-and-override
    // https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
    //helpful but not for this problem
    //console.log([convertLatLongToUTM(bbox.minLat, bbox.minLng), convertLatLongToUTM(bbox.maxLat, bbox.maxLng)]);

    var bbox = getBoundingBox(coordinate.lat, coordinate.long, bboxSize);
    var stringBBox = convertBBoxToString(bbox);
    console.log(stringBBox);
    var overpassQuery = overpassURL + encodeURIComponent(
        "(way[building]("+stringBBox+");" +
        "rel[building]("+stringBBox+"););" +
        "out geom;>;out skel qt;"
    );

    if ('caches' in window) {
        var response = caches.match(overpassQuery)
        .then((response) => {
            if (response) {     // If found in cache return response
                console.log("Found it in cache");
                return response;
            }
            console.log("NOT found in cache... Fetching URL");
            return fetchWithRetry(overpassQuery).then((response) => {    // If not found in cache fetch resource
                osmCache.then((cache) => {
                    cache.put(overpassQuery, response);        //  Once fetched cache the response
                    console.log("Storing in cache");
                });
                return response.clone();        // Return fetched resource
            });
        });
    }
    else {
        var response = fetchWithRetry(overpassQuery);        // Fetches the OSM data needed for the specific bbox
        //let response = await fetch("interpreter.xml");     // Uses the preloaded uni area of buildings
        //let response = await fetch("squareUni.xml");       // Uses the preloaded square area of the uni buildings
    }

    /* Converting the response from the overpass API into a JSON object. */
    let geoJSON = await response
    .then((response) => {return response.text();})
    .then((response) => {
        let parser = new DOMParser();
        let itemData = parser.parseFromString(response, "application/xml");
        let itemJSON = osmtogeojson(itemData);
        return itemJSON
    });

    // currently working on this^ 11th jan 1:49pm



    let sceneElement = document.querySelector('a-scene');
    let buildingParent = document.createElement('a-entity');
    buildingParent.setAttribute("id", "buildingParent");
    buildingParent.setAttribute("class", "building");
    sceneElement.appendChild(buildingParent);

    numberOfBuildings = 0;
    geoJSON.features.forEach(feature => {
        if (feature.geometry.type == "Polygon") {
            addBuilding(feature, buildingParent);
            numberOfBuildings += 1;
        } else {
        }
    });

    console.log("Number of buidlings: ", numberOfBuildings);
}


async function addBuilding(feature, parentElement) {
    //console.log("=== Adding Building ===");

    let tags = feature.properties;
    let height = tags.height ? tags.height : tags["building:levels"];
    //console.log(height);
    if(tags.amenity == "shelter" && !height) height = 1;
    else if(!height) height = 2;
    height = parseInt(height)
    height += buildingHeightOffset/buildingHeightScale;

    let color = "#FDF8EF";
    //console.log(tags);
    //console.log(tags["building:colour"]);
    if (tags["building:colour"]) {
      color = tags["building:colour"];
    }

    let outerPoints = [];
    let sumOfLatCoords = 0;
    let sumOfLongCoords = 0;
    let count = 0;
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

    let newBuilding = document.createElement('a-entity');
    let buildingProperties = {primitive: "building", outerPoints: outerPoints, height: height};
    newBuilding.setAttribute("geometry", buildingProperties);
    newBuilding.setAttribute("material", {color: color});
    newBuilding.setAttribute("scale", buildingScale+" "+buildingHeightScale+" "+buildingScale);

    let utm = convertLatLongToUTM(sumOfLatCoords/count, sumOfLongCoords/count);
    let easting = utm.x;
    let northing = utm.y;
    let pixelCoords = convertUTMToPixelCoords(easting, northing);
    console.log(pixelCoords.x*coordsScale, pixelCoords.y*coordsScale);
    if ((twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)]) == null) {
        throw new Error("Height map not found! (My own error)");
    }
    else {
        newBuilding.object3D.position.set((pixelCoords.x*coordsScale), (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)])-buildingHeightOffset, (pixelCoords.y*coordsScale));
    }
    parentElement.appendChild(newBuilding);
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