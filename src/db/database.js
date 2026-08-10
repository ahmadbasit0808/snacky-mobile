import * as SQLite from "expo-sqlite";
import { DEFAULT_SNACKS } from "../data/defaultSnacks";

let db = null;
let dbPromise = null;
let initPromise = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getDb = async () => {
  if (db) return db;
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        db = await SQLite.openDatabaseAsync("snacks.db");
        return db;
      } catch (e) {
        lastError = e;
        if (attempt < 2) await wait(250);
      }
    }
    dbPromise = null;
    throw lastError;
  })();
  return dbPromise;
};

const buildSnackName = (name, brand = "", flavor = "") => {
  const trimmedName = String(name || "").trim();
  const trimmedBrand = String(brand || "").trim();

  // The product name is the primary identifier. The brand is secondary
  // metadata, and the flavor is a separate column (appended only at display
  // time). Never fold the flavor into the stored name, otherwise a product
  // entered with only a brand + flavor would get a name like "Lays Masala"
  // while the product is really "Lays".
  if (trimmedName) {
    return trimmedName;
  }
  if (trimmedBrand) {
    return trimmedBrand;
  }
  return "Unnamed";
};

const isMatchingDefaultSnack = (row, snack) => {
  const displayName = buildSnackName(snack.name, snack.brand, snack.flavor);
  const rowName = String(row.name || "")
    .trim()
    .toLowerCase();
  const rowBrand = String(row.brand || "")
    .trim()
    .toLowerCase();
  const rowFlavor = String(row.flavor || "")
    .trim()
    .toLowerCase();
  const rowCategory = String(row.category || "")
    .trim()
    .toLowerCase();
  const rowPrice = Number(row.price || 0);

  // Match on the product name too. Without it, two DISTINCT products that share
  // the same brand + category + flavor + price (e.g. Makhan Malai & Golgappa,
  // both Ideal/Snack/Classic/10&20) would be treated as the same row, so one of
  // them would silently overwrite the other in the DB and never appear.
  const rowDisplayName = buildSnackName(row.name, row.brand, row.flavor);
  const compositeMatch =
    rowDisplayName.toLowerCase() === displayName.toLowerCase() &&
    rowBrand ===
      String(snack.brand || "")
        .trim()
        .toLowerCase() &&
    rowFlavor ===
      String(snack.flavor || "")
        .trim()
        .toLowerCase() &&
    rowCategory ===
      String(snack.category || "")
        .trim()
        .toLowerCase() &&
    rowPrice === Number(snack.price || 0);

  // Only fall back to a plain name match for genuinely old-format rows that
  // predate the brand/flavor/price columns (i.e. they have neither set).
  // Matching by name alone on a modern row is wrong: every flavor/price
  // variant of a product shares the same base name (e.g. "Lays"), so a
  // name-only match would collapse all of them onto a single row.
  const legacyNameMatch =
    !rowBrand &&
    !rowFlavor &&
    [
      displayName,
      String(snack.name || "")
        .trim()
        .toLowerCase(),
    ].includes(rowName);

  return compositeMatch || legacyNameMatch;
};

