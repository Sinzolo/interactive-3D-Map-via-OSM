async function loadBuildings(lat, long, bboxSize) {
    //(way(around:50, 51.1788435,-1.826204);>;);out body;
    //var uniBoundingBox = "54.002150,-2.798493,54.014962,-2.776263"

    var bbox = getBoundingBox(lat, long, bboxSize);
    console.log(bbox);
    // TODO Put this (below) into the REST DTM 2m 2020 website and it works!
    console.log([convertLatLongToUTM(bbox.minLat, bbox.minLng), convertLatLongToUTM(bbox.maxLat, bbox.maxLng)]);
    var stringBBox = convertBBoxToString(bbox);

    var overpassQuery = overpassURL +
    encodeURIComponent(
        "(way[building]("+stringBBox+");" +
        "rel[building]("+stringBBox+"););" +
        "out geom;>;out skel qt;"
    );
    console.log(overpassQuery);

    let geoJSON = await fetch(overpassQuery).then((response) => {           // Fetches the OSM data needed for the specific bbox
    //let geoJSON = await fetch("interpreter.xml").then((response) => {     // Uses the preloaded uni area of buildings
    //let geoJSON = await fetch("squareUni.xml").then((response) => {       // Uses the preloaded square area of the uni buildings
        if(!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
    })
    .then((response) => {
        var parser = new DOMParser();
        var itemData = parser.parseFromString(response, "application/xml");
        var itemJSON = osmtogeojson(itemData);
        //console.log(itemJSON);
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
    height = parseInt(height)
    height += heightOffset/buildingHeightScale;

    var color = "#FDF8EF";
    console.log(tags);
    console.log(tags["building:colour"]);
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

    var buildingParent = document.querySelector('#buildingParent');
    var newBuilding = document.createElement('a-entity');
    var buildingProperties = {primitive: "building", outerPoints: outerPoints, height: height};
    newBuilding.setAttribute("geometry", buildingProperties);
    newBuilding.setAttribute("material", {color: color});
    newBuilding.setAttribute("scale", buildingScale+" "+buildingHeightScale+" "+buildingScale);

    let utm = convertLatLongToUTM(sumOfLatCoords/count, sumOfLongCoords/count);
    let easting = utm.x;
    let northing = utm.y;
    let pixelCoords = convertUTMToPixelCoords(easting, northing);
    newBuilding.object3D.position.set((pixelCoords.x*coordsScale), (twoDHeightMapArray[Math.round(pixelCoords.x)][Math.round(pixelCoords.y)])-heightOffset, (pixelCoords.y*coordsScale));
    buildingParent.appendChild(newBuilding);
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