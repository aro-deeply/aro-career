import React from "react";
import {
  splitByBold,
  isBoldToken,
  stripBoldDelimiters,
} from "../../shared/markdown-bold.js";

export const BOLD_DEFAULT_CLASS = "font-bold text-neutral-900";
export const BOLD_HIGHLIGHT_CLASS = "font-bold text-neutral-900 bg-yellow-100 px-1";

export function renderMarkdownBold(text, className = BOLD_DEFAULT_CLASS) {
  if (!text) return null;
  return splitByBold(text).map((part, i) =>
    isBoldToken(part) ? (
      <strong key={i} className={className}>
        {stripBoldDelimiters(part)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