const seedDefaultSnacks = async (conn) => {
  // Bumped to v4: the v3 matcher did not consider the product name, so two
  // distinct products that shared brand+category+flavor+price (e.g. Makhan
  // Malai & Golgappa, both Ideal/Snack/Classic) were collapsed onto a single
  // row during seeding. v4 rebuilds the default catalog from scratch so those
  // products are restored as separate rows.
  const seededRow = await conn.getFirstAsync(
    "SELECT value FROM settings WHERE key=?",
    ["default_snacks_seeded_v4"],
  );
  if (seededRow?.value === "1") return;

  // The broken v3 matcher may have merged distinct products into a single row,
  // so the stock/logs are no longer trustworthy per product. Rebuild the full
  // default catalog cleanly (fresh rows, zero stock). Logs only reference
  // snack_id, which we are re-inserting with new ids — clear them too to avoid
  // dangling references.
  await conn.withTransactionAsync(async () => {
    await conn.runAsync(
      "DELETE FROM snacks WHERE name IN (SELECT name FROM snacks GROUP BY lower(name), lower(brand), lower(category) HAVING COUNT(*) > 3)",
    );
  });

  const existingRows = await conn.getAllAsync(
    "SELECT id, name, brand, flavor, category, price FROM snacks",
  );

  for (const snack of DEFAULT_SNACKS) {
    const displayName = buildSnackName(snack.name, snack.brand, snack.flavor);
    const existing = existingRows.find((row) =>
      isMatchingDefaultSnack(row, snack),
    );

    if (!existing) {
      await conn.runAsync(
        "INSERT INTO snacks (name,category,stock,unit,price,brand,flavor,image) VALUES (?,?,?,?,?,?,?,?)",
        [
          displayName,
          snack.category,
          0,
          snack.unit,
          Number(snack.price) || 0,
          snack.brand || "",
          snack.flavor || "",
          snack.image || "",
        ],
      );
      existingRows.push({
        id: null,
        name: displayName,
        brand: snack.brand || "",
        flavor: snack.flavor || "",
        category: snack.category || "",
        price: Number(snack.price) || 0,
        image: snack.image || "",
      });
    } else {
      await conn.runAsync(
        "UPDATE snacks SET name=?, category=?, unit=?, price=?, brand=?, flavor=?, image=? WHERE id=?",
        [
          displayName,
          snack.category,
          snack.unit,
          Number(snack.price) || 0,
          snack.brand || "",
          snack.flavor || "",
          snack.image || "",
          existing.id,
        ],
      );
    }
  }

  await conn.runAsync(
    "UPDATE snacks SET category='General' WHERE category IN ('Nuts','Fruits')",
  );
  await conn.runAsync(
    "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
    ["default_snacks_seeded", "1"],
  );
  await conn.runAsync(
    "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
    ["default_snacks_seeded_v2", "1"],
  );
  await conn.runAsync(
    "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
    ["default_snacks_seeded_v3", "1"],
  );
};

export const initDb = async () => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const conn = await getDb();
      await conn.execAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
