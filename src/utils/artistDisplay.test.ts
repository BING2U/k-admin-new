import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artistCompany, artistName } from "./envelope.ts";
import {
  aliasRows,
  artistTitle,
  artistTypeLabel,
  basicInfoFields,
  companyLabel,
  externalAccountRows,
  membershipRows,
  prettyJson,
  sourceRows
} from "./artistDisplay.ts";

const UUID = "3f1a9c2e-7b44-4d11-9c0a-0b6d5e8a1234";

const payload = {
  id: UUID,
  official_name: "Karina",
  company_code: "SM",
  type: "person",
  status: "active",
  birthday: "2000-04-11",
  height_cm: 168,
  debut_date: "2020-11-17",
  bio: "aespa member",
  updated_at: "2026-09-16T00:00:00Z",
  avatar_url: "https://example.invalid/face.jpg",
  aliases: [
    { lang: "ko", name: "카리나" },
    { lang: "en", name: "Karina" }
  ],
  memberships: [
    {
      group_name: "aespa",
      role: "member",
      position: "leader",
      join_date: "2020-11-17"
    }
  ],
  external_accounts: [
    {
      platform: "instagram",
      handle: "@katarinabluu",
      url: "https://instagram.com/katarinabluu"
    }
  ],
  sources: [
    {
      source_type: "official",
      source_url: "https://example.invalid/karina",
      fetched_at: "2026-09-16T00:00:00Z"
    }
  ]
};

describe("I1–I2 header name and company", () => {
  it("uses official_name, never the artist UUID, as the title", () => {
    assert.equal(artistTitle(payload), "Karina");
    assert.equal(artistName(payload), "Karina");
    assert.notEqual(artistTitle(payload), UUID);
    assert.equal(artistTitle({ id: UUID, name: UUID }), "");
    assert.notEqual(artistTitle({ id: UUID, name: UUID }), UUID);
  });

  it("maps company_code to a company label instead of leaving company empty", () => {
    assert.match(artistCompany(payload), /SM/);
    assert.match(companyLabel(payload), /SM/);
    assert.notEqual(companyLabel(payload), "");
    assert.match(
      companyLabel({ id: UUID, company: UUID, company_code: "JYP" }),
      /JYP/
    );
  });
});

describe("I3 type and I4 basic info", () => {
  it("labels type as person/团体 without dumping JSON", () => {
    assert.equal(artistTypeLabel(payload), "个人");
    assert.equal(artistTypeLabel({ type: "group" }), "团体");
    assert.equal(artistTypeLabel({ type: "团体" }), "团体");
  });

  it("exposes basic fields as scalars with empty optional values as —", () => {
    const fields = basicInfoFields(payload);
    const byKey = Object.fromEntries(
      fields.map(item => [item.key, item.value])
    );
    assert.equal(byKey.status, "active");
    assert.equal(byKey.birthday, "2000-04-11");
    assert.equal(byKey.height_cm, "168");
    assert.equal(byKey.debut_date, "2020-11-17");
    assert.equal(byKey.bio, "aespa member");
    assert.equal(byKey.updated_at, "2026-09-16T00:00:00Z");
    const empty = basicInfoFields({ id: UUID, official_name: "A" });
    for (const item of empty) {
      assert.equal(item.value, "—");
      assert.notEqual(item.value.trim().startsWith("{"), true);
      assert.notEqual(item.value.trim().startsWith("["), true);
    }
  });
});

describe("I5–I7 section rows are not JSON dumps", () => {
  it("renders aliases as one language/name row each", () => {
    const rows = aliasRows(payload);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].lang, "ko");
    assert.equal(rows[0].name, "카리나");
    assert.equal(rows[1].lang, "en");
    assert.equal(rows[1].name, "Karina");
  });

  it("renders memberships as group/member rows", () => {
    const rows = membershipRows(payload);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target, "aespa");
    assert.equal(rows[0].role, "member");
    assert.equal(rows[0].position, "leader");
    assert.equal(rows[0].join_date, "2020-11-17");
  });

  it("renders external_accounts as platform/handle/url rows", () => {
    const rows = externalAccountRows(payload);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].platform, "instagram");
    assert.equal(rows[0].handle, "@katarinabluu");
    assert.equal(rows[0].url, "https://instagram.com/katarinabluu");
  });
});

describe("I8 sources and collapsed raw JSON", () => {
  it("requires source_type, source_url, fetched_at on each source row", () => {
    const rows = sourceRows(payload);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source_type, "official");
    assert.equal(rows[0].source_url, "https://example.invalid/karina");
    assert.equal(rows[0].fetched_at, "2026-09-16T00:00:00Z");
  });

  it("pretty-prints the GET body as JSON text for the collapsed pane", () => {
    const text = prettyJson(payload);
    assert.match(text, /"official_name": "Karina"/);
    assert.match(text, /\n/);
  });
});
