// Spoken-number normalization. Converts word-numbers ("twenty two",
// "one hundred and five") into digits so the reference regex only needs
// to match \d{1,3}.

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const UNITS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

export function normalizeNumbers(text: string): string {
  let result = text;
  result = result.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/gi,
    (_, tens: string, units: string) =>
      String(TENS[tens.toLowerCase()]! + UNITS[units.toLowerCase()]!),
  );
  result = result.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+and\s+)?(?:(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(one|two|three|four|five|six|seven|eight|nine))?)?\b/gi,
    (_, hundreds: string, tens: string | undefined, units: string | undefined) => {
      let n = UNITS[hundreds.toLowerCase()]! * 100;
      if (tens) n += TENS[tens.toLowerCase()]!;
      if (units) n += UNITS[units.toLowerCase()]!;
      return String(n);
    },
  );
  result = result.replace(
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/gi,
    (m) => String(NUMBER_WORDS[m.toLowerCase()] ?? m),
  );
  return result;
}