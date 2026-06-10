export type CsvRow = Record<string, string>;

function detectDelimiter(line: string) {
  const commaCount = (line.match(/,/g) ?? []).length;
  const semicolonCount = (line.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current.trim());
  return out;
}

export function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = parseLine(line, delimiter);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}