# CTO notes

You don't have to write this code. You have to be able to do three things with it:

1. **Explain it** to an interviewer, a partner or a customer.
2. **Find a bug** in it when a grade looks wrong.
3. **Know what to ask for** when you want it changed.

This page gets you there. Read sections 1 and 2 once (about 20 minutes). Keep section 4 for the day something breaks. Do section 5 with your own hands, because that is where it sticks.

## 1. The whole app in one picture

```
   you type             the pipeline (core/grade.ts)                       the screen
 ┌───────────┐   ┌──────────────────────────────────────────────┐   ┌──────────────┐
 │ question  │   │ buildRequest() ─> send() ─> readReply()      │   │ band, STAR   │
 │ answer    │──>│   ─> validateModelGrade() ─> scoreAnswer()   │──>│ bar, checks, │
 │ stories   │   │   ─> checkRewrite()                          │   │ fix, rewrite │
 └───────────┘   └──────────────────────────────────────────────┘   └──────────────┘
                              send() is the only network call:
                              api/anthropic.ts, your key, Anthropic
```

There is no server of ours. The page is a handful of files that GitHub hands to the browser. When you press Grade, the browser talks to Anthropic directly with your key, and everything else happens on your device.

- **The brain** (`src/core/`) knows questions, answers, numbers and rules. It has never heard of a button or a network.
- **The network** (`src/api/anthropic.ts`) is one function that sends one request.
- **The screen** (`index.html`, `src/ui/`, `src/styles/`) only knows how to look.
- **The wiring** (`src/main.ts`) connects them.

## 2. Seven ideas this repo teaches

The first one is new in this repo. The rest carry over from Mol-Bhav Meter.

### Building on a language model like an engineer

This is the one to be able to talk about for ten minutes. Three parts.

**The prompt is code.** It lives in [`src/core/prompt.ts`](../src/core/prompt.ts), with a version number (`PROMPT_VERSION`). It is reviewed, committed and tested like any other code, because it changes what the program does just as much.

**The answer is forced into a schema.** The request tells the API the exact JSON shape the reply must have ([`src/core/schema.ts`](../src/core/schema.ts)). Then `validateModelGrade()` checks it again on arrival, because a refusal or a reply cut off at the token limit can still miss the shape. The screen only ever sees data that passed.

**The model reads; the code decides.** The model copies out which sentences are Situation, Task, Action and Result. Code checks each one is really in the answer, measures them, times the answer, and picks the band ([`src/core/score.ts`](../src/core/score.ts)). Same model output, same grade, every time. And a rewrite that uses a number the candidate never wrote is thrown away by code ([`src/core/numbers.ts`](../src/core/numbers.ts)), not by asking the model nicely.

**Evals tell you if a prompt change helped.** [`evals/cases.json`](../evals/cases.json) has 11 sample answers and what each check should say. `npm run evals` runs them against the live API and prints pass or fail. Change the prompt, run it again, compare. Without that, "the new prompt seems better" is a feeling.

- **Say it:** "I keep the prompt in code with a version, force the reply into a JSON schema and validate it again, let the model do the reading and code do the counting, and I measure prompt changes against an eval set instead of eyeballing them."
- **Read next:** [docs/THE-PROMPT.md](THE-PROMPT.md), the whole prompt and why each rule is there.

### Pure functions

A pure function gets values in and gives values out, and does nothing else. Same input, same answer, every time. No clock, no network, no screen.

- **See it:** `scoreAnswer()` in `score.ts`, `buildRequest()` in `prompt.ts`.
- **Say it:** "Everything that decides a grade is a pure function, so I test every rule in milliseconds without a browser or an API."

### Passing the network in

`gradeAnswer()` doesn't call the API itself. It takes a `send` function as its first argument. In the app, `send` is `makeSend(yourKey)`, which calls Anthropic. In the tests, `send` is a one-line fake that returns whatever the test wants: a good grade, a refusal, a 529 "busy", a reply in the wrong shape, a dropped connection. The demo uses a fake too, `scriptedSend()`.

- **See it:** the top of [`src/core/grade.ts`](../src/core/grade.ts), then [`src/core/grade.test.ts`](../src/core/grade.test.ts).
- **Say it:** "The pipeline takes the network as a parameter, so CI tests every failure path with no key and no internet, and the demo runs the real grader on scripted replies."

### Unit tests, and property tests

A unit test runs your code with known inputs and checks the answer. A property test invents hundreds of inputs and checks a rule that must hold for all of them. This repo has four:

- 500 random texts never invent numbers against themselves, and a planted number is always caught (`numbers.test.ts`).
- 500 random model replies never produce a share below 0, above 1, or NaN (`score.test.ts`).
- 200 random story banks survive export and import unchanged (`stories.test.ts`).

