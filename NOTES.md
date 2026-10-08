# Notes

## Architecture

Four parts: the React app (port 5173), the Express API (port 4000), Postgres, and a small mock ERP server (port 4001). The React app calls the API with JSON. There's no login since auth is out of scope, so when you pick a user in the dropdown the app sends their role and id in two headers (x-user-role, x-user-id). A middleware checks the user exists before any route runs.

In the API I split the code into routes, controllers and services. Routes map URLs, controllers handle the request and response, and services have the rules and SQL. Anything that changes data runs inside a transaction.

Every status change also inserts a row into erp_outbox in the same transaction. A worker inside the API checks that table every 2 seconds and posts new rows to the ERP. The paper doesn't say what the ERP endpoint is, so I wrote a mock one that logs what it gets.

Where each rule is enforced:

- R1: API. Stock is reserved with one UPDATE that only works if enough is available. Dispatch removes it from on-hand stock, cancel and reject give the reservation back. A CHECK in the database stops reserved going above on hand.
- R2: API. The discount % is worked out at placing time and saved on the order. Nothing recalculates it.
- R3: API, during placing, with the distributor row locked. I decided manager approval doesn't check credit again, because approving is the override.
- R4: API gives points only when an order goes into Confirmed. A unique constraint on (order_id, entry_type) stops a second award.
- R5: API. Cancelling a Confirmed order adds a negative points row, then the tier is recalculated. This happens after every points change.
- R6: API. There is no endpoint to edit items or totals, only status.
- R7: API rejects a line if stock isn't enough. The UI also disables the quantity box for out of stock items, but the API check is what counts.
- R8: API saves an order_events row (who and when) for every status change. The code only inserts into that table.

## Key decisions

1. Plain SQL with the pg library, no ORM. I wanted the locks and conditional updates to be visible, and it was easier to keep schema.dbml the same as the real tables.
2. Two stock columns, on hand and reserved, and reserving with a single conditional UPDATE. The other option was SELECT first then UPDATE, but then two requests can both see the last unit and both succeed.
3. A points ledger instead of a balance column. With only a balance you can't tell how many points came from the last 90 days. A reversal copies the date of the award so it cancels it in the same window.
4. An outbox table for ERP events instead of calling the ERP inside the request. If the ERP was down, a direct call would either fail the order or lose the event. Retries wait 2, 4, 8, 16, 32 seconds (6 tries max) on 5xx, timeout or no connection. 4xx isn't retried since the same request would fail again.
5. User identity in headers, checked in one middleware. I thought about sending the user id in each request body, but then every route needs its own check and it's easy to miss one.


## Known defects

- Anyone can send any user headers. OK here because auth was out of scope, not OK for real use.
- If the ERP processes an event but its reply times out, the event is sent again, so the ERP can get duplicates.
- A newer event for an order can reach the ERP before an older one that's still waiting to retry.
- Outbox rows marked FAILED are never retried.
- The tier column only updates when points change or an order is placed. The tier shown in the UI is always calculated live.
- Stock release and dispatch don't lock products in a fixed order, so many cancels at once could deadlock (Postgres would abort one).
- Placed only lasts a moment, so Placed → Cancelled is allowed but can't really happen.
- The concurrency test needs a fresh db reset first.and don't miss anything."