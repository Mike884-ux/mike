/** Ready-made questions for the AI chat; a few are shown at a time, reshuffled on demand. */
import type { MessageKey } from "./i18n";

export const CHAT_IDEAS: MessageKey[] = [
  "chat.q1",
  "chat.q2",
  "chat.q3",
  "chat.q4",
  "chat.q5",
  "chat.q6",
  "chat.q7",
  "chat.q8",
  "chat.q9",
  "chat.q10",
  "chat.q11",
  "chat.q12",
];

/** `count` different ideas, avoiding the ones on screen now when possible. */
export function pickIdeas(count: number, current: MessageKey[] = []): MessageKey[] {
  const fresh = CHAT_IDEAS.filter((key) => !current.includes(key));
  const pool = fresh.length >= count ? fresh : CHAT_IDEAS;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}
