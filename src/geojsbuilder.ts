/*
 * Class for generating geomap based on geojs model received from Jupyter kernel.
 */
//import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { JSONObject } from '@phosphor/coreutils';


// Local interface definitions - do these need to be exported?
export interface IFeatureModel {
  data?: any;
  featureType: string;
  options?: JSONObject;
  url?: string;
}

export interface ILayerModel {
  features?: IFeatureModel[];
  layerType: string;
  options?: JSONObject;
}

export interface IMapModel {
  layers?: ILayerModel[];
  options?: JSONObject;
  viewpoint?: JSONObject;
}



import * as geo from 'geojs'
console.debug(`Using geojs ${geo.version}`);

// Static var used to disable OSM layer renderer;
// For testing, so that we don't need to mock html canvas
let _disableOSMRenderer: boolean = false;


class GeoJSBuilder {
  // The GeoJS instance
  private _geoMap: any;

  // Promise list used when building geojs map
  private _promiseList: Promise<void | {}>[];

  constructor() {
    this._geoMap = null;
    this._promiseList = null;  // for loading data
  }

  // Sets static var
  static disableOSMRenderer(state: boolean): void {
    _disableOSMRenderer = state;
  }

  // Clears the current geo.map instance
  clear(): void {
    if (!!this._geoMap) {
      this._geoMap.exit();
      this._geoMap = null;
    }
  }

  // Returns PROMISE that resolves to geo.map instance
  // Note that caller is responsible for disposing the geo.map
  generate(node: HTMLElement, model: IMapModel={}): Promise<any> {
    console.dir(model);
    if (!!this._geoMap) {
      console.warn('Deleting existing GeoJS instance');
      this.clear()
    }

    let options: JSONObject = model.options || {};
    // Add dom node to the map options
    const mapOptions = Object.assign(options, {node: node});
    this._geoMap = geo.map(mapOptions);
    this.update(model);
    const viewpoint: JSONObject = model.viewpoint;
    if (viewpoint) {
      switch (viewpoint.mode) {
        case 'bounds':
          console.log('Input viewpoint bounds:');
          console.dir(viewpoint.bounds);
          let spec = this._geoMap.zoomAndCenterFromBounds(viewpoint.bounds, 0, null);
          console.log('Computed viewpoint spec:')
          console.dir(spec);
          this._geoMap.center(spec.center);
          this._geoMap.zoom(spec.zoom/2);  // apparently a factor of 2 difference (?)
        break;

        default:
          console.warn(`Unrecognized viewpoint object ${model.viewpoint}`);
          console.dir(model.viewpoint);
      }
    }

    // Return promise that resolves to this._geoMap
    return new Promise((resolve, reject) => {
      Promise.all(this._promiseList)
        .then(() => resolve(this._geoMap), reject => console.error(reject))
        .catch(error => reject(error));
    });
  }  // generate()

  // Generates geomap layers
  // Note: Internal logic can push promise instances onto this._promiseList
  update(model: IMapModel={}): void {
    this._promiseList = [];
    let layerModels: ILayerModel[] = model.layers || [];
    for (let layerModel of layerModels) {
      let options: JSONObject = layerModel.options || {};
      let layerType: string = layerModel.layerType;
      //console.log(`layerType: ${layerType}`);
      if (_disableOSMRenderer && layerType == 'osm') {
        options.renderer = null;
      }
      let layer: any = this._geoMap.createLayer(layerType, options);
      //console.log(`Renderer is ${layer.rendererName()}`)
      if (layerModel.features) {
        this._createFeatures(layer, layerModel.features)
      }
    }  // for (layerModel)
  }  // update()


  // Creates features
  _createFeatures(layer: any, featureModels: IFeatureModel[]): any {
    for (let featureModel of featureModels) {
      //console.dir(featureModel);
      switch(featureModel.featureType) {
        case 'geojson':
          this._createGeoJSONFeature(layer, featureModel);
        break;

        case 'point':
        case 'quad':
          let feature: any = layer.createFeature(featureModel.featureType);
          let options: JSONObject = featureModel.options || {};
          if (options.data) {
            if (featureModel.featureType === 'quad') {
              // Copy the options.data array, because geojs might
              // attach a cached texture object, which won't serialze
              // when saving the associated notebook.
              let dataCopy: Array<Object> =
                (options.data as Array<Object>).map(obj => ({...obj}));
              //console.log(`Same? ${dataCopy[0] == (options.data as Array<Object>)[0]}`);
              feature.data(dataCopy);
            }
            else {
              feature.data(options.data);
            }
          }  // if (options.data)

          // If position array included, set position method
          if (options.position) {
            feature.position((dataItem: any, dataIndex: number) => {
              // return options.position[dataIndex];
              let positions: any = options.position;
              let position: any = positions[dataIndex];
              return position;
            });
          }

          // Other options that are simple properties
          const properties = ['bin', 'gcs', 'style', 'selectionAPI', 'visible']
          for (let property of properties) {
            if (options[property]) {
              feature[property](options[property]);
            }
          }
        break;

        default:
          throw `Unrecognized feature type ${featureModel.featureType}`;
      }  // switch
    }
  }  // _createFeatures()

  // Generates GeoJSON feature from feature model
  _createGeoJSONFeature(layer: any, featureModel: IFeatureModel): void {
    if (featureModel.data) {
      let p: Promise<void | {}> = this._loadGeoJSONObject(layer, featureModel.data);
      this._promiseList.push(p);
    }
    if (featureModel.url) {
      let p: Promise<void | {}> = this._downloadGeoJSONFile(layer, featureModel.url);
      this._promiseList.push(p);
    }
  }

  // Loads GeoJSON object
  _loadGeoJSONObject(layer:any, data: any): Promise<void> {
    // console.dir(layer);
    // console.dir(data);

    let reader: any = geo.createFileReader('jsonReader', {layer: layer});
    return new Promise((resolve, reject) => {
      try {
        reader.read(data, resolve);
      }
      catch (error) {
        console.error(error);
        reject(error);
      }
    })  // new Promise()
  }  // loadGeoJSONData()

  _downloadGeoJSONFile(layer: any, url: string): Promise<void> {
    //console.log(`_downloadGeoJSONFile: ${url}`);
    return new Promise(function(resolve, reject) {
      fetch(url)
        .then(response => response.text())
        .then(text => {
          let reader = geo.createFileReader('jsonReader', {layer: layer});
          reader.read(text, resolve);
        })
        .catch(error => {
          console.error(error);
          reject(error)
        })
    })  // new Promise()
  }  // _downloadGeoJSONFile()

}  // GeoJSBuilder

export { GeoJSBuilder }
