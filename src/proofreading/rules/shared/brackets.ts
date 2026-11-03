export interface UnbalancedBrackets {
  /** Indices of closing characters without a matching opener. */
  unmatchedClose: number[];
  /** Indices of opening characters without a matching closer. */
  unmatchedOpen: number[];
}

/**
 * Stack-based scan over the whole text. A closer for which `isExemptCloser` is true is
 * ignored (neither pops nor is reported), e.g. list enumerators such as "1)".
 */
export function findUnbalancedBrackets(
  text: string,
  open: string,
  close: string,
  isExemptCloser: (index: number) => boolean = () => false,
): UnbalancedBrackets {
  const stack: number[] = [];
  const unmatchedClose: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) stack.push(i);
    else if (ch === close) {
      if (stack.length > 0) stack.pop();
      else if (!isExemptCloser(i)) unmatchedClose.push(i);
    }
  }
  return { unmatchedClose, unmatchedOpen: stack };
}
