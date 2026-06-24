import {
  turnNeedsDialogueAttribution,
} from "../src/lib/chat/resolveDialogueAttribution.ts";

const withQuotes = turnNeedsDialogueAttribution(
  'Er sagte „Hallo" und ging.',
  "de",
);
if (!withQuotes) throw new Error("quotes should need attribution");

const plain = turnNeedsDialogueAttribution("Der Wind weht.", "de");
if (plain) throw new Error("plain prose should not need attribution");

console.log("turnNeedsDialogueAttribution ok");
