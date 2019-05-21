var chai = require('chai');
var expect = chai.expect;

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
  });

});
