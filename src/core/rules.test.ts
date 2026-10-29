import { expect, test } from "vitest";
import { RULES } from "./index";

// Every rule ID #6's value and badge tables name, ranges such as BR-2..6 expanded, plus
// those named in their When columns and the text beside them. From 1.0.0 Test files pin
// rule IDs, so the catalogue is a public contract (ADR 0002).
const valueTable = [
  ...["EV-0", "EV-1", "EV-6", "BR-2", "BR-3", "BR-4", "BR-5", "BR-6", "BR-10"],
  ...["PA-1", "PA-2", "PA-3", "PA-7", "GL-1", "GL-2", "GL-3", "GL-4"],
  ...["DB-2", "DB-3", "DB-4", "FK-0", "FK-2", "FK-6", "FK-7", "FK-8"],
  ...["PRT-2", "PRT-3", "PRT-4", "PRT-5", "PL-10", "SK-1"],
  ...["WN-1", "WN-3", "WN-4", "WN-5"],
  ...["PA-5", "PA-6", "BR-8", "BR-9", "GL-6"],
  ...["JG-1", "JG-2", "JG-3", "JG-11", "CO-1", "CO-2", "CO-3", "CO-4", "CO-5"],
  ...["PERM-1", "PERM-2", "PERM-3", "PERM-4", "PERM-5", "PERM-6", "PERM-7"],
  ...["PERM-8", "RU-1"],
  ...["CC-1", "CC-2", "CC-3", "CC-4", "CC-5", "CC-6", "CC-7", "CC-8", "CC-9"],
  "CC-11",
];
const badgeTable = [
  ...["RQ-0", "RQ-1", "RQ-2", "RQ-3", "RQ-4", "RQ-6", "RQ-8", "RQ-9", "RQ-10"],
  ...["BR-10", "JG-1", "JG-11", "CO-1", "PRT-5", "WN-1", "PA-4"],
];

test.each([...new Set([...valueTable, ...badgeTable])])(
  "%s, named in #6's value or badge table, has a catalogue entry",
  (id) => {
    expect(RULES[id]?.id).toBe(id);
  },
);
