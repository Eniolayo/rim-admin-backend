# CSDP Integration API (Airtel)

**Status:** Partner integration specification — **this is the document Airtel expects RIM to follow** for CSDP REST integration (loan eligibility and fulfillment).  
**Source:** Airtel-supplied integration memo (reproduced here for engineering; replace or supplement with the **signed PDF / official portal** version when available).  
**See also:** [CSDP_HUB_MIGRATION_PLAN.md](./CSDP_HUB_MIGRATION_PLAN.md) §2.7 (gap analysis vs current RIM implementation).

---

## Overview

The CSDP REST APIs allow integration with the CSDP application to manage **loan eligibility** and **fulfillment**.

---

## Endpoints

### 1. Profile (to be provided by partner)

This endpoint is called each time a new request for a loan is made by customers.

| Field | Type | Length | Description |
|-------|------|--------|-------------|
| **Endpoint** | — | — | `[to be provided by partner]` |
| **Method** | — | — | **GET** (query parameters) |

**Query parameters**

| Name | Type | Length | Description |
|------|------|--------|-------------|
| `msisdn` | String | 13 | Subscriber MSISDN in `234xxx` format |
| `da` | Int | — | Current loan balance of subscriber (**in kobo**) |
| `trans_ref` | String | — | Reference ID (not in CDR) |
| `type` | String | — | `AIRTIME` / `DATA` / `TALKTIME` |

**Request sample (query params)**

```json
{
  "msisdn": "2348122356701",
  "da": 50000,
  "type": "AIRTIME",
  "trans_ref": "20221012051020"
}
```

**Response**

Returns only one value in **string** format: the limit the subscriber is entitled to receive **in Naira**.

```json
{
  "message": "1000"
}
```

---

### 2. Loan notification (to be provided by partner)

This endpoint is called each time a new loan is given to a subscriber.

| Field | Type | Length | Description |
|-------|------|--------|-------------|
| **Endpoint** | — | — | `[to be provided by partner]` |
| **Method** | — | — | **POST** |

**Body**

| Name | Type | Length | Description |
|------|------|--------|-------------|
| `msisdn` | String | 13 | Subscriber MSISDN in `234XXXXXXXXXX` format (country code + 10-digit number) |
| `amount` | Float | — | Amount borrowed or recovered |
| `max_amount` | Float | — | Same as `amount` |
| `trans_ref` | String | — | Unique transaction reference |
| `trans_datetime` | String | — | Transaction date/time: `YYYYmmdd HHMMSS` (space between date and time) |
| `transaction_type` | String | — | `AIRTIME`, `DATA`, or `TALKTIME` |
| `type` | String | — | Request type: **`fulfillment`** |
| `loan_id` | String | — | Unique ID of loan (required if request type = fulfillment) |
| `status` | String | — | `success` |

**Request sample**

```json
{
  "msisdn": "2348122356701",
  "amount": 500,
  "max_amount": 500,
  "trans_ref": "20221012051020",
  "trans_datetime": "20260101 101010",
  "transaction_type": "AIRTIME",
  "type": "fulfillment",
  "loan_id": "1212323233673",
  "status": "success"
}
```

**Response sample**

```json
{
  "success": true
}
```

---

### 3. Recovery notification (to be provided by partner)

This endpoint is called each time a new recovery is made on a subscriber.

**Note:** Same URL as **loan notification**; parameters differ slightly.

| Field | Type | Length | Description |
|-------|------|--------|-------------|
| **Endpoint** | — | — | Same as loan notification |
| **Method** | — | — | **POST** |

**Body**

| Name | Type | Length | Description |
|------|------|--------|-------------|
| `msisdn` | String | 13 | Subscriber MSISDN in `234XXXXXXXXXX` format |
| `amount` | Float | — | Amount borrowed or recovered |
| `max_amount` | Float | — | Same as `amount` |
| `trans_ref` | String | — | Unique transaction reference |
| `trans_datetime` | String | — | `YYYYmmdd HHMMSS` (space between date and time) |
| `transaction_type` | String | — | e.g. `AIRTIME` |
| `type` | String | — | Request type: **`repayment`** |
| `loans` | Array | — | List of loans recovered by this recovery |
| `recovery_id` | String | — | Unique ID of recovery (required if request type = recovery) |
| `status` | String | — | `success` |

**Request sample**

```json
{
  "msisdn": "8122356701",
  "amount": 500,
  "max_amount": 500,
  "type": "AIRTIME",
  "trans_ref": "20221012051020",
  "trans_datetime": "20260101 101010",
  "transaction_type": "AIRTIME",
  "request_type": "recovery",
  "loans": [
    { "id": "1212323233673", "paid": true, "amount": 100, "partner": "P1" }
  ],
  "recovery_id": "29829238982",
  "status": "success"
}
```

> **Implementation note:** The sample uses `request_type`: `"recovery"` while the field table uses `type`: **`repayment`**. Confirm the **canonical** field name and value with Airtel before locking DTOs.

**Response sample**

```json
{
  "success": true
}
```
