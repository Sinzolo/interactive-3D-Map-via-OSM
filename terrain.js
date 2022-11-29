
async function loadTerrain() {
    console.log("LOADING TERRAIN");
    console.log(GeoTIFF);
    const tiff = await GeoTIFF.fromUrl("uniTiff/SD45ne_DTM_2m.tif");
    const image = await tiff.getImage();

    const bbox = image.getBoundingBox();
    const pixelWidth = image.getWidth();
    const pixelHeight = image.getHeight();
    const bboxWidth = bbox[ 2 ] - bbox[ 0 ];
    const bboxHeight = bbox[ 3 ] - bbox[ 1 ];
    var latLongUTM = convertLatLongToUTM(centreLat, centreLong);
    const centreLongInUTM = latLongUTM.x;
    const centreLatInUTM = latLongUTM.y;
    const widthPct = ( centreLongInUTM - bbox[ 0 ] ) / bboxWidth;
    const heightPct = ( centreLatInUTM - bbox[ 1 ] ) / bboxHeight;
    const xPx = Math.floor( pixelWidth * widthPct );
    const yPx = Math.floor( pixelHeight * heightPct );
    console.log("xPx ", xPx);
    console.log("yPx ", yPx);
    const window = [ xPx-130, yPx-40, xPx+200, yPx + 600 ];
    const data = await image.readRasters( {window} );

    const width = image.getWidth();
    const height = image.getHeight();
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();
    const origin = image.getOrigin();
    
    console.log(convertUTMToLatAndLong(345000, 460000));
    console.log("width ", width);
    console.log("height ", height);
    console.log("tileWidth ", tileWidth);
    console.log("tileHeight ", tileHeight);
    console.log("origin ", origin);
    console.log("bbox ", bbox);
    
    //const data = await image.readRasters({window: [1450, 900, 2000, 1750] });
    /*
        To go from UTM(x'y') to pixel position(x,y) one can use the equation:
        x = (Ex'-By'+BF-EC)/(AE-DB)
        y = (-Dx'+Ay'+DC-AF)/(AE-DB)
    */


    /*
       Converts 1D data array into 2D array:
     */
    console.log("Stuff");
    console.log(data);
    //console.log(points);

    var length = data.height;
    var start = 0;
    var end = data.width;
    const points = [];
    while(length > 0) {
        points.push(data[0].slice(start,end));
        length -= 1;
        start += data.width;
        end += data.width;
    }
    console.log("points", points);

    /*
        Draws triangles for the floor
     */
    const yscale = -1.1;
    const xzscale = 4;
    const xRelative = data.height/2;
    const zRelative = data.width/2;
    var sceneElement = document.querySelector('a-scene');
    for (let x = 0; x < points.length-xzscale; x+=xzscale) {
        for (let z = 0; z < points[x].length-xzscale; z+=xzscale) {
            var newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-c", (x-xRelative)+" "+points[x][z]*yscale+" "+(z-zRelative));
            newTriangle.setAttribute("vertex-b", (x-xRelative)+" "+points[x][z+xzscale]*yscale+" "+(z+xzscale-zRelative));
            newTriangle.setAttribute("vertex-a", (x+xzscale-xRelative)+" "+points[x+xzscale][z]*yscale+" "+(z-zRelative));
            newTriangle.setAttribute("rotation", "0 0 180");
            newTriangle.setAttribute("scale", "2 4 2");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);

            newTriangle = document.createElement('a-triangle');
            newTriangle.setAttribute("class", "terrain");
            newTriangle.setAttribute("color", "#4c9141");
            newTriangle.setAttribute("vertex-c", (x-xRelative)+" "+points[x][z+xzscale]*yscale+" "+(z+xzscale-zRelative));
            newTriangle.setAttribute("vertex-b", (x+xzscale-xRelative)+" "+points[x+xzscale][z+xzscale]*yscale+" "+(z+xzscale-zRelative));
            newTriangle.setAttribute("vertex-a", (x+xzscale-xRelative)+" "+points[x+xzscale][z]*yscale+" "+(z-zRelative));
            newTriangle.setAttribute("rotation", "0 0 180");
            newTriangle.setAttribute("scale", "2 4 2");
            //newTriangle.setAttribute("wireframe", "true");
            sceneElement.appendChild(newTriangle);
        }
    }
}