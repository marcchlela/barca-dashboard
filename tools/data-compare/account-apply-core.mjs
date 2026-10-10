import { createHash } from "node:crypto";
import { CATEGORIES, TABLES } from "./catalog.mjs";
import { validateSnapshot } from "./compare-core.mjs";
import { TRANSFER_ORDER } from "./transfer-plan-core.mjs";

const PERSONAL = new Set(CATEGORIES["Personal archive"]);
const OPERATIONAL = new Set(CATEGORIES["Operational state"]);
const SHARED = new Set(TRANSFER_ORDER.filter(t => !PERSONAL.has(t)));
const PERSONAL_INSERTS = new Set([
  "favourite_player", "favourite_match", "media_save"
]);

const hash = value => createHash("sha256")
  .update(JSON.stringify(value)).digest("hex");

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function quote(name) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error("Unsafe SQL identifier.");
  }
  return `"${name}"`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readRows(client) {
  const rows = {};
  for (const table of TABLES) {
    rows[table] = JSON.parse(JSON.stringify(
      (await client.query(`SELECT * FROM ${quote(table)} ORDER BY id`)).rows
    ));
  }
  return rows;
}

async function readSchema(client) {
  return (await client.query(`
    SELECT table_name AS "table",
           column_name AS "column",
           data_type AS "type",
           udt_name AS "udt",
           is_nullable AS "nullable"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name NOT IN ('app_user', 'user_session', 'auth_throttle')
    ORDER BY table_name, ordinal_position
  `)).rows;
}

function validateCandidate(manifest, local, production) {
  assert(
    manifest.kind === "BARCA_ACCOUNT_TRANSFER_CANDIDATE_V1",
    "Unsupported account-transfer candidate."
  );

  const { sha256, ...body } = manifest;
  assert(hash(body) === sha256, "Candidate checksum mismatch.");

  assert(manifest.executable === false, "Unexpected executable candidate.");
  assert(
    manifest.productionWriteAuthorized === false,
    "Unexpected authorization field."
  );

  assert(
    manifest.localSnapshotSha256 === local.sha256 &&
    manifest.productionSnapshotSha256 === production.sha256,
    "Candidate references different snapshots."
  );

  for (const [label, envelope] of [
    ["local", local],
    ["production", production]
  ]) {
    const result = validateSnapshot(envelope);

    assert(
      !result.errors.length &&
      !result.broken.length &&
      !result.relationshipIssues.length &&
      Boolean(envelope.snapshot.authIsolation) &&
      envelope.snapshot.environment === label,
      `${label} snapshot failed validation.`
    );
  }

  const sourceOwner = manifest.ownerMapping.local;
  const targetOwner = manifest.ownerMapping.production;

  assert(
    local.snapshot.ownerAccounts.some(a => a.id === sourceOwner),
    "Source owner missing."
  );

  assert(
    production.snapshot.ownerAccounts.some(a => a.id === targetOwner),
    "Target owner missing."
  );

  assert(
    manifest.personalInserts.length === 4,
    "Unexpected number of personal inserts."
  );

  assert(
    manifest.counts.sharedInserts === 1103 &&
    manifest.counts.sharedUpdates === 58 &&
    manifest.counts.blocked === 142 &&
    manifest.counts.preservedDiaryEntries === 8,
    "Candidate counts differ from reviewed baseline."
  );

  const operations = [
    ...manifest.sharedOperations,
    ...manifest.personalInserts
  ];

  assert(
    operations.filter(op => op.action === "insert").length === 1107 &&
    operations.filter(op => op.action === "update").length === 58,
    "Unexpected operation count."
  );

  const targetIds = new Set();

  for (const op of operations) {
    const personal = PERSONAL.has(op.table);

    assert(
      personal
        ? PERSONAL_INSERTS.has(op.table) && op.action === "insert"
        : SHARED.has(op.table),
      `Forbidden operation: ${op.table}/${op.action}`
    );

    assert(
      ["insert", "update"].includes(op.action),
      "Invalid operation type."
    );

    const key = `${op.table}:${op.targetId}`;
    assert(!targetIds.has(key), `Duplicate operation target: ${key}`);
    targetIds.add(key);

    if (personal) {
      assert(
        op.values?.userId === targetOwner,
        "Personal record has incorrect destination owner."
      );

      const source = local.snapshot.rows[op.table]
        .find(row => row.id === op.localId);

      assert(
        source?.userId === sourceOwner,
        "Personal record is not owned by selected source account."
      );
    }

    if (!personal) {
      assert(
        !Object.hasOwn(op.values ?? op.changes ?? {}, "userId"),
        "Shared operation attempts to modify account ownership."
      );
    }
  }

  return operations;
}