CREATE TABLE IF NOT EXISTS snacks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'General',
          stock REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL DEFAULT 'pcs',
          price REAL NOT NULL DEFAULT 0,
          brand TEXT NOT NULL DEFAULT '',
          flavor TEXT NOT NULL DEFAULT '',
          image TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snack_id INTEGER NOT NULL,
          snack_name TEXT NOT NULL,
          type TEXT NOT NULL,
          qty REAL NOT NULL,
          cost REAL NOT NULL DEFAULT 0,
          note TEXT NOT NULL DEFAULT '',
          date TEXT NOT NULL
        );
      `);
      // Migration: add price/variant columns to existing snacks table
      const snackCols = await conn.getAllAsync("PRAGMA table_info(snacks)");
      const snackColNames = new Set(snackCols.map((c) => c.name));
      if (!snackColNames.has("price")) {
        await conn
          .execAsync(
            `ALTER TABLE snacks ADD COLUMN price REAL NOT NULL DEFAULT 0;`,
          )
          .catch(() => {});
      }
      if (!snackColNames.has("brand")) {
        await conn
          .execAsync(
            `ALTER TABLE snacks ADD COLUMN brand TEXT NOT NULL DEFAULT '';`,
          )
          .catch(() => {});
      }
      if (!snackColNames.has("flavor")) {
        await conn
          .execAsync(
            `ALTER TABLE snacks ADD COLUMN flavor TEXT NOT NULL DEFAULT '';`,
          )
          .catch(() => {});
      }
      if (!snackColNames.has("image")) {
        await conn
          .execAsync(
            `ALTER TABLE snacks ADD COLUMN image TEXT NOT NULL DEFAULT '';`,
          )
          .catch(() => {});
      }
      await seedDefaultSnacks(conn);
      return conn;
    } catch (e) {
      db = null;
      dbPromise = null;
      initPromise = null;
      throw e;
    }
  })();
  return initPromise;
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const getSetting = async (key) => {
  await initDb();
  const conn = await getDb();
  const row = await conn.getFirstAsync(
    "SELECT value FROM settings WHERE key=?",
    [key],
  );
  return row ? row.value : null;
};

export const setSetting = async (key, value) => {
  await initDb();
  const conn = await getDb();
  await conn.runAsync(
    "INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)",
    [key, String(value)],
  );
};

// ── Snacks catalog ────────────────────────────────────────────────────────────

export const getSnacks = async () => {
  await initDb();
  const conn = await getDb();
  return conn.getAllAsync("SELECT * FROM snacks ORDER BY name ASC");
};

export const addSnack = async (
  name,
  category = "General",
  stock = 0,
  unit = "pcs",
  price = 0,
  brand = "",
  flavor = "",
  image = "",
) => {
  await initDb();
  const conn = await getDb();
  const displayName = buildSnackName(name, brand, flavor);
  await conn.runAsync(
    "INSERT INTO snacks (name,category,stock,unit,price,brand,flavor,image) VALUES (?,?,?,?,?,?,?,?)",
    [
      displayName,
      category.trim(),
      Number(stock) || 0,
      unit.trim() || "pcs",
      Number(price) || 0,
      String(brand || "").trim(),
      String(flavor || "").trim(),
      String(image || ""),
    ],
  );
};

export const updateSnack = async (
  id,
  name,
  category,
  unit,
  price,
  brand = "",
  flavor = "",
  image = "",
) => {
  await initDb();
  const conn = await getDb();
  const displayName = buildSnackName(name, brand, flavor);
  await conn.runAsync(
    "UPDATE snacks SET name=?,category=?,unit=?,price=?,brand=?,flavor=?,image=? WHERE id=?",
    [
      displayName,
      category.trim(),
      unit.trim(),
      Number(price) || 0,
      String(brand || "").trim(),
      String(flavor || "").trim(),
      String(image || ""),
      id,
    ],
  );
  await conn.runAsync("UPDATE logs SET snack_name=? WHERE snack_id=?", [
    displayName,
    id,
  ]);
};

export const deleteSnack = async (id) => {
  await initDb();
  const conn = await getDb();
  await conn.runAsync("DELETE FROM snacks WHERE id=?", [id]);
  await conn.runAsync("DELETE FROM logs WHERE snack_id=?", [id]);
};

// ── Logs ──────────────────────────────────────────────────────────────────────

export const addLog = async (
  snackId,
  snackName,
  type,
  qty,
  cost,
  note,
  date,
) => {
  await initDb();
  const conn = await getDb();
  const delta = type === "consume" ? -Math.abs(qty) : Math.abs(qty);
  await conn.runAsync("UPDATE snacks SET stock = stock + ? WHERE id=?", [
    delta,
    snackId,
  ]);
  await conn.runAsync(
    "INSERT INTO logs (snack_id,snack_name,type,qty,cost,note,date) VALUES (?,?,?,?,?,?,?)",
    [
      snackId,
      snackName,
      type,
      Math.abs(qty),
      Number(cost) || 0,
      note || "",
      date || new Date().toISOString(),
    ],
  );
};

export const getLogs = async (limit = 50, offset = 0) => {
  await initDb();
  const conn = await getDb();
  return conn.getAllAsync(
    "SELECT * FROM logs ORDER BY id DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );
};

export const batchAddLogs = async (entries) => {
  // entries: [{ snackId, snackName, type, qty, cost, note, date }]
  await initDb();
  const conn = await getDb();
  await conn.withTransactionAsync(async () => {
    for (const e of entries) {
      const delta = e.type === "consume" ? -Math.abs(e.qty) : Math.abs(e.qty);
      await conn.runAsync("UPDATE snacks SET stock = stock + ? WHERE id=?", [
        delta,
        e.snackId,
      ]);
      await conn.runAsync(
        "INSERT INTO logs (snack_id,snack_name,type,qty,cost,note,date) VALUES (?,?,?,?,?,?,?)",
        [
          e.snackId,
          e.snackName,
          e.type,
          Math.abs(e.qty),
          Number(e.cost) || 0,
          e.note || "",
          e.date || new Date().toISOString(),
        ],
      );
    }
  });
};

export const getRecentConsumedSnacks = async (limit = 6) => {
  // Returns the most recently consumed distinct snacks (one row per snack_id),
  // ordered by the latest consumption date. Used for quick re-logging.
  await initDb();
  const conn = await getDb();
  return conn.getAllAsync(
    `SELECT l.snack_id AS id, l.snack_name AS name, MAX(l.date) AS lastDate,
            s.brand, s.flavor, s.price, s.unit, s.stock, s.category, s.image
     FROM logs l
     LEFT JOIN snacks s ON s.id = l.snack_id
     WHERE l.type = 'consume'
     GROUP BY l.snack_id
     ORDER BY lastDate DESC
     LIMIT ?`,
    [limit],
  );
};

export const getLogsFiltered = async ({
  limit = 50,
  offset = 0,
  type = "all",
  startDate = null,
  endDate = null,
  searchQuery = "",
} = {}) => {
  await initDb();
  const conn = await getDb();
  const where = [];
  const params = [];
  if (type !== "all") {
    where.push("type=?");
    params.push(type);
  }
  if (startDate) {
    where.push("date>=?");
    params.push(startDate);
  }
  if (endDate) {
    where.push("date<=?");
    params.push(endDate);
  }
  const q = String(searchQuery || "").trim();
  if (q) {
    where.push("(snack_name LIKE ? OR note LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return conn.getAllAsync(
    `SELECT * FROM logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
};

