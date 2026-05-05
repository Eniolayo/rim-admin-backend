# How We Decide Who Gets a Loan, and How Much

A plain-English walkthrough of the CSDP eligibility scoring system.
No maths, no jargon, just how the decisions are made and what to expect.

---

## What this document is for

Every time an Airtel subscriber tries to borrow airtime, data, or talktime through CSDP,
Airtel asks us a single question: **"How much should this person be allowed to borrow right
now?"**

We have about a second and a half to answer with a number in Naira. That number can be zero
(meaning "we don't think this is a good idea today") or any whole-Naira amount up to the
ceiling we have agreed with Airtel.

This document explains how we decide that number, written for someone who has not seen the
technical specification.

---

## The mental model: lending to people you barely know

Imagine you run a small kiosk and people you don't know walk up asking to borrow ₦500
worth of airtime. They promise to pay you back when their next salary or recharge comes in.
You can't talk to all of them — you have one second to decide yes or no, and how much.

In real life you would think about a few simple things:

1. **Have they ever stiffed you before?** If they currently owe you money from a previous
   loan and haven't paid, you say no — no question.
2. **Are they already drowning in debt to other lenders?** If they have already borrowed
   the maximum from your competitors, lending more is risky for everyone.
3. **Do they have a track record with you?** Someone who has borrowed five times and paid
   back every time is a very different proposition from someone you've never seen.
4. **Are they an active customer at all?** Someone who recharges every week is more likely
   to keep the lights on. Someone who hasn't recharged in two months is a churn risk.
5. **Can your kiosk afford the loan today?** Even if the person is a great customer, if
   you've already lent out half your float for the day, you should hold back.

Our scoring system does exactly these five things, in order, every time.

---

## The five things we check

We check them in a specific order. If any of the early checks fails, we stop and say no
immediately. We only get to the more nuanced calculations if the basics are clean.

### Check 1 — Hard "no" reasons

These are non-negotiable. If any of the following is true, we return zero with no further
analysis:

- The subscriber is on our explicit blacklist.
- They currently have an unpaid loan from us. We do not stack new loans on top of unpaid ones.
- They have an open default that has never been cleared, of any age.
- According to Airtel, they have already borrowed up to the absolute ceiling across all
  partners. There is no room to lend.
- They have hit our system more than 10 times in the last hour, suggesting abuse rather
  than a real customer.
- We have temporarily turned off lending for this loan type (an operational kill switch).

These are not soft signals — they are hard rules. They represent decisions we have made up
front and never want to override case-by-case in production.

### Check 2 — How much evidence do we have?

This is the heart of the system. We are trying to answer: **"How confident are we that this
person will pay back?"**

Two things matter here, and they matter together:

- **Their repayment rate.** Of the loans they have taken in the last six months, how many
  did they pay back?
- **How many loans we are basing that on.** Someone who has taken one loan and paid it back
  has a 100% repayment rate, but we have only seen them once. Someone who has taken twenty
  loans and paid all twenty has a 100% repayment rate too — but we are far more sure of them.

We deliberately reward both. A person with one perfect loan gets some credit, but not as
much as a person with ten perfect loans. The system gives much more weight to the second
person, even though their "score" looks identical on paper.

This is the same intuition you would use yourself. If your cousin has paid you back once,
that's nice. If they have paid you back fifteen times across two years, that's very
different.

### Check 3 — Are they actually still a customer?

A subscriber's loan history is necessary but not sufficient. If someone has a great
repayment history from six months ago but hasn't recharged at all in the last month, that
is a warning sign — not a green light. They might be churning to another network. If they
borrow from us and then disappear, we cannot recover.

So we look at two extra signals:

- **How long they've been on the network.** A subscriber who joined two years ago carries
  more weight than one who joined two weeks ago.
- **How often they recharge in the last 30 days.** Someone who recharges every week is
  much safer than someone who has gone quiet.

These two signals do not give "free points." They modulate the trust we already have from
the loan history. A subscriber with a perfect loan history but no recent activity gets
their score reduced; a subscriber with the same loan history who recharges weekly keeps
the full score.

We use the **weaker** of the two signals as the modulator. This is deliberate. If a
long-tenured subscriber has stopped recharging, we treat them as the churn risk they are,
not as the loyal customer their tenure implies.

