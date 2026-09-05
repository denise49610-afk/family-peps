import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  flattenDays,
  parseTimeRange,
  parseTimetableSlots,
  parseTimetableText,
  coerceSlots,
  extractJsonObject,
  mergeAdjacentSlots,
} from "./parse-schedule.ts";

function subjectsOn(slots: ReturnType<typeof parseTimetableSlots>, day: number) {
  return slots
    .filter((s) => s.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => `${s.startTime}-${s.endTime} ${s.subject}`);
}

describe("parseTimeRange", () => {
  it("parses 8h-9h", () => {
    const t = parseTimeRange("8h-9h Maths");
    assert.equal(t?.start, "08:00");
    assert.equal(t?.end, "09:00");
    assert.match(t?.rest ?? "", /Maths/);
  });
  it("parses 08:00 - 09:00", () => {
    const t = parseTimeRange("08:00 - 09:00 MATHS");
    assert.equal(t?.start, "08:00");
    assert.equal(t?.end, "09:00");
  });
  it("parses 8h à 9h", () => {
    const t = parseTimeRange("8h à 9h");
    assert.equal(t?.start, "08:00");
    assert.equal(t?.end, "09:00");
  });
  it("parses 8h00", () => {
    const t = parseTimeRange("8h00 Français");
    assert.equal(t?.start, "08:00");
    assert.equal(t?.end, "08:55");
  });
});

describe("linear French timetable", () => {
  it("parses day headers then hours", () => {
    const text = `Lundi
08:00 Mathématiques Salle 204
09:00 Français
Mardi
08:00 EPS`;
    const slots = parseTimetableSlots(text);
    assert.equal(slots.length, 3);
    assert.deepEqual(subjectsOn(slots, 1), [
      "08:00-08:55 Mathématiques",
      "09:00-09:55 Français",
    ]);
    assert.equal(slots.find((s) => s.subject.includes("Math"))?.room, "204");
    assert.ok(subjectsOn(slots, 2)[0]?.includes("EPS"));
  });

  it("parses same-line day + time", () => {
    const text = `Lundi 8h-9h Maths
Mardi 8h EPS`;
    const slots = parseTimetableSlots(text);
    assert.equal(slots.length, 2);
    assert.equal(slots[0]?.dayOfWeek, 1);
    assert.equal(slots[0]?.startTime, "08:00");
    assert.equal(slots[0]?.endTime, "09:00");
    assert.match(slots[0]?.subject ?? "", /Maths/i);
  });

  it("parses Pronote-style with unicode dash and nbsp", () => {
    const text = `Lundi 02/09
08h00 – 09h00 MATHS DUPONT Salle 12
09h00 – 10h00 FRANCAIS Mme MARTIN Salle 8`;
    const slots = parseTimetableSlots(text);
    assert.equal(slots.length, 2);
    assert.equal(slots[0]?.startTime, "08:00");
    assert.equal(slots[0]?.endTime, "09:00");
    assert.match(slots[0]?.subject ?? "", /Maths/i);
  });
});

describe("grid timetable", () => {
  it("parses tab-separated grid", () => {
    const text = `Horaire	Lundi	Mardi	Mercredi	Jeudi	Vendredi
08h00-09h00	Maths	Français	EPS	Histoire	Maths
09h00-10h00	Anglais	Maths	Français	SVT	Arts
10h00-10h15	Récré	Récré	Récré	Récré	Récré
10h15-11h15	Histoire	EPS	Anglais	Maths	Français`;
    const slots = parseTimetableSlots(text);
    assert.ok(slots.length >= 15, `got ${slots.length}: ${slots.map((s) => s.subject).join(",")}`);
    const monday = subjectsOn(slots, 1);
    assert.ok(monday.some((s) => s.startsWith("08:00") && /Maths/i.test(s)));
    assert.ok(monday.some((s) => s.startsWith("09:00") && /Anglais/i.test(s)));
    assert.ok(!slots.some((s) => /récré|recre/i.test(s.subject)));
  });

  it("parses space-padded grid", () => {
    const text = `        Lundi     Mardi     Mercredi
8h-9h   Maths     Français  EPS
9h-10h  Anglais   Maths     Français`;
    const slots = parseTimetableSlots(text);
    assert.ok(slots.length >= 6, `got ${slots.length}`);
    assert.ok(subjectsOn(slots, 1).some((s) => /Maths/i.test(s)));
    assert.ok(subjectsOn(slots, 3).some((s) => /EPS/i.test(s)));
  });
});