export const getLogsByDateRange = async (startDate, endDate) => {
  await initDb();
  const conn = await getDb();
  return conn.getAllAsync(
    "SELECT * FROM logs WHERE date>=? AND date<=? ORDER BY id ASC",
    [startDate, endDate],
  );
};

export const updateLog = async (id, note, qty, cost, date) => {
  await initDb();
  const conn = await getDb();
  const old = await conn.getFirstAsync("SELECT * FROM logs WHERE id=?", [id]);
  if (!old) return;
  const oldDelta = old.type === "consume" ? -old.qty : old.qty;
  const newQty = Math.abs(Number(qty)) || old.qty;
  const newDelta = old.type === "consume" ? -newQty : newQty;
  // Reverse old effect, apply new
  await conn.runAsync("UPDATE snacks SET stock = stock - ? + ? WHERE id=?", [
    oldDelta,
    newDelta,
    old.snack_id,
  ]);
  await conn.runAsync("UPDATE logs SET note=?,qty=?,cost=?,date=? WHERE id=?", [
    note || old.note,
    newQty,
    Number(cost) ?? old.cost,
    date || old.date,
    id,
  ]);
};

export const deleteLog = async (id) => {
  await initDb();
  const conn = await getDb();
  const log = await conn.getFirstAsync("SELECT * FROM logs WHERE id=?", [id]);
  if (!log) return;
  const delta = log.type === "consume" ? log.qty : -log.qty;
  await conn.runAsync("UPDATE snacks SET stock = stock + ? WHERE id=?", [
    delta,
    log.snack_id,
  ]);
  await conn.runAsync("DELETE FROM logs WHERE id=?", [id]);
};

// ── Backup / Restore ──────────────────────────────────────────────────────────

export const getAllData = async () => {
  await initDb();
  const conn = await getDb();
  const snacks = await conn.getAllAsync("SELECT * FROM snacks ORDER BY id ASC");
  const logs = await conn.getAllAsync("SELECT * FROM logs ORDER BY id ASC");
  const settings = await conn.getAllAsync("SELECT * FROM settings");
  return { snacks, logs, settings };
};

export const restoreData = async (data) => {
  await initDb();
  const conn = await getDb();
  // Use a transaction with individual statements (same native-safe pattern as
  // clearAllData) to avoid "native database has rejected" errors from
  // multi-statement execAsync calls.
  await conn.withTransactionAsync(async () => {
    await conn.runAsync("DELETE FROM logs");
    await conn.runAsync("DELETE FROM snacks");
    await conn.runAsync("DELETE FROM settings");
  });
  for (const s of data.settings || []) {
    await conn.runAsync("INSERT INTO settings (key,value) VALUES (?,?)", [
      s.key,
      s.value,
    ]);
  }
  for (const sn of data.snacks || []) {
    await conn.runAsync(
      "INSERT INTO snacks (id,name,category,stock,unit,price,brand,flavor,image) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        sn.id,
        sn.name,
        sn.category,
        sn.stock,
        sn.unit,
        sn.price || 0,
        sn.brand || "",
        sn.flavor || "",
        sn.image || "",
      ],
    );
  }
  for (const l of data.logs || []) {
    await conn.runAsync(
      "INSERT INTO logs (id,snack_id,snack_name,type,qty,cost,note,date) VALUES (?,?,?,?,?,?,?,?)",
      [l.id, l.snack_id, l.snack_name, l.type, l.qty, l.cost, l.note, l.date],
    );
  }
};

export const clearAllData = async () => {
  await initDb();
  const conn = await getDb();
  // Run deletes inside a transaction using individual statements. Passing
  // multiple semicolon-separated statements to a single execAsync call can be
  // rejected by the native SQLite layer ("native database has rejected").
  await conn.withTransactionAsync(async () => {
    await conn.runAsync("DELETE FROM logs");
    await conn.runAsync("DELETE FROM snacks");
    await conn.runAsync("DELETE FROM settings");
  });
  await seedDefaultSnacks(conn);
};
