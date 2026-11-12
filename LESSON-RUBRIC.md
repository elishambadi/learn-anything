# Lesson Rubric

The contract for a generated lesson. It is derived from the five reference
cards in `lessons-samples/` and is the source of truth for
`src/ai/schemas.ts` (shape), `src/ai/prompts/lesson.ts` (generation), and
`src/quiz/lint.ts` (validation).

A lesson is a **three-to-five-minute learning page**, not an article and not a
summary of everything. One card, one idea, one argument.

## 1. Lesson structure

Every lesson renders these blocks in this order:

```
1. HERO           one topical image, full width, no caption
2. PROMISE        one sentence (the angle), plus objectives and concepts
3. BODY           2-3 sections, each: heading + short paragraph + one visual
4. PRACTICAL      real-world card: scenario, optional link/code, "try this"
5. CLOSE          boundary ("when not to use this") or summary (final lesson)
6. QUIZ           1-2 inline checks + at least 2 final questions
```

Rules:

- **One concept per card.** The course outline title is the module label; the
  `promise` is the lesson's angle and must not repeat the title.
- **Open with a limitation or cost**, not a definition. Context → what fails →
  the better pattern → how it works → trace or tool → caveat.
- **2-3 sections only.** More than three turns a lesson into an article.
- **One visual per section.** Text + visual + takeaway, never text + text +
  text + visual.
- **The close is a decision aid.** Mid-course lessons close with a boundary;
  the final lesson of a unit or course closes with a summary.
- **Delete test.** If removing a section loses no concept, it should not exist.

## 2. Page components

The closed visual vocabulary. `kind` is part of the schema, so the model
chooses a structure instead of defaulting to prose.

| Kind | Use for | Shape | Limits |
|---|---|---|---|
| `table` | contrasting two approaches | first column = dimension | 2-3 cols, 2-4 rows, 2-6 words/cell |
| `steps` | a process or lifecycle | numbered cards | 3-4 items, ≤45 words each |
| `roles` | two contrasting roles | side-by-side cards | exactly 2, ≤45 words each |
| `accordion` | parallel optional details | expandable items | 3-4 items, ≤45 words each |
| `tabs` | mutually exclusive alternatives | tab headers + panel | 2-3 items, ≤45 words each |
| `code` | the actual contract or callback | language-tagged block | ≤12 lines, intent comments |
| `bullets` | short summary points | checked list | 3-5 items |
| `none` | paragraph is clearer | no extra markup | at most 1 section |

Hard rules:

- **At least one `table` per lesson.** This is the comparison the learner
  should leave with.
- **Never repeat a visual kind in consecutive sections.**
- **Accordion = parallel, tabs = exclusive, steps = ordered.** Models pick the
  wrong one when the prompt does not say so.
- Lists are promoted into components. Only a final synthesis keeps plain
  bullets.
- A code block must illustrate the section it sits in, not be a full program.

## 3. Language type and usage

Register: technical expository + instructional + scenario narrative. Not
academic, not marketing, not reference documentation.

| Dimension | Rule |
|---|---|
| Voice | "we" for the shared journey, "you/your" for the learner's code, imperative for rules |
| Tense | present, active; past tense only for event names (`invoice_paid`) |
| Sentence | 12-18 words target, 25 hard ceiling |
| Paragraph | 1-4 sentences, 60-word hard ceiling, one claim each |
| Terms | define in one clause at first use: "Handlers must be **idempotent**, meaning..." |
| Identifiers | inline `code` for names, paths, callbacks, topics |
| Metaphor | at most one per lesson, in quotes |
| Numbers | concrete values, never vague quantities |
| Glue | "Because...", "If...", "Instead..." — explain why, not just what |
| Hedging | near zero; express uncertainty as a trade-off |

Banned openers and furniture:

- "In this lesson we will..."
- "Now that we've seen..."
- "It is important to note..."
- "In conclusion..." / "Let's dive in"
- Headings: "Introduction", "Overview", "Key Points", "Conclusion", "Summary"
  (except a closing with a concrete phrase such as "Course Summary").

