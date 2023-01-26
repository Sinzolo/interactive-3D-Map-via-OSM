try {
    importScripts("https://cdn.jsdelivr.net/npm/geotiff@2.0.7/dist-browser/geotiff.js");
} catch (error) {
    self.postMessage({ status: "bad" });
    self.close();
}

self.onmessage = async function (e) {
    pools = [new GeoTIFF.Pool(), new GeoTIFF.Pool()];
    const [uniRaster, cityRaster] = await Promise.all([
        raster(e.data.uniURL, pools[0]),
        raster(e.data.cityURL, pools[1])
    ]);
    self.postMessage({ status: "ok", uniRaster, cityRaster });
    pools.forEach(pool => {
        pool.destroy();
    });
    self.close();
}

function raster(url, pool) {
    return GeoTIFF.fromUrl(url).then((tiff) => {
        return tiff.getImage();
    }).then((image) => {
        return image.readRasters({ pool });
    });
}