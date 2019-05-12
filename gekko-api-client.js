const _ = require('lodash');
const request = require('request');
const WebSocket = require('ws');
const DEFAULT_GEKKO_PORT = 3000;

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

  /**
   * Run a backtest and resolve the results when it's done.
   * 
   * @param {*} config 
   */
  runBacktest: async function (config) {
    return this._post('/api/backtest', config);
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

    return new Promise((resolve, reject) => {
      request.post(options, function (error, response, body) {
        try {
          if (response.statusCode >= 200 && response.statusCode <= 299) {
            resolve(body);
          } else {
            reject({error: error, response: response, body: body});
          }
        } catch (e) {
          reject(e);
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
        console.log(...args);
      }
    }
  }

};

module.exports = GekkoApiClient;