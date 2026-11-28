// Copyright (C) 2026-2026 Huawei Technologies Co., Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * A copy that lost immutable evidence says so, and a whole copy does not (#1532).
 *
 * The banner, the per-item list and "the continue action stays enabled" are the whole
 * point of the change, and the mocked desktop journey can be skipped for a given head,
 * so the rule is pinned here in the UT layer: the panel renders from
 * `continuationDowngraded` / `missingImmutableEvidence`, names every item, and never
 * turns the absence of those fields into a warning.
 */

import { createTest } from "../../../test/support/tagged/compat.mjs";
const { test } = createTest(import.meta.url, {
  tags: ["category:ut", "os:linux", "arch:amd64", "arch:arm64"],
});
import assert from "node:assert/strict";
import React from "react";

import { TEXT } from "../src/text.js";
import { ResearchPackage } from "../src/views/ResearchPackage.js";
import { act, create } from "./support/dom-renderer.js";

const t = TEXT.researchPackage;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubDocument(): () => void {
  const globals = globalThis as { document?: unknown };
  const previous = globals.document;
  globals.document = {
    activeElement: null, addEventListener: () => undefined, querySelector: () => null,
    querySelectorAll: () => [], removeEventListener: () => undefined,
  };
  return () => { globals.document = previous; };
}

const client = { request: async () => ({}), fetchStream: async () => ({ blob: async () => new Blob([]) }) } as never;

function detailWith(snapshot: Record<string, unknown>) {
  return {
    createdAt: "2026-01-01T00:00:00.000Z", id: "s1", messages: [], projectId: "p1",
    researchSnapshot: snapshot, title: "导入的研究", updatedAt: "2026-01-01T00:00:00.000Z",
  } as never;
}

const missing = ["cas:sha256:aa:unavailable source object", "version:artifact-7:2:unavailable source object"];

async function render(detail: unknown) {
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(React.createElement(ResearchPackage, {
      client, detail, onOpen: () => undefined, onRefresh: async () => undefined, projects: [] as never,
    } as never));
  });
  return view;
}

test("a degraded copy names every missing item and keeps the continue action enabled", async () => {
  const restoreDocument = stubDocument();
  let view: ReturnType<typeof create> | undefined;
  try {
    view = await render(detailWith({
      continuationAvailable: true, continuationDowngraded: true, missingImmutableEvidence: missing,
      role: "imported_snapshot", state: "ready",
    }));
    const alerts = view.root.findAll((node) => node.props?.role === "alert");
    assert.equal(alerts.length, 1, "the panel states the downgrade once");
    const items = alerts[0]!.findAllByType("li").map((node) => node.props.children);
    assert.deepEqual(items, missing, "every declared item is named, in the order the receipt gave them");
    assert.match(String(alerts[0]!.findAllByType("p")[0]?.props.children ?? ""), /部分证据缺失，结果不可复现/u);
    assert.equal(alerts[0]!.findAllByType("p")[1]?.props.children, t.degradedMissing);

    const buttons = view.root.findAllByType("button");
    const resume = buttons.find((button) => button.props.children === t.continue);
    assert.ok(resume, "the read-only panel offers the continue action");
    assert.equal(resume!.props.disabled, false, "allowed: the copy may be continued while it is marked degraded");
  } finally {
    if (view) act(() => { view!.unmount(); });
    restoreDocument();
  }
});

test("a whole copy carries no warning, even though the fields are present and empty", async () => {
  const restoreDocument = stubDocument();
  let view: ReturnType<typeof create> | undefined;
  try {
    view = await render(detailWith({
      continuationAvailable: true, continuationDowngraded: false, missingImmutableEvidence: [],
      role: "imported_snapshot", state: "ready",
    }));
    assert.equal(view.root.findAll((node) => node.props?.role === "alert").length, 0,
      "a copy whose package declared no loss is not degraded");
    const buttons = view.root.findAllByType("button");
    assert.equal(buttons.find((button) => button.props.children === t.continue)?.props.disabled, false);
  } finally {
    if (view) act(() => { view!.unmount(); });
    restoreDocument();
  }
});