### Check 4 — Have they ever defaulted in the past, even if they paid it back later?

Some subscribers default on a loan and then, weeks or months later, finally pay it off.
The current debt is gone, so they don't fail Check 1. But this is still a useful signal —
people who have defaulted in the past are more likely to default again, even if they
eventually catch up.

So we apply a small penalty for these "cured defaults." It is not severe. It is capped so
that an old serial defaulter who has been clean for years isn't permanently locked out.
But it is real, and it matters at the margin.

### Check 5 — Real-world spending caps

Even after the score is calculated, three accounting rules clamp the final amount:

- **The Airtel cross-partner cap.** If Airtel tells us the subscriber already has ₦4,000
  in loans across all partners and the ceiling is ₦5,000, we can never lend more than
  ₦1,000, regardless of score.
- **A daily limit per subscriber.** Even a perfect customer cannot borrow ₦3,000 worth of
  data three times a day. Each subscriber has a 24-hour rolling cap.
- **Our own daily exposure.** If our entire loan book is approaching its risk budget for
  the day, we taper down what we approve. At 95% utilisation we stop entirely. This is a
  circuit breaker — it protects the company from a runaway day.

These three caps exist for accounting reasons, not behavioural ones. They are about what
we _can_ afford to lend, not what we _should_ lend.

---

## How a real loan decision unfolds — five customer stories

Below are five subscribers, each at a different stage of their relationship with us. The
amounts approved (or denied) come directly from the live formulas.

### Adaeze — A first-time borrower, six months on the network

Adaeze has been on Airtel for 180 days. She recharges roughly twice a week. She has never
borrowed before. Today she tries to top up her airtime, comes up short, and Airtel asks
us if she can borrow.

We have no loan history for her at all. But we can see she is a genuine customer who uses
the network regularly. So we extend a small **starter loan**: about **₦237 in airtime**.

The starter loan exists for one reason: to give a real customer one chance to prove
themselves. The amount is deliberately small — small enough that if she defaults, we have
not lost much, but large enough to be a real loan that creates a real track record.

If Adaeze had only joined the network a week ago, or if she barely recharged, we would
not extend the starter loan. The starter loan is reserved for active, established
customers who have simply never borrowed before.

### Tunde — Adaeze's awkward second visit

Imagine Adaeze repays her ₦237 loan on time, and a few weeks later she tries to borrow
again. This time she has one loan in her history, and it was paid back perfectly.

Our system, paradoxically, **denies her**.

This sounds wrong, and it is the most counter-intuitive part of the algorithm. The logic
is: one perfect repayment is good news, but it is not yet enough evidence to lend her
more. She is in a "thin file" zone — too much history to qualify for the starter loan
again, but not enough history to clear the regular threshold.

She will be denied at her second, third, and fourth attempts as well. Around her **fifth
successful repayment**, she finally clears the threshold and starts receiving regular loans.

**This is a known weakness, and we are surfacing it deliberately.** From Adaeze's
perspective, the experience is "I borrowed and repaid, then you stopped lending to me."
That is a bad experience and a churn risk. Two ways to address this are on the table:

- **Continuity bonus**: give a small extra credit lift to subscribers whose only history
  is a successful starter loan, so they don't fall off a cliff.
- **Skip the starter loan entirely**: only lend to subscribers who already have history
  from another product.

Both have trade-offs and the choice is a product decision, not a technical one. The
algorithm does not pretend it has solved this — it is simply being explicit about it.

### Funmi — A cautious regular

Funmi has been on the network for two years, recharges three times a week, and has
borrowed four times in the last six months. She paid all four back on time. She walks up
asking for a DATA loan today.

She is **denied**, by a hair.

Four perfect repayments is genuinely good behaviour. But for a DATA loan — which is
larger than airtime — we want a slightly higher threshold. Four loans gets her almost there
but not quite. Her **fifth successful loan** (any product) will push her over and unlock
roughly **₦134 of DATA credit**.

The system is consciously conservative here. We would rather make Funmi wait one more
cycle than give her a DATA loan we are not yet sure about. Once she crosses the line, her
limit grows steadily with each successful repayment.

### Bola — The established customer

Bola has been on the network for two years, recharges multiple times a week, and has
taken twelve loans in the last six months — all repaid. She wants a DATA loan.

