/**
 * The only file that talks to the network.
 *
 * It sends one grading request to Anthropic's Messages API, straight from the browser,
 * with the key the user pasted. There is no server of ours in between.
 *
 * Headers, checked against the API docs and a live CORS preflight on 2026-10-14:
 *   x-api-key                                  the user's key
 *   anthropic-version: 2023-06-01              the API version this code was written for
 *   anthropic-dangerous-direct-browser-access  without it, the API does not send the CORS header
 *                                              and the browser blocks the reply. The "dangerous"
 *                                              is about the key being visible to the page: fine
 *                                              when it is your own key on your own device.
 */

import type { Reply, Send } from '../core/grade';

export const API_URL = 'https://api.anthropic.com/v1/messages';
export const API_VERSION = '2023-06-01';
const TIMEOUT_MS = 90_000;

export function makeSend(apiKey: string, fetchImpl: typeof fetch = fetch): Send {
  return async (body): Promise<Reply> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        // Never send cookies, never let a cached reply stand in for a grade.
        credentials: 'omit',
        cache: 'no-store',
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { status: response.status, body: json };
    } finally {
      clearTimeout(timer);
    }
  };
}