export async function executeAccountTransfer(
  client,
  manifest,
  local,
  production
) {
  const operations = validateCandidate(manifest, local, production);

  await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '120s'");

    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(17091799) AS acquired"
    );
    assert(lock.rows[0]?.acquired, "Transfer lock unavailable.");

    const schema = await readSchema(client);
    assert(
      same(schema, production.snapshot.schema),
      "Live database schema differs from reviewed snapshot."
    );

    const account = await client.query(
      'SELECT id FROM app_user WHERE id = $1 FOR SHARE',
      [manifest.ownerMapping.production]
    );
    assert(account.rows.length === 1, "Destination account missing.");

    const before = await readRows(client);

    for (const table of TABLES) {
      if (OPERATIONAL.has(table)) continue;

      assert(
        same(before[table], production.snapshot.rows[table]),
        `Production ${table} changed since the snapshot.`
      );
    }

    const columns = Object.fromEntries(
      TABLES.map(table => [
        table,
        new Map(schema
          .filter(column => column.table === table)
          .map(column => [column.column, column]))
      ])
    );

    for (const op of operations) {
      const data = op.action === "insert" ? op.values : op.changes;
      const fields = Object.keys(data);

      assert(fields.length > 0, "Empty operation.");
      assert(
        fields.every(field => columns[op.table]?.has(field)),
        `Unexpected column in ${op.table}.`
      );

      const values = fields.map(field => {
        const value = data[field];
        const column = columns[op.table].get(field);

        return value != null && ["json", "jsonb"].includes(column.udt)
          ? JSON.stringify(value)
          : value;
      });

      let result;

      if (op.action === "insert") {
        assert(data.id === op.targetId, "Insert ID mismatch.");

        result = await client.query(
          `INSERT INTO ${quote(op.table)}
           (${fields.map(quote).join(", ")})
           VALUES (${fields.map((_, i) => `$${i + 1}`).join(", ")})
           RETURNING id`,
          values
        );
      } else {
        assert(!fields.includes("id"), "Cannot update row identity.");

        const existing = before[op.table].find(
          row => row.id === op.targetId
        );

        assert(existing, "Update target missing.");

        for (const [field, expected] of Object.entries(op.expected ?? {})) {
          assert(
            same(existing[field], expected),
            `Update precondition failed: ${op.table}/${field}`
          );
        }

        result = await client.query(
          `UPDATE ${quote(op.table)}
           SET ${fields.map((field, i) =>
             `${quote(field)} = $${i + 1}`).join(", ")}
           WHERE id = $${fields.length + 1}
           RETURNING id`,
          [...values, op.targetId]
        );
      }

      assert(
        result.rows.length === 1 &&
        result.rows[0].id === op.targetId,
        `Incorrect affected row: ${op.table}/${op.targetId}`
      );
    }

    const after = await readRows(client);

    for (const table of OPERATIONAL) {
      assert(
        same(before[table], after[table]),
        `Operational table changed: ${table}`
      );
    }

    assert(
      same(before.match_diary_entry, after.match_diary_entry),
      "Existing diary entries were modified."
    );

    const touched = new Set(
      operations.map(op => `${op.table}:${op.targetId}`)
    );

    for (const table of TABLES) {
      const oldRows = before[table];
      const newRows = after[table];

      const expectedInserts = operations.filter(
        op => op.table === table && op.action === "insert"
      ).length;

      assert(
        newRows.length === oldRows.length + expectedInserts,
        `Unexpected row count in ${table}.`
      );

      const newById = new Map(newRows.map(row => [row.id, row]));

      for (const oldRow of oldRows) {
        if (touched.has(`${table}:${oldRow.id}`)) continue;

        assert(
          same(oldRow, newById.get(oldRow.id)),
          `Untouched production row changed: ${table}/${oldRow.id}`
        );
      }
    }

    for (const op of operations) {
      const row = after[op.table].find(r => r.id === op.targetId);
      const intended = op.action === "insert" ? op.values : op.changes;

      assert(
        row && Object.entries(intended).every(
          ([field, value]) => same(row[field], value)
        ),
        `Post-apply verification failed: ${op.table}/${op.targetId}`
      );
    }

    const snapshot = {
      ...production.snapshot,
      rows: after
    };

    const check = validateSnapshot({
      snapshot,
      sha256: hash(snapshot)
    });

    assert(
      !check.errors.length &&
      !check.broken.length &&
      !check.relationshipIssues.length,
      "Post-apply integrity validation failed."
    );

    await client.query("COMMIT");

    return {
      status: "applied",
      inserts: 1107,
      updates: 58,
      blocked: 142,
      protectedDiaryEntries: 8
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
