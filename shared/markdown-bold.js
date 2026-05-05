const BOLD_REPLACE_PATTERN = /\*\*([^*]+)\*\*/g;
const BOLD_SPLIT_PATTERN = /(\*\*[^*]+\*\*)/g;

export function applyBoldHtml(text) {
  if (!text) return "";
  return text.replace(BOLD_REPLACE_PATTERN, "<strong>$1</strong>");
}

export function splitByBold(text) {
  if (!text) return [""];
  return text.split(BOLD_SPLIT_PATTERN);
}

export function isBoldToken(s) {
  return typeof s === "string" && s.startsWith("**") && s.endsWith("**") && s.length >= 4;
}

export function stripBoldDelimiters(s) {
  return s.slice(2, -2);
}