- **Run it:** `npm test`.
- **Say it:** "Example tests prove the cases I thought of. Property tests cover the ones I didn't."

### Types

TypeScript is JavaScript where every value has a declared shape. `ModelGrade`, `Report` and `GradeResult` are the shapes. `GradeResult` is one of three kinds (`graded`, `problem`, `too-short`), and the screen has to handle all three or the build fails.

- **See it:** `GradeResult` in `grade.ts`, then `renderResult()` in `src/ui/report.ts`.
- **Run it:** `npm run typecheck`.
- **Say it:** "The types make the screen handle every outcome. Forget the error case and it won't build."

### Your data stays in your browser

The key, the story bank, the model you picked and the role you picked are stored in the browser's local storage. Nothing goes anywhere until you press Grade, and then the question, the answer and the story bank go to Anthropic only. Every piece of text from the answer or the model reaches the page through `textContent`, never `innerHTML`, so a reply with HTML in it shows as text.

- **See it:** `load()` and `save()` in `main.ts`, and `make()` in `src/ui/report.ts`.
- **Say it:** "No backend. The key and the stories never leave the device except in the one request to the model provider, and nothing from the model is ever treated as HTML."

### CI/CD

CI means a robot runs the tests on every push to main and every pull request. CD means that if they pass on main, the robot also deploys. The tests use the mocked API, so CI needs no secrets at all.

- **See it:** [`.github/workflows/ship.yml`](../.github/workflows/ship.yml), and the **Actions** tab on GitHub.
- **Say it:** "Main is always deployable, and the pipeline has no secrets in it to leak."

## 3. Where things live

| You want to change... | Open this |
| --- | --- |
| What the model is told | `SYSTEM_PROMPT` in `src/core/prompt.ts` (bump `PROMPT_VERSION`) |
| Which models are offered, or the default | `MODELS` and `DEFAULT_MODEL` in `src/core/prompt.ts` |
| The reply's shape | `GRADE_SCHEMA` and `validateModelGrade()` in `src/core/schema.ts` |
| The 40% and 30% rules | `SETUP_MAX` and `ACTION_MIN` in `src/core/score.ts` |
| The minimum answer length before grading | `MIN_WORDS_TO_GRADE` in `src/core/score.ts` |
| The speaking pace (150 words a minute) | `WORDS_PER_MINUTE` in `src/core/speaking.ts` |
| The 1:00 to 2:00 window | `TARGET` in `src/core/speaking.ts` |
| Which number words count | `WORDS` in `src/core/numbers.ts` |
| The questions | `BANK` in `src/core/questions.ts` |
| Anything the grader says | `src/core/words.ts` |
| The demo round | `DEMO_ROUNDS` in `src/core/demo.ts` |
| The API address, version or headers | `src/api/anthropic.ts` |
| How a grade is drawn | `src/ui/report.ts` |
| A colour or a font | `src/styles/brand.css` |
| Layout and spacing | `src/styles/app.css` |
| The boxes on the page | `index.html` |
| The eval answers | `evals/cases.json` |

## 4. When something breaks

| What you see | Likely cause | Where to look | How to check |
| --- | --- | --- | --- |
| "Anthropic did not accept that key" | The key is wrong, revoked, or has a space in it | The Claude Console | Paste the key again. The page refuses keys with spaces before saving. |
| "The API turned this request down" | A model name changed, or the request shape did | `MODELS` in `prompt.ts`, `buildRequest()` | Pick another model in the menu. If all fail, read the API docs' model list and the structured outputs page. |
| "The reply didn't match the grading format" | The model's JSON missed the schema | `validateModelGrade()` | Write the reply as a test in `grade.test.ts` with a fake `send`. The validator's error says which field. |
| A grade looks wrong | The model misfiled a sentence, or a rule is off | `score.ts` first | Turn it into an eval case with the checks you expected and run `npm run evals`. If the model's excerpts were right, write a unit test for `scoreAnswer()`. |
| The rewrite never shows up | It keeps adding numbers | `inventedNumbers()` in `numbers.ts` | The page names the numbers. If they were yours, written differently ("two hundred" vs "200"), it's a number-matching gap: add a test. |
| Nothing happens on Grade, console says CORS | The browser-access header is missing | `makeSend()` in `api/anthropic.ts` | The request must carry `anthropic-dangerous-direct-browser-access: true`. |
| Stories gone | Browser data cleared, or a private window | Nothing to fix in code | Export the bank now and then. Import puts it back. |
| Import says "not a story bank export" | The file was edited or is from another app | `importStories()` in `stories.ts` | The file needs `"format": "interview-room/stories"` and `"version": 1`. |
| Green check, but no website | The repo is private, so deploy is skipped on purpose | `ship.yml` | Make the repo public, set Pages to **GitHub Actions**, run the workflow once. |
| Red X on a commit | A test or the build failed | **Actions** tab, the red run | The log names the failing test. Nothing was deployed. |

