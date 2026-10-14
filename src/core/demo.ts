/**
 * The demo, for anyone without a key (and for when there is no signal).
 *
 * Honest labelling matters here, so to be exact about what this is:
 *   - The candidate is invented. The answers were written for this demo.
 *   - The model replies below were written by hand in the shape the API returns.
 *     They are scripted, not recorded from a real model call.
 *   - Everything after the reply is the real app: the same readReply(), schema check,
 *     scoring and number check that grade a live answer. The demo runs gradeAnswer()
 *     with a fake send() that hands back these scripted replies.
 *
 * Round 2's scripted rewrite slips in a number the candidate never said,
 * so the demo shows the "no invented numbers" check doing its job.
 */

import type { Reply, Send } from './grade';
import type { ModelGrade } from './schema';

export interface DemoRound {
  family: string;
  question: string;
  answer: string;
  modelGrade: ModelGrade;
  note: string;
}

export const DEMO_CANDIDATE = 'Sample candidate (invented)';

export const DEMO_ROUNDS: readonly DemoRound[] = [
  {
    family: 'Technical account manager',
    question: 'Tell me about an account that was at risk of leaving. What did you do?',
    answer:
      'Last spring I looked after a logistics customer whose renewal was three months out, and their usage had dropped by half since January. ' +
      'My job was to find out why before the renewal call and give them a reason to stay. ' +
      'I pulled their support history and found 14 tickets about slow report exports, all closed without a fix. ' +
      'I booked a call with their operations lead, admitted we had missed the pattern, and asked her to show me the export on screen. ' +
      'Then I took a recording of it to our engineering team and got the export bug onto the next release. ' +
      'While we waited, I set up a weekly check-in and wrote them a workaround that cut export time from 20 minutes to 4. ' +
      'The fix shipped five weeks later. ' +
      'They renewed for two years, and by the end of the quarter their usage was back above where it had been in January.',
    modelGrade: {
      situation: [
        'Last spring I looked after a logistics customer whose renewal was three months out, and their usage had dropped by half since January.',
      ],
      task: ['My job was to find out why before the renewal call and give them a reason to stay.'],
      action: [
        'I pulled their support history and found 14 tickets about slow report exports, all closed without a fix.',
        'I booked a call with their operations lead, admitted we had missed the pattern, and asked her to show me the export on screen.',
        'Then I took a recording of it to our engineering team and got the export bug onto the next release.',
        'While we waited, I set up a weekly check-in and wrote them a workaround that cut export time from 20 minutes to 4.',
      ],
      result: [
        'The fix shipped five weeks later.',
        'They renewed for two years, and by the end of the quarter their usage was back above where it had been in January.',
      ],
      named_outcome: true,
      coaching:
        'Say what was at stake in one phrase, such as the size of the account. Right now the listener has to guess why this renewal mattered.',
      rewrite:
        'A logistics customer was three months from renewal, and their usage had dropped by half since January. I had to find out why before the renewal call. ' +
        'In their support history I found 14 tickets about slow report exports, all closed without a fix. I called their operations lead, admitted we had missed the pattern, and watched the export run on her screen. ' +
        'I took a recording to our engineering team and got the bug onto the next release. Meanwhile I wrote a workaround that cut export time from 20 minutes to 4 and held a weekly check-in. ' +
        'The fix shipped five weeks later. They renewed for two years, and by the end of the quarter usage was above January levels. [What the account was worth to the business.]',
    },
    note: 'A complete answer: all four parts, a number, and about a minute to say.',
  },
  {
    family: 'Race or trackside engineer',
    question: 'Tell me about a time you improved a process by measuring it first.',
    answer:
      'At my last job our weekly report took ages to put together. ' +
      'I decided to look at where the time actually went. ' +
      'I timed each step for a couple of weeks and found that most of it was copying data between spreadsheets by hand. ' +
      'I wrote a small script to do the copying and showed the team how to run it. ' +
      'After that the report was much quicker and people were happier with it.',
    modelGrade: {
      situation: ['At my last job our weekly report took ages to put together.'],
      task: ['I decided to look at where the time actually went.'],
      action: [
        'I timed each step for a couple of weeks and found that most of it was copying data between spreadsheets by hand.',
        'I wrote a small script to do the copying and showed the team how to run it.',
      ],
      result: ['After that the report was much quicker and people were happier with it.'],
      named_outcome: false,
      coaching:
        'You measured it, so say the measurement. How long did the report take before the script, and how long after?',
      rewrite:
        'Our weekly report took 3 hours to put together, so I timed every step for a couple of weeks. Most of the time went on copying data between spreadsheets by hand. ' +
        'I wrote a small script to do the copying and showed the team how to run it. The report went from 3 hours to 20 minutes.',
    },
    note: 'This scripted rewrite slips in "3 hours" and "20 minutes". The candidate never said either, so the check throws the rewrite away.',
  },
];

/** A fake send() that returns a round's scripted reply in the API's own shape. */
export function scriptedSend(round: DemoRound): Send {
  return async (): Promise<Reply> => ({
    status: 200,
    body: {
      type: 'message',
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(round.modelGrade) }],
    },
  });
}
