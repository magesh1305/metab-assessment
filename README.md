# Distributor Orders

Order, stock and loyalty points app for a manufacturer and its distributors.

## You need

- Node 18+
- PostgreSQL 13+

## How to run

```bash
cp server/.env.example server/.env              # put your postgres password in this file
psql -U postgres -c "CREATE DATABASE orderflow;"
npm run setup                                   # installs everything + creates tables + seed data
npm start                                       # mock ERP on 4001, API on 4000, web app on 5173
```

Then open http://localhost:5173 and pick a user from the dropdown at the top.

## Seed users

| Name | Role | |
|---|---|---|
| Sri Murugan Agencies | Distributor | Bronze, credit limit 5,000 |
| Lakshmi Traders | Distributor | Silver, credit limit 20,000, 4,900 points |
| Annai Distributors | Distributor | Gold, credit limit 100,000 |
| Deepika | Sales Manager | |

Tip: log in as Lakshmi Traders and order 10 Filter Coffee to see the worked example from the paper (Silver goes to Gold).

## Other commands

```bash
npm run db:reset --prefix server    # back to the seed data
npm run test:concurrency            # two orders for the last unit at once, only one should win (reset first)
ERP_FAIL_RATE=0.5 npm start         # ERP returns 500 about half the time, to see retries
ERP_DELAY_MS=8000 npm start         # ERP replies slowly so requests time out, to see retries
```