**The habit that matters:** reproduce it as a test first. For a grading problem that means an eval case. For a code problem it means a unit test with a fake `send`.

## 5. Your turn

Five real changes, easiest first. You can do all of them in the browser: open the repo on GitHub and press the `.` key. That opens an editor. Change the file, then commit from the Source Control panel on the left. The robot runs the tests; watch the Actions tab.

1. **Add a question.** In `src/core/questions.ts`, add a ninth question to the `tam` list in `BANK`, in your own words, with no digits in it. *Done when:* CI goes red on the two tests that expect eight questions a family. Read the log, then decide: swap the question for one of the eight instead, or add a ninth to every family and change those tests to nine.
2. **Change the pace.** Set `WORDS_PER_MINUTE` in `speaking.ts` to `130` and push. CI goes red on the tests that pin 150, and the eval cases all still pass: at 130 every sample answer stays on the same side of the window. Now try `90`. *Done when:* you've seen two eval cases fail, `ready-named-outcome` and `close-long-setup`, because at that pace their answers run past two minutes. That's the eval set noticing a rule change. Change it back.
3. **Write an eval case.** Add one of your real answers to `evals/cases.json`, with an `id` starting with its band (`ready-`, `close-` or `rework-`), a `why`, and the three `checks` you expect. *Done when:* `npm test` passes. If it fails, the CI check has told you your expected length or evidence doesn't match the answer you wrote.
4. **Change a rule.** Set `SETUP_MAX` in `score.ts` to `0.35`. *Done when:* the two tests that pin 40% fail ("are 40% for setup and 30% for action", and "measures each part as a share of the words", whose example sits exactly on 40%), you update them, and the How it grades section on the live page says 35% without you touching `index.html`.
5. **Change the prompt, and measure it.** With your own key, run `ANTHROPIC_API_KEY=sk-ant-... npm run evals` and save the table. Then change rule 4 in `SYSTEM_PROMPT` to ask for two fixes instead of one, set `PROMPT_VERSION` to `2`, and run it again. *Done when:* you have two tables side by side and can say whether version 2 is better, worse or the same, and why. This is the one to talk through with Claude; ask it to explain the difference before you keep or revert the change.

## 6. Questions you should be ready for

**Why not just ask the model for a score?**
Because the same answer would get different scores on different days, nobody could say why, and a prompt change would move every score with no way to tell if it got better. The model reads; code counts. The grade is reproducible from the model's excerpts.

**How do you stop the model making things up?**
Three layers. The prompt says only use the candidate's facts and mark gaps in brackets. The schema stops it adding fields. And code checks every quoted sentence is really in the answer, and throws away any rewrite with a number the candidate didn't write.

**How do you know a prompt change made it better?**
The eval set. Eleven answers with known expected checks, run before and after. CI also checks the eval cases themselves, so a broken case can't make a run lie.

**Isn't putting an API key in a browser dangerous?**
It would be for a key that belongs to the website. This is the user's own key, on their own device, sent only to Anthropic. It's stored in local storage, never in a link or an export file, and one button removes it. The API makes the browser opt in with a header named "dangerous" for exactly this reason.

**What happens with no key, or no signal?**
The demo round. An invented candidate and two scripted model replies, clearly labelled as scripted, run through the real grader. A service worker saves the app on the first visit, so the demo opens offline.

**How do you test it without paying for API calls?**
`gradeAnswer()` takes the network call as a parameter. The tests pass a fake that returns any reply they want.

**What did the AI do, and what did you do?**
Say it straight: Claude wrote most of the code as a pair programmer. You chose the problem, made the product decisions, reviewed the changes and can walk through any file. Then walk through `score.ts`.

## 7. Words you'll hear

| Word | Plain meaning |
| --- | --- |
| LLM | Large language model: the kind of AI that reads and writes text |
| Prompt | The instructions sent to the model with each request |
| System prompt | The part of the prompt that sets the rules, the same for every request |
| Structured output | Asking the API to force the reply into a given JSON shape |
| JSON schema | A description of a JSON shape: which fields, what type each one is |
| Eval | A test for a prompt: known inputs, expected outputs, a pass rate |
| Token | The unit models read and write in, roughly a short word. Usage is billed by token. |
| CORS | The browser rule that stops a page reading replies from another site unless that site says it may |
| Prompt injection | Text in the input that tries to give the model new instructions |
| Repo, commit, push, branch, PR | As in Mol-Bhav Meter's notes: the project, one saved change, send to GitHub, a parallel copy, a request to merge |
| CI / CD | Robot runs the tests / robot deploys if they pass |
| STAR | Situation, Task, Action, Result: the usual shape for a behavioural answer |
