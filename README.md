# Gekko API Client

[Gekko](https://github.com/askmike/gekko) is a Bitcoin TA trading and backtesting platform that connects to popular Bitcoin exchanges. The Gekko Server exposes two different APIs: A REST API for controlling the server and querying its market data, and a websocket API to push gekko updates. This package is a client for those APIs, so that you can connect to a Gekko Server from another javascript project.

Note that this client doesn't yet support all the API endpoints, and I will add more as I come to need them in my own project.
Please feel free to add support for other endpoints and submit a pull request.

## Documentation

See [the Gekko Server API documentation](https://gekko.wizb.it/docs/internals/server_api.html).

## Examples

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