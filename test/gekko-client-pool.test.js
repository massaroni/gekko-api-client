var chai = require('chai');
var expect = chai.expect;
const sinon = require('sinon');
const GekkoApiClient = require('../src/gekko-api-client');
const GekkoClientPool = require('../src/gekko-client-pool');

describe('Gekko Client Pool', function () {

  it('should sum up all the threads in the pool', function () {
    const GEKKO_HOSTS = [
      { host: '192.168.1.10', threads: 12, strat: 'moon' },
      { host: '192.168.1.11', threads: 4, strat: 'moon' },
      { host: '192.168.1.15', threads: 6, strat: 'star' }
    ];
    
    const gekkoClient = new GekkoClientPool(GEKKO_HOSTS);

    expect(gekkoClient.getTotalThreads()).to.equal(22);
  });

  it('should prioritize hosts from highest to lowest and limit one request token per thread', async function () {
    const GEKKO_HOSTS = [
      { host: '192.168.1.10', threads: 2, strat: 'moon' },
      { host: '192.168.1.11', threads: 1, strat: 'moon' }
    ];
    
    const pool = new GekkoClientPool(GEKKO_HOSTS);
    let token1 = await pool._getHostToken();
    expect(token1.host.host).to.equal('192.168.1.10');

    let token2 = await pool._getHostToken();
    expect(token2.host.host).to.equal('192.168.1.10');

    let token3 = await pool._getHostToken();
    expect(token3.host.host).to.equal('192.168.1.11');

    let takerPromise = pool._getHostToken();
    setTimeout(function () {
      expect(pool.hostTokens.takers.length).to.equal(1);
      pool._returnHostToken(token2);
    });

    return takerPromise.then(function (token) {
      expect(token === token2).to.be.true;
      expect(pool.hostTokens.takers.length).to.equal(0);
    });
  });


  it('should limit the number of concurrent backtests to the number of available threads', async function () {
    const GEKKO_HOSTS = [
      { host: '192.168.1.10', threads: 1, strat: 'moon' }
    ];
    
    const pool = new GekkoClientPool(GEKKO_HOSTS);
    let runBacktest = sinon.stub(GekkoApiClient.prototype, 'runBacktest');

    let promiseAResolver, promiseBResolver;
    const promiseA = new Promise(function (resolver) {
      promiseAResolver = resolver;
    });
    const promiseB = new Promise(function (resolver) {
      promiseBResolver = resolver;
    });
    runBacktest.withArgs('a').returns(promiseA);
    runBacktest.withArgs('b').returns(promiseB);

    expect(pool.hostTokens.size()).to.equal(1);
    let promise1 = pool.runBacktest('a');
    let promise2 = pool.runBacktest('b');
    expect(pool.hostTokens.size()).to.equal(1);

    promise1.then(function () {
      setTimeout(function () {
        expect(runBacktest.callCount).to.equal(2);
        expect(pool.hostTokens.size()).to.equal(0);
        promiseBResolver();
        runBacktest.restore();  
      }, 10);
    });

    setTimeout(function () {
      expect(runBacktest.callCount).to.equal(1);
      expect(pool.hostTokens.size()).to.equal(0);
      promiseAResolver();
    }, 10);

    return Promise.all([promise1, promise2]);
  });

  
});