She gets approved for **₦892**.

For someone like Bola, the system does what you'd expect: she has earned trust through
sustained good behaviour, she is clearly an active customer, and she has a long track
record. Her limit reflects all of this. With twenty or thirty perfect repayments her
limit would grow further, eventually approaching the maximum we offer.

### Chinedu — Active but currently in default

Chinedu has been on the network for three years and used to be a great customer. But six
weeks ago he took a loan and never paid it back. He still has that unpaid balance.

He fails Check 1. **We deny him immediately, no scoring needed.**

This is not a permanent ban. The moment Chinedu pays off the outstanding loan, the gate
clears and he can apply again. He will, however, carry a small penalty going forward as a
"cured default" — a quiet flag that he has defaulted before, even though the debt is now
cleared.

### Emeka — A reformed defaulter

Emeka took ten loans, paid eight on time, defaulted on one, then eventually paid off that
default after a few weeks. He paid the tenth loan on time. He's recharged regularly the
whole time.

He is **approved**, but at a slightly lower limit than Bola would have received with the
same numbers. The cured default reduces his score by a few points. As more time passes
without further defaults, this penalty fades, and eventually he is treated like any other
established customer.

The system is forgiving — it doesn't lock people out forever for one mistake — but it is
also honest about the historical record.

---

## Why the system is built this way

A few design choices are worth flagging because they will come up in stakeholder
conversations.

**It is deterministic.** The same inputs always produce the same answer. This is
deliberate — every decision can be explained to a regulator, to Airtel, and to the
customer if asked. There is no black-box machine learning model in the loop today.

**It is conservative on thin files.** New borrowers get a small starter loan, then have
to earn larger ones. This is intentional. The cost of approving a bad loan to someone we
know nothing about is much higher than the cost of asking them to wait one more cycle.

**It is tunable without redeploying.** Every weight, threshold, and ceiling lives in
configuration. Risk and operations teams can adjust the system in real time as we learn
how it behaves in production, without engineering involvement.

**It logs every decision in detail.** For every request, we record the score, every
component that went into it, every clamp that was applied, and the final outcome. This
gives us two things: a paper trail for any decision we need to justify after the fact,
and the data we will eventually use to train a smarter model.

**It is designed to be replaced.** This algorithm is the v1 we ship before we have any
historical data. In about three months, once we have seen enough real loans go out and
come back, we will train a learned model on the logs. That model will replace one piece
of this algorithm — the scoring step — without touching the rest. The hard gates, the
final caps, and the logging stay the same.

---

## What this system does not do

Honesty about limitations.

- **It does not yet predict who is about to leave the network.** That signal is the
  single best predictor of default for airtime loans, and it lives in call detail records
  we do not yet feed into scoring. Adding it is the most important enhancement on the
  roadmap.
- **It does not learn from individual customer behaviour beyond aggregates.** Two
  customers with identical numbers get the same answer, even if their actual usage
  patterns are very different. A learned model in v2 will fix this.
- **It does not solve the post-starter-loan cliff.** That is a product decision waiting
  to be made.
- **It does not account for fraud rings or coordinated abuse beyond the basic velocity
  gate.** If we see patterns of abuse in production, anti-fraud rules will need to be
  added separately.

---

## What success looks like in the first 90 days

We are looking for three things in the rollout:

1. **Default rate stays under 5%** of approved loans. If it goes higher, we tighten.
2. **Approval rate of subscribers Airtel sends us is above the partner SLA.** If it goes
   lower, the experience for legitimate customers is bad and Airtel will push back.
3. **Enough labelled data accumulates** — meaning approved loans whose outcomes
   (repaid / partial / defaulted) we can join back to the original decision — to fit a
   real model. We need roughly two months of steady volume.

Once those three conditions are met, the heuristic we are shipping today gets retired in
favour of a learned model, and the conversation moves from "is the formula right?" to
"is the model calibrated?"

---

## Summary in three lines

We decide loan amounts based on whether someone has paid us back before, whether they
are currently an active customer, and whether they have any open debts. We are
deliberately cautious with new borrowers and reward consistent customers with larger
limits over time. The system ships transparent and tunable, and it is designed to be
upgraded with a learned model once we have enough real data.
