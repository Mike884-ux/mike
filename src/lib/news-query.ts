export const HEADLINES_QUERY = `
  query Headlines($base: String) {
    headlines(base: $base) {
      title
      source
      url
    }
  }
`.trim();

export function headlinesQueryExample(base = "BTC") {
  return `query Headlines {
  headlines(base: "${base}") {
    title
    source
    url
  }
}`;
}
