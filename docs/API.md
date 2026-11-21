# Dan & Dor Solar Company Limited — API guide (v1)

This API lets another system (for example a shop management system) read
**sales**, a **sales summary for targets**, **payments** and **phones / stock**
from the Dan & Dor Solar web app, and **record payments taken at the shop**.

- **Base address:** `https://dandorsolar.site/api/v1`
- **Format:** JSON in, JSON out. Amounts are in Ghana cedis (GHS). Dates are ISO 8601 (UTC = Ghana time).
- **Call it from your server**, not from a web browser page (the key must stay secret).

---

## 1. Getting a key

An admin makes the key in the Dan & Dor web app: **Settings → API keys → Make a key**.
They choose a name (e.g. "Shop system") and what the key may do:

| Permission | Lets the key… |
|---|---|
| `sales:read` | read sales and the sales summary |
| `payments:read` | read payments |
| `stock:read` | read phones / stock |
| `payments:write` | record payments taken at the shop |

The key (it starts with `ddsk_`) is shown **once**. Keep it secret. If it leaks,
the admin switches it off in the same place and makes a new one.

Send it with every request:

```
Authorization: Bearer ddsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Check that it works:

```bash
curl -H "Authorization: Bearer $DD_KEY" https://dandorsolar.site/api/v1/me
# {"success":true,"data":{"name":"Shop system","permissions":["sales:read","payments:read","stock:read"]}}
```

Limit: 120 requests per minute per key.

---

## 2. Answers and errors

Lists come back like this (pages of up to 200; default 50):

```json
{ "success": true, "data": [ ... ], "page": 1, "limit": 50, "total": 134, "has_more": true }
```

Use `?page=2`, `?page=3`… while `has_more` is `true`.

Errors:

```json
{ "success": false, "error": { "code": "invalid_key", "message": "This API key is not valid or has been switched off." } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `bad_request`, `too_much` | Something in the request is wrong (the message says what) |
| 401 | `missing_key`, `invalid_key` | No key, wrong key or switched-off key |
| 403 | `not_allowed` | The key doesn't have that permission |
| 404 | `not_found`, `customer_not_found`, `no_plan` | Not found |
| 409 | `plan_not_payable` | The customer's plan can't take a payment now |
| 429 | `too_many_requests` | Slow down |
| 500 | `server_error` | Try again later |

Dates in filters: `from` and `to` as `YYYY-MM-DD` (`to` includes that whole day).

---

## 3. Sales — `GET /sales` *(sales:read)*

A **sale** is a phone sold on a plan. By default only sales whose deposit was
paid (the plan started) are listed, newest first. `sold_at` is when the deposit
was paid.

| Filter | Example | |
|---|---|---|
| `from`, `to` | `?from=2026-11-01&to=2026-11-30` | by `sold_at` |
| `dsr` | `?dsr=DS-0003` | one DSR (staff ID) |
| `branch` | `?branch=Madina` | one branch |
| `status` | `?status=active,defaulted` | `active`, `defaulted` (overdue), `completed` (paid off), `closed`, `repossessed` |
| `include_pending` | `?include_pending=true` | also sales waiting for approval / deposit (then dates filter by registration date) |
| `page`, `limit` | `?page=2&limit=100` | |

```bash
curl -H "Authorization: Bearer $DD_KEY" "https://dandorsolar.site/api/v1/sales?from=2026-11-01&to=2026-11-30"
```

One sale:

```json
{
  "id": "6740c1…",
  "status": "active",
  "sold_at": "2026-11-07T10:00:00.000Z",
  "registered_at": "2026-11-06T09:12:00.000Z",
  "customer": { "id": "6740b9…", "name": "Akosua Mensah", "phone": "0244123456", "account_number": "DD-100234" },
  "phone": { "model": "samsung SM-A085F", "imei": "351980974800938", "serial_number": null },
  "price": 3850, "deposit": 750, "deposit_paid": true,
  "frequency": "weekly", "installment_amount": 182.36, "total_payments": 17, "payments_made": 0,
  "balance": 3000, "late_fees_owed": 0, "next_due_date": "2026-11-23T10:00:00.000Z",
  "dsr": { "id": "673f…", "name": "Wassah Samuel", "staff_id": "DS-0003", "branch": "Madina" },
  "branch": "Madina",
  "sold_by": "dsr"
}
```

Sales registered by an admin have `"dsr": null`, `"branch": "Office"`, `"sold_by": "office"`.

---

## 4. Sales summary for targets — `GET /sales/summary` *(sales:read)*

Counts sales (by `sold_at`) and adds up the money, per DSR, per branch and per
month. `collected` = all money received in the same dates from that DSR's /
branch's customers (deposits + installments).

Filters: `from`, `to`, `dsr`, `branch`.

```bash
curl -H "Authorization: Bearer $DD_KEY" "https://dandorsolar.site/api/v1/sales/summary?from=2026-11-01&to=2026-11-30"
```

```json
{
  "success": true,
  "data": {
    "from": "2026-11-01", "to": "2026-11-30",
    "totals": { "sales_count": 14, "sales_value": 47250, "deposits": 10400, "collected": 15890.5 },
    "by_dsr": [
      { "dsr_id": "673f…", "dsr_name": "Wassah Samuel", "staff_id": "DS-0003", "branch": "Madina",
        "sales_count": 8, "sales_value": 27400, "deposits": 5900, "collected": 9320 }
    ],
    "by_branch": [ { "branch": "Madina", "sales_count": 8, "sales_value": 27400, "deposits": 5900, "collected": 9320 } ],
    "by_month_and_dsr": [
      { "month": "2026-11", "dsr_id": "673f…", "dsr_name": "Wassah Samuel", "staff_id": "DS-0003", "branch": "Madina",
        "sales_count": 8, "sales_value": 27400, "deposits": 5900, "collected": 9320 }
    ]
  }
}
```

For a target of "phones sold per DSR this month", use `by_dsr[].sales_count`
with `from` = first day of the month.

---

## 5. Payments — `GET /payments` *(payments:read)*

All money received, newest first.

| Filter | Example | |
|---|---|---|
| `from`, `to` | `?from=2026-11-01` | by payment date |
| `method` | `?method=cash` | `paystack`, `cash`, `momo`, `bank` |
| `include_cancelled` | `?include_cancelled=true` | also payments an admin cancelled (marked `"cancelled": true`) |
| `page`, `limit` | | |

```json
{
  "id": "6741…", "date": "2026-11-11T18:23:00.000Z", "amount": 100,
  "method": "cash", "kind": "installment", "late_fees_part": 0,
  "reference": null,
  "customer": { "id": "6740b9…", "name": "Akosua Mensah", "phone": "0244123456", "account_number": "DD-100234" },
  "sale_id": "6740c1…",
  "dsr": { "id": "673f…", "name": "Wassah Samuel", "staff_id": "DS-0003", "branch": "Madina" },
  "recorded_by": "Daniel Ayamba",
  "source": "dan_dor_app",
  "cancelled": false,
  "note": "Cash recorded by Daniel Ayamba"
}
```

`kind` is `deposit` or `installment`. `source` is `paystack`, `dan_dor_app`, or
the API key's name for payments recorded through the API.

**Keeping in sync:** ask for `?from=<yesterday>` every few minutes or once a day
and store payments by `id` (skip ids you already have).

---

## 6. Phones / stock — `GET /stock` *(stock:read)*

| Filter | | |
|---|---|---|
| `status` | `in_stock`, `sold`, `all` (default) | |
| `page`, `limit` | | |

```json
{
  "id": "6739…", "model": "samsung SM-A065F", "imei": "352011223344551", "serial_number": null,
  "price": 2600, "cost": 1900,
  "status": "in_stock",
  "customer_name": null,
  "held_by": { "name": "Wassah Samuel", "staff_id": "DS-0003" },
  "locked": false, "last_check_in": "2026-11-21T10:45:00.000Z", "app_version": "1.140",
  "added_at": "2026-11-02T08:00:00.000Z"
}
```

`status`: `in_stock` (set up, not sold), `sold`, `released` (paid off / freed),
`not_set_up`. `price` is the selling price the admin set (`null` if none yet);
`cost` is what the company paid (`null` if not entered). `held_by` is the DSR the
phone was given to (`null` = at the office).

---

## 7. Record a payment taken at the shop — `POST /payments` *(payments:write)*

When a customer pays at the shop's till, send:

```bash
curl -X POST https://dandorsolar.site/api/v1/payments \
  -H "Authorization: Bearer $DD_KEY" -H "Content-Type: application/json" \
  -d '{ "account_number": "DD-100234", "amount": 182.36, "method": "cash", "reference": "POS-000123", "note": "Paid at Madina shop" }'
```

| Field | Required | |
|---|---|---|
| `account_number` | yes (or `customer_id`) | the customer's Dan & Dor account, e.g. `DD-100234` |
| `amount` | yes | GHS; at most what they owe (balance + late fees) |
| `method` | yes | `cash`, `momo` or `bank` |
| `reference` | yes | **your own unique id for this payment** (e.g. the till receipt number) |
| `note` | no | up to 200 characters |

Answer (201):

```json
{
  "success": true,
  "data": {
    "payment_id": "6742…", "amount": 182.36,
    "customer": { "name": "Akosua Mensah", "account_number": "DD-100234" },
    "balance": 2817.64, "late_fees_owed": 0, "payments_made": 1,
    "next_due_date": "2026-11-30T10:00:00.000Z",
    "plan_completed": false, "phone_unlocked": false
  }
}
```

The payment is credited exactly like one recorded in the Dan & Dor app: late
fees are paid first, the due date moves forward when an installment is covered,
a locked phone unlocks once the customer is up to date, and the customer gets an
SMS. It also appears in the app's **Money check → Cash-up**.

**Sending the same payment twice is safe:** if a `reference` was already
recorded, nothing is added and the answer is `200` with `"duplicate": true`.
So if your system isn't sure a request went through (e.g. no internet), send it
again with the **same** `reference`.

Deposits are not recorded here: a new sale's deposit is paid through Paystack in
the Dan & Dor app (that's what starts the plan). Paystack payments are recorded
automatically.

---

## 8. Quick test list for your developer

1. `GET /me` with the key → 200 and the key's permissions.
2. `GET /sales/summary?from=<first of month>` → this month's sales per DSR.
3. `GET /payments?from=<today>` → today's payments.
4. `GET /stock?status=in_stock` → phones in stock.
5. `POST /payments` with a small test amount on a test customer → 201; send it
   again with the same `reference` → 200 `"duplicate": true`. (An admin can
   cancel the test payment on the customer's page: *Cancel this payment*.)

Questions: contact Dan & Dor Solar Company Limited.
