/*!
 * A TypeScript port of nektos/act's pkg/workflowpattern (workflow_pattern.go at 2b8b3d6).
 *
 * MIT License
 *
 * Copyright (c) 2019
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Changes from the Go: the trace writer becomes the index of the deciding pattern, errors
// are listed in position order, and `flags` lets the caller ask the GL-6 case question.

export interface WorkflowPattern {
  pattern: string;
  negative: boolean;
  regex: RegExp;
}

const quoteMeta = (s: string) => s.replace(/[\\.+*?()|[\]{}^$]/g, "\\$&");

/** Compiles one filter pattern; throws an Error naming the pattern when it is invalid. */
export function compilePattern(raw: string, flags = ""): WorkflowPattern {
  const negative = raw.startsWith("!");
  const pattern = negative ? raw.slice(1) : raw;
  const source = patternToRegex(pattern);
  let regex: RegExp;
  try {
    regex = new RegExp(source, flags);
  } catch {
    throw new Error(`invalid Pattern '${pattern}'`);
  }
  return { pattern, negative, regex };
}

export function patternToRegex(pattern: string): string {
  let r = "^";
  let pos = 0;
  const errors = new Map<number, string>();
  const validChar = (a: string, b: string, test: string | undefined) =>
    test !== undefined && test >= a && test <= b;
  while (pos < pattern.length) {
    const c = pattern[pos]!;
    switch (c) {
      case "*":
        if (pattern[pos + 1] === "*") {
          if (pattern[pos + 2] === "/") {
            r += "(.+/)?";
            pos += 3;
          } else {
            r += ".*";
            pos += 2;
          }
        } else {
          r += "[^/]*";
          pos++;
        }
        break;
      case "+":
      case "?":
        r += pos > 0 ? c : quoteMeta(c);
        pos++;
        break;
      case "[": {
        r += c;
        pos++;
        if (pattern[pos] === "]") {
          errors.set(pos, "Unexpected empty brackets '[]'");
          pos++;
          break;
        }
        const startPos = pos;
        while (pos < pattern.length && pattern[pos] !== "]") {
          const d = pattern[pos]!;
          if (d === "-") {
            if (pos <= startPos || pos + 1 >= pattern.length) {
              errors.set(pos, "Invalid range");
              pos++;
              continue;
            }
            const before = pattern[pos - 1]!;
            const after = pattern[pos + 1]!;
            const validRange = (a: string, b: string) =>
              validChar(a, b, before) &&
              validChar(a, b, after) &&
              before <= after;
            if (!validRange("A", "z") && !validRange("0", "9")) {
              errors.set(pos, "Ranges can only include a-z, A-Z, A-z, and 0-9");
              pos++;
              continue;
            }
            r += pattern.slice(pos, pos + 2);
            pos += 2;
          } else {
            if (!validChar("A", "z", d) && !validChar("0", "9", d)) {
              errors.set(pos, "Ranges can only include a-z, A-Z and 0-9");
              pos++;
              continue;
            }
            r += quoteMeta(d);
            pos++;
          }
        }
        if (pos >= pattern.length || pattern[pos] !== "]") {
          errors.set(pos, "Missing closing bracket ']' after '['");
          pos++;
        }
        r += "]";
        pos++;
        break;
      }
      case "\\":
        if (pos + 1 >= pattern.length) {
          errors.set(pos, "Missing symbol after \\");
          pos++;
          break;
        }
        r += quoteMeta(pattern[pos + 1]!);
        pos += 2;
        break;
      default:
        r += quoteMeta(c);
        pos++;
    }
  }
  if (errors.size > 0) {
    const list = [...errors]
      .sort(([a], [b]) => a - b)
      .map(([at, err]) => `Position: ${at} Error: ${err}`);
    throw new Error(`invalid Pattern '${pattern}': ${list.join(", ")}`);
  }
  return r + "$";
}

export function compilePatterns(
  patterns: readonly string[],
  flags = "",
): WorkflowPattern[] {
  return patterns.map((p) => compilePattern(p, flags));
}

/** The ref name a filter is tried against, and which pattern decided. */
export interface Decision {
  skip: boolean;
  /** Index of the deciding pattern, or -1 when none matched. */
  by: number;
}

/** `branches`/`tags`/`paths` for one input: the last matching pattern wins. */
export function skip(sequence: WorkflowPattern[], input: string): Decision {
  if (sequence.length === 0) return { skip: false, by: -1 };
  let matched = false;
  let by = -1;
  sequence.forEach((item, i) => {
    if (item.regex.test(input)) {
      matched = !item.negative;
      by = i;
    }
  });
  return { skip: !matched, by };
}

/** `branches-ignore`/`tags-ignore`/`paths-ignore` for one input: the first pattern that ignores it. */
export function filter(sequence: WorkflowPattern[], input: string): Decision {
  const by = sequence.findIndex(
    (item) => item.regex.test(input) === !item.negative,
  );
  return { skip: by >= 0, by };
}
