# Gekko API Client

Use __GekkoApiClient__ for connecting to a remote Gekko host.
<br/>

Use __GekkoClientPool__ for managing a farm of Gekko hosts.  Synchronize market data on all hosts with a single function call, and run lots of backtests concurrently, to get the best performance out of your Gekko farm.
<br/>

Synchronizing data on many Gekko hosts is faster with a master/slave configuration: one host acts as the master importer and pulls data from the exchange.  All the other hosts pull data from the master host, via their [Gekko proxy-importer plugin (available in this fork)](https://github.com/massaroni/gekko/tree/feature/proxy-importer), pointing at the master.

[Gekko](https://github.com/askmike/gekko) is a Bitcoin TA trading and backtesting platform that connects to popular Bitcoin exchanges. The Gekko Server exposes two different APIs: A REST API for controlling the server and querying its market data, and a websocket API to push gekko updates. This package is a client for those APIs, so that you can connect to a Gekko Server from another javascript project.

Note that this client doesn't yet support all the API endpoints, and I will add more as I come to need them in my own project.
Please feel free to add support for other endpoints and submit a pull request.

## Documentation

See [the Gekko Server API documentation](https://gekko.wizb.it/docs/internals/server_api.html).

## Examples

### GekkoApiClient

Find all date ranges with available candle data, for a specific market.

```javascript
const GekkoApiClient = require('gekko-api-client');
let client = new GekkoApiClient('localhost', 3000);
let ranges = await client.scan({
  watch: {
    exchange: 'bitstamp',
    currency: 'USD',
    asset: 'BTC'
  }
});
```
ranges:
```json
[
    {
        "to": 1464787560,
        "from": 1464783960
    },
    {
        "to": 1479115560,
        "from": 1471112760
    }
]
```
<br/>
Import candles from the data provider. Wait until the whole job is done, and print out update messages on the console.

```javascript
const moment = require('moment');
const GekkoApiClient = require('gekko-api-client');
let client = new GekkoApiClient('localhost', 3000);
let from = moment().subtract(10, 'days');
let to = moment();
await client.importAndWait(from, to, {
    exchange: 'bitstamp',
    currency: 'USD',
    asset: 'BTC'
  },
  (updateMsg) => {console.log(updateMsg)}
);
```
<br/>
Get candles for charting.

```javascript
const moment = require('moment');
const GekkoApiClient = require('gekko-api-client');
let client = new GekkoApiClient('localhost', 3000);
let from = moment().subtract(10, 'days');
let to = moment();
let candles = await client.getCandles(from, to, 1, {
    exchange: 'poloniex',
    currency: 'USDT',
    asset: 'BTC'
  });
```
candles:
```json
[
    {
        "start": 1530596400,
        "open": 6645.49999958,
        "high": 6649.83970225,
        "low": 6642,
        "close": 6642,
        "vwp": 6644.840723040122,
        "volume": 0.007383000000000001,
        "trades": 23
    },
    {
        "start": 1530596460,
        "open": 6649.69979936,
        "high": 6649.69979936,
        "low": 6642,
        "close": 6648.89999912,
        "vwp": 6645.926390922748,
        "volume": 0.007383450000000001,
        "trades": 21
    },
    // etc.
]
```

<br/>
Run a backtest.

```javascript
const GekkoApiClient = require('gekko-api-client');
let client = new GekkoApiClient('localhost', 3000);
let results = await client.runBacktest({
    watch: {
        exchange: 'poloniex',
        currency: 'USDT',
        asset: 'ETH'
    },
    paperTrader: {
        feeMaker: 0.25,
        feeTaker: 0.25,
        feeUsing: 'maker',
        slippage: 0.05,
        simulationBalance: {
            asset: 1,
            currency: 100
        },
        reportRoundtrips: true,
        enabled: true
    },
    tradingAdvisor: {
        enabled: true,
        method: 'MACD',
        candleSize: 60,
        historySize: 10
    },
    MACD: {
        short: 10,
        long: 21,
        signal: 9,
        thresholds: {
            down: -0.025,
            up: 0.025,
            persistence: 1
        }
    },
    backtest: {
        daterange: {
            from: '2016-06-01T11:57:00Z',
            to: '2016-11-13T14:57:00Z'
        }
    },
    backtestResultExporter: {
        enabled: true,
        writeToDisk: false,
        data: {
            stratUpdates: false,
            roundtrips: true,
            stratCandles: true,
            stratCandleProps: [
                'open'
            ],
            trades: true
        }
    },
    performanceAnalyzer: {
        riskFreeReturn: 2,
        enabled: true
    }
});
```
results:
```json
{
    "performanceReport": {
        "startTime": "2018-04-02 14:08:00",
        "endTime": "2018-04-05 04:08:00",
        "timespan": "3 days",
        "market": -2.159980297428632,
        "startBalance": 7083.86,
        "balance": 7424.849452897501,
        "profit": 340.989452897501,
        "relativeProfit": 4.813610840664566,
        "yearlyProfit": 48210.518806418906,
        "relativeYearlyProfit": 680.5684867631334,
        "startPrice": 6983.86,
        "endPrice": 6833.01,
        "trades": 3,
        "exposure": 0.3709677419354839,
        "sharpe": null,
        "downside": null,
        "alpha": 343.14943319492966
    },
    "roundtrips": [
        {
            "id": 0,
            "entryAt": 1522685280,
            "entryPrice": 7019.99,
            "entryBalance": 7119.6899337771,
            "exitAt": 1522768080,
            "exitPrice": 7365,
            "exitBalance": 7447.19106625,
            "duration": 82800000,
            "pnl": 327.5011324729003,
            "profit": 4.599935327508788
        },
        // and more
    ],
    "stratCandles": [
        {
            "open": 6990.06,
            "start": 1522678080
        },
        // and more
    ],
    "trades": [
        {
            "id": "trade-1",
            "adviceId": "advice-1",
            "action": "buy",
            "cost": 0.30000000000000027,
            "amount": 1.01420229,
            "price": 7019.99,
            "portfolio": {
                "asset": 1.08661475,
                "currency": 0
            },
            "balance": 7119.6899337771,
            "date": 1522685280
        },
        // and more
    ]
}
```

### GekkoClientPool

Synchronize market data on 3 Gekko hosts.
```javascript
const GekkoClientPool = require('gekko-api-client').GekkoClientPool;
const moment = require('moment');

let pool = new GekkoClientPool([
  { host: '192.168.1.10', threads: 12 },
  { host: '192.168.1.11', threads: 3, port: 3001 },
  { host: '192.168.1.12', threads: 5 }
]);

let from = moment.utc('2019-04-01 00:00:00');
let to = moment.utc('2019-04-15 00:00:00');
let watch = {
    exchange: 'binance',
    currency: 'USDT',
    asset: 'BTC'
};
await pool.ensureDataReadyAllHosts(from, to, watch, console.log);
// and now this data is ready on all hosts
```

Synchronize market data on 3 Gekko hosts, for different assets and exchanges.
```javascript
const GekkoClientPool = require('gekko-api-client').GekkoClientPool;
const moment = require('moment');

let pool = new GekkoClientPool([
  { host: '192.168.1.10', threads: 12 },
  { host: '192.168.1.11', threads: 3, port: 3001 },
  { host: '192.168.1.12', threads: 5 }
]);

let from = moment.utc('2019-04-01 00:00:00');
let to = moment.utc('2019-04-15 00:00:00');
let exchanges = ['binance', 'poloniex'];
let currencyPairs = [
  {currency: 'USDT', asset: 'BTC'},
  {currency: 'USDT', asset: 'XRP'},
  {currency: 'USDT', asset: 'ADA'},
  {currency: 'USDT', asset: 'ETH'}
];

await pool.ensureDataReadyAllHostsAllWatches(from, to, exchanges, currencyPairs, console.log);
// and now this data is ready on all hosts
```

Run lots of concurrent backtests on all these hosts.  Each host's "threads" property acts to limit the number of concurrent backtests on that host.
```javascript
const GekkoClientPool = require('gekko-api-client').GekkoClientPool;
const moment = require('moment');

let pool = new GekkoClientPool([
  { host: '192.168.1.10', threads: 12, strat: 'moon' },
  { host: '192.168.1.11', threads: 3, strat: 'moon', port: 3001 },
  { host: '192.168.1.12', threads: 5, strat: 'star' }
]);

let backtestPromises = [];
for (let i = 0; i < 100; i++) {
  let backtestConfig = {
    starStrat: {
      prop1: 1234,
      prop2: [4, 5, 6],
      propI: i
    },
    watch: {
      exchange: 'binance',
      currency: 'USDT',
      asset: 'BTC'
    },
    tradingAdvisor: {
      enabled: true,
      method: 'starStrat',
      candleSize: 1,
      historySize: 10
    },
    backtest: {
      daterange: {
          from: "2019-04-01 00:00:00",
          to: "2019-04-15 00:00:00"
      }
    },
    paperTrader: {
      feeMaker: 0.1,
      feeTaker: 0.1,
      feeUsing: "maker",
      slippage: 0.09,
      simulationBalance: {
        asset: 1,
        currency: 100
      },
      reportRoundtrips: true,
      enabled: true
    },
    backtestResultExporter: {
      enabled: true,
      writeToDisk: false,
      data: {
        stratUpdates: false,
        roundtrips: false,
        stratCandles: false,
        stratCandleProps: ["open"],
        trades: false
      }
    },
    performanceAnalyzer: {
      riskFreeReturn: 2,
      enabled: true
    }
  };

  backtestPromises.push(gekkoClient.runBacktest(config));
}

let allResults = await Promise.all(backtestPromises);
```

Run lots of concurrent backtests on all these hosts.  Each host's "threads" property acts to limit the number of concurrent backtests on that host.  In this example, we're also customizing the backtest config based on the given host.
```javascript
const GekkoClientPool = require('gekko-api-client').GekkoClientPool;
const moment = require('moment');

let pool = new GekkoClientPool([
  { host: '192.168.1.10', threads: 12, strat: 'moon' },
  { host: '192.168.1.11', threads: 3, strat: 'moon', port: 3001 },
  { host: '192.168.1.12', threads: 5, strat: 'star' }
]);

let backtestPromises = [];
for (let i = 0; i < 100; i++) {
  let hostToConfig = function (host) {
    const strategyName = host.strat;

    let backtestConfig = {
      watch: {
        exchange: 'binance',
        currency: 'USDT',
        asset: 'BTC'
      },
      tradingAdvisor: {
        enabled: true,
        method: strategyName,
        candleSize: 1,
        historySize: 10
      },
      backtest: {
        daterange: {
            from: "2019-04-01 00:00:00",
            to: "2019-04-15 00:00:00"
        }
      },
      paperTrader: {
        feeMaker: 0.1,
        feeTaker: 0.1,
        feeUsing: "maker",
        slippage: 0.09,
        simulationBalance: {
          asset: 1,
          currency: 100
        },
        reportRoundtrips: true,
        enabled: true
      },
      backtestResultExporter: {
        enabled: true,
        writeToDisk: false,
        data: {
          stratUpdates: false,
          roundtrips: false,
          stratCandles: false,
          stratCandleProps: ["open"],
          trades: false
        }
      },
      performanceAnalyzer: {
        riskFreeReturn: 2,
        enabled: true
      }
    };
    backtestConfig[strategyName] = {
        prop1: 1234,
        prop2: [4, 5, 6],
        propI: i
    };
    return backtestConfig;
  };

  backtestPromises.push(gekkoClient.runBacktest(hostToConfig));
}

let allResults = await Promise.all(backtestPromises);
```
