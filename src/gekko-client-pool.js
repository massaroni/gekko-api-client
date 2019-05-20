const PriorityBlockingQueue = require('priority-blocking-queue');
const GekkoApiClient = require('./gekko-api-client');
const _ = require('lodash');
const utils = require('./gekko-utils');
const DEFAULT_GEKKO_PORT = 3000;

class GekkoClientPool {

  /**
   * @param {*} hosts - hosts are prioritized by their order in this array, from highest -> lowest
   */
  constructor(hosts) {
    this.hosts = _.cloneDeep(hosts);
    const hostLen = hosts.length;

    this.hostTokens = new PriorityBlockingQueue(
      (lhs, rhs) => lhs.priority - rhs.priority
    );
    
    for (let h = 0; h < hostLen; h++) {
      let host = hosts[h];
      let priority = hostLen - h;
      for (let t = 0; t < host.threads; t++) {
        this.hostTokens.put({host: host, priority: priority});
      }
    }
  }

  getTotalThreads() {
    return _.sum(_.map(this.hosts, 'threads'));
  }

  async ensureDataReadyAllHosts(from, to, watch, logFn) {
    logFn = logFn || _.noop;
    let hosts = _.uniqBy(this.hosts, 'host');
    for (let i = 0; i < hosts.length; i++) {
      logFn('Checking database ', i + 1, ' of ', hosts.length);
      await this.ensureDataReady(from, to, watch, hosts[i]);
      logFn('Database ', i + 1, ' of ', hosts.length, ' is ready.');
    }
  }

  async ensureDataReadyAllHostsAllWatches(from, to, exchanges, currencyPairs, logFn) {
    logFn = logFn || _.noop;
    let checkBatch = this.hosts.length;
    let numDatasets = checkBatch * exchanges.length * currencyPairs.length;
    let checked = 0;
    
    logFn('Checking ', numDatasets, ' market data sets.');
    for (let exchange of exchanges) {
      for (let pair of currencyPairs) {
        logFn('Checking data sets ', checked + 1, ' through ', checked + checkBatch);
        await this.ensureDataReadyAllHosts(from, to, {
          exchange: exchange,
          currency: pair.currency,
          asset: pair.asset
        });
        checked += checkBatch;
      }
    }
    logFn('All databases are in sync.');
  }

  async ensureDataReady(from, to, watch, host, logFn) {
    let client = new GekkoApiClient(host.host, host.port);
    logFn = logFn || _.noop;

    while (true) {
      logFn('Checking data on ', host.host, ':', host.port || DEFAULT_GEKKO_PORT, ' from ', from.format(), ' to ', to.format());
      let cached = await client.scan(watch);
      let gap = utils.findNextGap(from, to, cached);
      if (!gap) {
        return;
      }
      await client.importAndWait(gap.from.subtract(1, 'd'), gap.to.add(1, 'd'), watch);
    }
  }

  async _getHostToken() {
    return this.hostTokens.take();
  }

  _returnHostToken(token) {
    if (!!token) {
      this.hostTokens.put(token);
    }
  }

  async runBacktest(backtestConfig) {
    let token;
    try {
      token = await this._getHostToken();
      let host = token.host;
      let client = new GekkoApiClient(host.host, host.port);
      let config = _.isFunction(backtestConfig) ? backtestConfig(token.host) : backtestConfig;
      return client.runBacktest(config);
    } catch (e) {
      console.error('ERROR GekkoClientPool::runBacktest ', JSON.stringify(token));
      console.error(e);
      throw e;
    } finally {
      this._returnHostToken(token);
    }
  }

}

module.exports = GekkoClientPool;