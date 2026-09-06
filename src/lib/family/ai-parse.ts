import { createServerFn } from "@tanstack/react-start";
import { uid } from "@/lib/utils";
import type { ScheduleSlot } from "./types";
import {
  coerceSlots,
  extractJsonObject,
  mergeAdjacentSlots,
  parseScheduleText,
  type LooseSlot,
} from "./parse-schedule";

export type AiSlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  teacher: string;
};

export type ParseResult =
  | { ok: true; slots: AiSlot[]; source: string; rawText: string }
  | { ok: false; error: string; slots: AiSlot[]; rawText: string };

const SYSTEM = `Tu es un expert des emplois du temps scolaires français (primaire, collège, lycée, lycée pro, Pronote, EDT, centre aéré).
Tu lis une PHOTO ou un TEXTE et tu extraits CHAQUE cours à la bonne place.

Réponds UNIQUEMENT avec un objet JSON :
{"layout":"colonnes-jours|lignes-jours|liste","dayUnknown":false,"slots":[{"dayOfWeek":1,"startTime":"08:00","endTime":"09:00","subject":"Maths","room":"204","teacher":"M. Dupont"}]}

dayOfWeek (0=dimanche … 6=samedi) :
1=lundi  2=mardi  3=mercredi  4=jeudi  5=vendredi  6=samedi  0=dimanche

Règles d'alignement — NE PAS te tromper de jour :
- Grille classique : Lundi Mardi Mercredi Jeudi Vendredi = COLONNES de gauche à droite. L'heure est à GAUCHE (lignes).
- La 1re colonne de matières = LUNDI (1), 2e = MARDI (2), 3e = MERCREDI (3), etc. Ne décale JAMAIS.
- Si les jours sont en LIGNES, chaque bloc "Lundi / Mardi / …" contient uniquement les cours de CE jour.
- Tableau d'UN SEUL JOUR (colonnes Horaire | Cours | Professeur / salle, SANS nom de jour) :
  extraire TOUS les cours, mettre "dayUnknown": true, et omettre dayOfWeek (ou le mettre à -1).
  N'OMETS JAMAIS un cours faute de jour — l'humain choisira le jour ensuite.
- Une cellule vide, "—", "/", "x" = pas de cours.
- Récréation, pause, interclasse, déjeuner, self, sonnerie, "libre" = IGNORE.
- Une case fusionnée 08h–10h = UN seul slot start 08:00 end 10:00 (pas deux fois 1h).
- Si la fin n'est pas écrite, prends le début du cours suivant ou +55 min.
- Heures au format HH:MM 24h (8h → 08:00, 9h00 → 09:00, 10h15 → 10:15, 12h05 → 12:05).
- subject : nom lisible (Mathématiques, Français, Pratique professionnelle, Vie de classe). Garde les sigles EPS SVT HG SES NSI LV1 LV2 EMC SNT SPC AP.
- room = salle / atelier / code (E315, Atelier ENE1) ou "".
- teacher = "Gillet R.", "Lemasson O.", "M. Dupont" ou "".
- N'invente AUCUN cours absent de la source. Ne déplace aucun cours vers un autre jour.
- Photo floue : extraits seulement ce qui est lisible.
- Si aucun planning : {"layout":"aucun","slots":[]}`;

type GrokOut =
  | { ok: true; slots: AiSlot[]; rawText: string }
  | { ok: false; error: string };

let grokDisabledUntil = 0;

function toAiSlots(raw: unknown): AiSlot[] {
  return mergeAdjacentSlots(coerceSlots(raw)).map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    room: s.room,
    teacher: s.teacher,
  }));
}

