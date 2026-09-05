function uid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
import type { ScheduleSlot } from "./types";

/** 0=dimanche … 6=samedi, comme Date#getDay() */
const DAY_MAP: Record<string, number> = {
  dimanche: 0,
  dimanchee: 0,
  dim: 0,
  di: 0,
  sunday: 0,
  sun: 0,
  lundi: 1,
  lun: 1,
  lu: 1,
  monday: 1,
  mon: 1,
  mardi: 2,
  mar: 2,
  ma: 2,
  tuesday: 2,
  tue: 2,
  mercredi: 3,
  mer: 3,
  me: 3,
  wednesday: 3,
  wed: 3,
  jeudi: 4,
  jeu: 4,
  je: 4,
  thursday: 4,
  thu: 4,
  vendredi: 5,
  ven: 5,
  ve: 5,
  friday: 5,
  fri: 5,
  samedi: 6,
  sam: 6,
  sa: 6,
  saturday: 6,
  sat: 6,
};

const DAY_KEYS = Object.keys(DAY_MAP).sort((a, b) => b.length - a.length);

const SKIP_SUBJECT =
  /^(recre|récré|recré|recreation|récréation|pause|interclasse|sonnerie|dejeuner|déjeuner|repas|midi|lunch|break|libre|vacances|absence|abs|\/+|-+|—+|–+|x+|none|n\/a|vide)$/i;

const ACRONYMS = new Set([
  "EPS",
  "SVT",
  "HG",
  "H-G",
  "LV1",
  "LV2",
  "LV3",
  "SES",
  "NSI",
  "SNT",
  "EMC",
  "AP",
  "DNL",
  "LLCE",
  "SPC",
  "S.V.T",
  "E.P.S",
  "APBG",
]);

export type ParsedDay = {
  dayOfWeek: number;
  label: string;
  slots: ScheduleSlot[];
};

export type LooseSlot = {
  dayOfWeek: number; // 0-6, or -1 if the source didn't name a day
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  teacher: string;
};

export function normalizeScheduleText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u202f\u2007\u2009\u200a]/g, " ")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[‐]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/\t+/g, "\t")
    .trim();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toHHMM(h: number, m: number): string {
  return `${pad(h)}:${pad(m)}`;
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60);
  return toHHMM(Math.floor(total / 60), total % 60);
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.]/g, "")
    .trim();
}

function isDayToken(raw: string): number | null {
  const t = fold(raw).replace(/[^a-z]/g, "");
  if (!t || t.length > 12) return null;
  if (DAY_MAP[t] != null) return DAY_MAP[t];
  for (const k of DAY_KEYS) {
    if (t === k) return DAY_MAP[k];
  }
  return null;
}

function dayInText(raw: string): { day: number; at: number } | null {
  const lower = fold(raw);
  for (const k of DAY_KEYS) {
    const re = new RegExp(`(?:^|[^a-z])(${k})(?:$|[^a-z])`);
    const m = lower.match(re);
    if (m && m.index != null) {
      return { day: DAY_MAP[k]!, at: m.index };
    }
  }
  return null;
}

const RANGE_RE =
  /(?:de\s+)?(\d{1,2})\s*[hH:.]?\s*(\d{2})?\s*(?:heures?)?\s*(?:[-–—àa]|to)\s*(\d{1,2})\s*[hH:.]?\s*(\d{2})?/i;
const START_RE = /(?:a|à|de)?\s*(\d{1,2})\s*[hH:.]\s*(\d{2})?/i;

function validHour(h: number, m: number): boolean {
  return h >= 6 && h <= 22 && m >= 0 && m <= 59;
}

export function parseTimeRange(
  raw: string,
): { start: string; end: string; rest: string } | null {
  const range = raw.match(RANGE_RE);
  if (range) {
    const h1 = Number(range[1]);
    const m1 = range[2] != null && range[2] !== "" ? Number(range[2]) : 0;
    const h2 = Number(range[3]);
    const m2 = range[4] != null && range[4] !== "" ? Number(range[4]) : 0;
    if (validHour(h1, m1) && validHour(h2, m2)) {
      const rest = (raw.slice(0, range.index) + " " + raw.slice((range.index ?? 0) + range[0].length))
        .replace(/\s+/g, " ")
        .trim();
      return { start: toHHMM(h1, m1), end: toHHMM(h2, m2), rest };
    }
  }
  const start = raw.match(START_RE);
  if (start) {
    const h1 = Number(start[1]);
    const m1 = start[2] != null && start[2] !== "" ? Number(start[2]) : 0;
    if (validHour(h1, m1)) {
      const hhmm = toHHMM(h1, m1);
      const rest = (raw.slice(0, start.index) + " " + raw.slice((start.index ?? 0) + start[0].length))
        .replace(/\s+/g, " ")
        .trim();
      return { start: hhmm, end: addMinutes(hhmm, 55), rest };
    }
  }
  return null;
}

