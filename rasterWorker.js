try {
    importScripts("https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js");
} catch (error) {
    self.postMessage({ status: "bad" });
    self.close();
}

self.onmessage = async function (e) {
    const [uniRaster, cityRaster] = await Promise.all([
        raster(e.data.uniURL),
        raster(e.data.cityURL)
    ]);
    self.postMessage({ status: "ok", uniRaster, cityRaster });
    self.close();
}

function raster(url) {
    return GeoTIFF.fromUrl(url).then((tiff) => {
        return tiff.getImage();
    }).then((image) => {
        return image.readRasters({ pool: new GeoTIFF.Pool() });
    });

    // return fetch(url)
    // .then((response) => {
    //     return response.arrayBuffer();
    // }).then((response) => {
    //     return GeoTIFF.fromArrayBuffer(response);
    // }).then((response) => {
    //     return response.getImage()
    // }).then((response) => {
    //     return response.readRasters();
    // })
}