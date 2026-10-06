// Generated from UrbanNX/urbanwave c33b63887010f0b0de6c64ed9e895fa2677c05b8, vibes/packages/glb-project/glb.ts.
// Run node build-contract.mjs; do not edit or maintain a separate schema.

// projectTypes.ts
function emptyEdits() {
  return {
    openings: {},
    rooms: {},
    wallHeights: {},
    wallMarks: {},
    addedOpenings: [],
    rates: {},
    hidden: [],
    budget: 2e5
  };
}

// project.ts
var FORBIDDEN = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
var object = (value, where) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${where} must be an object`);
  for (const key of Object.keys(value))
    if (FORBIDDEN.has(key)) throw new Error(`${where} contains an unsafe key`);
  return value;
};
var array = (value, where) => {
  if (!Array.isArray(value)) throw new Error(`${where} must be an array`);
  return value;
};
var text = (value, where) => {
  if (typeof value !== "string") throw new Error(`${where} must be text`);
  return value;
};
var number = (value, where, min = -Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value) && Math.abs(value) > Number.MAX_SAFE_INTEGER || value < min)
    throw new Error(`${where} must be a finite safe number`);
  return value;
};
var positive = (value, where) => {
  const result = number(value, where, 0);
  if (result === 0) throw new Error(`${where} must be positive`);
  return result;
};
var optionalNumber = (value, where) => value === void 0 ? void 0 : number(value, where);
var nullableNumber = (value, where) => value === null ? null : number(value, where);
var boolean = (value, where) => {
  if (typeof value !== "boolean") throw new Error(`${where} must be true or false`);
  return value;
};
var record = (value, where, read) => {
  const source = object(value, where);
  const result = /* @__PURE__ */ Object.create(null);
  for (const [key, item] of Object.entries(source)) {
    if (FORBIDDEN.has(key)) throw new Error(`${where} contains an unsafe key`);
    result[key] = read(item, `${where}.${key}`);
  }
  return result;
};
var point = (value, where) => {
  const a = array(value, where);
  if (a.length !== 2) throw new Error(`${where} must have two coordinates`);
  return [number(a[0], `${where}[0]`), number(a[1], `${where}[1]`)];
};
var strings = (value, where) => array(value, where).map((v, i) => text(v, `${where}[${i}]`));
function opening(value, where) {
  const v = object(value, where);
  const axis = text(v.axis, `${where}.axis`);
  if (axis !== "x" && axis !== "z") throw new Error(`${where}.axis is invalid`);
  const sill = number(v.sill, `${where}.sill`);
  const head = number(v.head, `${where}.head`);
  if (head <= sill) throw new Error(`${where}.head must exceed sill`);
  return {
    id: text(v.id, `${where}.id`),
    tag: v.tag === void 0 ? void 0 : text(v.tag, `${where}.tag`),
    floor: text(v.floor, `${where}.floor`),
    kind: text(v.kind, `${where}.kind`),
    axis,
    width: positive(v.width, `${where}.width`),
    sill,
    head,
    center: point(v.center, `${where}.center`),
    parts: strings(v.parts, `${where}.parts`),
    style: v.style == null ? typeof v.style_n === "string" ? v.style_n : void 0 : text(v.style, `${where}.style`),
    material: v.material == null ? void 0 : text(v.material, `${where}.material`)
  };
}
function room(value, where) {
  const v = object(value, where);
  return {
    id: text(v.id, `${where}.id`),
    name: text(v.name, `${where}.name`),
    level: number(v.level, `${where}.level`),
    area: number(v.area, `${where}.area`, 0),
    perimeter_wall: number(v.perimeter_wall, `${where}.perimeter_wall`, 0),
    wall_height: number(v.wall_height, `${where}.wall_height`, 0),
    centroid: point(v.centroid, `${where}.centroid`),
    poly: array(v.poly, `${where}.poly`).map((p, i) => point(p, `${where}.poly[${i}]`)),
    holes: v.holes === void 0 ? void 0 : array(v.holes, `${where}.holes`).map(
      (h, i) => array(h, `${where}.holes[${i}]`).map(
        (p, j) => point(p, `${where}.holes[${i}][${j}]`)
      )
    ),
    openings: strings(v.openings, `${where}.openings`),
    apertures: v.apertures === void 0 ? void 0 : array(v.apertures, `${where}.apertures`).map((a, i) => {
      const x = object(a, `${where}.apertures[${i}]`);
      return {
        width: number(x.width, "aperture.width", 0),
        sill: number(x.sill, "aperture.sill"),
        head: number(x.head, "aperture.head")
      };
    })
  };
}
function line(value, where) {
  const v = object(value, where);
  return {
    section: text(v.section, `${where}.section`),
    category: text(v.category, `${where}.category`),
    description: text(v.description, `${where}.description`),
    unit: text(v.unit, `${where}.unit`),
    qty: nullableNumber(v.qty, `${where}.qty`),
    m2: v.m2 === void 0 ? void 0 : nullableNumber(v.m2, `${where}.m2`),
    key: v.key === void 0 ? void 0 : v.key === null ? null : text(v.key, `${where}.key`),
    note: v.note === void 0 ? void 0 : text(v.note, `${where}.note`),
    rate: v.rate === void 0 ? void 0 : nullableNumber(v.rate, `${where}.rate`)
  };
}
function parseEdits(value) {
  if (value === void 0 || value === null) return emptyEdits();
  const v = object(value, "edits");
  const openings = record(v.openings ?? {}, "edits.openings", (x, p) => {
    const a = object(x, p);
    return {
      width: positive(a.width, `${p}.width`),
      height: positive(a.height, `${p}.height`),
      head: number(a.head, `${p}.head`),
      style: text(a.style ?? "", `${p}.style`),
      glazing: text(a.glazing ?? "", `${p}.glazing`),
      angle: number(a.angle ?? 0, `${p}.angle`),
      removed: boolean(a.removed ?? false, `${p}.removed`)
    };
  });
  const rooms = record(v.rooms ?? {}, "edits.rooms", (x, p) => {
    const a = object(x, p);
    const from = number(a.from ?? 0, `${p}.from`, 0);
    const to = number(a.to ?? 0, `${p}.to`, 0);
    if (to < from) throw new Error(`${p} has a reversed tile range`);
    return {
      finish: text(a.finish ?? "As modelled", `${p}.finish`),
      ceiling: boolean(a.ceiling ?? true, `${p}.ceiling`),
      floorTiles: boolean(a.floorTiles ?? false, `${p}.floorTiles`),
      wallTiles: boolean(a.wallTiles ?? false, `${p}.wallTiles`),
      tileWidth: number(a.tileWidth ?? 0.6, `${p}.tileWidth`, 1e-3),
      tileHeight: number(a.tileHeight ?? 0.6, `${p}.tileHeight`, 1e-3),
      waste: number(a.waste ?? 10, `${p}.waste`, 0),
      from,
      to,
      manualArea: a.manualArea == null ? null : number(a.manualArea, `${p}.manualArea`, 0)
    };
  });
  const wallHeights = record(v.wallHeights ?? {}, "edits.wallHeights", (x, p) => positive(x, p));
  const wallMarks = record(
    v.wallMarks ?? {},
    "edits.wallMarks",
    (x, p) => {
      const a = object(x, p);
      const action = text(a.action, `${p}.action`);
      if (action !== "demolish" && action !== "new") throw new Error(`${p}.action is invalid`);
      return { action, area: number(a.area, `${p}.area`, 0) };
    }
  );
  const addedOpenings = array(v.addedOpenings ?? [], "edits.addedOpenings").map(
    (x, i) => {
      const a = object(x, `edits.addedOpenings[${i}]`);
      return {
        ...opening(a, `edits.addedOpenings[${i}]`),
        wall: text(a.wall, "added opening wall"),
        glazing: text(a.glazing ?? "", "added opening glazing"),
        angle: number(a.angle ?? 0, "added opening angle")
      };
    }
  );
  const rates = record(v.rates ?? {}, "edits.rates", (x, p) => number(x, p, 0));
  const hidden = array(v.hidden ?? [], "edits.hidden").map((x, i) => {
    const a = object(x, `edits.hidden[${i}]`);
    return {
      id: text(a.id, "hidden.id"),
      enabled: boolean(a.enabled, "hidden.enabled"),
      section: text(a.section, "hidden.section"),
      category: text(a.category, "hidden.category"),
      description: text(a.description, "hidden.description"),
      unit: text(a.unit, "hidden.unit"),
      qty: number(a.qty, "hidden.qty", 0),
      rate: nullableNumber(a.rate, "hidden.rate")
    };
  });
  return {
    openings,
    rooms,
    wallHeights,
    wallMarks,
    addedOpenings,
    rates,
    hidden,
    budget: number(v.budget ?? 2e5, "edits.budget", 0)
  };
}
function parseProject(textValue) {
  let raw;
  try {
    raw = JSON.parse(textValue);
  } catch {
    throw new Error("Project is not valid JSON");
  }
  const v = object(raw, "project file");
  if (v.format !== "urbanwave-editor-project/1") throw new Error("Unsupported project format");
  const p = object(v.project, "project");
  const id = text(p.id, "project.id");
  const rooms = object(v.rooms, "rooms");
  const bq = object(v.bq, "bq");
  const storeys = record(p.storeys, "project.storeys", (x, path) => {
    const a = object(x, path);
    return {
      level: number(a.level, `${path}.level`),
      label: a.label === void 0 ? void 0 : text(a.label, `${path}.label`),
      cutBase: optionalNumber(a.cutBase, `${path}.cutBase`),
      height: optionalNumber(a.height ?? a.originalHeight, `${path}.height`)
    };
  });
  const project = {
    format: "urbanwave-editor-project/1",
    model: v.model === void 0 ? void 0 : text(v.model, "model"),
    project: {
      id,
      name: text(p.name, "project.name"),
      revision: p.revision === void 0 ? void 0 : text(p.revision, "project.revision"),
      storeys,
      groups: strings(p.groups, "project.groups"),
      quantityFootMetres: id.toLowerCase() === "kaya" ? 0.3 : 0.3048,
      eyeViews: p.eyeViews === void 0 ? void 0 : record(p.eyeViews, "eyeViews", (value, path) => {
        const view = object(value, path);
        const coordinates = (value2) => {
          const values = array(value2, path);
          if (values.length !== 3) throw new Error(`${path} needs three coordinates`);
          return values.map((item) => number(item, path));
        };
        return {
          label: text(view.label, path),
          pos: coordinates(view.pos),
          target: coordinates(view.target)
        };
      })
    },
    meta: record(v.meta, "meta", (x) => {
      const value = object(x, "meta value");
      return Object.fromEntries(
        ["floor", "type", "part_of", "spec"].filter((key) => value[key] !== void 0).map((key) => [key, text(value[key], `meta.${key}`)])
      );
    }),
    rooms: {
      rooms: array(rooms.rooms, "rooms.rooms").map((x, i) => room(x, `rooms.rooms[${i}]`)),
      openings: record(rooms.openings, "rooms.openings", opening),
      schedule: rooms.schedule === void 0 ? void 0 : {
        me: array(object(rooms.schedule, "schedule").me ?? [], "schedule.me").map(
          (value) => {
            return record(
              value,
              "schedule entry",
              (cell, path) => cell === null ? null : typeof cell === "number" ? number(cell, path) : text(cell, path)
            );
          }
        )
      }
    },
    bq: {
      order: strings(bq.order, "bq.order"),
      lines: array(bq.lines, "bq.lines").map((x, i) => line(x, `bq.lines[${i}]`)),
      rates: array(bq.rates, "bq.rates").map((x, i) => {
        const a = array(x, `bq.rates[${i}]`);
        if (a.length !== 4) throw new Error("Invalid rate");
        return [
          text(a[0], "rate category"),
          text(a[1], "rate unit"),
          nullableNumber(a[2], "rate"),
          text(a[3], "rate basis")
        ];
      })
    },
    newWalls: array(v.newWalls, "newWalls").map((x) => {
      const a = object(x, "newWall");
      const axis = text(a.axis, "newWall.axis");
      if (axis !== "x" && axis !== "z") throw new Error("Invalid wall axis");
      return {
        id: text(a.id, "wall.id"),
        floor: text(a.floor, "wall.floor"),
        axis,
        x0: number(a.x0, "wall.x0"),
        x1: number(a.x1, "wall.x1"),
        z0: number(a.z0, "wall.z0"),
        z1: number(a.z1, "wall.z1"),
        len: number(a.len, "wall.len", 0),
        t: number(a.t, "wall.t", 0),
        base: number(a.base, "wall.base"),
        top: number(a.top, "wall.top")
      };
    }),
    estimate: array(v.estimate, "estimate").map((x) => {
      const a = object(x, "estimate line");
      return {
        section: text(a.section, "estimate.section"),
        category: text(a.category, "estimate.category"),
        description: text(a.description, "estimate.description"),
        unit: text(a.unit, "estimate.unit"),
        qty: number(a.qty, "estimate.qty", 0),
        suggested: a.suggested === void 0 ? void 0 : nullableNumber(a.suggested, "estimate.suggested"),
        override: a.override === void 0 ? void 0 : nullableNumber(a.override, "estimate.override"),
        total: optionalNumber(a.total, "estimate.total")
      };
    }),
    edits: v.edits === void 0 ? void 0 : parseEdits(v.edits),
    scenarios: v.scenarios === void 0 ? void 0 : array(v.scenarios, "scenarios").map((item) => {
      const scenario = object(item, "scenario");
      return {
        name: text(scenario.name, "scenario.name"),
        edits: parseEdits(scenario.edits)
      };
    }),
    pinnedScenario: v.pinnedScenario === void 0 ? void 0 : text(v.pinnedScenario, "pinnedScenario")
  };
  return project;
}

// glb.ts
var JSON_CHUNK = 1313821514;
var FIELD = "urbanwaveProject";
var object2 = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid GLB object");
  return value;
};
function unpack(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || view.getUint32(0, true) !== 1179937895 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length)
    throw new Error("Invalid GLB header or length");
  const chunks = [];
  for (let offset = 12; offset < bytes.length; ) {
    if (offset + 8 > bytes.length) throw new Error("Truncated GLB chunk");
    const length = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.length)
      throw new Error("Invalid GLB chunk length");
    if (!chunks.length && type !== JSON_CHUNK || chunks.length && type === JSON_CHUNK)
      throw new Error("GLB needs exactly one initial JSON chunk");
    chunks.push({ type, bytes: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const json = object2(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(chunks[0].bytes))
  );
  if (object2(json.asset).version !== "2.0") throw new Error("Unsupported glTF version");
  if (!Array.isArray(json.scenes)) throw new Error("GLB has no scenes");
  const index = json.scene ?? 0;
  if (!Number.isInteger(index) || Number(index) < 0)
    throw new Error("Invalid default scene");
  const scene = object2(json.scenes[Number(index)]);
  return { json, scene, chunks };
}
function pack(json, chunks) {
  const text2 = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(text2.length / 4) * 4).fill(32);
  padded.set(text2);
  const all = [{ type: JSON_CHUNK, bytes: padded }, ...chunks.slice(1)];
  const output = new Uint8Array(12 + all.reduce((n, c) => n + 8 + c.bytes.length, 0));
  const view = new DataView(output.buffer);
  view.setUint32(0, 1179937895, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.length, true);
  let offset = 12;
  for (const chunk of all) {
    view.setUint32(offset, chunk.bytes.length, true);
    view.setUint32(offset + 4, chunk.type, true);
    output.set(chunk.bytes, offset + 8);
    offset += 8 + chunk.bytes.length;
  }
  return output;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item)])
    );
  return value;
}
function readEmbeddedProject(bytes) {
  const { scene } = unpack(bytes);
  if (scene.extras === void 0) return null;
  const extras = object2(scene.extras);
  if (!Object.hasOwn(extras, FIELD)) return null;
  const text2 = JSON.stringify(extras[FIELD]);
  if (new TextEncoder().encode(text2).length > 1e7)
    throw new Error("Embedded project exceeds 10 MB");
  return parseProject(text2);
}
async function glbIdentity(bytes) {
  const { json, chunks } = unpack(bytes);
  for (const value of json.scenes) {
    const scene = object2(value);
    if (scene.extras !== void 0) {
      const extras = object2(scene.extras);
      delete extras[FIELD];
      if (!Object.keys(extras).length) delete scene.extras;
    }
  }
  const hash = async (input) => Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(input))),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  return {
    modelKey: `glb-content-v1:${await hash(pack(object2(canonical(json)), chunks))}`,
    legacyModelKey: await hash(bytes)
  };
}
async function loadGlbProject(bytes) {
  const project = readEmbeddedProject(bytes);
  const identity = await glbIdentity(bytes);
  if (project?.model && project.model !== identity.modelKey)
    throw new Error("Embedded project belongs to different model content");
  return { ...identity, project };
}
async function embedProject(bytes, value) {
  const project = parseProject(JSON.stringify(value));
  const { modelKey, legacyModelKey } = await glbIdentity(bytes);
  if (project.model && project.model !== modelKey && project.model !== legacyModelKey)
    throw new Error("Project belongs to a different GLB");
  project.model = modelKey;
  const { json, scene, chunks } = unpack(bytes);
  scene.extras = {
    ...scene.extras === void 0 ? {} : object2(scene.extras),
    [FIELD]: project
  };
  const output = pack(json, chunks);
  readEmbeddedProject(output);
  if (output.length > 2e8) throw new Error("Annotated GLB exceeds 200 MB");
  return output;
}
export {
  embedProject,
  glbIdentity,
  loadGlbProject,
  readEmbeddedProject
};