function splitCells(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((s) => s.trim());
  }
  if (line.includes("|")) {
    const cells = line.split("|").map((s) => s.trim());
    if (cells.length && cells[0] === "") cells.shift();
    if (cells.length && cells[cells.length - 1] === "") cells.pop();
    return cells;
  }
  if (line.includes(";") && line.split(";").length >= 3) {
    return line.split(";").map((s) => s.trim());
  }
  if (/\s{2,}/.test(line)) {
    return line.split(/\s{2,}/).map((s) => s.trim());
  }
  return line
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isSepRow(cells: string[]): boolean {
  if (!cells.length) return true;
  return cells.every((c) => !c || /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));
}

function isSepLine(line: string): boolean {
  const t = line.replace(/[\s|]/g, "");
  return /^:?-{3,}:?$/.test(t) || isSepRow(splitCells(line));
}

function prettySubject(raw: string): string {
  let s = raw
    .replace(/^[-–•:.,]+/, "")
    .replace(/[-–•:.,]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  s = s.replace(/^(cours|matiere|matière)\s*[:.]?\s*/i, "").trim();
  if (!s) return "Cours";
  const compact = s.replace(/[.\s]/g, "").toUpperCase();
  if (ACRONYMS.has(s.toUpperCase()) || ACRONYMS.has(compact)) {
    return s.toUpperCase();
  }
  if (s === s.toUpperCase() && /[A-ZÀ-Ÿ]/.test(s) && s.length > 3) {
    return s
      .toLowerCase()
      .split(/(\s+)/)
      .map((w) =>
        w.trim() && !/^(et|de|du|des|la|le|les|en)$/i.test(w)
          ? w.charAt(0).toUpperCase() + w.slice(1)
          : w,
      )
      .join("");
  }
  return s;
}

const ROOM_LABEL =
  /\b((?:atelier|labo(?:ratoire)?|gymnase|amphi(?:theatre)?|cdi|salle)\s+[A-Za-z0-9-]{1,12})\b/i;
const ROOM_CODE = /\b([A-Z]{1,4}-?\d{1,4}[A-Z]?)\b/;
const SUBJECT_CODES = new Set([
  "EPS",
  "SVT",
  "HG",
  "SES",
  "NSI",
  "SNT",
  "EMC",
  "SPC",
  "AP",
  "LV1",
  "LV2",
  "LV3",
  "DNL",
  "LLCE",
  "APBG",
]);

function extractRoom(text: string): { room: string; rest: string } {
  const labeled = text.match(
    /(?:^|\s)(?:salle|sal\.|s\.\s*|room)\s*[:.]?\s*([A-Za-z0-9-]{1,12})\b/i,
  );
  if (labeled) {
    return {
      room: labeled[1] ?? "",
      rest: text.replace(labeled[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  const named = text.match(ROOM_LABEL);
  if (named) {
    return {
      room: named[1] ?? "",
      rest: text.replace(named[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  const dashed = text.match(/[—–\-]\s*([A-Z]{1,4}-?\d{1,4}[A-Z]?)\s*$/);
  if (dashed && !SUBJECT_CODES.has((dashed[1] ?? "").toUpperCase())) {
    return {
      room: dashed[1] ?? "",
      rest: text.replace(dashed[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  const code = text.match(ROOM_CODE);
  if (code && !SUBJECT_CODES.has((code[1] ?? "").toUpperCase())) {
    const idx = code.index ?? 0;
    const before = text.slice(0, idx);
    if (/[—–\-]/.test(before) || /\b(salle|atelier|local)\b/i.test(before)) {
      return {
        room: code[1] ?? "",
        rest: text.replace(code[0], " ").replace(/\s+/g, " ").trim(),
      };
    }
  }
  return { room: "", rest: text };
}

function extractTeacher(text: string): { teacher: string; rest: string } {
  const titled = text.match(
    /(?:m\.|mme|mlle|mr|prof(?:esseur(?:e)?)?)\s+([A-Za-zÀ-ÿ' -]{2,30})/i,
  );
  if (titled) {
    return {
      teacher: (titled[1] ?? "").trim(),
      rest: text.replace(titled[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  const initial = text.match(
    /\b([A-ZÀ-Ÿ][a-zà-ÿ'’-]+(?:-[A-ZÀ-Ÿ][a-zà-ÿ'’-]+)*\s+[A-ZÀ-Ÿ]\.)(?=\s|$|[—–\-|/])/,
  );
  if (initial) {
    return {
      teacher: initial[1]!.trim(),
      rest: text.replace(initial[0], " ").replace(/\s+/g, " ").trim(),
    };
  }
  return { teacher: "", rest: text };
}

function splitTeacherRoomCell(cell: string): { teacher: string; room: string; rest: string } {
  const parts = cell
    .split(/\s*[—–|/]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1] ?? "";
    const head = parts.slice(0, -1).join(" ");
    const roomHit = extractRoom(last);
    const teacherHit = extractTeacher(head) ;
    if (roomHit.room || /^(atelier|salle|labo|gymnase|cdi|amphi)/i.test(last) || ROOM_CODE.test(last)) {
      const t = teacherHit.teacher || (extractTeacher(head).teacher || head);
      return { teacher: t, room: roomHit.room || last, rest: teacherHit.rest };
    }
  }
  const room = extractRoom(cell);
  const teacher = extractTeacher(room.rest);
  return { teacher: teacher.teacher, room: room.room, rest: teacher.rest };
}

function stripDayNames(text: string): string {
  let t = text;
  for (const k of DAY_KEYS) {
    t = t.replace(new RegExp(`(?:^|\\s)${k}\\.?(?=\\s|$)`, "ig"), " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

function isSkipSubject(s: string): boolean {
  const tokens = s.split(/[\s,/|]+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => SKIP_SUBJECT.test(t) || SKIP_SUBJECT.test(fold(t)));
}

function parseMeta(rest: string): { subject: string; room: string; teacher: string } {
  let cleaned = rest
    .replace(/\|/g, " ")
    .replace(/\s*[—–]\s*/g, " — ")
    .replace(/\s+/g, " ")
    .trim();
  const split = splitTeacherRoomCell(cleaned);
  let subject = stripDayNames(split.rest);
  subject = subject.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "").trim();
  subject = subject.replace(/\s+[—–]\s+/g, " ").replace(/[—–\-]\s*$/g, "").replace(/^\s*[—–\-]/g, "").trim();
  if (isSkipSubject(subject)) {
    return { subject: "", room: split.room, teacher: split.teacher };
  }
  subject = prettySubject(subject);
  if (!subject || isSkipSubject(subject)) {
    return { subject: "", room: split.room, teacher: split.teacher };
  }
  return { subject, room: split.room, teacher: split.teacher };
}

function makeSlot(partial: LooseSlot): ScheduleSlot {
  return {
    id: uid("slot"),
    dayOfWeek: partial.dayOfWeek,
    startTime: partial.startTime,
    endTime: partial.endTime,
    subject: partial.subject || "Cours",
    room: partial.room,
    teacher: partial.teacher,
  };
}

function isSkipCell(cell: string): boolean {
  const t = cell.trim();
  if (!t) return true;
  return isSkipSubject(t);
}

function parseGrid(lines: string[]): LooseSlot[] {
  let header: Array<number | null> | null = null;
  const slots: LooseSlot[] = [];

  for (const line of lines) {
    if (isSepLine(line)) continue;
    const cells = splitCells(line);
    if (cells.length < 2) continue;

    const dayHits = cells.map((c) => isDayToken(c));
    const dayCount = dayHits.filter((d) => d != null).length;
    if (dayCount >= 2) {
      header = dayHits;
      continue;
    }

    if (!header) continue;

    // First cell that looks like a time range / start = the hour column
    let timeIdx = 0;
    let time = parseTimeRange(cells[0] ?? "");
    if (!time) {
      for (let i = 0; i < Math.min(2, cells.length); i++) {
        const t = parseTimeRange(cells[i] ?? "");
        if (t) {
          time = t;
          timeIdx = i;
          break;
        }
      }
    }
    if (!time) continue;

    // Align remaining cells with header days.
    // If header has a leading non-day (Horaire / Heure), skip that column.
    const subjects = cells.slice(timeIdx + 1);
    const dayColumns = header
      .map((d, i) => ({ d, i }))
      .filter((x) => x.d != null);

    // If subjects length matches day columns, map 1:1.
    // Else try mapping by offset matching header indices after the time column.
    if (subjects.length === dayColumns.length) {
      for (let i = 0; i < subjects.length; i++) {
        const cell = subjects[i] ?? "";
        if (isSkipCell(cell)) continue;
        const meta = parseMeta(cell);
        if (!meta.subject) continue;
        slots.push({
          dayOfWeek: dayColumns[i]!.d as number,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
    } else {
      for (let i = 0; i < header.length; i++) {
        const d = header[i];
        if (d == null) continue;
        // cell index: if header[0] is horaire (null), days start at 1, and
        // the time column was cells[0], subjects are cells[1..] matching header[1..]
        const subjectIdx = i - (timeIdx + (header[0] == null ? 0 : 0));
        const cell = cells[subjectIdx] ?? cells[i] ?? "";
        if (isSkipCell(cell) || parseTimeRange(cell)) continue;
        const meta = parseMeta(cell);
        if (!meta.subject) continue;
        slots.push({
          dayOfWeek: d,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
    }
  }
  return slots;
}

function parseLinear(lines: string[]): LooseSlot[] {
  const slots: LooseSlot[] = [];
  let currentDay: number | null = null;

  for (const raw of lines) {
    const dayHit = isDayToken(raw) ?? dayInText(raw)?.day ?? null;
    const time = parseTimeRange(raw);
    const onlyDay = dayHit != null && !time && raw.length < 40;

    if (onlyDay) {
      currentDay = dayHit;
      continue;
    }

    if (dayHit != null && time) {
      currentDay = dayHit;
      const meta = parseMeta(time.rest);
      if (meta.subject) {
        slots.push({
          dayOfWeek: dayHit,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
      // Several courses on one line, split by comma / " / "
      const extra = time.rest.split(/\s*[,/]\s*(?=\d{1,2}\s*[hH:.])/);
      if (extra.length > 1) {
        // already consumed first via `time`; remaining chunks handled below if they have times
        for (const chunk of extra.slice(1)) {
          const t2 = parseTimeRange(chunk);
          if (!t2) continue;
          const m2 = parseMeta(t2.rest);
          if (!m2.subject) continue;
          slots.push({
            dayOfWeek: dayHit,
            startTime: t2.start,
            endTime: t2.end,
            ...m2,
          });
        }
      }
      continue;
    }

    if (time && currentDay != null) {
      const meta = parseMeta(time.rest);
      if (meta.subject) {
        slots.push({
          dayOfWeek: currentDay,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
      continue;
    }

    // "Maths 8h-9h lundi"
    if (time && dayHit != null) {
      const meta = parseMeta(time.rest);
      if (meta.subject) {
        slots.push({
          dayOfWeek: dayHit,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
    }
  }
  return slots;
}

function parseLoose(lines: string[]): LooseSlot[] {
  const slots: LooseSlot[] = [];
  let currentDay: number | null = null;
  for (const raw of lines) {
    const d = isDayToken(raw) ?? dayInText(raw)?.day ?? null;
    if (d != null) currentDay = d;
    const time = parseTimeRange(raw);
    if (!time) continue;
    const day = d ?? currentDay;
    if (day == null) continue;
    const meta = parseMeta(time.rest);
    if (!meta.subject) continue;
    slots.push({
      dayOfWeek: day,
      startTime: time.start,
      endTime: time.end,
      ...meta,
    });
  }
  return slots;
}

function dedupe(slots: LooseSlot[]): LooseSlot[] {
  const seen = new Set<string>();
  const out: LooseSlot[] = [];
  for (const s of slots) {
    const key = `${s.dayOfWeek}|${s.startTime}|${s.endTime}|${s.subject.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  out.sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      a.startTime.localeCompare(b.startTime) ||
      a.subject.localeCompare(b.subject),
  );
  return out;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Fusionne deux cours identiques qui se suivent (ex. Maths 8h-9h + 9h-10h). */
export function mergeAdjacentSlots(slots: LooseSlot[]): LooseSlot[] {
  const sorted = dedupe(slots);
  const out: LooseSlot[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.dayOfWeek === s.dayOfWeek &&
      prev.subject.toLowerCase() === s.subject.toLowerCase() &&
      (prev.room || "") === (s.room || "") &&
      toMinutes(prev.endTime) === toMinutes(s.startTime)
    ) {
      prev.endTime = s.endTime;
      if (!prev.teacher && s.teacher) prev.teacher = s.teacher;
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

type ColRole = "time" | "subject" | "teacher" | "room" | "combo" | "day" | "other";

function classifyCol(cell: string): ColRole {
  const t = fold(cell).replace(/\s+/g, " ").trim();
  if (!t || t.length > 32) return "other";
  if (isDayToken(cell) != null) return "day";
  if (/^(horaire|heure|heures|creneau|debut|hour|time|h)$/.test(t)) return "time";
  if (
    /(professeur|enseignant|profs?|teacher).{0,12}(salle|lieu|local|room)/.test(t) ||
    /(salle|lieu).{0,12}(prof)/.test(t)
  ) {
    return "combo";
  }
  if (/^(professeurs?|enseignants?|profs?|teacher|intervenant)$/.test(t)) return "teacher";
  if (/^(salle|lieu|local|room|atelier)$/.test(t)) return "room";
  if (/^(cours|matieres?|discipline|activites?|subject|enseignement|intitule)$/.test(t)) {
    return "subject";
  }
  return "other";
}

function parseListFromMatrix(grid: string[][]): LooseSlot[] {
  if (grid.length < 2) return [];
  let headerIdx = -1;
  let roles: ColRole[] = [];
  for (let r = 0; r < Math.min(4, grid.length); r++) {
    const row = (grid[r] ?? []).filter((c) => !isSepRow([c]));
    if (row.length < 2) continue;
    const classified = row.map(classifyCol);
    const days = classified.filter((c) => c === "day").length;
    if (days >= 2) return []; // weekly grid — handled elsewhere
    const looksLikeData = Boolean(parseTimeRange(row[0] ?? "") || parseTimeRange(row.join(" ")));
    if (looksLikeData) continue;
    if (classified.includes("time") || classified.includes("subject") || classified.includes("combo")) {
      headerIdx = r;
      roles = classified;
      break;
    }
  }

  const slots: LooseSlot[] = [];
  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  const timeIdx = roles.indexOf("time");
  const subjectIdx = roles.indexOf("subject");
  const teacherIdx = roles.indexOf("teacher");
  const roomIdx = roles.indexOf("room");
  const comboIdx = roles.indexOf("combo");
  const dayIdx = roles.indexOf("day");

  for (let r = startRow; r < grid.length; r++) {
    const row = grid[r] ?? [];
    if (isSepRow(row)) continue;
    let time: ReturnType<typeof parseTimeRange> = null;
    let timeAt = 0;
    if (timeIdx >= 0) {
      time = parseTimeRange(row[timeIdx] ?? "");
      timeAt = timeIdx;
    }
    if (!time) {
      for (let i = 0; i < Math.min(3, row.length); i++) {
        const t = parseTimeRange(row[i] ?? "");
        if (t) {
          time = t;
          timeAt = i;
          break;
        }
      }
    }
    if (!time) continue;

    let day = dayIdx >= 0 ? (isDayToken(row[dayIdx] ?? "") ?? dayInText(row[dayIdx] ?? "")?.day ?? -1) : -1;
    if (day < 0) {
      const hit = dayInText(row.join(" "));
      if (hit) day = hit.day;
    }

    const subjectCell =
      subjectIdx >= 0 && subjectIdx !== timeAt
        ? (row[subjectIdx] ?? "")
        : row.filter((_, i) => i !== timeAt && i !== teacherIdx && i !== roomIdx && i !== comboIdx && i !== dayIdx)[0] ?? time.rest;

    const comboCell = comboIdx >= 0 ? (row[comboIdx] ?? "") : "";
    const teacherCell = teacherIdx >= 0 ? (row[teacherIdx] ?? "") : "";
    const roomCell = roomIdx >= 0 ? (row[roomIdx] ?? "") : "";

    let meta = parseMeta(subjectCell || time.rest);
    if (comboCell) {
      const extra = splitTeacherRoomCell(comboCell);
      meta = {
        subject: meta.subject,
        teacher: extra.teacher || meta.teacher,
        room: extra.room || meta.room,
      };
    }
    if (teacherCell && !meta.teacher) {
      meta = { ...meta, teacher: extractTeacher(teacherCell).teacher || teacherCell.trim() };
    }
    if (roomCell && !meta.room) {
      meta = { ...meta, room: extractRoom(roomCell).room || roomCell.trim() };
    }
    if (!meta.subject) continue;
    slots.push({
      dayOfWeek: day,
      startTime: time.start,
      endTime: time.end,
      ...meta,
    });
  }
  return slots;
}

function parseListTable(lines: string[]): LooseSlot[] {
  const matrix = lines
    .map((l) => splitCells(l))
    .filter((cells) => cells.length >= 2 && !isSepRow(cells));
  if (matrix.length < 2) return [];
  const structured = lines.filter(
    (l) => l.includes("|") || l.includes("\t") || /\s{2,}/.test(l),
  ).length;
  if (structured < 2) {
    const roles = (matrix[0] ?? []).map(classifyCol);
    if (!roles.includes("time") && !roles.includes("subject") && !roles.includes("combo")) {
      return [];
    }
  }
  return parseListFromMatrix(matrix);
}

function parseDayless(lines: string[]): LooseSlot[] {
  const slots: LooseSlot[] = [];
  for (const raw of lines) {
    if (isSepLine(raw)) continue;
    const dayHit = isDayToken(raw) ?? dayInText(raw)?.day ?? null;
    if (dayHit != null) continue;
    const cleaned = raw.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    const time = parseTimeRange(cleaned);
    if (!time) continue;
    const meta = parseMeta(time.rest);
    if (!meta.subject) continue;
    slots.push({
      dayOfWeek: -1,
      startTime: time.start,
      endTime: time.end,
      ...meta,
    });
  }
  return slots;
}

export type ParsedSchedule = {
  slots: LooseSlot[];
  needsDay: boolean;
};

export function slotsNeedDay(slots: LooseSlot[]): boolean {
  return slots.length > 0 && slots.every((s) => s.dayOfWeek < 0);
}

export function toScheduleSlots(slots: LooseSlot[]): ScheduleSlot[] {
  return slots
    .filter((s) => s.dayOfWeek >= 0 && s.dayOfWeek <= 6)
    .map(makeSlot);
}

export function applyDaysToSlots(slots: LooseSlot[], days: number[]): ScheduleSlot[] {
  const uniqueDays = [...new Set(days.filter((d) => d >= 0 && d <= 6))];
  if (!uniqueDays.length) return toScheduleSlots(slots);
  const known = slots.filter((s) => s.dayOfWeek >= 0);
  const unknown = slots.filter((s) => s.dayOfWeek < 0);
  const stamped = uniqueDays.flatMap((d) => unknown.map((s) => ({ ...s, dayOfWeek: d })));
  return toScheduleSlots(mergeAdjacentSlots(dedupe([...known, ...stamped])));
}

export function parseScheduleText(text: string): ParsedSchedule {
  const normalized = normalizeScheduleText(text);
  if (!normalized) return { slots: [], needsDay: false };
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const grid = parseGrid(lines);
  const list = parseListTable(lines);
  const linear = parseLinear(lines);
  const loose = parseLoose(lines);
  const dayless = parseDayless(lines);
  const datedLinear = [...linear, ...loose].filter((s) => s.dayOfWeek >= 0);

  let chosen: LooseSlot[] = [];
  if (grid.length >= 4) chosen = grid;
  else if (datedLinear.length >= 2) {
    chosen = linear.length >= loose.length ? (linear.length ? linear : loose) : loose;
  } else if (list.length >= 2) chosen = list;
  else if (dayless.length >= 2) chosen = dayless;
  else if (list.length) chosen = list;
  else if (linear.length) chosen = linear;
  else if (loose.length) chosen = loose;
  else chosen = dayless;

  const extras =
    chosen === grid || chosen === list || chosen === dayless
      ? []
      : chosen === linear
        ? loose.filter((s) => s.dayOfWeek >= 0)
        : linear.filter((s) => s.dayOfWeek >= 0);
  const merged = mergeAdjacentSlots(dedupe([...chosen, ...extras]));
  return { slots: merged, needsDay: slotsNeedDay(merged) };
}

export function parseTimetableText(text: string): ParsedDay[] {
  const slots = parseTimetableSlots(text);
  const byDay = new Map<number, ScheduleSlot[]>();
  for (const s of slots) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }
  const labels = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayOfWeek, daySlots]) => ({
      dayOfWeek,
      label: labels[dayOfWeek] ?? String(dayOfWeek),
      slots: daySlots,
    }));
}

export function parseTimetableSlots(text: string): ScheduleSlot[] {
  return toScheduleSlots(parseScheduleText(text).slots);
}

export function flattenDays(days: ParsedDay[]): ScheduleSlot[] {
  return days.flatMap((d) => d.slots);
}

const DAY_NAME_TO_NUM: Record<string, number> = { ...DAY_MAP };

export function coerceSlots(raw: unknown): LooseSlot[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj)
    ? obj
    : Array.isArray(obj.slots)
      ? obj.slots
      : Array.isArray(obj.cours)
        ? obj.cours
        : [];
  const out: LooseSlot[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    let day: number | null = null;
    if (typeof s.dayOfWeek === "number" && s.dayOfWeek >= 0 && s.dayOfWeek <= 6) {
      day = s.dayOfWeek;
    } else if (typeof s.dayOfWeek === "string") {
      const n = Number(s.dayOfWeek);
      if (!Number.isNaN(n) && n >= 0 && n <= 6) day = n;
      else day = isDayToken(s.dayOfWeek) ?? DAY_NAME_TO_NUM[fold(s.dayOfWeek)] ?? null;
    } else if (typeof s.day === "string") {
      day = isDayToken(s.day) ?? DAY_NAME_TO_NUM[fold(s.day)] ?? null;
    } else if (typeof s.jour === "string") {
      day = isDayToken(s.jour) ?? DAY_NAME_TO_NUM[fold(s.jour)] ?? null;
    }

    let start = "";
    let end = "";
    const startRaw = String(s.startTime ?? s.start ?? s.debut ?? s.heure ?? "");
    const endRaw = String(s.endTime ?? s.end ?? s.fin ?? "");
    const combined = endRaw ? `${startRaw}-${endRaw}` : startRaw;
    const parsed = parseTimeRange(combined) ?? parseTimeRange(startRaw);
    if (parsed) {
      start = parsed.start;
      end = endRaw ? (parseTimeRange(endRaw)?.start ?? parsed.end) : parsed.end;
      if (endRaw) {
        const e = parseTimeRange(`8h-${endRaw}`) ?? parseTimeRange(endRaw);
        if (e) end = e.end === e.start ? e.start : e.end;
        // if endRaw is "09:00", parseTimeRange might treat as start-only (+55)
        const em = endRaw.match(/(\d{1,2})\s*[hH:.]?\s*(\d{2})?/);
        if (em) {
          const eh = Number(em[1]);
          const emin = em[2] != null && em[2] !== "" ? Number(em[2]) : 0;
          if (validHour(eh, emin)) end = toHHMM(eh, emin);
        }
      }
    }
    if (!start) continue;
    const subject = prettySubject(String(s.subject ?? s.matiere ?? s.matière ?? s.title ?? s.nom ?? "Cours"));
    if (!subject || SKIP_SUBJECT.test(subject)) continue;
    out.push({
      dayOfWeek: day ?? -1,
      startTime: start,
      endTime: end || addMinutes(start, 55),
      subject,
      room: String(s.room ?? s.salle ?? "").trim(),
      teacher: String(s.teacher ?? s.prof ?? s.professeur ?? "").trim(),
    });
  }
  return mergeAdjacentSlots(out);
}

export function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    const a0 = body.indexOf("[");
    const a1 = body.lastIndexOf("]");
    if (a0 >= 0 && a1 > a0) {
      try {
        return JSON.parse(body.slice(a0, a1 + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function extractPdfStrings(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];
  const paren = /\((?:\\.|[^\\)]){2,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(text))) {
    const inner = m[0]
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\\)/g, ")");
    if (/[A-Za-zÀ-ÿ]/.test(inner)) chunks.push(inner);
  }
  // TJ arrays: [(H)(ello)]
  const tj = /\[(?:\s*\((?:\\.|[^\\)])*\)\s*)+\]/g;
  while ((m = tj.exec(text))) {
    const inner = [...m[0].matchAll(/\((?:\\.|[^\\)])*\)/g)]
      .map((x) => x[0].slice(1, -1))
      .join("");
    if (/[A-Za-zÀ-ÿ]{3,}/.test(inner)) chunks.push(inner);
  }
  return chunks.join("\n");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function attrInt(tag: string, name: string): number {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, "i"));
  return m ? Math.max(1, Number(m[1])) : 1;
}

function splitCellsHtml(rowHtml: string): Array<{ text: string; rowspan: number; colspan: number }> {
  const out: Array<{ text: string; rowspan: number; colspan: number }> = [];
  const re = /<(td|th)(\b[^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowHtml))) {
    out.push({
      text: stripTags(m[3] ?? ""),
      rowspan: attrInt(m[2] ?? "", "rowspan"),
      colspan: attrInt(m[2] ?? "", "colspan"),
    });
  }
  return out;
}

/** Expand the first HTML table into a rectangular grid (rowspan/colspan). */
export function htmlTableToGrid(html: string): string[][] {
  const tableMatch = html.match(/<table\b[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];
  const rowsHtml = [...tableMatch[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (!rowsHtml.length) return [];

  const grid: string[][] = [];
  const occupied: Array<Array<string | null>> = [];

  function ensureRow(r: number) {
    occupied[r] ??= [];
    grid[r] ??= [];
  }

  for (let r = 0; r < rowsHtml.length; r++) {
    ensureRow(r);
    const cells = splitCellsHtml(rowsHtml[r] ?? "");
    let c = 0;
    for (const cell of cells) {
      while (occupied[r]?.[c] != null) c++;
      for (let i = 0; i < cell.rowspan; i++) {
        ensureRow(r + i);
        for (let j = 0; j < cell.colspan; j++) {
          occupied[r + i]![c + j] = cell.text;
          grid[r + i]![c + j] = cell.text;
        }
      }
      c += cell.colspan;
    }
  }

  const width = Math.max(0, ...grid.map((row) => row.length));
  return grid.map((row) => {
    const next = row.slice();
    while (next.length < width) next.push("");
    return next.map((v) => v ?? "");
  });
}

export function htmlTableToTsv(html: string): string {
  const grid = htmlTableToGrid(html);
  if (!grid.length) return "";
  return grid.map((row) => row.join("\t")).join("\n");
}

function parseSlotsFromGridMatrix(grid: string[][]): LooseSlot[] {
  if (grid.length < 2) return [];
  const slots: LooseSlot[] = [];

  let headerRow = -1;
  let header: Array<number | null> = [];
  for (let r = 0; r < Math.min(4, grid.length); r++) {
    const days = (grid[r] ?? []).map((c) => isDayToken(c) ?? dayInText(c)?.day ?? null);
    if (days.filter((d) => d != null).length >= 2) {
      headerRow = r;
      header = days;
      break;
    }
  }

  if (headerRow >= 0) {
    for (let r = headerRow + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      let timeIdx = 0;
      let time = parseTimeRange(row[0] ?? "");
      if (!time) {
        for (let i = 0; i < Math.min(2, row.length); i++) {
          const t = parseTimeRange(row[i] ?? "");
          if (t) {
            time = t;
            timeIdx = i;
            break;
          }
        }
      }
      if (!time) continue;
      for (let c = 0; c < header.length; c++) {
        const day = header[c];
        if (day == null || c === timeIdx) continue;
        const cell = row[c] ?? "";
        if (isSkipCell(cell) || parseTimeRange(cell)) continue;
        const meta = parseMeta(cell);
        if (!meta.subject) continue;
        slots.push({
          dayOfWeek: day,
          startTime: time.start,
          endTime: time.end,
          ...meta,
        });
      }
    }
    return slots;
  }

  // Days as first column (one row per day)
  for (const row of grid) {
    const day = isDayToken(row[0] ?? "") ?? dayInText(row[0] ?? "")?.day ?? null;
    if (day == null) continue;
    const rest = row.slice(1).join(" | ");
    const chunks = rest.split(/\s*\|\s*|\s{2,}/).filter(Boolean);
    const pieces = chunks.length ? chunks : [rest];
    for (const piece of pieces) {
      const time = parseTimeRange(piece);
      if (!time) continue;
      const meta = parseMeta(time.rest);
      if (!meta.subject) continue;
      slots.push({
        dayOfWeek: day,
        startTime: time.start,
        endTime: time.end,
        ...meta,
      });
    }
  }
  if (slots.length) return slots;
  return parseListFromMatrix(grid);
}

export function parseHtmlTableSlots(html: string): ScheduleSlot[] {
  const grid = htmlTableToGrid(html);
  if (!grid.length) return [];
  return toScheduleSlots(mergeAdjacentSlots(parseSlotsFromGridMatrix(grid)));
}

export function looksLikeTimetable(text: string): boolean {
  const n = normalizeScheduleText(text);
  if (n.length < 12) return false;
  const days = (n.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday)\b/gi) || []).length;
  const times = (n.match(/\b\d{1,2}\s*[hH:]\s*\d{0,2}/g) || []).length;
  const ranges = (n.match(/\d{1,2}\s*[hH:.]?\s*\d{0,2}\s*(?:[-–—]|à|to)\s*\d{1,2}/gi) || []).length;
  const lines = n.split("\n").filter(Boolean).length;
  const tabs = (n.match(/\t/g) || []).length;
  const pipes = (n.match(/\|/g) || []).length;
  const headerHint = /(horaire|cours|matiere|matière|professeur)/i.test(n);
  return (
    (days >= 2 && times >= 2) ||
    (times >= 4 && lines >= 3) ||
    (tabs >= 4 && days >= 2) ||
    ranges >= 2 ||
    (pipes >= 6 && times >= 2) ||
    (headerHint && times >= 2)
  );
}

export function parseClipboardDraft(html?: string, text?: string): ParsedSchedule {
  const htmlSrc = html?.trim() ?? "";
  const textSrc = text?.trim() ?? "";
  if (htmlSrc && /<table/i.test(htmlSrc)) {
    const grid = htmlTableToGrid(htmlSrc);
    const fromHtml = mergeAdjacentSlots(parseSlotsFromGridMatrix(grid));
    if (fromHtml.length >= 2) {
      return { slots: fromHtml, needsDay: slotsNeedDay(fromHtml) };
    }
    const tsv = htmlTableToTsv(htmlSrc);
    const fromTsv = parseScheduleText(tsv);
    if (fromTsv.slots.length >= 2) return fromTsv;
  }
  if (textSrc) return parseScheduleText(textSrc);
  if (htmlSrc) return parseScheduleText(stripTags(htmlSrc));
  return { slots: [], needsDay: false };
}

/**
 * Copier-coller Pronote / Excel / Sheets : HTML table prioritaire, sinon texte.
 * Les cours sans jour (planning d'une seule journée) sont conservés avec dayOfWeek = -1.
 */
export function parseClipboardToSlots(html?: string, text?: string): ScheduleSlot[] {
  const draft = parseClipboardDraft(html, text);
  const dated = toScheduleSlots(draft.slots);
  if (dated.length) return dated;
  if (draft.needsDay) return applyDaysToSlots(draft.slots, [1]);
  return [];
}

export function clipboardToScheduleText(html?: string, text?: string): string {
  const htmlSrc = html?.trim() ?? "";
  if (htmlSrc && /<table/i.test(htmlSrc)) {
    const tsv = htmlTableToTsv(htmlSrc);
    if (tsv.split("\n").length >= 2) return tsv;
  }
  if (text?.trim()) return normalizeScheduleText(text);
  if (htmlSrc) return stripTags(htmlSrc);
  return "";
}

