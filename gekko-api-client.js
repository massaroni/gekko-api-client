const _ = require('lodash');
const request = require('request');
const WebSocket = require('ws');
const DEFAULT_GEKKO_PORT = 3000;
const supportedGekkoModes = {
  realtime: 1,
  importer: 1,
  backtest: 1
};

const GekkoApiClient = function (host, port, options) {
  this.host = host;
  this.port = port;
  this.options = options;
}

GekkoApiClient.prototype = {
  /**
   * Get a list of available candle ranges.
   * 
   * @param {*} watch - the "watch" gekko config property
   */
  scan: async function (watch) {
    return this._post('/api/scan', { watch });
  },

  /**
   * Start a historical data import.
   * 
   * @param {*} from - momentjs object
   * @param {*} to - momentjs object
   * @param {*} watch - the "watch" gekko config property
   * @param {*} otherConfig - optional root gekko configuration object
   */
  import: async function (from, to, watch, otherConfig) {
    let config = !otherConfig ? {} : _.clone(otherConfig);
    config.watch = watch;
    config.importer = {
      daterange: {
        from: from.utc().format(),
        to: to.utc().format()
      }
    };
    config.candleWriter = {
      enabled: true
    };
    return this._post('/api/import', config);
  },

  /**
   * Start an import job, and resolve when the job's done.
   * 
   * @param {*} from - momentjs object
   * @param {*} to - momentjs object
   * @param {*} watch - the "watch" gekko config property
   * @param {*} onUpdate - callback function for observing importer updates for this job
   */
  importAndWait: async function (from, to, watch, onUpdate) {
    const self = this;
    return new Promise((resolve, reject) => {
      try {
        let ws = self.newWebsocket();
        let started = false;
        let done = false;
        let importId;
        let closeSocket = function () {
          done = true;
          ws.close();
        };
    
        ws.on('open', async function open() {
          try {
            started = true;
            let result = await self.import(from, to, watch);
            importId = result.id;
          } catch (e) {
            reject(e);
            closeSocket();
          }
        });
        
        ws.on('close', function close() {
          if (!started) {
            reject('failed opening websocket');
          } else if (!done) {
            reject('websocket closed early');
          } else {
            self._verbose('websocket closed');
          }
        });
        
        ws.on('message', function incoming(data) {
          data = JSON.parse(data);
          if (!!data && !!importId && data.import_id === importId) {
            if (data.type === 'import_update' && !!data.updates && !!data.updates.done) {
              resolve();
              closeSocket();
            } else if (data.type === 'import_error') {
              reject(data);
              closeSocket();
            }

            if (!!onUpdate) {
              onUpdate(data);
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Get candle data for charting.
   * 
   * @param {*} from - momentjs object
   * @param {*} to - momentjs object
   * @param {*} candleSize - size of candle, in minutes
   * @param {*} watch - gekko config watch object, with the exchange name and currency pair
   */
  getCandles: async function (from, to, candleSize, watch) {
    return this._post('/api/getCandles', {
      watch: watch,
      daterange: {
        from: from.utc().format(),
        to: to.utc().format()
      },
      candleSize: candleSize
    });
  },

  startGekko: async function (config) {
    return this._post('/api/startGekko', config);
  },

  deleteGekko: async function (gekkoId) {
    return this._post('/api/deleteGekko', {id: gekkoId});
  },

  listGekkos: async function () {
    return this._get('/api/gekkos');
  },

  /**
   * Run a backtest and resolve the results when it's done.
   * 
   * @param {*} config 
   */
  runBacktest: async function (config, onEvent) {
    checkGekkoConfig(config);
    let backtestConfig = _.clone(config);
    config.type = 'backtest';
    config.mode = config.type;
    return this.runGekkoSync(backtestConfig, onEvent);
  },

  runGekkoSync: async function (config, onEvent, force) {
    checkGekkoConfig(config);
    if (!force && (!_.isString(config.mode) || !supportedGekkoModes[config.mode])) {
      throw 'Unsupported gekko mode: ' + config.mode;
    }
    if (!force && !_.isString(config.type)) {
      throw 'Gekko config object missing "type" property.';
    }

    const self = this;
    return new Promise((resolve, reject) => {
      try {
        let ws = self.newWebsocket();
        let started = false;
        let done = false;
        let gekkoId;
        const closeSocket = function () {
          done = true;
          ws.close();
          if (!!gekkoId) {
            self.deleteGekko(gekkoId);
          }
        };
    
        ws.on('open', async function open() {
          try {
            started = true;
            let response = await self.startGekko(config);
            gekkoId = (response || {}).id;
            if (!gekkoId || !response.active || response.stopped || response.errored) {
              reject({msg: 'Failed starting new gekko job.', response});
              closeSocket();
            }
          } catch (e) {
            reject(e);
            closeSocket();
          }
        });
        
        ws.on('close', function close() {
          if (!started) {
            reject('failed opening websocket');
          } else if (!done) {
            reject('websocket closed early');
          } else {
            self._verbose('websocket closed');
          }
        });
        
        ws.on('message', function incoming(data) {
          data = JSON.parse(data);
          if (!done && data.id === gekkoId) {
            if (data.type === 'gekko_stopped') {
              resolve(data);
              closeSocket();
            } else if (data.type === 'gekko_error') {
              reject(data);
              closeSocket();
            }

            if (_.isFunction(onEvent)) {
              try {
                onEvent(data, config);
              } catch (e) {
                console.error(e);
              }
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Send an HTTP POST request with a json request body.
   * 
   * @param {*} path - api endpoint path
   * @param {*} json - json request body object
   */
  _post: async function (path, json) {
    const options = {
      uri: 'http://' + this.host + ':' + (this.port || DEFAULT_GEKKO_PORT) + path,
      method: 'POST',
      json: json
    };
    this._verbose(options);
    const self = this;

    return new Promise((resolve, reject) => {
      const startMs = Date.now();
      request.post(options, function (error, response, body) {
        const endMs = Date.now();
        const durationS = (endMs - startMs) / 1000;
        try {
          if (!!response && !!response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
            resolve(body);
            self._verbose(body);
          } else {
            reject({error, options, response, body, startMs, endMs, durationS});
          }
        } catch (e) {
          reject({error, options, response, body, startMs, endMs, durationS, e});
        }
      });
    });
  },

  _get: async function (path) {
    const self = this;
    const url = 'http://' + this.host + ':' + (this.port || DEFAULT_GEKKO_PORT) + path;
    return new Promise((resolve, reject) => {
      const startMs = Date.now();
      request.get(url, function (error, response, body) {
        const endMs = Date.now();
        const durationS = (endMs - startMs) / 1000;
        try {
          if (!!response && !!response.statusCode && response.statusCode >= 200 && response.statusCode <= 299) {
            resolve(body);
            self._verbose(body);
          } else {
            reject({error, response, body, startMs, endMs, durationS});
          }
        } catch (e) {
          reject({error, response, body, startMs, endMs, durationS, e});
        }
      });
    });
  },

  /**
   * Open a new gekko websocket.
   */
  newWebsocket: function () {
    return new WebSocket('ws://' + this.host + ':' + (this.port || DEFAULT_GEKKO_PORT) + '/', {
      perMessageDeflate: false
    });
  },

  /**
   * Logging.
   * 
   * @param  {...any} args 
   */
  _verbose: function (...args) {
    if (!!this.options && !!this.options.verbose) {
      let verbose = this.options.verbose;
      if (_.isFunction(verbose)) {
        verbose(...args);
      } else {
        console.log(_.map(args, JSON.stringify));
      }
    }
  }

};

function checkGekkoConfig(config) {
  if (!_.isPlainObject(config)) {
    throw 'Invalid gekko config object.';
  }
}

module.exports = GekkoApiClient;