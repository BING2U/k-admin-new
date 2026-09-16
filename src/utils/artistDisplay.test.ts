import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { artistCompany, artistName } from "./envelope.ts";
import {
  albumRows,
  aliasRows,
  artistTitle,
  artistTypeLabel,
  basicInfoFields,
  companyLabel,
  externalAccountRows,
  membershipRows,
  prettyJson,
  sourceRows,
  trackRows
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

  it("person membership still shows group_name when member_name is also present", () => {
    const rows = membershipRows({
      official_name: "Karina",
      type: "person",
      memberships: [
        {
          group_name: "aespa",
          member_name: "Karina",
          role: "member"
        }
      ]
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target, "aespa");
    assert.notEqual(rows[0].target, "Karina");
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

const TWO_PM_MEMBERS = [
  "Chansung",
  "JUN. K",
  "Junho",
  "Nichkhun",
  "Taecyeon",
  "Wooyoung"
];

const twoPm = {
  id: UUID,
  official_name: "2PM",
  type: "group",
  memberships: TWO_PM_MEMBERS.map(member_name => ({
    group_name: "2PM",
    member_name,
    role: "member"
  }))
};

describe("J1–J3 group membership shows member names, not the group", () => {
  it("J1 2PM membership rows use member_name, not group_name", () => {
    const rows = membershipRows(twoPm);
    assert.equal(rows.length, 6);
    assert.deepEqual(
      rows.map(row => row.target),
      TWO_PM_MEMBERS
    );
  });

  it("J2 each 2PM member display name is distinct and ≠ group name", () => {
    const names = membershipRows(twoPm).map(row => row.target);
    assert.equal(new Set(names).size, 6);
    for (const name of names) {
      assert.notEqual(name, "2PM");
      assert.notEqual(name, twoPm.official_name);
    }
  });

  it("J3 group view prefers member official name even when group_name is also present", () => {
    const rows = membershipRows({
      official_name: "2PM",
      type: "group",
      memberships: [
        {
          group_name: "2PM",
          member_name: "Chansung",
          group: { official_name: "2PM" },
          member: { official_name: "Chansung" }
        }
      ]
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target, "Chansung");
    assert.notEqual(rows[0].target, "2PM");
  });
});

describe("OpenAPI v0.2 artist fields", () => {
  it("shows debut_date, debut_kind, and nationality without inventing missing values", () => {
    const fields = basicInfoFields({
      official_name: "2PM",
      type: "group",
      debut_date: "2008-09-04",
      debut_kind: "group",
      nationality: "KR"
    });
    const byKey = Object.fromEntries(
      fields.map(item => [item.key, item.value])
    );
    assert.equal(byKey.debut_date, "2008-09-04");
    assert.equal(byKey.debut_kind, "group");
    assert.equal(byKey.nationality, "KR");
    const empty = basicInfoFields({ official_name: "2PM", type: "group" });
    const emptyByKey = Object.fromEntries(
      empty.map(item => [item.key, item.value])
    );
    assert.equal(emptyByKey.debut_date, "—");
    assert.equal(emptyByKey.debut_kind, "—");
    assert.equal(emptyByKey.nationality, "—");
  });

  it("shows member_count for groups only", () => {
    const group = basicInfoFields({
      official_name: "2PM",
      type: "group",
      member_count: 6
    });
    assert.equal(group.find(item => item.key === "member_count")?.value, "6");
    const person = basicInfoFields({
      official_name: "Karina",
      type: "person",
      member_count: 6
    });
    assert.equal(
      person.find(item => item.key === "member_count"),
      undefined
    );
  });

  it("keeps member_name and maps is_leader, joined_at, left_at, role", () => {
    const rows = membershipRows({
      official_name: "2PM",
      type: "group",
      memberships: [
        {
          group_name: "2PM",
          member_name: "Nichkhun",
          is_leader: false,
          joined_at: "2008-09-04",
          left_at: null,
          role: "vocal",
          position: "rapper"
        },
        {
          group_name: "2PM",
          member_name: "Junho",
          is_leader: true,
          joined_at: "2008-09-04",
          left_at: "2017-01-01",
          role: "main vocal"
        }
      ]
    });
    assert.equal(rows[0].target, "Nichkhun");
    assert.notEqual(rows[0].target, "2PM");
    assert.equal(rows[0].is_leader, "否");
    assert.equal(rows[0].join_date, "2008-09-04");
    assert.equal(rows[0].leave_date, "");
    assert.equal(rows[0].role, "vocal");
    assert.equal(rows[0].position, "rapper");
    assert.equal(rows[1].target, "Junho");
    assert.equal(rows[1].is_leader, "是");
    assert.equal(rows[1].leave_date, "2017-01-01");
    assert.equal(rows[1].role, "main vocal");
  });
});

describe("OpenAPI v0.2 albums and tracks", () => {
  it("maps album list items to title without inventing missing fields", () => {
    const rows = albumRows([
      {
        id: "alb-1",
        title: "Grown",
        release_date: "2013-05-06",
        album_type: "studio"
      },
      { id: "alb-2", name: "Hands Up" }
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, "alb-1");
    assert.equal(rows[0].title, "Grown");
    assert.equal(rows[0].release_date, "2013-05-06");
    assert.equal(rows[0].album_type, "studio");
    assert.equal(rows[1].title, "Hands Up");
    assert.equal(rows[1].release_date, "");
    assert.equal(rows[1].album_type, "");
  });

  it("maps tracks with title, track_no, and duration only when present", () => {
    const rows = trackRows([
      { title: "A.D.T.O.Y.", track_no: 1, duration: "03:21" },
      { title: "Comeback When You Hear This Song", track_no: 2 },
      { title: "Go Crazy", track_no: 3, duration_ms: 201000 }
    ]);
    assert.equal(rows[0].title, "A.D.T.O.Y.");
    assert.equal(rows[0].track_no, "1");
    assert.equal(rows[0].duration, "03:21");
    assert.equal(rows[1].title, "Comeback When You Hear This Song");
    assert.equal(rows[1].track_no, "2");
    assert.equal(rows[1].duration, "");
    assert.equal(rows[2].duration, "3:21");
  });
});
