import type { ProofreadingRule } from "../../domain/proofreading";
import { createRuleRegistry } from "../registry/registry";
import { cons002 } from "./consistency/cons002";
import { punc001 } from "./punctuation/punc001";
import { punc002 } from "./punctuation/punc002";
import { punc003 } from "./punctuation/punc003";
import { punc004 } from "./punctuation/punc004";
import { space001 } from "./spacing/space001";
import { space002 } from "./spacing/space002";
import { space003 } from "./spacing/space003";
import { space004 } from "./spacing/space004";
import { space005 } from "./spacing/space005";
import { space006 } from "./spacing/space006";
import { typo003 } from "./typography/typo003";

export const initialRules: readonly ProofreadingRule[] = [
  space001,
  space002,
  space003,
  space004,
  space005,
  space006,
  punc001,
  punc002,
  punc003,
  punc004,
  cons002,
  typo003,
];

export const defaultRegistry = createRuleRegistry(initialRules);

export { cons002, punc001, punc002, punc003, punc004, space001, space002, space003, space004, space005, space006, typo003 };
