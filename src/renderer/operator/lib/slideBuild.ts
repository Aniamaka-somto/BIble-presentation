import type { Slide, SlideBlock } from "../../../shared/types";

// ---------------------------------------------------------------
// Slide builders. Verse text -> declarative slide scenes rendered
// by the shared slide engine. Stacking reproduces the operator's
// "first slide + this slide" semantics: an S1 ground slide plus an
// S2 foreground slide, with numbered flows for consecutive runs,
// comma-lists for same-chapter picks, and blocked sections across
// books.
// ---------------------------------------------------------------

export interface StackItem {
  ref: string;
  text: string;
}

interface ParsedRef {
  book: string;
  chapter: number;
  verse: number;
}

function parseRef(ref: string): ParsedRef {
  const m = String(ref).trim().match(/^(.+?)\s+(\d+):(\d+)$/);
  if (!m) return { book: String(ref), chapter: 0, verse: 0 };
  return { book: m[1], chapter: Number(m[2]), verse: Number(m[3]) };
}

const pad = (n: number) => String(n).padStart(2, "0");

function rangeLabel(list: StackItem[]): string {
  const first = parseRef(list[0].ref);
  const verses = list.map((i) => parseRef(i.ref).verse);
  const consecutive = verses.every((v, i) => i === 0 || v === verses[i - 1] + 1);
  if (consecutive) {
    return `${first.book} ${first.chapter}:${verses[0]}\u2013${verses[verses.length - 1]}`;
  }
  return `${first.book} ${first.chapter}:${verses.join(",")}`;
}

export function verseSlide(
  ref: string,
  text: string,
  opts?: { index?: string | number; translation?: string }
): Slide {
  const num =
    opts?.index !== undefined && opts.index !== "" ? Number(opts.index) : undefined;
  const blocks: SlideBlock[] = [
    {
      ref,
      parts: num !== undefined ? [{ text, num }] : [{ text }],
      translation: opts?.translation,
    },
  ];
  return {
    label: ref,
    refs: [ref],
    blocks,
    theme: "default",
    layout: "single",
  };
}

function flowBlocks(
  label: string,
  rows: { verse: number; text: string; suffix?: string }[]
): SlideBlock[] {
  return rows.map((r) => ({
    ref: r.suffix ? `${label}  ${r.suffix}` : label,
    parts: [{ text: r.text, num: r.verse }],
  }));
}

interface ConGroup {
  book: string;
  chapter: number;
  vers: string; // comma-joined run list, e.g. "1,4-6"
  items: StackItem[]; // book-sorted, verse order, with sentences
}

function buildConList(list: StackItem[]): ConGroup[] {
  const books = [...new Set(list.map((i) => parseRef(i.ref).book))];
  const groups: ConGroup[] = [];
  for (const book of books) {
    let run = list
      .filter((i) => parseRef(i.ref).book === book)
      .map((i) => ({ ...i, parsed: parseRef(i.ref) }));
    run = run
      .filter((i) => !!i.text.trim())
      .slice()
      .sort((a, b) => a.parsed.verse - b.parsed.verse);
    if (!run.length) continue;
    let lo = 0;
    const segs: (typeof run)[] = [];
    for (let i = 1; i < run.length; i++) {
      if (run[i].parsed.verse !== run[i - 1].parsed.verse + 1) {
        segs.push(run.slice(lo, i));
        lo = i;
      }
    }
    segs.push(run.slice(lo));
    const vers = segs
      .map((seg) => {
        const vs = seg.map((x) => x.parsed.verse);
        return vs.length === 1 ? String(vs[0]) : `${vs[0]}-${vs[vs.length - 1]}`;
      })
      .join(",");
    groups.push({ book, chapter: run[0].parsed.chapter, vers, items: run });
  }
  return groups;
}

const sortKey = (vers: string) =>
  vers
    .split(",")
    .map((numPart) =>
      numPart.includes("-") ? numPart.replace("-", ".") : numPart.padStart(2, "0")
    )
    .join(".");

/**
 * Two stacked verses -> two slides (S1 = first item, S2 = rest).
 * Three or more -> one ground slide "S1" (blocks for every book/day except
 * the last, as numbered flows / comma-lists) plus one foreground slide "S2"
 * built from the final group.
 */
export function stackSlide(list: StackItem[]): Slide {
  if (list.length < 2) {
    return verseSlide(list[0].ref, list[0].text);
  }

  const groups = buildConList(list).sort((a, b) =>
    sortKey(a.vers).localeCompare(sortKey(b.vers))
  );
  const total = groups.length;

  if (total === 2) {
    const [s1Group, s2Group] = groups;
    const s1: SlideBlock[] = [
      {
        ref: s1Group.vers.includes(",") || s1Group.items.length > 1
          ? `${s1Group.book} ${s1Group.chapter}:${s1Group.vers.replace(/-/g, "\u2013")}`
          : s1Group.items[0].ref,
        parts: s1Group.items.map((i) => ({
          text: i.text,
        })),
      },
    ];
    const s1Read = s1Group.items[0].ref;

    const s2Refs =
      s2Group.vers.includes(",") || s2Group.items.length > 1
        ? rangeLabel(s2Group.items)
        : s2Group.items[0].ref;
    const s2: SlideBlock[] = flowBlocks(s2Refs, [
      ...s2Group.items.map((i) => ({ verse: parseRef(i.ref).verse, text: i.text })),
    ]);

    return {
      label: rangeLabel(list),
      refs: [s1Read, ...s2Group.items.map((i) => i.ref)],
      blocks: [...s1, ...s2],
      theme: "default",
      layout: "single",
    };
  }

  // multi-book: ground slide with previous groups, foreground with the last
  const [last, ...prior] = [...groups].reverse();
  const priorBlocks: SlideBlock[] = prior.flatMap((g) => {
    const chapterLabel = `${g.book} ${g.chapter}:${g.vers.replace(/-/g, "\u2013")}`;
    const snippets = g.items
      .map((i) => i.text)
      .filter(Boolean)
      .join(" ")
      .slice(0, 140);
    return [
      {
        ref: chapterLabel,
        parts: [{ text: snippets }],
      },
    ];
  });

  const lastRefs =
    last.vers.includes(",") || last.items.length > 1
      ? rangeLabel(last.items)
      : last.items[0].ref;
  const lastBlocks: SlideBlock[] = flowBlocks(lastRefs, [
    ...last.items.map((i) => ({ verse: parseRef(i.ref).verse, text: i.text })),
  ]);

  return {
    label: rangeLabel(list),
    refs: list.map((i) => i.ref),
    blocks: [...priorBlocks, ...lastBlocks],
    theme: "default",
    layout: "single",
  };
}