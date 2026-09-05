import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { isFamilyCode, normalizeFamilyCode } from "./code";
import type { FamilyState } from "./types";

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return `ZEN-${body}`;
}

function asIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

export const pingCloud = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await sql.query("select 1 as ok");
  return { ok: true as const };
});

export const fetchFamily = createServerFn({ method: "GET" })
  .validator((input: { code: string }) => {
    const code = normalizeFamilyCode(input.code);
    if (!isFamilyCode(code)) throw new Error("Code famille invalide");
    return { code };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown; updated_at: unknown }>(
      "select payload, updated_at from families where code = $1",
      [data.code],
    );
    const row = rows[0];
    if (!row) return { found: false as const };
    return {
      found: true as const,
      payload: row.payload as FamilyState,
      updatedAt: asIso(row.updated_at),
    };
  });

export const saveFamily = createServerFn({ method: "POST" })
  .validator((input: { code: string; payload: FamilyState }) => {
    const code = normalizeFamilyCode(input.code);
    if (!isFamilyCode(code)) throw new Error("Code famille invalide");
    if (!input.payload || typeof input.payload !== "object") {
      throw new Error("Données invalides");
    }
    return { code, payload: input.payload };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ updated_at: unknown }>(
      `insert into families (code, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (code) do update
         set payload = excluded.payload, updated_at = now()
       returning updated_at`,
      [data.code, JSON.stringify(data.payload)],
    );
    return { ok: true as const, updatedAt: asIso(rows[0]?.updated_at) };
  });

export const createFamilyRow = createServerFn({ method: "POST" })
  .validator((input: { payload: FamilyState }) => {
    if (!input.payload || typeof input.payload !== "object") {
      throw new Error("Données invalides");
    }
    return { payload: input.payload };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    for (let i = 0; i < 8; i++) {
      const code = randomCode();
      try {
        await sql.query(
          `insert into families (code, payload, updated_at)
           values ($1, $2::jsonb, now())`,
          [code, JSON.stringify(data.payload)],
        );
        return { ok: true as const, code };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/unique|duplicate|pk_|primary/i.test(msg) && i < 7) continue;
        throw err;
      }
    }
    return { ok: false as const, error: "Impossible de créer un code unique" };
  });

export const putFamilyAsset = createServerFn({ method: "POST" })
  .validator((input: { code: string; id: string; mimeType?: string; dataUrl: string }) => {
    const code = normalizeFamilyCode(input.code);
    if (!isFamilyCode(code)) throw new Error("Code famille invalide");
    const id = String(input.id ?? "")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 80);
    if (!id) throw new Error("Identifiant invalide");
    const dataUrl = String(input.dataUrl ?? "");
    if (!dataUrl.startsWith("data:")) throw new Error("Fichier invalide");
    if (dataUrl.length > 2_200_000) throw new Error("Photo trop lourde pour le partage");
    return {
      code,
      id,
      mimeType: String(input.mimeType || "image/jpeg").slice(0, 80),
      dataUrl,
    };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into family_assets (id, family_code, mime_type, data_url, updated_at)
       values ($1, $2, $3, $4, now())
       on conflict (id) do update
         set data_url = excluded.data_url,
             mime_type = excluded.mime_type,
             updated_at = now()
       where family_assets.family_code = excluded.family_code`,
      [data.id, data.code, data.mimeType, data.dataUrl],
    );
    return { ok: true as const };
  });

export const listFamilyAssets = createServerFn({ method: "GET" })
  .validator((input: { code: string }) => {
    const code = normalizeFamilyCode(input.code);
    if (!isFamilyCode(code)) throw new Error("Code famille invalide");
    return { code };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: string; data_url: string }>(
      "select id, data_url from family_assets where family_code = $1",
      [data.code],
    );
    return { assets: rows.map((r) => ({ id: r.id, dataUrl: r.data_url })) };
  });