export const extractScheduleFn = createServerFn({ method: "POST" })
  .validator((input: { text?: string; imageDataUrl?: string }) => {
    const text = String(input.text ?? "").slice(0, 24_000);
    const imageDataUrl =
      typeof input.imageDataUrl === "string" &&
      input.imageDataUrl.startsWith("data:image/")
        ? input.imageDataUrl.slice(0, 2_400_000)
        : undefined;
    // Ne pas throw : évite les messages d'erreur bruts côté client
    return { text, imageDataUrl };
  })
  .handler(async ({ data }): Promise<GrokOut> => {
    try {
    if (!data.text.trim() && !data.imageDataUrl) {
      return { ok: false, error: "unavailable" };
    }
    if (Date.now() < grokDisabledUntil) {
      return { ok: false, error: "unavailable" };
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "high" } }
    > = [];
    if (data.imageDataUrl) {
      userContent.push({
        type: "text",
        text: `Lis cette photo d'emploi du temps / Pronote / planning.
1. Identifie si les JOURS sont en colonnes (le plus fréquent) ou en lignes.
2. Pour CHAQUE case non vide, donne le jour EXACT de sa colonne/ligne, l'heure de début, l'heure de fin, la matière.
3. Vérifie mentalement : le cours de la 1re colonne de matières est bien lundi, la 2e mardi, etc.
4. Renvoie le JSON.`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: data.imageDataUrl, detail: "high" },
      });
    }
    if (data.text.trim()) {
      userContent.push({
        type: "text",
        text: (data.imageDataUrl ? "Texte associé (peut être incomplet) :\n" : "") + data.text,
      });
    }

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(42_000),
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0,
          max_tokens: 5000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (
          res.status === 403 ||
          res.status === 429 ||
          /spending-limit|credits|quota/i.test(body)
        ) {
          grokDisabledUntil = Date.now() + 15 * 60_000;
          return { ok: false, error: "unavailable" };
        }
        // Ne jamais exposer quota / crédits / erreurs techniques à l'utilisateur
        return { ok: false, error: "unavailable" };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = body.choices?.[0]?.message?.content ?? "";
      const parsed = extractJsonObject(content);
      const slots = toAiSlots(parsed);
      return { ok: true, slots, rawText: content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ai-error";
      if (/timeout|abort/i.test(msg)) return { ok: false, error: "timeout" };
      return { ok: false, error: "unavailable" };
    }
    } catch {
      // Filet de sécurité : jamais d'exception quota / exceeded vers le client
      return { ok: false, error: "unavailable" };
    }
  });

function toAi(slots: ScheduleSlot[] | AiSlot[]): AiSlot[] {
  return slots.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    room: s.room,
    teacher: s.teacher,
  }));
}

function looksPlausible(slots: AiSlot[]): boolean {
  if (!slots.length) return false;
  return slots.some((s) => Boolean(s.startTime && s.subject));
}

/**
 * Analyse un planning : parseur local (instantané) + vision IA.
 * Toujours user-initiated. Pas d'OCR Tesseract (il mélange les colonnes).
 */
export async function parseScheduleWithAi(input: {
  text?: string;
  imageDataUrl?: string;
}): Promise<ParseResult> {
  const text = (input.text || "").trim();
  const local: AiSlot[] = text
    ? parseScheduleText(text).slots.map((s: LooseSlot) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        room: s.room,
        teacher: s.teacher,
      }))
    : [];
  const localUsable = local.length >= 3;

  const shouldCallAi =
    Boolean(input.imageDataUrl) || (text.length >= 8 && !localUsable);

  if (shouldCallAi) {
    try {
      const ai = await extractScheduleFn({
        data: {
          text: text || undefined,
          imageDataUrl: input.imageDataUrl,
        },
      });
      if (ai && "ok" in ai && ai.ok && looksPlausible(ai.slots)) {
        return {
          ok: true,
          slots: ai.slots,
          source: input.imageDataUrl ? "Photo" : "Texte",
          rawText: text,
        };
      }
      if (ai && "ok" in ai && ai.ok && ai.slots.length && local.length === 0) {
        return {
          ok: true,
          slots: ai.slots,
          source: input.imageDataUrl ? "Photo" : "Texte",
          rawText: text,
        };
      }
      // unavailable / quota / timeout → silencieux
    } catch {
      // Jamais de message quota / exceeded à l'utilisateur
    }
  }

  if (local.length) {
    return { ok: true, slots: local, source: "Texte", rawText: text };
  }

  return {
    ok: false,
    error: text || input.imageDataUrl ? "no-slots" : "empty",
    slots: [],
    rawText: text,
  };
}

export function aiSlotsToSchedule(
  slots: AiSlot[],
  memberId: string,
  name = "Emploi du temps (import)",
) {
  return {
    id: uid("sch"),
    memberId,
    name,
    slots: slots.map(
      (s): ScheduleSlot => ({
        id: uid("slot"),
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        room: s.room,
        teacher: s.teacher,
      }),
    ),
  };
}

export function mergeSlotLists(base: AiSlot[], extra: AiSlot[]): AiSlot[] {
  return mergeAdjacentSlots(
    [...base, ...extra].map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject,
      room: s.room,
      teacher: s.teacher,
    })),
  ).map((s) => ({
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    room: s.room,
    teacher: s.teacher,
  }));
}