Required:

- **One consequence sentence** per lesson: what breaks if the learner ignores
  the idea. This is what makes it teaching rather than description.
- **Concrete headings**: a mechanism, taxonomy, failure, lifecycle, boundary,
  or synthesis. Two to six words.

## 4. Real-world implementation

Real world is a mode of argument, not a link at the bottom. Use at least two of:

1. **Named system** — a real tool, library, product, or industry workflow.
2. **Actor + numbers scenario** — who acts, with what values, under what load.
3. **Worked trace** — walk the rule one step at a time with real values.
4. **Trade-off framing** — what you gain, what you pay. Tables are the home
   for this.
5. **Counter-example / boundary** — when the idea is the wrong choice.

Requirements:

- One concrete scenario of 40-90 words after the mechanism.
- A stable link (official docs, MDN, Wikipedia) or `null`. Never invent a URL.
- Optional code snippet tied to the current concept, ≤12 lines.
- A "try this" action doable in under ten minutes, one sentence.
- One stated cost or failure: a duplicate charge, a full mailbox, a spinning
  loader, a stale balance.

## 5. Article structure

Within a lesson:

```
context (what we already do)
  → its failure or cost
    → the better pattern
      → how it works (visual)
        → real trace or tool
          → caveat or decision rule
```

Across a course: one mechanism per lesson, cumulative, with the final lesson
synthesizing. Never two new mechanisms in one card, and never a survey lesson.

**Article vs lesson test:** an article explains everything about a topic; a
lesson changes what the learner can do in five minutes. If a section could move
to another lesson without loss, it belongs there.

## 6. Hard gates

Shape and grounding failures trigger a repair call. Style and length warnings
are logged only.

| Gate | Rule | Enforcement |
|---|---|---|
| G1 | Hero image query, 2-5 keywords | schema |
| G2 | Promise 12-25 words, one sentence, an outcome | schema + soft lint |
| G3 | 2-3 sections, concrete 2-6 word headings | schema + hard lint |
| G4 | At least one `table`; no repeated consecutive visual kind | hard lint |
| G5 | One visual per section; at most one `none` | schema + hard lint |
| G6 | Body prose 160-240 words; total visible 320-420 | soft lint |
| G7 | Each section body 35-90 words | soft lint |
| G8 | Closing present: `boundary` or `summary`, 25-70 words | schema + soft lint |
| G9 | No meta-framing openers; sentence ≤25 words; paragraph ≤60 | soft lint |
| G10 | Real-world scenario + stable link or null + try-this | schema + lint |
| G11 | 4-6 questions: 1-2 inline, ≥2 final, ≥2 types | schema + hard lint |
| G12 | Every answer and order item stated verbatim in lesson text | hard lint |
| G13 | No negated stems, all/none-of-the-above, implausible distractors | hard lint |
| G14 | Order questions only when `has_sequence` is true | hard lint |

## 7. Schema map

```ts
Lesson {
  promise            string                  // G2
  hero_image_query   string                  // G1
  focus_concept_ids  string[]                // 1-3 course concepts
  sections           LessonSection[]         // G3-G7
  closing            LessonClosing           // G8
  real_world         RealWorld               // G10
  questions          Question[]              // G11-G14
}

LessonSection {
  heading            string                  // 2-6 concrete words
  body_markdown      string                  // 35-90 words
  visual             SectionVisual           // one of 8 kinds
}

LessonClosing {
  kind               "summary" | "boundary"
  heading            string
  body_markdown      string                  // 25-70 words
}
```

Storage: `lessons.sections_json` and `lessons.closing_json` hold the structured
page. `lessons.summary` stores the promise for backward compatibility, and
`lessons.content_md` keeps a flattened Markdown copy for export and readiness
checks. Rows generated before this rubric have no sections and render through
the legacy comparison + Markdown path.

## 8. Reference measurements

The five samples in `lessons-samples/` land at 391-422 visible words each,
with 2-3 body sections, one visual per section, and about 400 words of reading
per card. The budget above preserves that density while leaving room for a
short quiz.
