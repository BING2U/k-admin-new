import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrapItem, unwrapList } from "./envelope.ts";

describe("unwrapList OpenAPI v0.2 collections", () => {
  it("unwraps albums arrays from GET /v1/artists/{id}/albums payloads", () => {
    const fromKey = unwrapList({ albums: [{ id: "a1", title: "Grown" }] });
    assert.equal(fromKey.items.length, 1);
    assert.equal(fromKey.items[0].id, "a1");
    const nested = unwrapList({
      data: { albums: [{ id: "a2", title: "Hands Up" }] }
    });
    assert.equal(nested.items[0].title, "Hands Up");
  });

  it("unwraps tracks arrays from GET /v1/albums/{id}/tracks payloads", () => {
    const fromKey = unwrapList({
      tracks: [{ title: "A.D.T.O.Y.", track_no: 1 }]
    });
    assert.equal(fromKey.items[0].title, "A.D.T.O.Y.");
    const nested = unwrapList({
      data: { tracks: [{ title: "Go Crazy", track_no: 2 }] }
    });
    assert.equal(nested.items[0].track_no, 2);
  });
});

describe("unwrapItem album detail", () => {
  it("unwraps GET /v1/albums/{id} objects", () => {
    const album = unwrapItem(
      { data: { id: "alb-1", title: "Grown" } },
      "alb-1"
    );
    assert.equal(album.id, "alb-1");
    assert.equal(album.title, "Grown");
  });
});
