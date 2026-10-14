# How this could pay for itself

Interview Room is free with your own key, and that stays true. This page is the honest version of how it could earn, what each path needs to be true, and what I don't know yet.

No market-size numbers here. I haven't measured the market, so I'm not going to make one up.

## Who it's for

People with an interview coming up who want reps, not reading:

- Career changers moving into customer-facing technical roles: account management, customer success, solutions engineering.
- People going for engineering roles where behavioural rounds carry weight.
- Anyone who has a list of questions and nobody to ask them out loud.

The moment it's for: the week before an interview, at night, when there's nobody to practise with.

## What's free forever

The questions, the grader, the story bank and the demo. With your own Anthropic key, every grade is billed to you by Anthropic, and I never see it. That's the reason it can be free: it costs me nothing to run.

The catch is that most people preparing for an interview don't have an API key and won't get one. That gap is where the money is.

## Two things worth testing

### 1. An interview-week pass

A hosted key for a short window. Pay once, grade as many answers as you like for seven days, no API account needed.

- **Price to test:** a small one-off fee for the week. I'd set it after seeing what a week of heavy use actually costs in tokens, with a hard cap on answers per day so one user can't run up a bill.
- **What has to be true:** people who try the demo want to grade their own answers, and paying once is easier for them than setting up an API account.
- **Cost to deliver:** this is the first version that needs a server: a small proxy that holds the key, checks the pass and counts usage. Plus payment through a hosted checkout. Real work, and real running costs, which is why it isn't built.
- **Risk:** every graded answer costs money. The price has to cover the heaviest reasonable user, not the average one.

### 2. Question packs by role

Sets of questions written for one role family, with notes on what each question is really testing. Imported as a file, like the story bank.

- **Price to test:** a few dollars a pack.
- **What has to be true:** the free 40 questions get people started, and they want more depth for the specific role they're going for.
- **Cost to deliver:** writing time. No code beyond an import format for questions.
- **Why it might go first:** it needs no server and no running costs.

## What it costs to run today

| Thing | Cost |
| --- | --- |
| Hosting (GitHub Pages) | $0 |
| Servers, database | none |
| Model usage | paid by each user, on their own key |
| Domain | optional |

## The one-week demand test (before building anything paid)

1. Ship the free version.
2. Under the key form, add one line: "No key? Get a 7-day pass." It goes to a waitlist form. Nothing to buy yet.
3. Put it in front of people who are interviewing: a short video of the demo round, and posts in job-search communities where sharing tools is welcome.
4. Count two numbers: clicks on the links I post (a tagged short link per post) and waitlist sign-ups. The app has no tracking and that isn't changing, so I count at the doors, not inside the room.

**Go:** 25 or more sign-ups in a week. Price the pass from real token costs and build the proxy.
**No-go:** fewer than 5. The tool may be fine, but the offer is wrong. Try question packs instead.
**In between:** run one more week with a different audience before deciding.

## What I don't know yet

- What a week of real use costs in tokens. The evals haven't been run against the live API yet, so I don't even have a cost per grade.
- Whether people trust a grade from a model enough to pay for more of them.
- Whether question packs are worth paying for when free question lists are everywhere. My guess is that the grader is what's worth paying for, not the questions. A guess is not data.

## Ground rules

- No ads and no selling data. The app doesn't collect any.
- Anything paid has a refund button.
- No promises about getting hired. It's practice, and the page says so.