describe("flattenDays + parseTimetableText", () => {
  it("returns days with slots", () => {
    const days = parseTimetableText(`Lundi
8h Maths
Mardi
8h EPS`);
    const flat = flattenDays(days);
    assert.equal(flat.length, 2);
  });
});

describe("coerceSlots / extractJsonObject", () => {
  it("reads grok json", () => {
    const json = extractJsonObject(`Voici
\`\`\`json
{"slots":[{"dayOfWeek":1,"startTime":"08:00","endTime":"09:00","subject":"Maths","room":"12","teacher":"Dupont"}]}
\`\`\``);
    const slots = coerceSlots(json);
    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.dayOfWeek, 1);
    assert.equal(slots[0]?.subject, "Maths");
  });

  it("accepts French keys", () => {
    const slots = coerceSlots({
      slots: [{ jour: "mardi", debut: "9h", fin: "10h", matiere: "EPS", salle: "gym" }],
    });
    assert.equal(slots[0]?.dayOfWeek, 2);
    assert.equal(slots[0]?.startTime, "09:00");
    assert.equal(slots[0]?.endTime, "10:00");
    assert.equal(slots[0]?.room, "gym");
  });
});

describe("mergeAdjacentSlots", () => {
  it("merges two consecutive same-subject hours", () => {
    const merged = mergeAdjacentSlots([
      { dayOfWeek: 1, startTime: "08:00", endTime: "09:00", subject: "Maths", room: "204", teacher: "" },
      { dayOfWeek: 1, startTime: "09:00", endTime: "10:00", subject: "Maths", room: "204", teacher: "Dupont" },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.startTime, "08:00");
    assert.equal(merged[0]?.endTime, "10:00");
    assert.equal(merged[0]?.teacher, "Dupont");
  });
});

describe("HTML table copy-paste (Pronote / Excel)", () => {
  it("parses a classic day-column table", async () => {
    const { parseClipboardToSlots, htmlTableToTsv } = await import("./parse-schedule.ts");
    const html = `<table>
      <tr><th></th><th>Lundi</th><th>Mardi</th><th>Mercredi</th><th>Jeudi</th><th>Vendredi</th></tr>
      <tr><td>08h00-09h00</td><td>Maths Dupont Salle 12</td><td>EPS</td><td>Histoire</td><td>Anglais</td><td>Français</td></tr>
      <tr><td>09h00-10h00</td><td>Français</td><td>Maths</td><td>SVT</td><td>EPS</td><td>Arts</td></tr>
    </table>`;
    const tsv = htmlTableToTsv(html);
    assert.match(tsv, /Lundi/);
    const slots = parseClipboardToSlots(html, "");
    assert.ok(slots.length >= 10, `got ${slots.length}`);
    const monday = slots.filter((s) => s.dayOfWeek === 1).sort((a, b) => a.startTime.localeCompare(b.startTime));
    assert.ok(monday.some((s) => s.startTime === "08:00" && /Maths/i.test(s.subject)));
    assert.equal(monday.find((s) => /Maths/i.test(s.subject))?.room, "12");
    assert.ok(slots.some((s) => s.dayOfWeek === 2 && /EPS/i.test(s.subject)));
  });

  it("expands rowspan into a merged slot", async () => {
    const { parseClipboardToSlots } = await import("./parse-schedule.ts");
    const html = `<table>
      <tr><td></td><td>Lundi</td><td>Mardi</td></tr>
      <tr><td>08h00-09h00</td><td rowspan="2">MATHS</td><td>EPS</td></tr>
      <tr><td>09h00-10h00</td><td>Français</td></tr>
    </table>`;
    const slots = parseClipboardToSlots(html, "");
    const maths = slots.find((s) => s.dayOfWeek === 1 && /Maths/i.test(s.subject));
    assert.ok(maths, JSON.stringify(slots));
    assert.equal(maths?.startTime, "08:00");
    assert.equal(maths?.endTime, "10:00");
  });

  it("looksLikeTimetable detects Pronote paste", async () => {
    const { looksLikeTimetable } = await import("./parse-schedule.ts");
    assert.equal(looksLikeTimetable("bonjour"), false);
    assert.equal(
      looksLikeTimetable(`Lundi
08h00 Maths
Mardi
08h00 EPS`),
      true,
    );
  });
});

describe("single-day markdown / Pronote daily view", () => {
  const SAMPLE = `| Horaire       | Cours                          | Professeur / salle       |
| ------------- | ------------------------------ | ------------------------ |
| 9h00 – 12h05  | Pratique professionnelle       | Gillet R. — Atelier ENE1 |
| 13h00 – 14h55 | Éducation physique et sportive | Robert P.                |
| 15h00 – 15h55 | Accompagnement personnalisé    | Lemasson O. — E315       |
| 16h10 – 17h05 | Vie de classe                  | Lemasson O. — E317       |`;

  it("detects the table as a timetable", async () => {
    const { looksLikeTimetable } = await import("./parse-schedule.ts");
    assert.equal(looksLikeTimetable(SAMPLE), true);
  });

  it("extracts 4 courses without requiring a weekday", async () => {
    const { parseScheduleText } = await import("./parse-schedule.ts");
    const { slots, needsDay } = parseScheduleText(SAMPLE);
    assert.equal(needsDay, true);
    assert.equal(slots.length, 4, slots.map((s) => s.subject).join(" | "));
    assert.equal(slots[0]?.startTime, "09:00");
    assert.equal(slots[0]?.endTime, "12:05");
    assert.match(slots[0]?.subject ?? "", /Pratique/i);
    assert.match(slots[0]?.teacher ?? "", /Gillet/i);
    assert.match(slots[0]?.room ?? "", /Atelier/i);
    assert.match(slots[1]?.subject ?? "", /physique|EPS/i);
    assert.match(slots[1]?.teacher ?? "", /Robert/i);
    assert.match(slots[2]?.subject ?? "", /Accompagnement/i);
    assert.equal(slots[2]?.room, "E315");
    assert.match(slots[2]?.teacher ?? "", /Lemasson/i);
    assert.match(slots[3]?.subject ?? "", /Vie de classe/i);
    assert.equal(slots[3]?.room, "E317");
  });

  it("assigns the chosen weekday", async () => {
    const { parseScheduleText, applyDaysToSlots } = await import("./parse-schedule.ts");
    const { slots } = parseScheduleText(SAMPLE);
    const dated = applyDaysToSlots(slots, [4]);
    assert.equal(dated.length, 4);
    assert.ok(dated.every((s) => s.dayOfWeek === 4));
  });

  it("parses the same table as HTML", async () => {
    const { parseClipboardDraft } = await import("./parse-schedule.ts");
    const html = `<table>
      <tr><th>Horaire</th><th>Cours</th><th>Professeur / salle</th></tr>
      <tr><td>9h00 – 12h05</td><td>Pratique professionnelle</td><td>Gillet R. — Atelier ENE1</td></tr>
      <tr><td>13h00 – 14h55</td><td>Éducation physique et sportive</td><td>Robert P.</td></tr>
      <tr><td>15h00 – 15h55</td><td>Accompagnement personnalisé</td><td>Lemasson O. — E315</td></tr>
      <tr><td>16h10 – 17h05</td><td>Vie de classe</td><td>Lemasson O. — E317</td></tr>
    </table>`;
    const { slots, needsDay } = parseClipboardDraft(html, "");
    assert.equal(needsDay, true);
    assert.equal(slots.length, 4, JSON.stringify(slots, null, 2));
    assert.match(slots[0]?.teacher ?? "", /Gillet/i);
    assert.equal(slots[2]?.room, "E315");
  });
});
