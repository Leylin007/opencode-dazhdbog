// @bun
// src/tui.tsx
import { memo as _$memo4 } from "@opentui/solid";
import { createComponent as _$createComponent4 } from "@opentui/solid";
import { effect as _$effect4 } from "@opentui/solid";
import { insertNode as _$insertNode4 } from "@opentui/solid";
import { insert as _$insert4 } from "@opentui/solid";
import { use as _$use3 } from "@opentui/solid";
import { setProp as _$setProp4 } from "@opentui/solid";
import { createElement as _$createElement4 } from "@opentui/solid";
import { readFileSync as readFileSync3 } from "fs";
import { join as join9 } from "path";
import { spawn as spawn2 } from "child_process";

// src/fs-atomic.ts
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname } from "path";
var LOCK_CODES = new Set(["EBUSY", "EPERM", "EACCES", "ENOTEMPTY", "EMFILE", "ENFILE"]);
function errorMessage(error) {
  if (error instanceof Error)
    return error.message;
  return String(error);
}
function isLockError(error) {
  return typeof error === "object" && error !== null && LOCK_CODES.has(String(error.code));
}
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function readTextFile(path) {
  if (!existsSync(path))
    return;
  return readFileSync(path, "utf8");
}
async function writeTextFileAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, text, "utf8");
  let lastError;
  for (let attempt = 0;attempt < 8; attempt += 1) {
    try {
      renameSync(temp, path);
      return;
    } catch (error) {
      lastError = error;
      if (!isLockError(error))
        break;
      await delay(30 * (attempt + 1));
    }
  }
  try {
    unlinkSync(temp);
  } catch {}
  throw new Error(`Cannot write ${path}: ${errorMessage(lastError)}`);
}
function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}

// src/tui.tsx
import { CliRenderEvents as CliRenderEvents3, CodeRenderable, InputRenderable, SyntaxStyle, TextAttributes, isRenderable } from "@opentui/core";
import { Show as Show4, createEffect as createEffect3, createMemo as createMemo2, createSignal as createSignal4, onCleanup as onCleanup3 } from "solid-js";
import { useTerminalDimensions as useTerminalDimensions4, useRenderer } from "@opentui/solid";

// src/components/skills-manager-panel.tsx
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { For, Show, createMemo, createSignal } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";

// src/skill-data.ts
import { posix, win32 } from "path";
var compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
var estimateTokens = (text) => Math.ceil(Buffer.byteLength(text, "utf8") / 4);
var formatTokenCount = (tokens) => compactNumber.format(tokens).toLowerCase();
function renderSkillListing(skill) {
  return [
    "  <skill>",
    `    <id>${skill.id}</id>`,
    `    <name>${skill.name}</name>`,
    `    <description>${skill.description}</description>`,
    "  </skill>"
  ].join(`
`);
}
function estimateSkillListingTotal(skills) {
  const visible = skills.filter((skill) => skill.modelVisible !== false && skill.description !== undefined).sort((a, b) => a.id.localeCompare(b.id));
  if (visible.some((skill) => skill.name === undefined))
    return;
  if (visible.length === 0)
    return 0;
  return estimateTokens([
    "Skills provide specialized instructions and workflows for specific tasks.",
    "Use the skill tool to load a skill when a task matches its description.",
    "The user may also invoke a skill directly. When that happens, its instructions appear in the conversation as a <skill_content> block, the same shape the skill tool returns. A skill that is already present this way does not need to be invoked again.",
    "<available_skills>",
    ...visible.map(renderSkillListing),
    "</available_skills>"
  ].join(`
`));
}
var pathFor = (path) => /^(?:[a-z]:[\\/]|\\\\)/i.test(path) ? win32 : posix;
function renderSkillLoad(skill) {
  if (skill.name === undefined || !skill.path)
    return;
  const path = pathFor(skill.path);
  const files = path.basename(skill.path) === "SKILL.md" ? skill.fileSamples : [];
  if (files === undefined)
    return;
  return [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    "",
    skill.content.trim(),
    "",
    `Base directory for this skill: ${path.dirname(skill.path)}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "Note: file list is sampled.",
    "",
    "<skill_files>",
    ...files.map((file) => `<file>${file}</file>`),
    "</skill_files>",
    "</skill_content>"
  ].join(`
`);
}
function estimateSkillTokens(skill, mode) {
  if (skill.name === undefined)
    return;
  const listing = skill.modelVisible === false || skill.description === undefined ? 0 : estimateTokens(renderSkillListing(skill));
  if (mode === "listing")
    return listing;
  const output = renderSkillLoad(skill);
  if (output === undefined)
    return;
  const load = estimateTokens(output);
  return mode === "loaded-total" ? listing + load : load;
}
async function loadSkillFileSamples(ctx, skill, location, signal) {
  if (!skill.path || skill.name === undefined)
    return;
  const path = pathFor(skill.path);
  if (path.basename(skill.path) !== "SKILL.md")
    return [];
  const files = [];
  const visit = async (directory) => {
    if (signal?.aborted)
      return;
    const response = await ctx.client.file.list({ location, path: directory }, { signal });
    if (signal?.aborted)
      return;
    const base = response.location.directory ?? location.directory;
    if (!base)
      throw new Error("File sample location is unavailable");
    const entries = response.data.map((entry) => {
      const absolute = path.resolve(base, entry.path);
      const relative = path.relative(directory, absolute);
      if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error("File sample escaped its skill directory");
      }
      return { type: entry.type, absolute, key: absolute + (entry.type === "directory" ? path.sep : "") };
    }).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    for (const entry of entries) {
      if (signal?.aborted || files.length === 10)
        return;
      if (entry.type === "directory")
        await visit(entry.absolute);
      else if (path.basename(entry.absolute) !== "SKILL.md")
        files.push(entry.absolute);
    }
  };
  await visit(path.dirname(skill.path));
  return signal?.aborted ? undefined : files;
}
async function loadAvailableSkills(ctx, location = ctx.location ?? ctx.data.location.default()) {
  await Promise.all([
    ctx.data.location.skill.sync(location),
    ctx.data.location.agent.sync(location)
  ]);
  return toSummaries(ctx.data.location.skill.list(location) ?? []);
}
function matches(input, pattern) {
  let escaped = pattern.replaceAll("\\", "/").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  if (escaped.endsWith(" .*"))
    escaped = escaped.slice(0, -3) + "( .*)?";
  return new RegExp(`^${escaped}$`, process.platform === "win32" ? "si" : "s").test(input.replaceAll("\\", "/"));
}
function isModelVisible(entry, id, rules) {
  if (entry.description === undefined || entry.autoinvoke === false)
    return false;
  const permission = rules.find((rule) => matches("skill", rule.action) && matches(id, rule.resource));
  return permission?.effect !== "deny";
}
function toSummaries(skills, permissions = [], loadedIDs, mode = "model") {
  const deduped = new Map;
  const rules = [...permissions].reverse();
  for (const entry of skills) {
    if (typeof entry.id !== "string" || !entry.id)
      continue;
    const id = entry.id;
    const modelVisible = isModelVisible(entry, id, rules);
    if (mode === "loaded" && !loadedIDs?.has(id))
      continue;
    if (mode === "model" && !modelVisible && !loadedIDs?.has(id))
      continue;
    deduped.set(id, deduped.get(id) ?? {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      path: entry.path,
      content: entry.content ?? "",
      modelVisible
    });
  }
  for (const id of loadedIDs ?? []) {
    if (typeof id === "string" && id && !deduped.has(id))
      deduped.set(id, { id, content: "", modelVisible: false });
  }
  return [...deduped.values()].sort((a, b) => a.id.localeCompare(b.id));
}
function extractMessageSkillLoads(message) {
  const m = message;
  if (m.type === "assistant" && Array.isArray(m.content)) {
    const ids = [];
    for (const entry of m.content) {
      const s = entry;
      if (s.type !== "tool" || s.name !== "skill" || s.state?.status !== "completed" || typeof s.state.input?.id !== "string" || s.state.input.id.length === 0)
        continue;
      if ((Array.isArray(s.state.content) ? s.state.content : []).some((part) => typeof part?.text === "string" && part.text.startsWith('<skill_content name="')))
        ids.push(s.state.input.id);
    }
    return ids;
  }
  if (m.type === "skill" && typeof m.skill === "string" && m.skill.length > 0) {
    return [m.skill];
  }
  if (m.type === "user" && Array.isArray(m.skills)) {
    return m.skills.map((attachment) => attachment?.id).filter((id) => typeof id === "string" && id.length > 0);
  }
  return [];
}
function extractSkillLoadState(messages) {
  const loaded = new Set;
  let compactionID;
  for (const message of messages) {
    const entry = message;
    if (entry.type === "compaction" && entry.status === "completed") {
      loaded.clear();
      compactionID = entry.id;
    }
    for (const id of extractMessageSkillLoads(message))
      loaded.add(id);
  }
  return { loaded, compactionID };
}
async function backfillLoadedSkills(ctx, sessionID, signal) {
  const loaded = new Set;
  let cursor;
  do {
    if (signal?.aborted)
      return;
    const page = await ctx.client.message.list({
      sessionID,
      limit: 200,
      ...cursor ? { cursor } : { order: "desc" }
    });
    if (signal?.aborted)
      return;
    for (const message of page.data) {
      if (message.type === "compaction" && message.status === "completed") {
        return { loaded, compactionID: message.id };
      }
      for (const id of extractMessageSkillLoads(message))
        loaded.add(id);
    }
    cursor = page.cursor?.next;
  } while (cursor);
  return { loaded };
}

// src/components/skills-manager-panel.tsx
var COLLAPSED = {};
var lastToggle = new Map;
var SKILL_EXPANDED = {};
var skillExpandLast = new Map;
function SkillsManagerPanel(props) {
  const termDims = useTerminalDimensions();
  const loadedColor = () => props.theme().surface("dialog").background.action.primary.focused;
  const normalColor = () => props.themeMode() === "light" ? "#000000" : "#ffffff";
  const theme = () => props.theme();
  const mutedColor = () => theme().text.muted;
  const accentColor = () => theme().hue.accent[200];
  const errorColor = () => theme().text.feedback.error.base;
  const warningColor = () => theme().text.feedback.warning.base;
  const successColor = () => theme().text.feedback.success.base;
  const [stateWidth, setStateWidth] = createSignal(0);
  const [openMap, setOpenMap] = createSignal({
    ...COLLAPSED
  });
  const isOpen = (key) => openMap()[key] === true;
  const toggleOpen = (key) => {
    const now = Date.now();
    const prev = lastToggle.get(key) ?? 0;
    if (now - prev < 120)
      return;
    lastToggle.set(key, now);
    const next = !(COLLAPSED[key] === true);
    COLLAPSED[key] = next;
    setOpenMap({
      ...COLLAPSED
    });
  };
  const sumUsage = (tools) => tools.reduce((sum, tool) => sum + (props.usageTools()[tool.name] ?? 0), 0);
  const skillTokens = (skill) => estimateSkillTokens(skill, "listing") ?? Math.max(1, Math.round((skill.name?.length ?? 8) / 4));
  const allSkillTokens = createMemo(() => props.tree().allSkills.reduce((s, sk) => s + skillTokens(sk), 0));
  const allToolTokens = createMemo(() => props.tools().reduce((s, g) => s + g.tools.reduce((s2, t) => s2 + t.tokens, 0), 0));
  const allPluginTokens = createMemo(() => props.plugins().filter((p) => !p.id.startsWith("__group__")).reduce((s, p) => s + Math.max(1, Math.round(p.label.length / 4)) + p.tools.reduce((s2, t) => s2 + t.tokens, 0), 0));
  const allMcpTokens = createMemo(() => props.mcp().reduce((s, g) => s + g.servers.reduce((s2, sv) => s2 + Math.max(1, Math.round(sv.name.length / 4)) + sv.tools.reduce((s3, t) => s3 + t.tokens, 0), 0), 0));
  const unassignedEnabled = () => COLLAPSED["unassigned-enabled"] !== false;
  const toggleUnassignedEnabled = () => {
    const now = Date.now();
    const prev = lastToggle.get("unassigned-enabled") ?? 0;
    if (now - prev < 120)
      return;
    lastToggle.set("unassigned-enabled", now);
    const next = !(COLLAPSED["unassigned-enabled"] !== false);
    COLLAPSED["unassigned-enabled"] = next;
    setOpenMap({
      ...COLLAPSED
    });
    for (const skill of props.tree().unassigned.skills) {
      if (skill.enabled !== next)
        props.onToggleSkill(skill);
    }
  };
  const loadedCount = createMemo(() => {
    const loaded = props.loadedIDs();
    return props.tree().allSkills.filter((skill) => loaded.has(skill.id)).length;
  });
  const enabledSkills = createMemo(() => props.tree().allSkills.filter((skill) => skill.enabled));
  const fullState = () => {
    const tree = props.tree();
    const loaded = loadedCount();
    return `(${tree.enabledCount}/${tree.total})${loaded > 0 ? ` \xB7 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E ${loaded}` : ""}`;
  };
  const state = () => {
    if (fullState().length <= stateWidth())
      return fullState();
    const tree = props.tree();
    return `(${tree.enabledCount}/${tree.total})`;
  };
  const estimates = createMemo(() => {
    const mode = props.tokenMode();
    return new Map(mode === "off" ? [] : props.tree().allSkills.map((skill) => [skill.id, estimateSkillTokens(skill, mode)]));
  });
  const tokenLabel = (tokens) => tokens === undefined ? "-" : `~${formatTokenCount(tokens)} tok`;
  const totalTokens = createMemo(() => {
    const visible = enabledSkills().filter((skill) => skill.modelVisible !== false);
    const mode = props.tokenMode();
    if (mode === "listing")
      return tokenLabel(estimateSkillListingTotal(visible));
    const counts = visible.map((skill) => mode === "loaded-total" ? estimateSkillTokens(skill, "load-delta") : estimates().get(skill.id));
    if (counts.some((count) => count === undefined))
      return tokenLabel(undefined);
    const load = counts.reduce((sum, count) => sum + count, 0);
    const listing = mode === "loaded-total" ? estimateSkillListingTotal(visible) : 0;
    return tokenLabel(listing === undefined ? undefined : listing + load);
  });
  const tokenWidth = createMemo(() => Math.max(totalTokens().length, ...[...estimates().values()].map((count) => tokenLabel(count).length)));
  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const skillColor = (skill) => {
    if (!skill.enabled)
      return mutedColor();
    return props.loadedIDs().has(skill.id) ? loadedColor() : normalColor();
  };
  const skillStatusColor = (skill) => {
    if (!skill.enabled)
      return mutedColor();
    if (skill.missingMcpCount > 0 || skill.declaredDisabledCount > 0)
      return errorColor();
    return successColor();
  };
  const toolStatusColor = (tool) => {
    if (!tool.enabled)
      return tool.users && tool.users > 0 ? errorColor() : mutedColor();
    return successColor();
  };
  const SkillRow = (row) => {
    const [expandedSig, setExpandedSig] = createSignal(SKILL_EXPANDED[row.skill.id] === true);
    const setExpanded = (next) => {
      SKILL_EXPANDED[row.skill.id] = next;
      setExpandedSig(next);
    };
    const hasTools = () => (row.skill.declaredTools?.length ?? 0) > 0;
    return (() => {
      var _el$ = _$createElement("box"), _el$2 = _$createElement("box"), _el$5 = _$createElement("box"), _el$6 = _$createElement("text"), _el$8 = _$createElement("text"), _el$11 = _$createElement("text"), _el$12 = _$createElement("text"), _el$13 = _$createElement("box"), _el$14 = _$createElement("text");
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "flexDirection", "column");
      _$setProp(_el$, "width", "100%");
      _$insertNode(_el$2, _el$5);
      _$insertNode(_el$2, _el$8);
      _$insertNode(_el$2, _el$11);
      _$insertNode(_el$2, _el$12);
      _$insertNode(_el$2, _el$13);
      _$setProp(_el$2, "width", "100%");
      _$setProp(_el$2, "flexDirection", "row");
      _$setProp(_el$2, "columnGap", 1);
      _$setProp(_el$2, "paddingLeft", 2);
      _$setProp(_el$2, "onMouseUp", (event) => {
        if (event.button !== 0 && event.button !== 1 && event.button !== 2)
          return;
        stop(event);
        if (event.button === 2)
          props.onSkillMenu(row.skill);
        else if (event.button === 1)
          props.onSkillMention(row.skill);
        else
          props.onShowDesc(row.skill.name ?? row.skill.id, props.getRu(`skill:${row.skill.id}`, row.skill.description ?? "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442."));
      });
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return hasTools();
        },
        get children() {
          var _el$3 = _$createElement("box"), _el$4 = _$createElement("text");
          _$insertNode(_el$3, _el$4);
          _$setProp(_el$3, "flexShrink", 0);
          _$setProp(_el$3, "onMouseUp", (event) => {
            if (event.button !== 0)
              return;
            const now = Date.now();
            const prev = skillExpandLast.get(row.skill.id) ?? 0;
            if (now - prev < 120)
              return;
            skillExpandLast.set(row.skill.id, now);
            stop(event);
            setExpanded(!expandedSig());
          });
          _$insert(_el$4, () => expandedSig() ? "\u25BC" : "\u25B6");
          _$effect((_$p) => _$setProp(_el$4, "fg", mutedColor(), _$p));
          return _el$3;
        }
      }), _el$5);
      _$insertNode(_el$5, _el$6);
      _$setProp(_el$5, "flexShrink", 0);
      _$setProp(_el$5, "onMouseUp", (event) => {
        if (event.button !== 0 && event.button !== 1 && event.button !== 2)
          return;
        stop(event);
        if (event.button === 2)
          props.onSkillMenu(row.skill);
        else if (event.button === 1)
          props.onSkillMention(row.skill);
        else
          props.onToggleSkill(row.skill);
      });
      _$insertNode(_el$6, _$createTextNode(`\u2022`));
      _$setProp(_el$6, "flexShrink", 0);
      _$setProp(_el$8, "flexGrow", 1);
      _$setProp(_el$8, "minWidth", 0);
      _$setProp(_el$8, "flexShrink", 1);
      _$setProp(_el$8, "wrapMode", "char");
      _$setProp(_el$8, "onMouseUp", (event) => {
        if (event.button !== 0 && event.button !== 1 && event.button !== 2)
          return;
        stop(event);
        if (event.button === 2)
          props.onSkillMenu(row.skill);
        else if (event.button === 1)
          props.onSkillMention(row.skill);
        else
          props.onShowDesc(row.skill.name ?? row.skill.id, props.getRu(`skill:${row.skill.id}`, row.skill.description ?? "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442."));
      });
      _$insert(_el$8, () => row.skill.name ?? row.skill.id);
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return hasTools();
        },
        get children() {
          var _el$9 = _$createElement("text");
          _$setProp(_el$9, "flexShrink", 0);
          _$insert(_el$9, () => `\uD83D\uDD27${row.skill.declaredTools.length}`);
          _$effect((_$p) => _$setProp(_el$9, "fg", mutedColor(), _$p));
          return _el$9;
        }
      }), _el$11);
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return row.skill.declaredDisabledCount > 0;
        },
        get children() {
          var _el$0 = _$createElement("text");
          _$setProp(_el$0, "flexShrink", 0);
          _$insert(_el$0, () => `\u26A0${row.skill.declaredDisabledCount}`);
          _$effect((_$p) => _$setProp(_el$0, "fg", warningColor(), _$p));
          return _el$0;
        }
      }), _el$11);
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return row.skill.missingMcpCount > 0;
        },
        get children() {
          var _el$1 = _$createElement("text");
          _$insertNode(_el$1, _$createTextNode(`\u26A0MCP`));
          _$setProp(_el$1, "flexShrink", 0);
          _$effect((_$p) => _$setProp(_el$1, "fg", warningColor(), _$p));
          return _el$1;
        }
      }), _el$11);
      _$setProp(_el$11, "flexShrink", 0);
      _$insert(_el$11, () => `(${props.usageSkills()[row.skill.id] ?? 0})`);
      _$setProp(_el$12, "height", 1);
      _$setProp(_el$12, "flexShrink", 0);
      _$setProp(_el$12, "textAlign", "right");
      _$insert(_el$12, () => {
        const estimate = estimateSkillTokens(row.skill, "listing");
        return tokenLabel(estimate ?? Math.max(1, Math.round((row.skill.name?.length ?? 8) / 4)));
      });
      _$insertNode(_el$13, _el$14);
      _$setProp(_el$13, "flexShrink", 0);
      _$setProp(_el$13, "onMouseUp", (event) => {
        if (event.button !== 0)
          return;
        stop(event);
        props.onAssignSkill(row.skill);
      });
      _$insertNode(_el$14, _$createTextNode(`\u21C4`));
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return _$memo(() => !!expandedSig())() && hasTools();
        },
        get children() {
          return _$createComponent(For, {
            get each() {
              return row.skill.declaredTools;
            },
            children: (tool) => (() => {
              var _el$16 = _$createElement("box"), _el$17 = _$createElement("text"), _el$19 = _$createElement("text"), _el$20 = _$createElement("text"), _el$21 = _$createElement("text");
              _$insertNode(_el$16, _el$17);
              _$insertNode(_el$16, _el$19);
              _$insertNode(_el$16, _el$20);
              _$insertNode(_el$16, _el$21);
              _$setProp(_el$16, "width", "100%");
              _$setProp(_el$16, "flexDirection", "row");
              _$setProp(_el$16, "columnGap", 1);
              _$setProp(_el$16, "paddingLeft", 5);
              _$setProp(_el$16, "onMouseUp", (event) => {
                if (event.button !== 0)
                  return;
                stop(event);
                props.onToggleTool(tool);
              });
              _$insertNode(_el$17, _$createTextNode(`\u2022`));
              _$setProp(_el$17, "flexShrink", 0);
              _$setProp(_el$19, "flexGrow", 1);
              _$setProp(_el$19, "minWidth", 0);
              _$setProp(_el$19, "flexShrink", 1);
              _$setProp(_el$19, "wrapMode", "char");
              _$setProp(_el$19, "onMouseUp", (event) => {
                if (event.button !== 0)
                  return;
                stop(event);
                props.onShowDesc(tool.name, props.getRu(`tool:${tool.name}`, `\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB.`));
              });
              _$insert(_el$19, () => tool.name);
              _$setProp(_el$20, "flexShrink", 0);
              _$insert(_el$20, () => `(${props.usageTools()[tool.name] ?? 0})`);
              _$setProp(_el$21, "flexShrink", 0);
              _$insert(_el$21, () => `~${Math.max(1, Math.round(tool.name.length / 4))} tok`);
              _$effect((_p$) => {
                var _v$8 = `skills-manager.skill.${row.skill.id}.tool.${tool.name}`, _v$9 = toolStatusColor(tool), _v$0 = tool.enabled ? normalColor() : mutedColor(), _v$1 = mutedColor(), _v$10 = mutedColor();
                _v$8 !== _p$.e && (_p$.e = _$setProp(_el$16, "id", _v$8, _p$.e));
                _v$9 !== _p$.t && (_p$.t = _$setProp(_el$17, "fg", _v$9, _p$.t));
                _v$0 !== _p$.a && (_p$.a = _$setProp(_el$19, "fg", _v$0, _p$.a));
                _v$1 !== _p$.o && (_p$.o = _$setProp(_el$20, "fg", _v$1, _p$.o));
                _v$10 !== _p$.i && (_p$.i = _$setProp(_el$21, "fg", _v$10, _p$.i));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined,
                i: undefined
              });
              return _el$16;
            })()
          });
        }
      }), null);
      _$effect((_p$) => {
        var _v$ = `skills-manager.skill.${row.skill.id}`, _v$2 = skillStatusColor(row.skill), _v$3 = skillColor(row.skill), _v$4 = mutedColor(), _v$5 = `skills-manager.skill.${row.skill.id}.tokens`, _v$6 = mutedColor(), _v$7 = accentColor();
        _v$ !== _p$.e && (_p$.e = _$setProp(_el$2, "id", _v$, _p$.e));
        _v$2 !== _p$.t && (_p$.t = _$setProp(_el$6, "fg", _v$2, _p$.t));
        _v$3 !== _p$.a && (_p$.a = _$setProp(_el$8, "fg", _v$3, _p$.a));
        _v$4 !== _p$.o && (_p$.o = _$setProp(_el$11, "fg", _v$4, _p$.o));
        _v$5 !== _p$.i && (_p$.i = _$setProp(_el$12, "id", _v$5, _p$.i));
        _v$6 !== _p$.n && (_p$.n = _$setProp(_el$12, "fg", _v$6, _p$.n));
        _v$7 !== _p$.s && (_p$.s = _$setProp(_el$14, "fg", _v$7, _p$.s));
        return _p$;
      }, {
        e: undefined,
        t: undefined,
        a: undefined,
        o: undefined,
        i: undefined,
        n: undefined,
        s: undefined
      });
      return _el$;
    })();
  };
  return (() => {
    var _el$22 = _$createElement("box"), _el$23 = _$createElement("box"), _el$24 = _$createElement("box"), _el$25 = _$createElement("text"), _el$26 = _$createElement("text"), _el$27 = _$createElement("b"), _el$29 = _$createElement("text"), _el$30 = _$createElement("box"), _el$31 = _$createElement("text"), _el$33 = _$createElement("box"), _el$34 = _$createElement("text"), _el$36 = _$createElement("box"), _el$37 = _$createElement("text"), _el$38 = _$createElement("text"), _el$39 = _$createElement("b"), _el$44 = _$createElement("text"), _el$45 = _$createElement("box"), _el$46 = _$createElement("text"), _el$57 = _$createElement("text"), _el$58 = _$createElement("box"), _el$59 = _$createElement("box"), _el$60 = _$createElement("text"), _el$61 = _$createElement("text"), _el$62 = _$createElement("b"), _el$64 = _$createElement("text"), _el$65 = _$createElement("text"), _el$66 = _$createElement("box"), _el$67 = _$createElement("text"), _el$69 = _$createElement("text"), _el$70 = _$createElement("box"), _el$71 = _$createElement("box"), _el$72 = _$createElement("text"), _el$73 = _$createElement("text"), _el$74 = _$createElement("b"), _el$76 = _$createElement("text"), _el$77 = _$createElement("text"), _el$78 = _$createElement("box"), _el$79 = _$createElement("text"), _el$81 = _$createElement("text"), _el$82 = _$createElement("box"), _el$83 = _$createElement("box"), _el$84 = _$createElement("text"), _el$85 = _$createElement("text"), _el$86 = _$createElement("b"), _el$88 = _$createElement("text"), _el$89 = _$createElement("text"), _el$90 = _$createElement("box"), _el$91 = _$createElement("text");
    _$insertNode(_el$22, _el$23);
    _$insertNode(_el$22, _el$36);
    _$insertNode(_el$22, _el$57);
    _$insertNode(_el$22, _el$58);
    _$insertNode(_el$22, _el$69);
    _$insertNode(_el$22, _el$70);
    _$insertNode(_el$22, _el$81);
    _$insertNode(_el$22, _el$82);
    _$setProp(_el$22, "flexDirection", "column");
    _$setProp(_el$22, "paddingRight", 1);
    _$insertNode(_el$23, _el$24);
    _$setProp(_el$23, "flexDirection", "column");
    _$setProp(_el$23, "width", "100%");
    _$insertNode(_el$24, _el$25);
    _$insertNode(_el$24, _el$26);
    _$insertNode(_el$24, _el$29);
    _$insertNode(_el$24, _el$30);
    _$insertNode(_el$24, _el$33);
    _$setProp(_el$24, "id", "skills-manager.presets");
    _$setProp(_el$24, "width", "100%");
    _$setProp(_el$24, "flexDirection", "row");
    _$setProp(_el$24, "columnGap", 1);
    _$setProp(_el$24, "onMouseUp", (event) => {
      if (event.button !== 0 && event.button !== 2)
        return;
      stop(event);
      toggleOpen("presets");
    });
    _$setProp(_el$25, "flexShrink", 0);
    _$insert(_el$25, () => isOpen("presets") ? "\u25BC" : "\u25B6");
    _$insertNode(_el$26, _el$27);
    _$setProp(_el$26, "flexGrow", 1);
    _$insertNode(_el$27, _$createTextNode(`\u041F\u0440\u0435\u0441\u0435\u0442\u044B`));
    _$setProp(_el$29, "flexShrink", 0);
    _$insert(_el$29, () => `(${props.presets().length})`);
    _$insertNode(_el$30, _el$31);
    _$setProp(_el$30, "flexShrink", 0);
    _$setProp(_el$30, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onFullRestart();
    });
    _$insertNode(_el$31, _$createTextNode(`\u21BB`));
    _$insertNode(_el$33, _el$34);
    _$setProp(_el$33, "flexShrink", 0);
    _$setProp(_el$33, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onCreatePreset();
    });
    _$insertNode(_el$34, _$createTextNode(`+`));
    _$insert(_el$23, _$createComponent(Show, {
      get when() {
        return isOpen("presets");
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return props.presets();
          },
          children: (preset) => (() => {
            var _el$93 = _$createElement("box"), _el$94 = _$createElement("text"), _el$96 = _$createElement("text"), _el$97 = _$createElement("text"), _el$98 = _$createElement("box"), _el$99 = _$createElement("text");
            _$insertNode(_el$93, _el$94);
            _$insertNode(_el$93, _el$96);
            _$insertNode(_el$93, _el$97);
            _$insertNode(_el$93, _el$98);
            _$setProp(_el$93, "width", "100%");
            _$setProp(_el$93, "flexDirection", "row");
            _$setProp(_el$93, "columnGap", 1);
            _$setProp(_el$93, "paddingLeft", 1);
            _$setProp(_el$93, "onMouseUp", (event) => {
              if (event.button === 2) {
                stop(event);
                props.onPresetMenu(preset.name);
                return;
              }
              if (event.button !== 0)
                return;
              stop(event);
              props.onApplyPreset(preset.name);
            });
            _$insertNode(_el$94, _$createTextNode(`\u2022`));
            _$setProp(_el$94, "flexShrink", 0);
            _$setProp(_el$96, "flexGrow", 1);
            _$setProp(_el$96, "wrapMode", "char");
            _$insert(_el$96, () => preset.name);
            _$setProp(_el$97, "flexShrink", 0);
            _$insert(_el$97, () => `~${preset.tokens} tok`);
            _$insertNode(_el$98, _el$99);
            _$setProp(_el$98, "flexShrink", 0);
            _$setProp(_el$98, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              props.onPresetMenu(preset.name);
            });
            _$insertNode(_el$99, _$createTextNode(`\u270E`));
            _$effect((_p$) => {
              var _v$46 = preset.dirty ? warningColor() : preset.active ? successColor() : mutedColor(), _v$47 = normalColor(), _v$48 = mutedColor(), _v$49 = mutedColor();
              _v$46 !== _p$.e && (_p$.e = _$setProp(_el$94, "fg", _v$46, _p$.e));
              _v$47 !== _p$.t && (_p$.t = _$setProp(_el$96, "fg", _v$47, _p$.t));
              _v$48 !== _p$.a && (_p$.a = _$setProp(_el$97, "fg", _v$48, _p$.a));
              _v$49 !== _p$.o && (_p$.o = _$setProp(_el$99, "fg", _v$49, _p$.o));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined
            });
            return _el$93;
          })()
        });
      }
    }), null);
    _$insertNode(_el$36, _el$37);
    _$insertNode(_el$36, _el$38);
    _$insertNode(_el$36, _el$44);
    _$insertNode(_el$36, _el$45);
    _$setProp(_el$36, "id", "skills-manager.header");
    _$setProp(_el$36, "width", "100%");
    _$setProp(_el$36, "flexDirection", "row");
    _$setProp(_el$36, "gap", 1);
    _$setProp(_el$36, "onMouseUp", (event) => {
      if (event.button !== 0 && event.button !== 2)
        return;
      stop(event);
      toggleOpen("skills");
    });
    _$setProp(_el$37, "flexShrink", 0);
    _$insert(_el$37, () => isOpen("skills") ? "\u25BC" : "\u25B6");
    _$insertNode(_el$38, _el$39);
    _$setProp(_el$38, "flexShrink", 0);
    _$insertNode(_el$39, _$createTextNode(`Skills`));
    _$insert(_el$36, _$createComponent(Show, {
      get when() {
        return props.showState();
      },
      get fallback() {
        return (() => {
          var _el$101 = _$createElement("box");
          _$setProp(_el$101, "flexGrow", 1);
          return _el$101;
        })();
      },
      get children() {
        var _el$41 = _$createElement("box"), _el$42 = _$createElement("text");
        _$insertNode(_el$41, _el$42);
        _$setProp(_el$41, "onSizeChange", function() {
          setStateWidth(this.width);
        });
        _$setProp(_el$41, "flexGrow", 1);
        _$setProp(_el$41, "minWidth", 0);
        _$setProp(_el$41, "height", 1);
        _$setProp(_el$41, "flexShrink", 1);
        _$setProp(_el$42, "width", "100%");
        _$setProp(_el$42, "height", 1);
        _$setProp(_el$42, "wrapMode", "none");
        _$setProp(_el$42, "truncate", true);
        _$setProp(_el$42, "textAlign", "right");
        _$effect((_p$) => {
          var _v$11 = state(), _v$12 = mutedColor();
          _v$11 !== _p$.e && (_p$.e = _$setProp(_el$42, "content", _v$11, _p$.e));
          _v$12 !== _p$.t && (_p$.t = _$setProp(_el$42, "fg", _v$12, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$41;
      }
    }), _el$44);
    _$insert(_el$36, _$createComponent(Show, {
      get when() {
        return props.tokenMode() !== "off";
      },
      get children() {
        var _el$43 = _$createElement("text");
        _$setProp(_el$43, "id", "skills-manager.total-tokens");
        _$setProp(_el$43, "height", 1);
        _$setProp(_el$43, "flexShrink", 0);
        _$setProp(_el$43, "textAlign", "right");
        _$insert(_el$43, totalTokens);
        _$effect((_p$) => {
          var _v$13 = tokenWidth(), _v$14 = mutedColor();
          _v$13 !== _p$.e && (_p$.e = _$setProp(_el$43, "width", _v$13, _p$.e));
          _v$14 !== _p$.t && (_p$.t = _$setProp(_el$43, "fg", _v$14, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$43;
      }
    }), _el$44);
    _$setProp(_el$44, "flexShrink", 0);
    _$insert(_el$44, () => `~${allSkillTokens()} tok`);
    _$insertNode(_el$45, _el$46);
    _$setProp(_el$45, "flexShrink", 0);
    _$setProp(_el$45, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onCreateSet();
    });
    _$insertNode(_el$46, _$createTextNode(`+`));
    _$insert(_el$22, _$createComponent(Show, {
      get when() {
        return isOpen("skills");
      },
      get children() {
        return [_$createComponent(Show, {
          get when() {
            return props.tree().error ?? props.error();
          },
          children: (message) => (() => {
            var _el$102 = _$createElement("text");
            _$setProp(_el$102, "width", "100%");
            _$setProp(_el$102, "flexShrink", 0);
            _$setProp(_el$102, "wrapMode", "char");
            _$insert(_el$102, message);
            _$effect((_$p) => _$setProp(_el$102, "fg", errorColor(), _$p));
            return _el$102;
          })()
        }), _$createComponent(Show, {
          get when() {
            return props.tree().alert;
          },
          children: (alert) => (() => {
            var _el$103 = _$createElement("text");
            _$setProp(_el$103, "width", "100%");
            _$setProp(_el$103, "flexShrink", 0);
            _$setProp(_el$103, "wrapMode", "char");
            _$insert(_el$103, alert);
            _$effect((_$p) => _$setProp(_el$103, "fg", warningColor(), _$p));
            return _el$103;
          })()
        }), _$createComponent(Show, {
          get when() {
            return props.tree().total > 0 || props.tree().sets.length > 0;
          },
          get fallback() {
            return (() => {
              var _el$104 = _$createElement("text");
              _$setProp(_el$104, "width", "100%");
              _$setProp(_el$104, "flexShrink", 0);
              _$setProp(_el$104, "wrapMode", "char");
              _$insert(_el$104, () => props.emptyMessage());
              _$effect((_$p) => _$setProp(_el$104, "fg", mutedColor(), _$p));
              return _el$104;
            })();
          },
          get children() {
            return [_$createComponent(For, {
              get each() {
                return props.tree().sets;
              },
              children: (set) => (() => {
                var _el$105 = _$createElement("box"), _el$106 = _$createElement("box"), _el$107 = _$createElement("box"), _el$108 = _$createElement("text"), _el$109 = _$createElement("box"), _el$110 = _$createElement("text"), _el$111 = _$createElement("text"), _el$112 = _$createElement("b"), _el$113 = _$createElement("text"), _el$114 = _$createElement("text"), _el$115 = _$createElement("box"), _el$116 = _$createElement("text");
                _$insertNode(_el$105, _el$106);
                _$setProp(_el$105, "flexDirection", "column");
                _$setProp(_el$105, "width", "100%");
                _$insertNode(_el$106, _el$107);
                _$insertNode(_el$106, _el$109);
                _$insertNode(_el$106, _el$111);
                _$insertNode(_el$106, _el$113);
                _$insertNode(_el$106, _el$114);
                _$insertNode(_el$106, _el$115);
                _$setProp(_el$106, "width", "100%");
                _$setProp(_el$106, "flexDirection", "row");
                _$setProp(_el$106, "columnGap", 1);
                _$setProp(_el$106, "paddingLeft", 1);
                _$setProp(_el$106, "onMouseUp", (event) => {
                  if (event.button === 2) {
                    stop(event);
                    props.onSetMenu(set);
                    return;
                  }
                  if (event.button !== 0)
                    return;
                  stop(event);
                  toggleOpen(set.key);
                });
                _$insertNode(_el$107, _el$108);
                _$setProp(_el$107, "flexShrink", 0);
                _$setProp(_el$107, "onMouseUp", (event) => {
                  if (event.button !== 0)
                    return;
                  stop(event);
                  toggleOpen(set.key);
                });
                _$insert(_el$108, () => isOpen(set.key) ? "\u25BC" : "\u25B6");
                _$insertNode(_el$109, _el$110);
                _$setProp(_el$109, "flexShrink", 0);
                _$setProp(_el$109, "onMouseUp", (event) => {
                  if (event.button !== 0)
                    return;
                  stop(event);
                  props.onToggleSet(set);
                });
                _$insert(_el$110, () => set.disabled ? "[ ]" : "[x]");
                _$insertNode(_el$111, _el$112);
                _$setProp(_el$111, "flexGrow", 1);
                _$setProp(_el$111, "minWidth", 0);
                _$setProp(_el$111, "height", 1);
                _$setProp(_el$111, "flexShrink", 1);
                _$setProp(_el$111, "wrapMode", "none");
                _$setProp(_el$111, "truncate", true);
                _$insert(_el$112, () => set.name);
                _$setProp(_el$113, "flexShrink", 0);
                _$insert(_el$113, () => `(${set.enabledCount}/${set.total})`);
                _$setProp(_el$114, "flexShrink", 0);
                _$insert(_el$114, () => `~${set.skills.reduce((s, sk) => s + skillTokens(sk), 0)} tok`);
                _$insertNode(_el$115, _el$116);
                _$setProp(_el$115, "flexShrink", 0);
                _$setProp(_el$115, "onMouseUp", (event) => {
                  if (event.button !== 0)
                    return;
                  stop(event);
                  props.onSetMenu(set);
                });
                _$insertNode(_el$116, _$createTextNode(`\u270E`));
                _$insert(_el$105, _$createComponent(Show, {
                  get when() {
                    return isOpen(set.key);
                  },
                  get children() {
                    return _$createComponent(For, {
                      get each() {
                        return set.skills;
                      },
                      children: (skill) => _$createComponent(SkillRow, {
                        skill
                      })
                    });
                  }
                }), null);
                _$effect((_p$) => {
                  var _v$50 = `skills-manager.set.${set.key}`, _v$51 = set.disabled ? mutedColor() : normalColor(), _v$52 = set.disabled ? mutedColor() : accentColor(), _v$53 = set.disabled ? mutedColor() : normalColor(), _v$54 = mutedColor(), _v$55 = mutedColor(), _v$56 = mutedColor();
                  _v$50 !== _p$.e && (_p$.e = _$setProp(_el$106, "id", _v$50, _p$.e));
                  _v$51 !== _p$.t && (_p$.t = _$setProp(_el$108, "fg", _v$51, _p$.t));
                  _v$52 !== _p$.a && (_p$.a = _$setProp(_el$110, "fg", _v$52, _p$.a));
                  _v$53 !== _p$.o && (_p$.o = _$setProp(_el$111, "fg", _v$53, _p$.o));
                  _v$54 !== _p$.i && (_p$.i = _$setProp(_el$113, "fg", _v$54, _p$.i));
                  _v$55 !== _p$.n && (_p$.n = _$setProp(_el$114, "fg", _v$55, _p$.n));
                  _v$56 !== _p$.s && (_p$.s = _$setProp(_el$116, "fg", _v$56, _p$.s));
                  return _p$;
                }, {
                  e: undefined,
                  t: undefined,
                  a: undefined,
                  o: undefined,
                  i: undefined,
                  n: undefined,
                  s: undefined
                });
                return _el$105;
              })()
            }), (() => {
              var _el$48 = _$createElement("box"), _el$49 = _$createElement("box"), _el$50 = _$createElement("box"), _el$51 = _$createElement("text"), _el$52 = _$createElement("box"), _el$53 = _$createElement("text"), _el$54 = _$createElement("text"), _el$55 = _$createElement("b"), _el$56 = _$createElement("text");
              _$insertNode(_el$48, _el$49);
              _$setProp(_el$48, "flexDirection", "column");
              _$setProp(_el$48, "width", "100%");
              _$insertNode(_el$49, _el$50);
              _$insertNode(_el$49, _el$52);
              _$insertNode(_el$49, _el$54);
              _$insertNode(_el$49, _el$56);
              _$setProp(_el$49, "id", "skills-manager.unassigned");
              _$setProp(_el$49, "width", "100%");
              _$setProp(_el$49, "flexDirection", "row");
              _$setProp(_el$49, "columnGap", 1);
              _$setProp(_el$49, "paddingLeft", 1);
              _$setProp(_el$49, "onMouseUp", (event) => {
                if (event.button !== 0 && event.button !== 2)
                  return;
                stop(event);
                toggleOpen(props.tree().unassigned.key);
              });
              _$insertNode(_el$50, _el$51);
              _$setProp(_el$50, "flexShrink", 0);
              _$setProp(_el$50, "onMouseUp", (event) => {
                if (event.button !== 0)
                  return;
                stop(event);
                toggleOpen(props.tree().unassigned.key);
              });
              _$insert(_el$51, () => isOpen("unassigned") ? "\u25BC" : "\u25B6");
              _$insertNode(_el$52, _el$53);
              _$setProp(_el$52, "flexShrink", 0);
              _$setProp(_el$52, "onMouseUp", (event) => {
                if (event.button !== 0)
                  return;
                stop(event);
                toggleUnassignedEnabled();
              });
              _$insert(_el$53, () => unassignedEnabled() ? "[x]" : "[ ]");
              _$insertNode(_el$54, _el$55);
              _$setProp(_el$54, "flexGrow", 1);
              _$setProp(_el$54, "minWidth", 0);
              _$setProp(_el$54, "flexShrink", 1);
              _$setProp(_el$54, "wrapMode", "char");
              _$insert(_el$55, () => props.tree().unassigned.label);
              _$setProp(_el$56, "flexShrink", 0);
              _$insert(_el$56, () => `(${props.tree().unassigned.skills.filter((s) => s.enabled).length}/${props.tree().unassigned.skills.length})`);
              _$insert(_el$48, _$createComponent(Show, {
                get when() {
                  return isOpen("unassigned");
                },
                get children() {
                  return _$createComponent(For, {
                    get each() {
                      return props.tree().unassigned.skills;
                    },
                    children: (skill) => _$createComponent(SkillRow, {
                      skill
                    })
                  });
                }
              }), null);
              _$effect((_p$) => {
                var _v$15 = normalColor(), _v$16 = unassignedEnabled() ? accentColor() : mutedColor(), _v$17 = normalColor(), _v$18 = mutedColor();
                _v$15 !== _p$.e && (_p$.e = _$setProp(_el$51, "fg", _v$15, _p$.e));
                _v$16 !== _p$.t && (_p$.t = _$setProp(_el$53, "fg", _v$16, _p$.t));
                _v$17 !== _p$.a && (_p$.a = _$setProp(_el$54, "fg", _v$17, _p$.a));
                _v$18 !== _p$.o && (_p$.o = _$setProp(_el$56, "fg", _v$18, _p$.o));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined
              });
              return _el$48;
            })()];
          }
        })];
      }
    }), _el$57);
    _$setProp(_el$57, "width", "100%");
    _$setProp(_el$57, "wrapMode", "none");
    _$setProp(_el$57, "truncate", true);
    _$insert(_el$57, () => "\u2500".repeat(Math.max(termDims().width, 200)));
    _$insertNode(_el$58, _el$59);
    _$setProp(_el$58, "flexDirection", "column");
    _$setProp(_el$58, "width", "100%");
    _$insertNode(_el$59, _el$60);
    _$insertNode(_el$59, _el$61);
    _$insertNode(_el$59, _el$64);
    _$insertNode(_el$59, _el$65);
    _$insertNode(_el$59, _el$66);
    _$setProp(_el$59, "id", "skills-manager.tools");
    _$setProp(_el$59, "width", "100%");
    _$setProp(_el$59, "flexDirection", "row");
    _$setProp(_el$59, "columnGap", 1);
    _$setProp(_el$59, "onMouseUp", (event) => {
      if (event.button !== 0 && event.button !== 2)
        return;
      stop(event);
      toggleOpen("tools");
    });
    _$setProp(_el$60, "flexShrink", 0);
    _$insert(_el$60, () => isOpen("tools") ? "\u25BC" : "\u25B6");
    _$insertNode(_el$61, _el$62);
    _$setProp(_el$61, "flexGrow", 1);
    _$setProp(_el$61, "minWidth", 0);
    _$setProp(_el$61, "flexShrink", 1);
    _$setProp(_el$61, "wrapMode", "char");
    _$insertNode(_el$62, _$createTextNode(`\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B`));
    _$setProp(_el$64, "flexShrink", 0);
    _$insert(_el$64, () => `(${props.tools().reduce((sum, group) => sum + (group.total - group.disabledCount), 0)}/${props.tools().reduce((sum, group) => sum + group.total, 0)})`);
    _$setProp(_el$65, "flexShrink", 0);
    _$insert(_el$65, () => `~${allToolTokens()} tok`);
    _$insertNode(_el$66, _el$67);
    _$setProp(_el$66, "flexShrink", 0);
    _$setProp(_el$66, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onToolsGroupCreate();
    });
    _$insertNode(_el$67, _$createTextNode(`+`));
    _$insert(_el$58, _$createComponent(Show, {
      get when() {
        return isOpen("tools");
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return props.tools();
          },
          children: (group) => (() => {
            var _el$118 = _$createElement("box"), _el$119 = _$createElement("box"), _el$120 = _$createElement("box"), _el$121 = _$createElement("text"), _el$122 = _$createElement("box"), _el$123 = _$createElement("text"), _el$124 = _$createElement("text"), _el$125 = _$createElement("text"), _el$126 = _$createElement("text"), _el$127 = _$createElement("box"), _el$128 = _$createElement("text");
            _$insertNode(_el$118, _el$119);
            _$setProp(_el$118, "flexDirection", "column");
            _$setProp(_el$118, "width", "100%");
            _$insertNode(_el$119, _el$120);
            _$insertNode(_el$119, _el$122);
            _$insertNode(_el$119, _el$124);
            _$insertNode(_el$119, _el$125);
            _$insertNode(_el$119, _el$126);
            _$insertNode(_el$119, _el$127);
            _$setProp(_el$119, "width", "100%");
            _$setProp(_el$119, "flexDirection", "row");
            _$setProp(_el$119, "columnGap", 1);
            _$setProp(_el$119, "paddingLeft", 1);
            _$setProp(_el$119, "onMouseUp", (event) => {
              if (event.button === 2) {
                stop(event);
                props.onToolsGroupMenu(group);
                return;
              }
              if (event.button !== 0)
                return;
              stop(event);
              toggleOpen(group.key);
            });
            _$insertNode(_el$120, _el$121);
            _$setProp(_el$120, "flexShrink", 0);
            _$setProp(_el$120, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              toggleOpen(group.key);
            });
            _$insert(_el$121, () => isOpen(group.key) ? "\u25BC" : "\u25B6");
            _$insertNode(_el$122, _el$123);
            _$setProp(_el$122, "flexShrink", 0);
            _$setProp(_el$123, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              props.onToolsGroupToggle(group);
            });
            _$insert(_el$123, () => group.enabled ? "[x]" : "[ ]");
            _$setProp(_el$124, "flexGrow", 1);
            _$setProp(_el$124, "minWidth", 0);
            _$setProp(_el$124, "flexShrink", 1);
            _$setProp(_el$124, "wrapMode", "char");
            _$insert(_el$124, () => group.label);
            _$setProp(_el$125, "flexShrink", 0);
            _$insert(_el$125, () => `(${group.total - group.disabledCount}/${group.total})`);
            _$setProp(_el$126, "flexShrink", 0);
            _$insert(_el$126, () => `~${group.tools.reduce((s, t) => s + t.tokens, 0)} tok`);
            _$insertNode(_el$127, _el$128);
            _$setProp(_el$127, "flexShrink", 0);
            _$setProp(_el$127, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              props.onToolsGroupMenu(group);
            });
            _$insertNode(_el$128, _$createTextNode(`\u270E`));
            _$insert(_el$118, _$createComponent(Show, {
              get when() {
                return isOpen(group.key);
              },
              get children() {
                return _$createComponent(For, {
                  get each() {
                    return group.tools;
                  },
                  children: (tool) => (() => {
                    var _el$130 = _$createElement("box"), _el$131 = _$createElement("text"), _el$133 = _$createElement("text"), _el$135 = _$createElement("text"), _el$136 = _$createElement("text"), _el$137 = _$createElement("box"), _el$138 = _$createElement("text");
                    _$insertNode(_el$130, _el$131);
                    _$insertNode(_el$130, _el$133);
                    _$insertNode(_el$130, _el$135);
                    _$insertNode(_el$130, _el$136);
                    _$insertNode(_el$130, _el$137);
                    _$setProp(_el$130, "width", "100%");
                    _$setProp(_el$130, "flexDirection", "row");
                    _$setProp(_el$130, "columnGap", 1);
                    _$setProp(_el$130, "paddingLeft", 5);
                    _$setProp(_el$130, "onMouseUp", (event) => {
                      if (event.button !== 0 && event.button !== 2)
                        return;
                      stop(event);
                      if (event.button === 2) {
                        props.onToolMenu(tool);
                        return;
                      }
                      props.onToggleTool(tool);
                    });
                    _$insertNode(_el$131, _$createTextNode(`\u2022`));
                    _$setProp(_el$131, "flexShrink", 0);
                    _$setProp(_el$133, "flexGrow", 1);
                    _$setProp(_el$133, "minWidth", 0);
                    _$setProp(_el$133, "flexShrink", 1);
                    _$setProp(_el$133, "wrapMode", "char");
                    _$setProp(_el$133, "onMouseUp", (event) => {
                      if (event.button !== 0)
                        return;
                      stop(event);
                      props.onShowDesc(tool.name, props.getRu(`tool:${tool.name}`, `\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB.`));
                    });
                    _$insert(_el$133, () => tool.name);
                    _$insert(_el$130, _$createComponent(Show, {
                      get when() {
                        return tool.users > 0;
                      },
                      get children() {
                        var _el$134 = _$createElement("text");
                        _$setProp(_el$134, "flexShrink", 0);
                        _$insert(_el$134, () => `(\u0432 ${tool.users} \u0441\u043A\u0438\u043B\u0430\u0445)`);
                        _$effect((_$p) => _$setProp(_el$134, "fg", warningColor(), _$p));
                        return _el$134;
                      }
                    }), _el$135);
                    _$setProp(_el$135, "flexShrink", 0);
                    _$insert(_el$135, () => `(${props.usageTools()[tool.name] ?? 0})`);
                    _$setProp(_el$136, "flexShrink", 0);
                    _$insert(_el$136, () => `~${tool.tokens} tok`);
                    _$insertNode(_el$137, _el$138);
                    _$setProp(_el$137, "flexShrink", 0);
                    _$setProp(_el$137, "onMouseUp", (event) => {
                      if (event.button !== 0)
                        return;
                      stop(event);
                      props.onToolMenu(tool);
                    });
                    _$insertNode(_el$138, _$createTextNode(`\u21C4`));
                    _$effect((_p$) => {
                      var _v$64 = `skills-manager.tool.${tool.name}`, _v$65 = toolStatusColor(tool), _v$66 = tool.enabled ? normalColor() : mutedColor(), _v$67 = mutedColor(), _v$68 = mutedColor(), _v$69 = accentColor();
                      _v$64 !== _p$.e && (_p$.e = _$setProp(_el$130, "id", _v$64, _p$.e));
                      _v$65 !== _p$.t && (_p$.t = _$setProp(_el$131, "fg", _v$65, _p$.t));
                      _v$66 !== _p$.a && (_p$.a = _$setProp(_el$133, "fg", _v$66, _p$.a));
                      _v$67 !== _p$.o && (_p$.o = _$setProp(_el$135, "fg", _v$67, _p$.o));
                      _v$68 !== _p$.i && (_p$.i = _$setProp(_el$136, "fg", _v$68, _p$.i));
                      _v$69 !== _p$.n && (_p$.n = _$setProp(_el$138, "fg", _v$69, _p$.n));
                      return _p$;
                    }, {
                      e: undefined,
                      t: undefined,
                      a: undefined,
                      o: undefined,
                      i: undefined,
                      n: undefined
                    });
                    return _el$130;
                  })()
                });
              }
            }), null);
            _$effect((_p$) => {
              var _v$57 = `skills-manager.tools-group.${group.key}`, _v$58 = mutedColor(), _v$59 = group.enabled ? accentColor() : mutedColor(), _v$60 = normalColor(), _v$61 = mutedColor(), _v$62 = mutedColor(), _v$63 = mutedColor();
              _v$57 !== _p$.e && (_p$.e = _$setProp(_el$119, "id", _v$57, _p$.e));
              _v$58 !== _p$.t && (_p$.t = _$setProp(_el$121, "fg", _v$58, _p$.t));
              _v$59 !== _p$.a && (_p$.a = _$setProp(_el$123, "fg", _v$59, _p$.a));
              _v$60 !== _p$.o && (_p$.o = _$setProp(_el$124, "fg", _v$60, _p$.o));
              _v$61 !== _p$.i && (_p$.i = _$setProp(_el$125, "fg", _v$61, _p$.i));
              _v$62 !== _p$.n && (_p$.n = _$setProp(_el$126, "fg", _v$62, _p$.n));
              _v$63 !== _p$.s && (_p$.s = _$setProp(_el$128, "fg", _v$63, _p$.s));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined,
              i: undefined,
              n: undefined,
              s: undefined
            });
            return _el$118;
          })()
        });
      }
    }), null);
    _$setProp(_el$69, "width", "100%");
    _$setProp(_el$69, "wrapMode", "none");
    _$setProp(_el$69, "truncate", true);
    _$insert(_el$69, () => "\u2500".repeat(Math.max(termDims().width, 200)));
    _$insertNode(_el$70, _el$71);
    _$setProp(_el$70, "flexDirection", "column");
    _$setProp(_el$70, "width", "100%");
    _$insertNode(_el$71, _el$72);
    _$insertNode(_el$71, _el$73);
    _$insertNode(_el$71, _el$76);
    _$insertNode(_el$71, _el$77);
    _$insertNode(_el$71, _el$78);
    _$setProp(_el$71, "id", "skills-manager.plugins");
    _$setProp(_el$71, "width", "100%");
    _$setProp(_el$71, "flexDirection", "row");
    _$setProp(_el$71, "columnGap", 1);
    _$setProp(_el$71, "onMouseUp", (event) => {
      if (event.button !== 0 && event.button !== 2)
        return;
      stop(event);
      toggleOpen("plugins");
    });
    _$setProp(_el$72, "flexShrink", 0);
    _$insert(_el$72, () => isOpen("plugins") ? "\u25BC" : "\u25B6");
    _$insertNode(_el$73, _el$74);
    _$setProp(_el$73, "flexGrow", 1);
    _$setProp(_el$73, "minWidth", 0);
    _$setProp(_el$73, "flexShrink", 1);
    _$setProp(_el$73, "wrapMode", "char");
    _$insertNode(_el$74, _$createTextNode(`\u041F\u043B\u0430\u0433\u0438\u043D\u044B`));
    _$setProp(_el$76, "flexShrink", 0);
    _$insert(_el$76, () => `(\u041F\u0435\u0440\u0435\u0437\u0430\u0433) (${props.plugins().filter((p) => !p.id.startsWith("__group__") && p.enabled).length}/${props.plugins().filter((p) => !p.id.startsWith("__group__")).length})`);
    _$setProp(_el$77, "flexShrink", 0);
    _$insert(_el$77, () => `~${allPluginTokens()} tok`);
    _$insertNode(_el$78, _el$79);
    _$setProp(_el$78, "flexShrink", 0);
    _$setProp(_el$78, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onPluginsGroupCreate();
    });
    _$insertNode(_el$79, _$createTextNode(`+`));
    _$insert(_el$70, _$createComponent(Show, {
      get when() {
        return isOpen("plugins");
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return props.plugins();
          },
          children: (plugin) => {
            const isGroupRow = plugin.id.startsWith("__group__");
            const nested = !isGroupRow && Boolean(plugin.groupLabel);
            return (() => {
              var _el$140 = _$createElement("box"), _el$141 = _$createElement("box"), _el$150 = _$createElement("text"), _el$152 = _$createElement("text"), _el$153 = _$createElement("text");
              _$insertNode(_el$140, _el$141);
              _$setProp(_el$140, "flexDirection", "column");
              _$setProp(_el$140, "width", "100%");
              _$insertNode(_el$141, _el$150);
              _$insertNode(_el$141, _el$152);
              _$insertNode(_el$141, _el$153);
              _$setProp(_el$141, "width", "100%");
              _$setProp(_el$141, "flexDirection", "row");
              _$setProp(_el$141, "columnGap", 1);
              _$setProp(_el$141, "paddingLeft", nested ? 3 : 1);
              _$setProp(_el$141, "onMouseUp", (event) => {
                if (isGroupRow)
                  return;
                if (event.button === 2) {
                  stop(event);
                  props.onPluginMenu(plugin);
                  return;
                }
                if (event.button === 0) {
                  stop(event);
                  props.onTogglePlugin(plugin);
                }
              });
              _$insert(_el$141, _$createComponent(Show, {
                when: !isGroupRow,
                get children() {
                  var _el$142 = _$createElement("text");
                  _$insertNode(_el$142, _$createTextNode(`\u2022`));
                  _$setProp(_el$142, "flexShrink", 0);
                  _$effect((_$p) => _$setProp(_el$142, "fg", plugin.enabled ? successColor() : mutedColor(), _$p));
                  return _el$142;
                }
              }), _el$150);
              _$insert(_el$141, _$createComponent(Show, {
                get when() {
                  return plugin.tools.length > 0;
                },
                get children() {
                  var _el$144 = _$createElement("box"), _el$145 = _$createElement("text");
                  _$insertNode(_el$144, _el$145);
                  _$setProp(_el$144, "flexShrink", 0);
                  _$setProp(_el$144, "onMouseUp", (event) => {
                    if (event.button !== 0)
                      return;
                    stop(event);
                    toggleOpen(plugin.key);
                  });
                  _$insert(_el$145, () => isOpen(plugin.key) ? "\u25BC" : "\u25B6");
                  _$effect((_$p) => _$setProp(_el$145, "fg", mutedColor(), _$p));
                  return _el$144;
                }
              }), _el$150);
              _$insert(_el$141, _$createComponent(Show, {
                get when() {
                  return isGroupRow && !plugin.system;
                },
                get children() {
                  var _el$146 = _$createElement("box"), _el$147 = _$createElement("text");
                  _$insertNode(_el$146, _el$147);
                  _$setProp(_el$146, "flexShrink", 0);
                  _$setProp(_el$147, "onMouseUp", (event) => {
                    if (event.button !== 0)
                      return;
                    stop(event);
                    props.onPluginsGroupToggle(plugin);
                  });
                  _$insert(_el$147, () => plugin.enabled ? "[x]" : "[ ]");
                  _$effect((_$p) => _$setProp(_el$147, "fg", plugin.enabled ? accentColor() : mutedColor(), _$p));
                  return _el$146;
                }
              }), _el$150);
              _$insert(_el$141, _$createComponent(Show, {
                get when() {
                  return plugin.system;
                },
                get children() {
                  var _el$148 = _$createElement("text");
                  _$insertNode(_el$148, _$createTextNode(`\uD83D\uDD12`));
                  _$setProp(_el$148, "flexShrink", 0);
                  _$effect((_$p) => _$setProp(_el$148, "fg", mutedColor(), _$p));
                  return _el$148;
                }
              }), _el$150);
              _$setProp(_el$150, "flexGrow", 1);
              _$setProp(_el$150, "minWidth", 0);
              _$setProp(_el$150, "flexShrink", 1);
              _$setProp(_el$150, "wrapMode", "char");
              _$setProp(_el$150, "onMouseUp", (event) => {
                if (event.button !== 0)
                  return;
                stop(event);
                props.onShowDesc(plugin.label, props.getRu(`plugin:${plugin.id}`, isGroupRow ? `\u0413\u0440\u0443\u043F\u043F\u0430 \u043F\u043B\u0430\u0433\u0438\u043D\u043E\u0432 \xAB${plugin.label}\xBB.` : `\u041F\u043B\u0430\u0433\u0438\u043D \xAB${plugin.label}\xBB.`));
              });
              _$insert(_el$150, () => plugin.label);
              _$insert(_el$141, _$createComponent(Show, {
                get when() {
                  return plugin.tools.length > 0;
                },
                get children() {
                  var _el$151 = _$createElement("text");
                  _$setProp(_el$151, "flexShrink", 0);
                  _$insert(_el$151, () => `\uD83D\uDD27${plugin.tools.length}`);
                  _$effect((_$p) => _$setProp(_el$151, "fg", mutedColor(), _$p));
                  return _el$151;
                }
              }), _el$152);
              _$setProp(_el$152, "flexShrink", 0);
              _$insert(_el$152, () => `(${sumUsage(plugin.tools)})`);
              _$setProp(_el$153, "flexShrink", 0);
              _$insert(_el$153, () => `~${isGroupRow && typeof plugin.tokensTotal === "number" ? plugin.tokensTotal : Math.max(1, Math.round(plugin.label.length / 4)) + plugin.tools.reduce((s, t) => s + t.tokens, 0)} tok`);
              _$insert(_el$141, _$createComponent(Show, {
                when: isGroupRow,
                get children() {
                  var _el$154 = _$createElement("box"), _el$155 = _$createElement("text");
                  _$insertNode(_el$154, _el$155);
                  _$setProp(_el$154, "flexShrink", 0);
                  _$setProp(_el$154, "onMouseUp", (event) => {
                    if (event.button !== 0)
                      return;
                    stop(event);
                    props.onPluginsGroupMenu(plugin);
                  });
                  _$insertNode(_el$155, _$createTextNode(`\u270E`));
                  _$effect((_$p) => _$setProp(_el$155, "fg", mutedColor(), _$p));
                  return _el$154;
                }
              }), null);
              _$insert(_el$141, _$createComponent(Show, {
                when: !isGroupRow,
                get children() {
                  var _el$157 = _$createElement("box"), _el$158 = _$createElement("text");
                  _$insertNode(_el$157, _el$158);
                  _$setProp(_el$157, "flexShrink", 0);
                  _$setProp(_el$157, "onMouseUp", (event) => {
                    if (event.button !== 0)
                      return;
                    stop(event);
                    props.onPluginMenu(plugin);
                  });
                  _$insertNode(_el$158, _$createTextNode(`\u21C4`));
                  _$effect((_$p) => _$setProp(_el$158, "fg", accentColor(), _$p));
                  return _el$157;
                }
              }), null);
              _$insert(_el$140, _$createComponent(Show, {
                get when() {
                  return _$memo(() => !!isOpen(plugin.key))() && plugin.tools.length > 0;
                },
                get children() {
                  return _$createComponent(For, {
                    get each() {
                      return plugin.tools;
                    },
                    children: (tool) => (() => {
                      var _el$160 = _$createElement("box"), _el$161 = _$createElement("text"), _el$163 = _$createElement("text"), _el$164 = _$createElement("text"), _el$165 = _$createElement("text"), _el$166 = _$createElement("box"), _el$167 = _$createElement("text");
                      _$insertNode(_el$160, _el$161);
                      _$insertNode(_el$160, _el$163);
                      _$insertNode(_el$160, _el$164);
                      _$insertNode(_el$160, _el$165);
                      _$insertNode(_el$160, _el$166);
                      _$setProp(_el$160, "width", "100%");
                      _$setProp(_el$160, "flexDirection", "row");
                      _$setProp(_el$160, "columnGap", 1);
                      _$setProp(_el$160, "paddingLeft", 3);
                      _$setProp(_el$160, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        props.onToggleTool(tool);
                      });
                      _$insertNode(_el$161, _$createTextNode(`\u2022`));
                      _$setProp(_el$161, "flexShrink", 0);
                      _$setProp(_el$163, "flexGrow", 1);
                      _$setProp(_el$163, "minWidth", 0);
                      _$setProp(_el$163, "flexShrink", 1);
                      _$setProp(_el$163, "wrapMode", "char");
                      _$setProp(_el$163, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        props.onShowDesc(tool.name, props.getRu(`tool:${tool.name}`, `\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB.`));
                      });
                      _$insert(_el$163, () => tool.name);
                      _$setProp(_el$164, "flexShrink", 0);
                      _$insert(_el$164, () => `(${props.usageTools()[tool.name] ?? 0})`);
                      _$setProp(_el$165, "flexShrink", 0);
                      _$insert(_el$165, () => `~${tool.tokens} tok`);
                      _$insertNode(_el$166, _el$167);
                      _$setProp(_el$166, "flexShrink", 0);
                      _$setProp(_el$166, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        props.onToolMenu(tool);
                      });
                      _$insertNode(_el$167, _$createTextNode(`\u21C4`));
                      _$effect((_p$) => {
                        var _v$74 = toolStatusColor(tool), _v$75 = tool.enabled ? normalColor() : mutedColor(), _v$76 = mutedColor(), _v$77 = mutedColor(), _v$78 = accentColor();
                        _v$74 !== _p$.e && (_p$.e = _$setProp(_el$161, "fg", _v$74, _p$.e));
                        _v$75 !== _p$.t && (_p$.t = _$setProp(_el$163, "fg", _v$75, _p$.t));
                        _v$76 !== _p$.a && (_p$.a = _$setProp(_el$164, "fg", _v$76, _p$.a));
                        _v$77 !== _p$.o && (_p$.o = _$setProp(_el$165, "fg", _v$77, _p$.o));
                        _v$78 !== _p$.i && (_p$.i = _$setProp(_el$167, "fg", _v$78, _p$.i));
                        return _p$;
                      }, {
                        e: undefined,
                        t: undefined,
                        a: undefined,
                        o: undefined,
                        i: undefined
                      });
                      return _el$160;
                    })()
                  });
                }
              }), null);
              _$effect((_p$) => {
                var _v$70 = `skills-manager.plugin.${plugin.id}`, _v$71 = plugin.enabled ? normalColor() : mutedColor(), _v$72 = mutedColor(), _v$73 = mutedColor();
                _v$70 !== _p$.e && (_p$.e = _$setProp(_el$141, "id", _v$70, _p$.e));
                _v$71 !== _p$.t && (_p$.t = _$setProp(_el$150, "fg", _v$71, _p$.t));
                _v$72 !== _p$.a && (_p$.a = _$setProp(_el$152, "fg", _v$72, _p$.a));
                _v$73 !== _p$.o && (_p$.o = _$setProp(_el$153, "fg", _v$73, _p$.o));
                return _p$;
              }, {
                e: undefined,
                t: undefined,
                a: undefined,
                o: undefined
              });
              return _el$140;
            })();
          }
        });
      }
    }), null);
    _$setProp(_el$81, "width", "100%");
    _$setProp(_el$81, "wrapMode", "none");
    _$setProp(_el$81, "truncate", true);
    _$insert(_el$81, () => "\u2500".repeat(Math.max(termDims().width, 200)));
    _$insertNode(_el$82, _el$83);
    _$setProp(_el$82, "flexDirection", "column");
    _$setProp(_el$82, "width", "100%");
    _$insertNode(_el$83, _el$84);
    _$insertNode(_el$83, _el$85);
    _$insertNode(_el$83, _el$88);
    _$insertNode(_el$83, _el$89);
    _$insertNode(_el$83, _el$90);
    _$setProp(_el$83, "id", "skills-manager.mcp");
    _$setProp(_el$83, "width", "100%");
    _$setProp(_el$83, "flexDirection", "row");
    _$setProp(_el$83, "columnGap", 1);
    _$setProp(_el$83, "onMouseUp", (event) => {
      if (event.button !== 0 && event.button !== 2)
        return;
      stop(event);
      toggleOpen("mcp");
    });
    _$setProp(_el$84, "flexShrink", 0);
    _$insert(_el$84, () => isOpen("mcp") ? "\u25BC" : "\u25B6");
    _$insertNode(_el$85, _el$86);
    _$setProp(_el$85, "flexGrow", 1);
    _$setProp(_el$85, "minWidth", 0);
    _$setProp(_el$85, "flexShrink", 1);
    _$setProp(_el$85, "wrapMode", "char");
    _$insertNode(_el$86, _$createTextNode(`MCP`));
    _$setProp(_el$88, "flexShrink", 0);
    _$insert(_el$88, () => `(${props.mcp().reduce((sum, group) => sum + group.servers.filter((s) => s.status === "connected").length, 0)}/${props.mcp().reduce((sum, group) => sum + group.servers.length, 0)})`);
    _$setProp(_el$89, "flexShrink", 0);
    _$insert(_el$89, () => `~${allMcpTokens()} tok`);
    _$insertNode(_el$90, _el$91);
    _$setProp(_el$90, "flexShrink", 0);
    _$setProp(_el$90, "onMouseUp", (event) => {
      if (event.button !== 0)
        return;
      stop(event);
      props.onMcpGroupCreate();
    });
    _$insertNode(_el$91, _$createTextNode(`+`));
    _$insert(_el$82, _$createComponent(Show, {
      get when() {
        return isOpen("mcp");
      },
      get children() {
        return _$createComponent(For, {
          get each() {
            return props.mcp();
          },
          children: (group) => (() => {
            var _el$169 = _$createElement("box"), _el$170 = _$createElement("box"), _el$171 = _$createElement("box"), _el$172 = _$createElement("text"), _el$173 = _$createElement("box"), _el$174 = _$createElement("text"), _el$175 = _$createElement("text"), _el$176 = _$createElement("text"), _el$177 = _$createElement("text"), _el$178 = _$createElement("box"), _el$179 = _$createElement("text");
            _$insertNode(_el$169, _el$170);
            _$setProp(_el$169, "flexDirection", "column");
            _$setProp(_el$169, "width", "100%");
            _$insertNode(_el$170, _el$171);
            _$insertNode(_el$170, _el$173);
            _$insertNode(_el$170, _el$175);
            _$insertNode(_el$170, _el$176);
            _$insertNode(_el$170, _el$177);
            _$insertNode(_el$170, _el$178);
            _$setProp(_el$170, "width", "100%");
            _$setProp(_el$170, "flexDirection", "row");
            _$setProp(_el$170, "columnGap", 1);
            _$setProp(_el$170, "paddingLeft", 1);
            _$setProp(_el$170, "onMouseUp", (event) => {
              if (event.button === 2) {
                stop(event);
                props.onMcpGroupMenu(group);
                return;
              }
              if (event.button !== 0)
                return;
              stop(event);
              toggleOpen(group.key);
            });
            _$insertNode(_el$171, _el$172);
            _$setProp(_el$171, "flexShrink", 0);
            _$setProp(_el$171, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              toggleOpen(group.key);
            });
            _$insert(_el$172, () => isOpen(group.key) ? "\u25BC" : "\u25B6");
            _$insertNode(_el$173, _el$174);
            _$setProp(_el$173, "flexShrink", 0);
            _$setProp(_el$174, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              props.onMcpGroupToggle(group);
            });
            _$insert(_el$174, () => group.enabled ? "[x]" : "[ ]");
            _$setProp(_el$175, "flexGrow", 1);
            _$setProp(_el$175, "minWidth", 0);
            _$setProp(_el$175, "flexShrink", 1);
            _$setProp(_el$175, "wrapMode", "char");
            _$insert(_el$175, () => group.label);
            _$setProp(_el$176, "flexShrink", 0);
            _$insert(_el$176, () => `(${group.servers.filter((s) => s.status === "connected").length}/${group.servers.length})`);
            _$setProp(_el$177, "flexShrink", 0);
            _$insert(_el$177, () => `~${group.servers.reduce((s, sv) => s + Math.max(1, Math.round(sv.name.length / 4)) + sv.tools.reduce((s2, t) => s2 + t.tokens, 0), 0)} tok`);
            _$insertNode(_el$178, _el$179);
            _$setProp(_el$178, "flexShrink", 0);
            _$setProp(_el$178, "onMouseUp", (event) => {
              if (event.button !== 0)
                return;
              stop(event);
              props.onMcpGroupMenu(group);
            });
            _$insertNode(_el$179, _$createTextNode(`\u270E`));
            _$insert(_el$169, _$createComponent(Show, {
              get when() {
                return isOpen(group.key);
              },
              get children() {
                return _$createComponent(For, {
                  get each() {
                    return group.servers;
                  },
                  children: (server) => {
                    const dot = () => {
                      if (server.status === "connected")
                        return theme().text.feedback.success.base;
                      if (server.status === "failed")
                        return theme().text.feedback.error.base;
                      if (server.status === "needs_auth")
                        return theme().text.feedback.warning.base;
                      return theme().text.muted;
                    };
                    const statusLabel = () => {
                      if (server.loading)
                        return server.stalled ? "Timeout" : "Connecting";
                      if (server.status === "connected")
                        return "Connected";
                      if (server.status === "pending")
                        return "Connecting";
                      if (server.status === "failed")
                        return "Error";
                      if (server.status === "needs_auth")
                        return "Sign in";
                      return "Disabled";
                    };
                    const tone = () => {
                      if (server.stalled)
                        return theme().text.feedback.warning.base;
                      if (server.loading || server.status === "pending")
                        return theme().text.muted;
                      if (server.status === "failed")
                        return theme().text.feedback.error.base;
                      if (server.status === "needs_auth")
                        return theme().text.feedback.warning.base;
                      return theme().text.muted;
                    };
                    return (() => {
                      var _el$181 = _$createElement("box"), _el$182 = _$createElement("box"), _el$183 = _$createElement("box"), _el$184 = _$createElement("text"), _el$185 = _$createElement("text"), _el$187 = _$createElement("text"), _el$189 = _$createElement("text"), _el$190 = _$createElement("text"), _el$191 = _$createElement("box"), _el$192 = _$createElement("text");
                      _$insertNode(_el$181, _el$182);
                      _$setProp(_el$181, "flexDirection", "column");
                      _$setProp(_el$181, "width", "100%");
                      _$insertNode(_el$182, _el$183);
                      _$insertNode(_el$182, _el$185);
                      _$insertNode(_el$182, _el$187);
                      _$insertNode(_el$182, _el$189);
                      _$insertNode(_el$182, _el$190);
                      _$insertNode(_el$182, _el$191);
                      _$setProp(_el$182, "width", "100%");
                      _$setProp(_el$182, "flexDirection", "row");
                      _$setProp(_el$182, "columnGap", 1);
                      _$setProp(_el$182, "paddingLeft", 2);
                      _$setProp(_el$182, "onMouseUp", (event) => {
                        if (event.button !== 0 && event.button !== 2)
                          return;
                        stop(event);
                        if (event.button === 2) {
                          props.onMcpServerMenu(server);
                          return;
                        }
                        props.onToggleServer(server);
                      });
                      _$insertNode(_el$183, _el$184);
                      _$setProp(_el$183, "flexShrink", 0);
                      _$setProp(_el$183, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        toggleOpen(`mcp-server:${server.name}`);
                      });
                      _$insert(_el$184, () => isOpen(`mcp-server:${server.name}`) ? "\u25BC" : "\u25B6");
                      _$insertNode(_el$185, _$createTextNode(`\u2022`));
                      _$setProp(_el$185, "flexShrink", 0);
                      _$setProp(_el$187, "flexGrow", 1);
                      _$setProp(_el$187, "minWidth", 0);
                      _$setProp(_el$187, "flexShrink", 1);
                      _$setProp(_el$187, "wrapMode", "char");
                      _$setProp(_el$187, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        const body = props.getRu(`server:${server.name}`, `MCP-\u0441\u0435\u0440\u0432\u0435\u0440 \xAB${server.name}\xBB.
\u0421\u0442\u0430\u0442\u0443\u0441: ${statusLabel()}.`);
                        props.onShowDesc(server.name, body);
                      });
                      _$insert(_el$187, () => server.name);
                      _$insert(_el$182, _$createComponent(Show, {
                        get when() {
                          return server.tools.length > 0;
                        },
                        get children() {
                          var _el$188 = _$createElement("text");
                          _$setProp(_el$188, "flexShrink", 0);
                          _$insert(_el$188, () => `\uD83D\uDD27${server.tools.length}`);
                          _$effect((_$p) => _$setProp(_el$188, "fg", mutedColor(), _$p));
                          return _el$188;
                        }
                      }), _el$189);
                      _$setProp(_el$189, "flexShrink", 0);
                      _$insert(_el$189, () => `(${sumUsage(server.tools)})`);
                      _$setProp(_el$190, "flexShrink", 0);
                      _$insert(_el$190, () => `~${Math.max(1, Math.round(server.name.length / 4)) + server.tools.reduce((s, t) => s + t.tokens, 0)} tok`);
                      _$insertNode(_el$191, _el$192);
                      _$setProp(_el$191, "flexShrink", 0);
                      _$setProp(_el$191, "onMouseUp", (event) => {
                        if (event.button !== 0)
                          return;
                        stop(event);
                        props.onMcpServerMenu(server);
                      });
                      _$insertNode(_el$192, _$createTextNode(`\u21C4`));
                      _$insert(_el$181, _$createComponent(Show, {
                        get when() {
                          return _$memo(() => !!isOpen(`mcp-server:${server.name}`))() && server.tools.length > 0;
                        },
                        get children() {
                          return _$createComponent(For, {
                            get each() {
                              return server.tools;
                            },
                            children: (tool) => (() => {
                              var _el$194 = _$createElement("box"), _el$195 = _$createElement("text"), _el$196 = _$createElement("text"), _el$197 = _$createElement("text"), _el$198 = _$createElement("text");
                              _$insertNode(_el$194, _el$195);
                              _$insertNode(_el$194, _el$196);
                              _$insertNode(_el$194, _el$197);
                              _$insertNode(_el$194, _el$198);
                              _$setProp(_el$194, "width", "100%");
                              _$setProp(_el$194, "flexDirection", "row");
                              _$setProp(_el$194, "columnGap", 1);
                              _$setProp(_el$194, "paddingLeft", 4);
                              _$setProp(_el$194, "onMouseUp", (event) => {
                                if (event.button !== 0)
                                  return;
                                stop(event);
                                props.onToggleTool(tool);
                              });
                              _$setProp(_el$195, "flexShrink", 0);
                              _$insert(_el$195, () => tool.enabled ? "[x]" : "[ ]");
                              _$setProp(_el$196, "flexGrow", 1);
                              _$setProp(_el$196, "minWidth", 0);
                              _$setProp(_el$196, "flexShrink", 1);
                              _$setProp(_el$196, "wrapMode", "char");
                              _$setProp(_el$196, "onMouseUp", (event) => {
                                if (event.button !== 0)
                                  return;
                                stop(event);
                                props.onShowDesc(tool.name, props.getRu(`tool:${tool.name}`, `\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB.`));
                              });
                              _$insert(_el$196, () => tool.name);
                              _$setProp(_el$197, "flexShrink", 0);
                              _$insert(_el$197, () => `(${props.usageTools()[tool.name] ?? 0})`);
                              _$setProp(_el$198, "flexShrink", 0);
                              _$insert(_el$198, () => `~${tool.tokens} tok`);
                              _$effect((_p$) => {
                                var _v$92 = tool.enabled ? accentColor() : mutedColor(), _v$93 = tool.enabled ? normalColor() : mutedColor(), _v$94 = mutedColor(), _v$95 = mutedColor();
                                _v$92 !== _p$.e && (_p$.e = _$setProp(_el$195, "fg", _v$92, _p$.e));
                                _v$93 !== _p$.t && (_p$.t = _$setProp(_el$196, "fg", _v$93, _p$.t));
                                _v$94 !== _p$.a && (_p$.a = _$setProp(_el$197, "fg", _v$94, _p$.a));
                                _v$95 !== _p$.o && (_p$.o = _$setProp(_el$198, "fg", _v$95, _p$.o));
                                return _p$;
                              }, {
                                e: undefined,
                                t: undefined,
                                a: undefined,
                                o: undefined
                              });
                              return _el$194;
                            })()
                          });
                        }
                      }), null);
                      _$effect((_p$) => {
                        var _v$86 = mutedColor(), _v$87 = dot(), _v$88 = normalColor(), _v$89 = mutedColor(), _v$90 = mutedColor(), _v$91 = accentColor();
                        _v$86 !== _p$.e && (_p$.e = _$setProp(_el$184, "fg", _v$86, _p$.e));
                        _v$87 !== _p$.t && (_p$.t = _$setProp(_el$185, "fg", _v$87, _p$.t));
                        _v$88 !== _p$.a && (_p$.a = _$setProp(_el$187, "fg", _v$88, _p$.a));
                        _v$89 !== _p$.o && (_p$.o = _$setProp(_el$189, "fg", _v$89, _p$.o));
                        _v$90 !== _p$.i && (_p$.i = _$setProp(_el$190, "fg", _v$90, _p$.i));
                        _v$91 !== _p$.n && (_p$.n = _$setProp(_el$192, "fg", _v$91, _p$.n));
                        return _p$;
                      }, {
                        e: undefined,
                        t: undefined,
                        a: undefined,
                        o: undefined,
                        i: undefined,
                        n: undefined
                      });
                      return _el$181;
                    })();
                  }
                });
              }
            }), null);
            _$effect((_p$) => {
              var _v$79 = `skills-manager.mcp-group.${group.key}`, _v$80 = mutedColor(), _v$81 = group.enabled ? accentColor() : mutedColor(), _v$82 = normalColor(), _v$83 = mutedColor(), _v$84 = mutedColor(), _v$85 = mutedColor();
              _v$79 !== _p$.e && (_p$.e = _$setProp(_el$170, "id", _v$79, _p$.e));
              _v$80 !== _p$.t && (_p$.t = _$setProp(_el$172, "fg", _v$80, _p$.t));
              _v$81 !== _p$.a && (_p$.a = _$setProp(_el$174, "fg", _v$81, _p$.a));
              _v$82 !== _p$.o && (_p$.o = _$setProp(_el$175, "fg", _v$82, _p$.o));
              _v$83 !== _p$.i && (_p$.i = _$setProp(_el$176, "fg", _v$83, _p$.i));
              _v$84 !== _p$.n && (_p$.n = _$setProp(_el$177, "fg", _v$84, _p$.n));
              _v$85 !== _p$.s && (_p$.s = _$setProp(_el$179, "fg", _v$85, _p$.s));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined,
              i: undefined,
              n: undefined,
              s: undefined
            });
            return _el$169;
          })()
        });
      }
    }), null);
    _$effect((_p$) => {
      var _v$19 = normalColor(), _v$20 = normalColor(), _v$21 = mutedColor(), _v$22 = mutedColor(), _v$23 = accentColor(), _v$24 = normalColor(), _v$25 = normalColor(), _v$26 = mutedColor(), _v$27 = accentColor(), _v$28 = mutedColor(), _v$29 = normalColor(), _v$30 = normalColor(), _v$31 = mutedColor(), _v$32 = mutedColor(), _v$33 = accentColor(), _v$34 = mutedColor(), _v$35 = normalColor(), _v$36 = normalColor(), _v$37 = mutedColor(), _v$38 = mutedColor(), _v$39 = accentColor(), _v$40 = mutedColor(), _v$41 = normalColor(), _v$42 = normalColor(), _v$43 = mutedColor(), _v$44 = mutedColor(), _v$45 = accentColor();
      _v$19 !== _p$.e && (_p$.e = _$setProp(_el$25, "fg", _v$19, _p$.e));
      _v$20 !== _p$.t && (_p$.t = _$setProp(_el$26, "fg", _v$20, _p$.t));
      _v$21 !== _p$.a && (_p$.a = _$setProp(_el$29, "fg", _v$21, _p$.a));
      _v$22 !== _p$.o && (_p$.o = _$setProp(_el$31, "fg", _v$22, _p$.o));
      _v$23 !== _p$.i && (_p$.i = _$setProp(_el$34, "fg", _v$23, _p$.i));
      _v$24 !== _p$.n && (_p$.n = _$setProp(_el$37, "fg", _v$24, _p$.n));
      _v$25 !== _p$.s && (_p$.s = _$setProp(_el$38, "fg", _v$25, _p$.s));
      _v$26 !== _p$.h && (_p$.h = _$setProp(_el$44, "fg", _v$26, _p$.h));
      _v$27 !== _p$.r && (_p$.r = _$setProp(_el$46, "fg", _v$27, _p$.r));
      _v$28 !== _p$.d && (_p$.d = _$setProp(_el$57, "fg", _v$28, _p$.d));
      _v$29 !== _p$.l && (_p$.l = _$setProp(_el$60, "fg", _v$29, _p$.l));
      _v$30 !== _p$.u && (_p$.u = _$setProp(_el$61, "fg", _v$30, _p$.u));
      _v$31 !== _p$.c && (_p$.c = _$setProp(_el$64, "fg", _v$31, _p$.c));
      _v$32 !== _p$.w && (_p$.w = _$setProp(_el$65, "fg", _v$32, _p$.w));
      _v$33 !== _p$.m && (_p$.m = _$setProp(_el$67, "fg", _v$33, _p$.m));
      _v$34 !== _p$.f && (_p$.f = _$setProp(_el$69, "fg", _v$34, _p$.f));
      _v$35 !== _p$.y && (_p$.y = _$setProp(_el$72, "fg", _v$35, _p$.y));
      _v$36 !== _p$.g && (_p$.g = _$setProp(_el$73, "fg", _v$36, _p$.g));
      _v$37 !== _p$.p && (_p$.p = _$setProp(_el$76, "fg", _v$37, _p$.p));
      _v$38 !== _p$.b && (_p$.b = _$setProp(_el$77, "fg", _v$38, _p$.b));
      _v$39 !== _p$.T && (_p$.T = _$setProp(_el$79, "fg", _v$39, _p$.T));
      _v$40 !== _p$.A && (_p$.A = _$setProp(_el$81, "fg", _v$40, _p$.A));
      _v$41 !== _p$.O && (_p$.O = _$setProp(_el$84, "fg", _v$41, _p$.O));
      _v$42 !== _p$.I && (_p$.I = _$setProp(_el$85, "fg", _v$42, _p$.I));
      _v$43 !== _p$.S && (_p$.S = _$setProp(_el$88, "fg", _v$43, _p$.S));
      _v$44 !== _p$.W && (_p$.W = _$setProp(_el$89, "fg", _v$44, _p$.W));
      _v$45 !== _p$.C && (_p$.C = _$setProp(_el$91, "fg", _v$45, _p$.C));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined,
      r: undefined,
      d: undefined,
      l: undefined,
      u: undefined,
      c: undefined,
      w: undefined,
      m: undefined,
      f: undefined,
      y: undefined,
      g: undefined,
      p: undefined,
      b: undefined,
      T: undefined,
      A: undefined,
      O: undefined,
      I: undefined,
      S: undefined,
      W: undefined,
      C: undefined
    });
    return _el$22;
  })();
}

// src/components/manager-dialogs.tsx
import { memo as _$memo2 } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { effect as _$effect2 } from "@opentui/solid";
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { createTextNode as _$createTextNode2 } from "@opentui/solid";
import { insertNode as _$insertNode2 } from "@opentui/solid";
import { insert as _$insert2 } from "@opentui/solid";
import { setProp as _$setProp2 } from "@opentui/solid";
import { createElement as _$createElement2 } from "@opentui/solid";
import { CliRenderEvents } from "@opentui/core";

// src/clipboard.ts
import { spawnSync } from "child_process";
function copyToClipboard(text) {
  try {
    const script = `Set-Clipboard -Value ${JSON.stringify(text)}`;
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      timeout: 5000
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// src/components/manager-dialogs.tsx
import { useTerminalDimensions as useTerminalDimensions2 } from "@opentui/solid";
import { For as For2, Show as Show2, createEffect, createSignal as createSignal2, onCleanup } from "solid-js";
function click(event, action) {
  if (event.button !== 0)
    return;
  event.preventDefault();
  event.stopPropagation();
  action();
}
function MenuDialog(props) {
  const dims = useTerminalDimensions2();
  const theme = () => props.ctx.theme.surface("dialog");
  const [selected, setSelected] = createSignal2(0);
  const move = (delta) => setSelected((index) => (index + delta + props.options.length) % props.options.length);
  const choose = (index) => {
    const option = props.options[index];
    if (option)
      props.onSelect(option.value);
  };
  props.ctx.keymap.layer(() => ({
    mode: "modal",
    priority: 10,
    commands: [{
      bind: "escape",
      run: props.onClose
    }, {
      bind: "up,ctrl+p",
      run: () => move(-1)
    }, {
      bind: "down,ctrl+n",
      run: () => move(1)
    }, {
      bind: "home",
      run: () => setSelected(0)
    }, {
      bind: "end",
      run: () => setSelected(props.options.length - 1)
    }, {
      bind: "return",
      run: () => choose(selected())
    }]
  }));
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("box"), _el$3 = _$createElement2("text"), _el$4 = _$createElement2("b"), _el$5 = _$createElement2("text"), _el$7 = _$createElement2("box"), _el$8 = _$createElement2("text");
    _$insertNode2(_el$, _el$2);
    _$insertNode2(_el$, _el$7);
    _$setProp2(_el$, "width", "100%");
    _$setProp2(_el$, "paddingBottom", 1);
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$2, _el$5);
    _$setProp2(_el$2, "flexDirection", "row");
    _$setProp2(_el$2, "paddingX", 4);
    _$setProp2(_el$2, "flexShrink", 0);
    _$insertNode2(_el$3, _el$4);
    _$insert2(_el$4, () => props.title);
    _$insertNode2(_el$5, _$createTextNode2(`esc`));
    _$setProp2(_el$5, "flexGrow", 1);
    _$setProp2(_el$5, "textAlign", "right");
    _$setProp2(_el$5, "onMouseUp", (event) => click(event, props.onClose));
    _$insert2(_el$, _$createComponent2(For2, {
      get each() {
        return props.options;
      },
      children: (option, index) => {
        const active = () => selected() === index();
        return (() => {
          var _el$0 = _$createElement2("box"), _el$1 = _$createElement2("text");
          _$insertNode2(_el$0, _el$1);
          _$setProp2(_el$0, "width", "100%");
          _$setProp2(_el$0, "flexDirection", "row");
          _$setProp2(_el$0, "columnGap", 1);
          _$setProp2(_el$0, "paddingLeft", 3);
          _$setProp2(_el$0, "paddingRight", 2);
          _$setProp2(_el$0, "height", 1);
          _$setProp2(_el$0, "flexShrink", 0);
          _$setProp2(_el$0, "onMouseMove", () => setSelected(index()));
          _$setProp2(_el$0, "onMouseDown", (event) => click(event, () => setSelected(index())));
          _$setProp2(_el$0, "onMouseUp", (event) => click(event, () => {
            setSelected(index());
            choose(index());
          }));
          _$setProp2(_el$1, "flexShrink", 0);
          _$insert2(_el$1, () => option.label);
          _$insert2(_el$0, _$createComponent2(Show2, {
            get when() {
              return option.hint;
            },
            get children() {
              var _el$10 = _$createElement2("text");
              _$setProp2(_el$10, "flexGrow", 1);
              _$setProp2(_el$10, "minWidth", 0);
              _$setProp2(_el$10, "height", 1);
              _$setProp2(_el$10, "flexShrink", 1);
              _$setProp2(_el$10, "wrapMode", "none");
              _$setProp2(_el$10, "truncate", true);
              _$setProp2(_el$10, "textAlign", "right");
              _$insert2(_el$10, () => option.hint);
              _$effect2((_$p) => _$setProp2(_el$10, "fg", active() ? theme().text.action.primary.focused : theme().text.muted, _$p));
              return _el$10;
            }
          }), null);
          _$effect2((_p$) => {
            var _v$6 = `skills-manager.menu.${option.value}`, _v$7 = active() ? theme().background.action.primary.focused : undefined, _v$8 = option.danger ? theme().text.feedback.error.base : active() ? theme().text.action.primary.focused : theme().text.base;
            _v$6 !== _p$.e && (_p$.e = _$setProp2(_el$0, "id", _v$6, _p$.e));
            _v$7 !== _p$.t && (_p$.t = _$setProp2(_el$0, "backgroundColor", _v$7, _p$.t));
            _v$8 !== _p$.a && (_p$.a = _$setProp2(_el$1, "fg", _v$8, _p$.a));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined
          });
          return _el$0;
        })();
      }
    }), _el$7);
    _$insertNode2(_el$7, _el$8);
    _$setProp2(_el$7, "paddingX", 4);
    _$setProp2(_el$7, "flexShrink", 0);
    _$insertNode2(_el$8, _$createTextNode2(`\u2191/\u2193 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \xB7 enter \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \xB7 esc \u043E\u0442\u043C\u0435\u043D\u0430`));
    _$setProp2(_el$8, "width", "100%");
    _$setProp2(_el$8, "height", 1);
    _$setProp2(_el$8, "wrapMode", "none");
    _$setProp2(_el$8, "truncate", true);
    _$effect2((_p$) => {
      var _v$ = Math.max(1, Math.min(props.options.length + 3, dims().height - 4)), _v$2 = theme().background.base, _v$3 = theme().text.base, _v$4 = theme().text.muted, _v$5 = theme().text.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$, "height", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$, "backgroundColor", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp2(_el$3, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp2(_el$5, "fg", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp2(_el$8, "fg", _v$5, _p$.i));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined
    });
    return _el$;
  })();
}
function SetSelectionDialog(props) {
  const dims = useTerminalDimensions2();
  const theme = () => props.ctx.theme.surface("dialog");
  const [selected, setSelected] = createSignal2(new Set(props.initialSelected));
  const [cursor, setCursor] = createSignal2(0);
  let scroll;
  const move = (delta) => {
    const count = props.skills.length;
    if (count === 0)
      return;
    setCursor((index) => (index + delta + count) % count);
  };
  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id))
        next.delete(id);
      else
        next.add(id);
      return next;
    });
  };
  const apply = () => {
    props.onApply([...selected()]);
    props.onClose();
  };
  props.ctx.keymap.layer(() => ({
    mode: "modal",
    priority: 10,
    commands: [{
      bind: "escape",
      run: props.onClose
    }, {
      bind: "up,ctrl+p",
      run: () => move(-1)
    }, {
      bind: "down,ctrl+n",
      run: () => move(1)
    }, {
      bind: "home",
      run: () => setCursor(0)
    }, {
      bind: "end",
      run: () => setCursor(Math.max(0, props.skills.length - 1))
    }, {
      bind: "space",
      run: () => {
        const skill = props.skills[cursor()];
        if (skill)
          toggle(skill.id);
      }
    }, {
      bind: "return",
      run: apply
    }, {
      bind: "a",
      run: () => setSelected(new Set(props.skills.map((skill) => skill.id)))
    }, {
      bind: "n",
      run: () => setSelected(new Set)
    }]
  }));
  createEffect(() => {
    const index = cursor();
    dims().height;
    const reveal = () => {
      if (!scroll || scroll.isDestroyed)
        return;
      const skill = props.skills[index];
      if (!skill)
        return;
      scroll.scrollChildIntoView(`skills-manager.select.${skill.id}`);
    };
    props.ctx.renderer.once(CliRenderEvents.FRAME, reveal);
    props.ctx.renderer.requestRender();
    onCleanup(() => props.ctx.renderer.off(CliRenderEvents.FRAME, reveal));
  });
  return (() => {
    var _el$11 = _$createElement2("box"), _el$12 = _$createElement2("box"), _el$13 = _$createElement2("text"), _el$14 = _$createElement2("b"), _el$15 = _$createElement2("text"), _el$16 = _$createElement2("text"), _el$18 = _$createElement2("scrollbox"), _el$19 = _$createElement2("box"), _el$20 = _$createElement2("text");
    _$insertNode2(_el$11, _el$12);
    _$insertNode2(_el$11, _el$18);
    _$insertNode2(_el$11, _el$19);
    _$setProp2(_el$11, "width", "100%");
    _$setProp2(_el$11, "paddingBottom", 1);
    _$insertNode2(_el$12, _el$13);
    _$insertNode2(_el$12, _el$15);
    _$insertNode2(_el$12, _el$16);
    _$setProp2(_el$12, "flexDirection", "row");
    _$setProp2(_el$12, "paddingX", 4);
    _$setProp2(_el$12, "flexShrink", 0);
    _$insertNode2(_el$13, _el$14);
    _$insert2(_el$14, () => props.title);
    _$setProp2(_el$15, "flexGrow", 1);
    _$setProp2(_el$15, "minWidth", 0);
    _$setProp2(_el$15, "height", 1);
    _$setProp2(_el$15, "flexShrink", 1);
    _$setProp2(_el$15, "wrapMode", "none");
    _$setProp2(_el$15, "truncate", true);
    _$setProp2(_el$15, "textAlign", "right");
    _$insert2(_el$15, () => `\u0432\u044B\u0431\u0440\u0430\u043D\u043E ${selected().size} / ${props.skills.length}`);
    _$insertNode2(_el$16, _$createTextNode2(`  esc`));
    _$setProp2(_el$16, "flexShrink", 0);
    _$setProp2(_el$16, "onMouseUp", (event) => click(event, props.onClose));
    _$use((value) => {
      scroll = value;
      value.verticalScrollBar.resetVisibilityControl();
      value.horizontalScrollBar.resetVisibilityControl();
    }, _el$18);
    _$setProp2(_el$18, "id", "skills-manager.select");
    _$setProp2(_el$18, "flexGrow", 1);
    _$setProp2(_el$18, "minHeight", 0);
    _$setProp2(_el$18, "width", "100%");
    _$setProp2(_el$18, "paddingX", 1);
    _$setProp2(_el$18, "scrollX", false);
    _$insert2(_el$18, _$createComponent2(For2, {
      get each() {
        return props.skills;
      },
      children: (skill, index) => {
        const active = () => cursor() === index();
        const checked = () => selected().has(skill.id);
        return (() => {
          var _el$22 = _$createElement2("box"), _el$23 = _$createElement2("text"), _el$24 = _$createElement2("text");
          _$insertNode2(_el$22, _el$23);
          _$insertNode2(_el$22, _el$24);
          _$setProp2(_el$22, "width", "100%");
          _$setProp2(_el$22, "flexDirection", "row");
          _$setProp2(_el$22, "columnGap", 1);
          _$setProp2(_el$22, "paddingLeft", 3);
          _$setProp2(_el$22, "paddingRight", 2);
          _$setProp2(_el$22, "height", 1);
          _$setProp2(_el$22, "flexShrink", 0);
          _$setProp2(_el$22, "onMouseMove", () => setCursor(index()));
          _$setProp2(_el$22, "onMouseDown", (event) => click(event, () => setCursor(index())));
          _$setProp2(_el$22, "onMouseUp", (event) => click(event, () => {
            setCursor(index());
            toggle(skill.id);
          }));
          _$setProp2(_el$23, "flexShrink", 0);
          _$insert2(_el$23, () => checked() ? "[x]" : "[ ]");
          _$setProp2(_el$24, "flexGrow", 1);
          _$setProp2(_el$24, "minWidth", 0);
          _$setProp2(_el$24, "height", 1);
          _$setProp2(_el$24, "flexShrink", 1);
          _$setProp2(_el$24, "wrapMode", "none");
          _$setProp2(_el$24, "truncate", true);
          _$insert2(_el$24, () => skill.name);
          _$effect2((_p$) => {
            var _v$14 = `skills-manager.select.${skill.id}`, _v$15 = active() ? theme().background.action.primary.focused : undefined, _v$16 = active() ? theme().text.action.primary.focused : checked() ? theme().hue.accent[200] : theme().text.muted, _v$17 = active() ? theme().text.action.primary.focused : skill.enabled ? theme().text.base : theme().text.muted;
            _v$14 !== _p$.e && (_p$.e = _$setProp2(_el$22, "id", _v$14, _p$.e));
            _v$15 !== _p$.t && (_p$.t = _$setProp2(_el$22, "backgroundColor", _v$15, _p$.t));
            _v$16 !== _p$.a && (_p$.a = _$setProp2(_el$23, "fg", _v$16, _p$.a));
            _v$17 !== _p$.o && (_p$.o = _$setProp2(_el$24, "fg", _v$17, _p$.o));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined
          });
          return _el$22;
        })();
      }
    }));
    _$insertNode2(_el$19, _el$20);
    _$setProp2(_el$19, "paddingX", 4);
    _$setProp2(_el$19, "flexShrink", 0);
    _$insertNode2(_el$20, _$createTextNode2(`space \u043E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \xB7 enter \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \xB7 a \u0432\u0441\u0435 \xB7 n \u0441\u043D\u044F\u0442\u044C \xB7 esc \u043E\u0442\u043C\u0435\u043D\u0430`));
    _$setProp2(_el$20, "width", "100%");
    _$setProp2(_el$20, "height", 1);
    _$setProp2(_el$20, "wrapMode", "none");
    _$setProp2(_el$20, "truncate", true);
    _$effect2((_p$) => {
      var _v$9 = Math.max(1, Math.min(20, dims().height - 4)), _v$0 = dims().height < 14 ? 0 : 1, _v$1 = theme().background.base, _v$10 = theme().text.base, _v$11 = theme().text.muted, _v$12 = theme().text.muted, _v$13 = theme().text.muted;
      _v$9 !== _p$.e && (_p$.e = _$setProp2(_el$11, "height", _v$9, _p$.e));
      _v$0 !== _p$.t && (_p$.t = _$setProp2(_el$11, "gap", _v$0, _p$.t));
      _v$1 !== _p$.a && (_p$.a = _$setProp2(_el$11, "backgroundColor", _v$1, _p$.a));
      _v$10 !== _p$.o && (_p$.o = _$setProp2(_el$13, "fg", _v$10, _p$.o));
      _v$11 !== _p$.i && (_p$.i = _$setProp2(_el$15, "fg", _v$11, _p$.i));
      _v$12 !== _p$.n && (_p$.n = _$setProp2(_el$16, "fg", _v$12, _p$.n));
      _v$13 !== _p$.s && (_p$.s = _$setProp2(_el$20, "fg", _v$13, _p$.s));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined
    });
    return _el$11;
  })();
}
function DescDialog(props) {
  const dims = useTerminalDimensions2();
  const theme = () => props.ctx.theme.surface("dialog");
  const wrapText = (text, cols = 72) => {
    const out = [];
    for (const raw of text.split(`
`)) {
      let rest = raw;
      while (rest.length > cols) {
        let cut = rest.lastIndexOf(" ", cols);
        if (cut < cols / 2)
          cut = cols;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^ /, "");
      }
      out.push(rest);
    }
    return out;
  };
  const lines = wrapText(props.body);
  const height = Math.max(3, Math.min(lines.length + 4, dims().height - 4));
  props.ctx.keymap.layer(() => ({
    mode: "modal",
    priority: 10,
    commands: [{
      bind: "escape",
      run: props.onClose
    }, {
      bind: "return",
      run: props.onClose
    }, {
      bind: "ctrl+c",
      run: () => copyToClipboard(props.body)
    }]
  }));
  return (() => {
    var _el$25 = _$createElement2("box"), _el$26 = _$createElement2("box"), _el$27 = _$createElement2("text"), _el$28 = _$createElement2("b"), _el$29 = _$createElement2("text"), _el$31 = _$createElement2("text"), _el$33 = _$createElement2("box"), _el$34 = _$createElement2("text");
    _$insertNode2(_el$25, _el$26);
    _$insertNode2(_el$25, _el$33);
    _$setProp2(_el$25, "flexDirection", "column");
    _$setProp2(_el$25, "width", "100%");
    _$setProp2(_el$25, "height", height);
    _$setProp2(_el$25, "paddingX", 4);
    _$setProp2(_el$25, "paddingBottom", 1);
    _$insertNode2(_el$26, _el$27);
    _$insertNode2(_el$26, _el$29);
    _$insertNode2(_el$26, _el$31);
    _$setProp2(_el$26, "flexDirection", "row");
    _$setProp2(_el$26, "flexShrink", 0);
    _$insertNode2(_el$27, _el$28);
    _$insert2(_el$28, () => props.title);
    _$insertNode2(_el$29, _$createTextNode2(`\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C`));
    _$setProp2(_el$29, "flexGrow", 1);
    _$setProp2(_el$29, "textAlign", "right");
    _$setProp2(_el$29, "onMouseUp", (event) => {
      click(event, () => {
        copyToClipboard(props.body);
      });
    });
    _$insertNode2(_el$31, _$createTextNode2(`  esc`));
    _$setProp2(_el$31, "flexShrink", 0);
    _$setProp2(_el$31, "onMouseUp", (event) => click(event, props.onClose));
    _$insert2(_el$25, _$createComponent2(For2, {
      each: lines,
      children: (line) => (() => {
        var _el$36 = _$createElement2("text");
        _$setProp2(_el$36, "width", "100%");
        _$setProp2(_el$36, "wrapMode", "char");
        _$setProp2(_el$36, "flexShrink", 1);
        _$setProp2(_el$36, "minWidth", 0);
        _$insert2(_el$36, line || " ");
        _$effect2((_$p) => _$setProp2(_el$36, "fg", theme().text.base, _$p));
        return _el$36;
      })()
    }), _el$33);
    _$insertNode2(_el$33, _el$34);
    _$setProp2(_el$33, "paddingTop", 1);
    _$setProp2(_el$33, "flexShrink", 0);
    _$insertNode2(_el$34, _$createTextNode2(`Ctrl+C \u2014 \u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \xB7 esc \u2014 \u0437\u0430\u043A\u0440\u044B\u0442\u044C`));
    _$setProp2(_el$34, "width", "100%");
    _$setProp2(_el$34, "height", 1);
    _$setProp2(_el$34, "wrapMode", "none");
    _$setProp2(_el$34, "truncate", true);
    _$effect2((_p$) => {
      var _v$18 = theme().background.base, _v$19 = theme().text.base, _v$20 = theme().text.muted, _v$21 = theme().text.muted, _v$22 = theme().text.muted;
      _v$18 !== _p$.e && (_p$.e = _$setProp2(_el$25, "backgroundColor", _v$18, _p$.e));
      _v$19 !== _p$.t && (_p$.t = _$setProp2(_el$27, "fg", _v$19, _p$.t));
      _v$20 !== _p$.a && (_p$.a = _$setProp2(_el$29, "fg", _v$20, _p$.a));
      _v$21 !== _p$.o && (_p$.o = _$setProp2(_el$31, "fg", _v$21, _p$.o));
      _v$22 !== _p$.i && (_p$.i = _$setProp2(_el$34, "fg", _v$22, _p$.i));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined
    });
    return _el$25;
  })();
}

// src/ru-desc.ts
import { join } from "path";
var DEFAULT_RU = {
  "skill:codehealth-mcp": "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \xAB\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F\xBB \u043A\u043E\u0434\u0430 \u0447\u0435\u0440\u0435\u0437 MCP CodeScene. \u041E\u0446\u0435\u043D\u043A\u0438 1\u201310: " + "\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0444\u0430\u0439\u043B\u0430 \u0434\u043E \u043F\u0440\u0430\u0432\u043E\u043A (baseline), \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0439 \u043F\u0440\u0430\u0432\u043A\u0438, " + "\u0437\u0430\u0449\u0438\u0442\u0430 \u043A\u043E\u043C\u043C\u0438\u0442\u0430 \u043E\u0442 \u0440\u0435\u0433\u0440\u0435\u0441\u0441\u0430 \u0438 \u0430\u043D\u0430\u043B\u0438\u0437 \u0432\u0435\u0442\u043A\u0438 \u043F\u0435\u0440\u0435\u0434 PR. \u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0435 standalone-\u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0431\u0435\u0437 \u043A\u043B\u044E\u0447\u0430.",
  "tool:code_health_review": "\u0414\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u043E\u0434\u043D\u043E\u0433\u043E \u0444\u0430\u0439\u043B\u0430: \u043E\u0446\u0435\u043D\u043A\u0430 Code Health (1\u201310) \u0438 \u0441\u043F\u0438\u0441\u043E\u043A \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u043F\u0440\u043E\u0431\u043B\u0435\u043C. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u0440\u0430\u0432\u043E\u043A.",
  "tool:code_health_score": "\u0411\u044B\u0441\u0442\u0440\u0430\u044F \u0447\u0438\u0441\u043B\u043E\u0432\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0444\u0430\u0439\u043B\u0430 \u043F\u043E\u0441\u043B\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u2014 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438, \u0447\u0442\u043E \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u043E \u043D\u0435 \u0443\u0445\u0443\u0434\u0448\u0438\u043B\u043E\u0441\u044C.",
  "tool:pre_commit_code_health_safeguard": "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043F\u0435\u0440\u0435\u0434 \u043A\u043E\u043C\u043C\u0438\u0442\u043E\u043C: \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0441\u043D\u0438\u0436\u0430\u044E\u0442 Code Health.",
  "tool:analyze_change_set": "\u0410\u043D\u0430\u043B\u0438\u0437 \u0432\u0435\u0442\u043A\u0438 \u043F\u0435\u0440\u0435\u0434 \u043E\u0442\u043A\u0440\u044B\u0442\u0438\u0435\u043C Pull Request: \u043E\u0446\u0435\u043D\u043A\u0430 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0431\u0430\u0437\u043E\u0432\u043E\u0439 \u0432\u0435\u0442\u043A\u0438.",
  "tool:explain_code_health": "\u041E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442, \u0447\u0442\u043E \u0442\u0430\u043A\u043E\u0435 \u043C\u0435\u0442\u0440\u0438\u043A\u0430 Code Health \u0438 \u043A\u0430\u043A \u0435\u0451 \u043F\u043E\u043D\u0438\u043C\u0430\u0442\u044C.",
  "tool:explain_code_health_productivity": "\u0411\u0438\u0437\u043D\u0435\u0441-\u043E\u0431\u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u0438: \u043A\u0430\u043A Code Health \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0440\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u043A\u0438.",
  "tool:code_health_refactoring_business_case": "\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0432\u044B\u0433\u043E\u0434\u044B \u043E\u0442 \u0440\u0435\u0444\u0430\u043A\u0442\u043E\u0440\u0438\u043D\u0433\u0430 (ROI).",
  "server:codescene": "MCP-\u0441\u0435\u0440\u0432\u0435\u0440 CodeScene: \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \xAB\u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F\xBB \u043A\u043E\u0434\u0430. \u0411\u0435\u0437 \u043A\u043B\u044E\u0447\u0430 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 standalone-\u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B.",
  "server:codegraph": "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u043D\u0434\u0435\u043A\u0441 \u043A\u043E\u0434\u0430 (knowledge graph): \u0431\u044B\u0441\u0442\u0440\u044B\u0439 \u043F\u043E\u0438\u0441\u043A \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432, \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u044B \u0438 \u0441\u0432\u044F\u0437\u0435\u0439 \u0432 \u043F\u0440\u043E\u0435\u043A\u0442\u0435.",
  "server:context7": "\u0410\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u044F \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A \u0438 \u0444\u0440\u0435\u0439\u043C\u0432\u043E\u0440\u043A\u043E\u0432 (Context7).",
  "server:memory": "\u0413\u0440\u0430\u0444 \u0437\u043D\u0430\u043D\u0438\u0439: \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435 \u0444\u0430\u043A\u0442\u043E\u0432 \u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0435 \u043C\u0435\u0436\u0434\u0443 \u0441\u0435\u0441\u0441\u0438\u044F\u043C\u0438 (\u043F\u0430\u043C\u044F\u0442\u044C \u0430\u0433\u0435\u043D\u0442\u0430).",
  "server:i18n-tools": "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B \u043B\u043E\u043A\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438: \u0440\u0430\u0431\u043E\u0442\u0430 \u0441 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430\u043C\u0438 \u0438 \u0444\u0430\u0439\u043B\u0430\u043C\u0438 \u043B\u043E\u043A\u0430\u043B\u0438.",
  "plugin:opencode.dazhdbog": "\u041F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0430\u0432\u044B\u043A\u0430\u043C\u0438: \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435/\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u0441\u043A\u0438\u043B\u043B\u043E\u0432, \u043D\u0430\u0431\u043E\u0440\u044B, \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B, MCP \u0438 \u043F\u043B\u0430\u0433\u0438\u043D\u044B.",
  "plugin:opencode.mcp-classify": "\u0421\u0435\u043A\u0446\u0438\u044F MCP \u043E\u0442 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043B\u0430\u0433\u0438\u043D\u0430 (\u0432 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435 \u0432\u0440\u0435\u043C\u044F \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u2014 \u0434\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u043D\u0430\u0448\u0443 \u043F\u0430\u043D\u0435\u043B\u044C).",
  "plugin:watermark-clean": "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0447\u0438\u0441\u0442\u043A\u0430 \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u044B\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 (watermark) \u0432 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u0435\u043C\u044B\u0445 \u0444\u0430\u0439\u043B\u0430\u0445.",
  "tool:read": "\u0427\u0442\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u0430/\u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430. \u0421\u0442\u0440\u043E\u043A\u0438 \u043D\u0443\u043C\u0435\u0440\u0443\u044E\u0442\u0441\u044F.",
  "tool:edit": "\u0422\u043E\u0447\u0435\u0447\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0444\u0430\u0439\u043B\u0430 \u043F\u043E \u0442\u043E\u0447\u043D\u043E\u043C\u0443 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044E \u0442\u0435\u043A\u0441\u0442\u0430.",
  "tool:write": "\u0417\u0430\u043F\u0438\u0441\u044C \u0444\u0430\u0439\u043B\u0430 \u0446\u0435\u043B\u0438\u043A\u043E\u043C (\u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435/\u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0438\u0441\u044C).",
  "tool:patch": "\u041F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435 diff-\u043F\u0430\u0442\u0447\u0430 \u043A \u0444\u0430\u0439\u043B\u0430\u043C.",
  "tool:glob": "\u041F\u043E\u0438\u0441\u043A \u0444\u0430\u0439\u043B\u043E\u0432 \u043F\u043E \u043C\u0430\u0441\u043A\u0435/\u0448\u0430\u0431\u043B\u043E\u043D\u0443.",
  "tool:grep": "\u041F\u043E\u0438\u0441\u043A \u0442\u0435\u043A\u0441\u0442\u0430 \u043F\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 \u0444\u0430\u0439\u043B\u043E\u0432 (ripgrep).",
  "tool:shell": "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u043A\u043E\u043C\u0430\u043D\u0434 \u0432 \u043E\u0431\u043E\u043B\u043E\u0447\u043A\u0435.",
  "tool:question": "\u0417\u0430\u0434\u0430\u0442\u044C \u0432\u043E\u043F\u0440\u043E\u0441 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u0441 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C\u0438 \u043E\u0442\u0432\u0435\u0442\u0430.",
  "tool:skill": "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u0441\u043A\u0438\u043B\u043B\u0430 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442.",
  "tool:subagent": "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0434\u043E\u0447\u0435\u0440\u043D\u0435\u0433\u043E \u0430\u0433\u0435\u043D\u0442\u0430 \u0434\u043B\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u0437\u0430\u0434\u0430\u0447\u0438.",
  "tool:webfetch": "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 URL.",
  "tool:websearch": "\u041F\u043E\u0438\u0441\u043A \u0432 \u0432\u0435\u0431\u0435.",
  "tool:codegraph_explore": "\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438 \u043F\u043E \u043A\u043E\u0434\u0443: \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0438\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u0438 \u043D\u0443\u0436\u043D\u044B\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432, \u043F\u0443\u0442\u0438 \u0432\u044B\u0437\u043E\u0432\u043E\u0432 \u0438 \xAB\u0440\u0430\u0434\u0438\u0443\u0441 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u044F\xBB \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u0437\u0430 \u043E\u0434\u0438\u043D \u0432\u044B\u0437\u043E\u0432.",
  "tool:codegraph_search": "\u041F\u043E\u0438\u0441\u043A \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u043F\u043E \u0433\u0440\u0430\u0444\u0443 \u043A\u043E\u0434\u0430 (\u0438\u043D\u0434\u0435\u043A\u0441\u0443 \u043F\u0440\u043E\u0435\u043A\u0442\u0430).",
  "tool:query-docs": "\u0417\u0430\u043F\u0440\u043E\u0441 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438/\u0444\u0440\u0435\u0439\u043C\u0432\u043E\u0440\u043A\u0430 (Context7) \u0441 \u043F\u0440\u0438\u043C\u0435\u0440\u0430\u043C\u0438 \u043A\u043E\u0434\u0430.",
  "tool:resolve-library-id": "\u041F\u043E\u0438\u0441\u043A \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438 \u0432 Context7 \u0434\u043B\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438.",
  "tool:add_observations": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F \u043A \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0432 \u0433\u0440\u0430\u0444\u0435 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:create_entities": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0432 \u0433\u0440\u0430\u0444\u0435 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:create_relations": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0432\u044F\u0437\u0438 \u043C\u0435\u0436\u0434\u0443 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044F\u043C\u0438 \u0432 \u0433\u0440\u0430\u0444\u0435 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:read_graph": "\u0427\u0442\u0435\u043D\u0438\u0435 \u0432\u0441\u0435\u0433\u043E \u0433\u0440\u0430\u0444\u0430 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:search_nodes": "\u041F\u043E\u0438\u0441\u043A \u0443\u0437\u043B\u043E\u0432 \u0432 \u0433\u0440\u0430\u0444\u0435 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:open_nodes": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0443\u0437\u043B\u044B \u0433\u0440\u0430\u0444\u0430 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:delete_entities": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0438 \u0438 \u0438\u0445 \u0441\u0432\u044F\u0437\u0438 \u0438\u0437 \u0433\u0440\u0430\u0444\u0430 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:delete_observations": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u0435\u0439 \u0432 \u0433\u0440\u0430\u0444\u0435 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:delete_relations": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u0432\u044F\u0437\u0438 \u0438\u0437 \u0433\u0440\u0430\u0444\u0430 \u0437\u043D\u0430\u043D\u0438\u0439.",
  "tool:set": "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u0434\u043B\u044F \u043B\u043E\u043A\u0430\u043B\u0438.",
  "tool:add": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043A\u043B\u044E\u0447 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u0441\u0440\u0430\u0437\u0443 \u0432 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043B\u043E\u043A\u0430\u043B\u0435\u0439.",
  "tool:batch": "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0439 \u0441 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430\u043C\u0438 \u043E\u0434\u043D\u0438\u043C \u0432\u044B\u0437\u043E\u0432\u043E\u043C.",
  "tool:query": "\u041D\u0430\u0439\u0442\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043A\u043B\u044E\u0447\u0430 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u0432\u043E \u0432\u0441\u0435\u0445 \u043B\u043E\u043A\u0430\u043B\u044F\u0445.",
  "tool:rename": "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043A\u043B\u044E\u0447 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430.",
  "tool:move": "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u043A\u043B\u044E\u0447 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u043F\u0443\u0442\u044C.",
  "tool:delete": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043A\u043B\u044E\u0447 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0430 \u0438\u0437 \u0432\u0441\u0435\u0445 \u043B\u043E\u043A\u0430\u043B\u0435\u0439.",
  "tool:search": "\u041F\u043E\u0438\u0441\u043A \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u043E\u0432 \u043F\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044E.",
  "tool:list": "\u0421\u043F\u0438\u0441\u043E\u043A \u043A\u043B\u044E\u0447\u0435\u0439 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u043E\u0432 (\u0441 \u0444\u0438\u043B\u044C\u0442\u0440\u043E\u043C \u0438 \u043F\u0430\u0433\u0438\u043D\u0430\u0446\u0438\u0435\u0439).",
  "tool:missing": "\u041D\u0430\u0439\u0442\u0438 \u043A\u043B\u044E\u0447\u0438, \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0432 \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043B\u043E\u043A\u0430\u043B\u044F\u0445.",
  "tool:opencode_session_rename": "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u044E.",
  "tool:opencode_session_move": "\u041F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u0442\u044C \u0441\u0435\u0441\u0441\u0438\u044E \u0432 \u0434\u0440\u0443\u0433\u043E\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433.",
  "tool:opencode_worktree_create": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u043D\u044B\u0439 worktree \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u044F.",
  "tool:opencode_worktree_list": "\u0421\u043F\u0438\u0441\u043E\u043A worktree \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u044F.",
  "tool:opencode_worktree_remove": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C worktree \u0440\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u044F.",
  "tool:opencode_models": "\u041F\u043E\u0438\u0441\u043A \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u043C\u043E\u0434\u0435\u043B\u0435\u0439 \u043F\u043E \u043F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440\u0443.",
  "tool:opencode_list_mcp_resources": "\u0421\u043F\u0438\u0441\u043E\u043A \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432, \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0447\u0435\u0440\u0435\u0437 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u044B.",
  "tool:opencode_read_mcp_resource": "\u0427\u0442\u0435\u043D\u0438\u0435 \u0440\u0435\u0441\u0443\u0440\u0441\u0430 MCP-\u0441\u0435\u0440\u0432\u0435\u0440\u0430.",
  "server:rea": "REA-\u0430\u0433\u0435\u043D\u0442: \u0430\u043D\u0430\u043B\u0438\u0437 \u043A\u043E\u0434\u0430 \u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044F \u0437\u0430\u0434\u0430\u0447.",
  "server:shadcn": "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B shadcn/ui (\u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432)."
};
var OVERRIDES_FILE = ".opencode/.control-panel/ru-descriptions.json";
function readRuOverrides(projectRoot) {
  try {
    const raw = readTextFile(join(projectRoot, OVERRIDES_FILE));
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    return parsed.ru ?? {};
  } catch {
    return {};
  }
}
function buildRuMap(projectRoot) {
  return { ...DEFAULT_RU, ...readRuOverrides(projectRoot) };
}

// src/components/skills-dialog.tsx
import { memo as _$memo3 } from "@opentui/solid";
import { effect as _$effect3 } from "@opentui/solid";
import { insert as _$insert3 } from "@opentui/solid";
import { createComponent as _$createComponent3 } from "@opentui/solid";
import { use as _$use2 } from "@opentui/solid";
import { createTextNode as _$createTextNode3 } from "@opentui/solid";
import { insertNode as _$insertNode3 } from "@opentui/solid";
import { setProp as _$setProp3 } from "@opentui/solid";
import { createElement as _$createElement3 } from "@opentui/solid";
import { CliRenderEvents as CliRenderEvents2 } from "@opentui/core";
import { useTerminalDimensions as useTerminalDimensions3 } from "@opentui/solid";
import { For as For3, Show as Show3, createEffect as createEffect2, createSignal as createSignal3, onCleanup as onCleanup2 } from "solid-js";
var OPTIONS = [{
  key: "switch",
  label: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C",
  category: "\u041F\u0430\u043D\u0435\u043B\u044C",
  values: ["off", "on"],
  labels: ["\u0432\u044B\u043A\u043B", "\u0432\u043A\u043B"]
}, {
  key: "token",
  label: "\u041E\u0446\u0435\u043D\u043A\u0430 \u0442\u043E\u043A\u0435\u043D\u043E\u0432",
  category: "\u041F\u0430\u043D\u0435\u043B\u044C",
  values: ["listing", "load-delta", "loaded-total", "off"],
  labels: ["\u0432 \u0441\u043F\u0438\u0441\u043A\u0435", "\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430", "\u0432\u0441\u0435\u0433\u043E", "\u0432\u044B\u043A\u043B"]
}, {
  key: "state",
  label: "\u0421\u0447\u0451\u0442\u0447\u0438\u043A\u0438 \u0432 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0435",
  category: "\u041F\u0430\u043D\u0435\u043B\u044C",
  values: ["on", "off"],
  labels: ["\u0432\u043A\u043B", "\u0432\u044B\u043A\u043B"]
}];
function SkillsDialog(props) {
  const dims = useTerminalDimensions3();
  const theme = () => props.ctx.theme.surface("dialog");
  const [selected, setSelected] = createSignal3(0);
  const value = (key) => props.settings()[key];
  let scroll;
  const move = (delta) => setSelected((index) => (index + delta + OPTIONS.length) % OPTIONS.length);
  const change = (delta, option = OPTIONS[selected()]) => {
    const index = option.values.indexOf(value(option.key));
    const next = option.values[(index + delta + option.values.length) % option.values.length];
    props.onChange({
      [option.key]: next
    });
  };
  const close = () => {
    props.ctx.renderer.clearSelection();
    props.ctx.ui.dialog.clear();
  };
  props.ctx.keymap.layer(() => ({
    mode: "modal",
    priority: 10,
    commands: [{
      bind: "escape",
      run: close
    }, {
      bind: "up,ctrl+p",
      run: () => move(-1)
    }, {
      bind: "down,ctrl+n",
      run: () => move(1)
    }, {
      bind: "home",
      run: () => setSelected(0)
    }, {
      bind: "end",
      run: () => setSelected(OPTIONS.length - 1)
    }, {
      bind: "left",
      run: () => change(-1)
    }, {
      bind: "right,return",
      run: () => change(1)
    }]
  }));
  createEffect2(() => {
    const index = selected();
    const option = OPTIONS[index];
    dims().height;
    const reveal = () => {
      if (!scroll || scroll.isDestroyed)
        return;
      if (index === 0)
        scroll.scrollTo(0);
      else
        scroll.scrollChildIntoView(`skills-sider.${option.key}`);
    };
    props.ctx.renderer.once(CliRenderEvents2.FRAME, reveal);
    props.ctx.renderer.requestRender();
    onCleanup2(() => props.ctx.renderer.off(CliRenderEvents2.FRAME, reveal));
  });
  const click = (event, action) => {
    if (event.button !== 0)
      return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  return (() => {
    var _el$ = _$createElement3("box"), _el$2 = _$createElement3("box"), _el$3 = _$createElement3("text"), _el$4 = _$createElement3("b"), _el$6 = _$createElement3("text"), _el$8 = _$createElement3("scrollbox"), _el$9 = _$createElement3("box"), _el$0 = _$createElement3("text");
    _$insertNode3(_el$, _el$2);
    _$insertNode3(_el$, _el$8);
    _$insertNode3(_el$, _el$9);
    _$setProp3(_el$, "width", "100%");
    _$setProp3(_el$, "paddingBottom", 1);
    _$insertNode3(_el$2, _el$3);
    _$insertNode3(_el$2, _el$6);
    _$setProp3(_el$2, "flexDirection", "row");
    _$setProp3(_el$2, "paddingX", 4);
    _$setProp3(_el$2, "flexShrink", 0);
    _$insertNode3(_el$3, _el$4);
    _$insertNode3(_el$4, _$createTextNode3(`Skills Manager`));
    _$insertNode3(_el$6, _$createTextNode3(`esc`));
    _$setProp3(_el$6, "flexGrow", 1);
    _$setProp3(_el$6, "textAlign", "right");
    _$setProp3(_el$6, "onMouseUp", (event) => click(event, close));
    _$use2((value) => {
      scroll = value;
      value.verticalScrollBar.resetVisibilityControl();
      value.horizontalScrollBar.resetVisibilityControl();
    }, _el$8);
    _$setProp3(_el$8, "id", "skills-sider.options");
    _$setProp3(_el$8, "flexGrow", 1);
    _$setProp3(_el$8, "minHeight", 0);
    _$setProp3(_el$8, "width", "100%");
    _$setProp3(_el$8, "paddingX", 1);
    _$setProp3(_el$8, "scrollX", false);
    _$insert3(_el$8, _$createComponent3(For3, {
      each: OPTIONS,
      children: (option, index) => {
        const active = () => selected() === index();
        return [_$createComponent3(Show3, {
          get when() {
            return index() === 0 || OPTIONS[index() - 1].category !== option.category;
          },
          get children() {
            var _el$10 = _$createElement3("box"), _el$11 = _$createElement3("text"), _el$12 = _$createElement3("b");
            _$insertNode3(_el$10, _el$11);
            _$setProp3(_el$10, "paddingLeft", 3);
            _$setProp3(_el$10, "flexShrink", 0);
            _$insertNode3(_el$11, _el$12);
            _$insert3(_el$12, () => option.category);
            _$effect3((_p$) => {
              var _v$7 = index() > 0 ? 1 : 0, _v$8 = theme().hue.accent[200];
              _v$7 !== _p$.e && (_p$.e = _$setProp3(_el$10, "paddingTop", _v$7, _p$.e));
              _v$8 !== _p$.t && (_p$.t = _$setProp3(_el$11, "fg", _v$8, _p$.t));
              return _p$;
            }, {
              e: undefined,
              t: undefined
            });
            return _el$10;
          }
        }), (() => {
          var _el$13 = _$createElement3("box"), _el$14 = _$createElement3("text"), _el$15 = _$createElement3("text");
          _$insertNode3(_el$13, _el$14);
          _$insertNode3(_el$13, _el$15);
          _$setProp3(_el$13, "width", "100%");
          _$setProp3(_el$13, "flexDirection", "row");
          _$setProp3(_el$13, "columnGap", 1);
          _$setProp3(_el$13, "paddingLeft", 3);
          _$setProp3(_el$13, "paddingRight", 2);
          _$setProp3(_el$13, "height", 1);
          _$setProp3(_el$13, "flexShrink", 0);
          _$setProp3(_el$13, "onMouseMove", () => setSelected(index()));
          _$setProp3(_el$13, "onMouseDown", (event) => click(event, () => setSelected(index())));
          _$setProp3(_el$13, "onMouseUp", (event) => click(event, () => {
            setSelected(index());
            change(1, option);
          }));
          _$setProp3(_el$14, "flexShrink", 0);
          _$insert3(_el$14, () => option.label ?? option.key);
          _$setProp3(_el$15, "flexGrow", 1);
          _$setProp3(_el$15, "minWidth", 0);
          _$setProp3(_el$15, "height", 1);
          _$setProp3(_el$15, "flexShrink", 1);
          _$setProp3(_el$15, "wrapMode", "none");
          _$setProp3(_el$15, "truncate", true);
          _$setProp3(_el$15, "textAlign", "right");
          _$insert3(_el$15, () => (option.labels ?? option.values)[option.values.indexOf(value(option.key))]);
          _$effect3((_p$) => {
            var _v$9 = `skills-sider.${option.key}`, _v$0 = active() ? theme().background.action.primary.focused : undefined, _v$1 = active() ? theme().text.action.primary.focused : theme().text.base, _v$10 = active() ? theme().text.action.primary.focused : theme().text.muted;
            _v$9 !== _p$.e && (_p$.e = _$setProp3(_el$13, "id", _v$9, _p$.e));
            _v$0 !== _p$.t && (_p$.t = _$setProp3(_el$13, "backgroundColor", _v$0, _p$.t));
            _v$1 !== _p$.a && (_p$.a = _$setProp3(_el$14, "fg", _v$1, _p$.a));
            _v$10 !== _p$.o && (_p$.o = _$setProp3(_el$15, "fg", _v$10, _p$.o));
            return _p$;
          }, {
            e: undefined,
            t: undefined,
            a: undefined,
            o: undefined
          });
          return _el$13;
        })()];
      }
    }));
    _$insertNode3(_el$9, _el$0);
    _$setProp3(_el$9, "paddingX", 4);
    _$setProp3(_el$9, "flexShrink", 0);
    _$insertNode3(_el$0, _$createTextNode3(`\u2191/\u2193 \u0432\u044B\u0431\u043E\u0440 \xB7 \u2190/\u2192 / enter \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \xB7 \u041B\u041A\u041C \u043F\u043E \u043D\u0430\u0432\u044B\u043A\u0443 \u0432\u043A\u043B/\u0432\u044B\u043A\u043B \xB7 \u041F\u041A\u041C \u043C\u0435\u043D\u044E`));
    _$setProp3(_el$0, "width", "100%");
    _$setProp3(_el$0, "height", 1);
    _$setProp3(_el$0, "wrapMode", "none");
    _$setProp3(_el$0, "truncate", true);
    _$effect3((_p$) => {
      var _v$ = Math.max(1, Math.min(17, dims().height - 4)), _v$2 = dims().height < 12 ? 0 : 1, _v$3 = theme().background.base, _v$4 = theme().text.base, _v$5 = theme().text.muted, _v$6 = theme().text.muted;
      _v$ !== _p$.e && (_p$.e = _$setProp3(_el$, "height", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp3(_el$, "gap", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp3(_el$, "backgroundColor", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp3(_el$3, "fg", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp3(_el$6, "fg", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp3(_el$0, "fg", _v$6, _p$.n));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined
    });
    return _el$;
  })();
}

// src/open-link.ts
import { spawn } from "child_process";
function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}
function resolveLinkToOpen(event, hasSelection, getLinkAt) {
  if (!event.modifiers?.ctrl || hasSelection())
    return null;
  const url = getLinkAt(event.x, event.y);
  return url !== null && isHttpUrl(url) ? url : null;
}
function openUrl(url) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

// src/permissions.ts
import { homedir } from "os";
import { join as join2 } from "path";

// node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text, ignoreTrivia = false) {
  const len = text.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value = 0;
    while (digits < count || !exact) {
      let ch = text.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value = value * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value = value * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value = value * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value = -1;
    }
    return value;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text.length && (text.charCodeAt(pos) === 69 || text.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text.length && text.charCodeAt(pos) === 43 || text.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++;
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === 34) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += `
`;
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "\t";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text.charCodeAt(pos) === 10) {
        pos++;
        value += `
`;
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      case 47:
        const start = pos - 1;
        if (text.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text.substring(start, pos);
          return token = 12;
        }
        if (text.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text.charCodeAt(pos);
            if (ch === 42 && text.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return token = 16;
        }
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function(CharacterCodes) {
  CharacterCodes[CharacterCodes["lineFeed"] = 10] = "lineFeed";
  CharacterCodes[CharacterCodes["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes[CharacterCodes["space"] = 32] = "space";
  CharacterCodes[CharacterCodes["_0"] = 48] = "_0";
  CharacterCodes[CharacterCodes["_1"] = 49] = "_1";
  CharacterCodes[CharacterCodes["_2"] = 50] = "_2";
  CharacterCodes[CharacterCodes["_3"] = 51] = "_3";
  CharacterCodes[CharacterCodes["_4"] = 52] = "_4";
  CharacterCodes[CharacterCodes["_5"] = 53] = "_5";
  CharacterCodes[CharacterCodes["_6"] = 54] = "_6";
  CharacterCodes[CharacterCodes["_7"] = 55] = "_7";
  CharacterCodes[CharacterCodes["_8"] = 56] = "_8";
  CharacterCodes[CharacterCodes["_9"] = 57] = "_9";
  CharacterCodes[CharacterCodes["a"] = 97] = "a";
  CharacterCodes[CharacterCodes["b"] = 98] = "b";
  CharacterCodes[CharacterCodes["c"] = 99] = "c";
  CharacterCodes[CharacterCodes["d"] = 100] = "d";
  CharacterCodes[CharacterCodes["e"] = 101] = "e";
  CharacterCodes[CharacterCodes["f"] = 102] = "f";
  CharacterCodes[CharacterCodes["g"] = 103] = "g";
  CharacterCodes[CharacterCodes["h"] = 104] = "h";
  CharacterCodes[CharacterCodes["i"] = 105] = "i";
  CharacterCodes[CharacterCodes["j"] = 106] = "j";
  CharacterCodes[CharacterCodes["k"] = 107] = "k";
  CharacterCodes[CharacterCodes["l"] = 108] = "l";
  CharacterCodes[CharacterCodes["m"] = 109] = "m";
  CharacterCodes[CharacterCodes["n"] = 110] = "n";
  CharacterCodes[CharacterCodes["o"] = 111] = "o";
  CharacterCodes[CharacterCodes["p"] = 112] = "p";
  CharacterCodes[CharacterCodes["q"] = 113] = "q";
  CharacterCodes[CharacterCodes["r"] = 114] = "r";
  CharacterCodes[CharacterCodes["s"] = 115] = "s";
  CharacterCodes[CharacterCodes["t"] = 116] = "t";
  CharacterCodes[CharacterCodes["u"] = 117] = "u";
  CharacterCodes[CharacterCodes["v"] = 118] = "v";
  CharacterCodes[CharacterCodes["w"] = 119] = "w";
  CharacterCodes[CharacterCodes["x"] = 120] = "x";
  CharacterCodes[CharacterCodes["y"] = 121] = "y";
  CharacterCodes[CharacterCodes["z"] = 122] = "z";
  CharacterCodes[CharacterCodes["A"] = 65] = "A";
  CharacterCodes[CharacterCodes["B"] = 66] = "B";
  CharacterCodes[CharacterCodes["C"] = 67] = "C";
  CharacterCodes[CharacterCodes["D"] = 68] = "D";
  CharacterCodes[CharacterCodes["E"] = 69] = "E";
  CharacterCodes[CharacterCodes["F"] = 70] = "F";
  CharacterCodes[CharacterCodes["G"] = 71] = "G";
  CharacterCodes[CharacterCodes["H"] = 72] = "H";
  CharacterCodes[CharacterCodes["I"] = 73] = "I";
  CharacterCodes[CharacterCodes["J"] = 74] = "J";
  CharacterCodes[CharacterCodes["K"] = 75] = "K";
  CharacterCodes[CharacterCodes["L"] = 76] = "L";
  CharacterCodes[CharacterCodes["M"] = 77] = "M";
  CharacterCodes[CharacterCodes["N"] = 78] = "N";
  CharacterCodes[CharacterCodes["O"] = 79] = "O";
  CharacterCodes[CharacterCodes["P"] = 80] = "P";
  CharacterCodes[CharacterCodes["Q"] = 81] = "Q";
  CharacterCodes[CharacterCodes["R"] = 82] = "R";
  CharacterCodes[CharacterCodes["S"] = 83] = "S";
  CharacterCodes[CharacterCodes["T"] = 84] = "T";
  CharacterCodes[CharacterCodes["U"] = 85] = "U";
  CharacterCodes[CharacterCodes["V"] = 86] = "V";
  CharacterCodes[CharacterCodes["W"] = 87] = "W";
  CharacterCodes[CharacterCodes["X"] = 88] = "X";
  CharacterCodes[CharacterCodes["Y"] = 89] = "Y";
  CharacterCodes[CharacterCodes["Z"] = 90] = "Z";
  CharacterCodes[CharacterCodes["asterisk"] = 42] = "asterisk";
  CharacterCodes[CharacterCodes["backslash"] = 92] = "backslash";
  CharacterCodes[CharacterCodes["closeBrace"] = 125] = "closeBrace";
  CharacterCodes[CharacterCodes["closeBracket"] = 93] = "closeBracket";
  CharacterCodes[CharacterCodes["colon"] = 58] = "colon";
  CharacterCodes[CharacterCodes["comma"] = 44] = "comma";
  CharacterCodes[CharacterCodes["dot"] = 46] = "dot";
  CharacterCodes[CharacterCodes["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes[CharacterCodes["minus"] = 45] = "minus";
  CharacterCodes[CharacterCodes["openBrace"] = 123] = "openBrace";
  CharacterCodes[CharacterCodes["openBracket"] = 91] = "openBracket";
  CharacterCodes[CharacterCodes["plus"] = 43] = "plus";
  CharacterCodes[CharacterCodes["slash"] = 47] = "slash";
  CharacterCodes[CharacterCodes["formFeed"] = 12] = "formFeed";
  CharacterCodes[CharacterCodes["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return `
` + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return `\r
` + " ".repeat(index);
    })
  },
  "\t": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return `
` + "\t".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + "\t".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return `\r
` + "\t".repeat(index);
    })
  }
};
var supportedEols = [`
`, "\r", `\r
`];

// node_modules/jsonc-parser/lib/esm/impl/format.js
function format(documentText, range, options) {
  let initialIndentLevel;
  let formatText;
  let formatTextStart;
  let rangeStart;
  let rangeEnd;
  if (range) {
    rangeStart = range.offset;
    rangeEnd = rangeStart + range.length;
    formatTextStart = rangeStart;
    while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
      formatTextStart--;
    }
    let endOffset = rangeEnd;
    while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
      endOffset++;
    }
    formatText = documentText.substring(formatTextStart, endOffset);
    initialIndentLevel = computeIndentLevel(formatText, options);
  } else {
    formatText = documentText;
    initialIndentLevel = 0;
    formatTextStart = 0;
    rangeStart = 0;
    rangeEnd = documentText.length;
  }
  const eol = getEOL(options, documentText);
  const eolFastPathSupported = supportedEols.includes(eol);
  let numberLineBreaks = 0;
  let indentLevel = 0;
  let indentValue;
  if (options.insertSpaces) {
    indentValue = cachedSpaces[options.tabSize || 4] ?? repeat(cachedSpaces[1], options.tabSize || 4);
  } else {
    indentValue = "\t";
  }
  const indentType = indentValue === "\t" ? "\t" : " ";
  let scanner = createScanner(formatText, false);
  let hasError = false;
  function newLinesAndIndent() {
    if (numberLineBreaks > 1) {
      return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    const amountOfSpaces = indentValue.length * (initialIndentLevel + indentLevel);
    if (!eolFastPathSupported || amountOfSpaces > cachedBreakLinesWithSpaces[indentType][eol].length) {
      return eol + repeat(indentValue, initialIndentLevel + indentLevel);
    }
    if (amountOfSpaces <= 0) {
      return eol;
    }
    return cachedBreakLinesWithSpaces[indentType][eol][amountOfSpaces];
  }
  function scanNext() {
    let token = scanner.scan();
    numberLineBreaks = 0;
    while (token === 15 || token === 14) {
      if (token === 14 && options.keepLines) {
        numberLineBreaks += 1;
      } else if (token === 14) {
        numberLineBreaks = 1;
      }
      token = scanner.scan();
    }
    hasError = token === 16 || scanner.getTokenError() !== 0;
    return token;
  }
  const editOperations = [];
  function addEdit(text, startOffset, endOffset) {
    if (!hasError && (!range || startOffset < rangeEnd && endOffset > rangeStart) && documentText.substring(startOffset, endOffset) !== text) {
      editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
    }
  }
  let firstToken = scanNext();
  if (options.keepLines && numberLineBreaks > 0) {
    addEdit(repeat(eol, numberLineBreaks), 0, 0);
  }
  if (firstToken !== 17) {
    let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
    let initialIndent = indentValue.length * initialIndentLevel < 20 && options.insertSpaces ? cachedSpaces[indentValue.length * initialIndentLevel] : repeat(indentValue, initialIndentLevel);
    addEdit(initialIndent, formatTextStart, firstTokenStart);
  }
  while (firstToken !== 17) {
    let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
    let secondToken = scanNext();
    let replaceContent = "";
    let needsLineBreak = false;
    while (numberLineBreaks === 0 && (secondToken === 12 || secondToken === 13)) {
      let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
      addEdit(cachedSpaces[1], firstTokenEnd, commentTokenStart);
      firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
      needsLineBreak = secondToken === 12;
      replaceContent = needsLineBreak ? newLinesAndIndent() : "";
      secondToken = scanNext();
    }
    if (secondToken === 2) {
      if (firstToken !== 1) {
        indentLevel--;
      }
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 1) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else if (secondToken === 4) {
      if (firstToken !== 3) {
        indentLevel--;
      }
      if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== 3) {
        replaceContent = newLinesAndIndent();
      } else if (options.keepLines) {
        replaceContent = cachedSpaces[1];
      }
    } else {
      switch (firstToken) {
        case 3:
        case 1:
          indentLevel++;
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 5:
          if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
            replaceContent = newLinesAndIndent();
          } else {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 12:
          replaceContent = newLinesAndIndent();
          break;
        case 13:
          if (numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 6:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (!needsLineBreak) {
            replaceContent = cachedSpaces[1];
          }
          break;
        case 10:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else if (secondToken === 6 && !needsLineBreak) {
            replaceContent = "";
          }
          break;
        case 7:
        case 8:
        case 9:
        case 11:
        case 2:
        case 4:
          if (options.keepLines && numberLineBreaks > 0) {
            replaceContent = newLinesAndIndent();
          } else {
            if ((secondToken === 12 || secondToken === 13) && !needsLineBreak) {
              replaceContent = cachedSpaces[1];
            } else if (secondToken !== 5 && secondToken !== 17) {
              hasError = true;
            }
          }
          break;
        case 16:
          hasError = true;
          break;
      }
      if (numberLineBreaks > 0 && (secondToken === 12 || secondToken === 13)) {
        replaceContent = newLinesAndIndent();
      }
    }
    if (secondToken === 17) {
      if (options.keepLines && numberLineBreaks > 0) {
        replaceContent = newLinesAndIndent();
      } else {
        replaceContent = options.insertFinalNewline ? eol : "";
      }
    }
    const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
    addEdit(replaceContent, firstTokenEnd, secondTokenStart);
    firstToken = secondToken;
  }
  return editOperations;
}
function repeat(s, count) {
  let result = "";
  for (let i = 0;i < count; i++) {
    result += s;
  }
  return result;
}
function computeIndentLevel(content, options) {
  let i = 0;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    let ch = content.charAt(i);
    if (ch === cachedSpaces[1]) {
      nChars++;
    } else if (ch === "\t") {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}
function getEOL(options, text) {
  for (let i = 0;i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch === "\r") {
      if (i + 1 < text.length && text.charAt(i + 1) === `
`) {
        return `\r
`;
      }
      return "\r";
    } else if (ch === `
`) {
      return `
`;
    }
  }
  return options && options.eol || `
`;
}
function isEOL(text, offset) {
  return `\r
`.indexOf(text.charAt(offset)) !== -1;
}

// node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions) {
  ParseOptions.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parse(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentProperty = null;
  let currentParent = [];
  const previousParents = [];
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: () => {
      const object = {};
      onValue(object);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name) => {
      currentProperty = name;
    },
    onObjectEnd: () => {
      currentParent = previousParents.pop();
    },
    onArrayBegin: () => {
      const array = [];
      onValue(array);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: () => {
      currentParent = previousParents.pop();
    },
    onLiteralValue: onValue,
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  return currentParent[0];
}
function parseTree(text, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: undefined };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path) {
  if (!root) {
    return;
  }
  let node = root;
  for (let segment of path) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return;
      }
      node = node.children[index];
    }
  }
  return node;
}
function visit(text, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(14);
          break;
        case 5:
          handleError(15);
          break;
        case 3:
          handleError(13);
          break;
        case 1:
          if (!disallowComments) {
            handleError(11);
          }
          break;
        case 2:
          handleError(12);
          break;
        case 6:
          handleError(16);
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(10);
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(1);
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(2);
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(3, [], [2, 5]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [2, 5]);
      }
    } else {
      handleError(5, [], [2, 5]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [2, 5]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [2], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [4, 5]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(8, [4], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/jsonc-parser/lib/esm/impl/edit.js
function setProperty(text, originalPath, value, options) {
  const path = originalPath.slice();
  const errors = [];
  const root = parseTree(text, errors);
  let parent = undefined;
  let lastSegment = undefined;
  while (path.length > 0) {
    lastSegment = path.pop();
    parent = findNodeAtLocation(root, path);
    if (parent === undefined && value !== undefined) {
      if (typeof lastSegment === "string") {
        value = { [lastSegment]: value };
      } else {
        value = [value];
      }
    } else {
      break;
    }
  }
  if (!parent) {
    if (value === undefined) {
      throw new Error("Can not delete in empty document");
    }
    return withFormatting(text, { offset: root ? root.offset : 0, length: root ? root.length : 0, content: JSON.stringify(value) }, options);
  } else if (parent.type === "object" && typeof lastSegment === "string" && Array.isArray(parent.children)) {
    const existing = findNodeAtLocation(parent, [lastSegment]);
    if (existing !== undefined) {
      if (value === undefined) {
        if (!existing.parent) {
          throw new Error("Malformed AST");
        }
        const propertyIndex = parent.children.indexOf(existing.parent);
        let removeBegin;
        let removeEnd = existing.parent.offset + existing.parent.length;
        if (propertyIndex > 0) {
          let previous = parent.children[propertyIndex - 1];
          removeBegin = previous.offset + previous.length;
        } else {
          removeBegin = parent.offset + 1;
          if (parent.children.length > 1) {
            let next = parent.children[1];
            removeEnd = next.offset;
          }
        }
        return withFormatting(text, { offset: removeBegin, length: removeEnd - removeBegin, content: "" }, options);
      } else {
        return withFormatting(text, { offset: existing.offset, length: existing.length, content: JSON.stringify(value) }, options);
      }
    } else {
      if (value === undefined) {
        return [];
      }
      const newProperty = `${JSON.stringify(lastSegment)}: ${JSON.stringify(value)}`;
      const index = options.getInsertionIndex ? options.getInsertionIndex(parent.children.map((p) => p.children[0].value)) : parent.children.length;
      let edit;
      if (index > 0) {
        let previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      } else if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty + "," };
      }
      return withFormatting(text, edit, options);
    }
  } else if (parent.type === "array" && typeof lastSegment === "number" && Array.isArray(parent.children)) {
    const insertIndex = lastSegment;
    if (insertIndex === -1) {
      const newProperty = `${JSON.stringify(value)}`;
      let edit;
      if (parent.children.length === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: newProperty };
      } else {
        const previous = parent.children[parent.children.length - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else if (value === undefined && parent.children.length >= 0) {
      const removalIndex = lastSegment;
      const toRemove = parent.children[removalIndex];
      let edit;
      if (parent.children.length === 1) {
        edit = { offset: parent.offset + 1, length: parent.length - 2, content: "" };
      } else if (parent.children.length - 1 === removalIndex) {
        let previous = parent.children[removalIndex - 1];
        let offset = previous.offset + previous.length;
        let parentEndOffset = parent.offset + parent.length;
        edit = { offset, length: parentEndOffset - 2 - offset, content: "" };
      } else {
        edit = { offset: toRemove.offset, length: parent.children[removalIndex + 1].offset - toRemove.offset, content: "" };
      }
      return withFormatting(text, edit, options);
    } else if (value !== undefined) {
      let edit;
      const newProperty = `${JSON.stringify(value)}`;
      if (!options.isArrayInsertion && parent.children.length > lastSegment) {
        const toModify = parent.children[lastSegment];
        edit = { offset: toModify.offset, length: toModify.length, content: newProperty };
      } else if (parent.children.length === 0 || lastSegment === 0) {
        edit = { offset: parent.offset + 1, length: 0, content: parent.children.length === 0 ? newProperty : newProperty + "," };
      } else {
        const index = lastSegment > parent.children.length ? parent.children.length : lastSegment;
        const previous = parent.children[index - 1];
        edit = { offset: previous.offset + previous.length, length: 0, content: "," + newProperty };
      }
      return withFormatting(text, edit, options);
    } else {
      throw new Error(`Can not ${value === undefined ? "remove" : options.isArrayInsertion ? "insert" : "modify"} Array index ${insertIndex} as length is not sufficient`);
    }
  } else {
    throw new Error(`Can not add ${typeof lastSegment !== "number" ? "index" : "property"} to parent of type ${parent.type}`);
  }
}
function withFormatting(text, edit, options) {
  if (!options.formattingOptions) {
    return [edit];
  }
  let newText = applyEdit(text, edit);
  let begin = edit.offset;
  let end = edit.offset + edit.content.length;
  if (edit.length === 0 || edit.content.length === 0) {
    while (begin > 0 && !isEOL(newText, begin - 1)) {
      begin--;
    }
    while (end < newText.length && !isEOL(newText, end)) {
      end++;
    }
  }
  const edits = format(newText, { offset: begin, length: end - begin }, { ...options.formattingOptions, keepLines: false });
  for (let i = edits.length - 1;i >= 0; i--) {
    const edit = edits[i];
    newText = applyEdit(newText, edit);
    begin = Math.min(begin, edit.offset);
    end = Math.max(end, edit.offset + edit.length);
    end += edit.content.length - edit.length;
  }
  const editLength = text.length - (newText.length - end) - begin;
  return [{ offset: begin, length: editLength, content: newText.substring(begin, end) }];
}
function applyEdit(text, edit) {
  return text.substring(0, edit.offset) + edit.content + text.substring(edit.offset + edit.length);
}

// node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function(ScanError) {
  ScanError[ScanError["None"] = 0] = "None";
  ScanError[ScanError["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError[ScanError["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError[ScanError["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError[ScanError["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError[ScanError["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError[ScanError["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind) {
  SyntaxKind[SyntaxKind["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind[SyntaxKind["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind[SyntaxKind["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind[SyntaxKind["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind[SyntaxKind["CommaToken"] = 5] = "CommaToken";
  SyntaxKind[SyntaxKind["ColonToken"] = 6] = "ColonToken";
  SyntaxKind[SyntaxKind["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind[SyntaxKind["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind[SyntaxKind["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind[SyntaxKind["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind[SyntaxKind["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind[SyntaxKind["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind[SyntaxKind["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind[SyntaxKind["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind[SyntaxKind["Trivia"] = 15] = "Trivia";
  SyntaxKind[SyntaxKind["Unknown"] = 16] = "Unknown";
  SyntaxKind[SyntaxKind["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var parse2 = parse;
var ParseErrorCode;
(function(ParseErrorCode) {
  ParseErrorCode[ParseErrorCode["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode[ParseErrorCode["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode[ParseErrorCode["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode[ParseErrorCode["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode[ParseErrorCode["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode[ParseErrorCode["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode[ParseErrorCode["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode[ParseErrorCode["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode[ParseErrorCode["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode[ParseErrorCode["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode[ParseErrorCode["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode[ParseErrorCode["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode[ParseErrorCode["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode[ParseErrorCode["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode[ParseErrorCode["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode[ParseErrorCode["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));
function modify(text, path, value, options) {
  return setProperty(text, path, value, options);
}
function applyEdits(text, edits) {
  let sortedEdits = edits.slice(0).sort((a, b) => {
    const diff = a.offset - b.offset;
    if (diff === 0) {
      return a.length - b.length;
    }
    return diff;
  });
  let lastModifiedOffset = text.length;
  for (let i = sortedEdits.length - 1;i >= 0; i--) {
    let e = sortedEdits[i];
    if (e.offset + e.length <= lastModifiedOffset) {
      text = applyEdit(text, e);
    } else {
      throw new Error("Overlapping edit");
    }
    lastModifiedOffset = e.offset;
  }
  return text;
}

// src/permissions.ts
var configDirectory = () => process.env.XDG_CONFIG_HOME ? join2(process.env.XDG_CONFIG_HOME, "opencode") : join2(homedir(), ".config", "opencode");
var globalConfigPath = () => join2(configDirectory(), "opencode.json");
var projectConfigPath = (projectRoot) => join2(projectRoot, ".opencode", "opencode.json");
function matches2(input, pattern) {
  let escaped = pattern.replaceAll("\\", "/").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  if (escaped.endsWith(" .*"))
    escaped = escaped.slice(0, -3) + "( .*)?";
  return new RegExp(`^${escaped}$`, process.platform === "win32" ? "si" : "s").test(input.replaceAll("\\", "/"));
}
function readSkillRules(path, errors) {
  const text = readTextFile(path);
  if (text === undefined)
    return {};
  const parseErrors = [];
  const value = parse2(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  if (parseErrors.length > 0) {
    errors.push(`${path}: invalid JSONC`);
    return {};
  }
  if (value === undefined)
    return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.push(`${path}: expected a JSON object`);
    return {};
  }
  const permission = value.permission;
  if (permission === undefined)
    return {};
  if (typeof permission !== "object" || permission === null || Array.isArray(permission)) {
    errors.push(`${path}: "permission" is not an object`);
    return {};
  }
  const skill = permission.skill;
  if (skill === undefined)
    return {};
  if (typeof skill !== "object" || skill === null || Array.isArray(skill)) {
    errors.push(`${path}: "permission.skill" is not an object`);
    return {};
  }
  const rules = {};
  for (const [key, effect] of Object.entries(skill)) {
    if (typeof effect === "string")
      rules[key] = effect;
  }
  return rules;
}
function loadPermissionConfig(projectRoot) {
  const errors = [];
  const globalPath = globalConfigPath();
  const globalJsoncPath = join2(configDirectory(), "opencode.jsonc");
  const global = {
    ...readSkillRules(globalPath, errors),
    ...readSkillRules(globalJsoncPath, errors)
  };
  const projectPath = projectConfigPath(projectRoot);
  const project = readSkillRules(projectPath, errors);
  return { global, project, globalPath, projectPath, errors };
}
function effectiveEffect(config, skillID) {
  const entries = [...Object.entries(config.global), ...Object.entries(config.project)];
  for (let index = entries.length - 1;index >= 0; index -= 1) {
    const [pattern, effect] = entries[index];
    if (matches2(skillID, pattern))
      return effect;
  }
  return;
}
function isDenied(config, skillID) {
  return effectiveEffect(config, skillID) === "deny";
}
var normalizedPath = (path) => process.platform === "win32" ? path.replaceAll("\\", "/").toLowerCase() : path.replaceAll("\\", "/");
function targetForSkill(path, projectRoot) {
  if (!path)
    return "global";
  const skillPath = normalizedPath(path);
  const root = normalizedPath(projectRoot).replace(/\/+$/, "");
  return skillPath === root || skillPath.startsWith(`${root}/`) ? "project" : "global";
}
function detectFormatting(text) {
  const eol = text.includes(`\r
`) ? `\r
` : `
`;
  const match = /\n([ \t]+)"/.exec(text);
  if (match) {
    const indent = match[1];
    if (indent.includes("\t"))
      return { insertSpaces: false, tabSize: 1, eol };
    return { insertSpaces: true, tabSize: indent.length, eol };
  }
  return { insertSpaces: true, tabSize: 2, eol };
}
function validateEditable(text, path) {
  const parseErrors = [];
  const value = parse2(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  if (parseErrors.length > 0)
    throw new Error(`${path}: invalid JSONC; refusing to edit`);
  if (value === undefined)
    return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected a JSON object; refusing to edit`);
  }
  const permission = value.permission;
  if (permission !== undefined && (typeof permission !== "object" || permission === null || Array.isArray(permission))) {
    throw new Error(`${path}: "permission" is not an object; refusing to edit`);
  }
  const skill = permission?.skill;
  if (skill !== undefined && (typeof skill !== "object" || skill === null || Array.isArray(skill))) {
    throw new Error(`${path}: "permission.skill" is not an object; refusing to edit`);
  }
}
async function writeSkillPermissions(projectRoot, target, entries) {
  const ids = Object.keys(entries);
  if (ids.length === 0)
    return;
  const path = target === "project" ? projectConfigPath(projectRoot) : globalConfigPath();
  const original = readTextFile(path);
  let text = original === undefined || original.trim().length === 0 ? `{}
` : original;
  validateEditable(text, path);
  const formattingOptions = detectFormatting(text);
  for (const id of ids) {
    const edits = modify(text, ["permission", "skill", id], entries[id], {
      formattingOptions,
      getInsertionIndex: undefined
    });
    text = applyEdits(text, edits);
  }
  if (text === original)
    return;
  await writeTextFileAtomic(path, text);
}

// src/tools-config.ts
function parseDocument(text) {
  const errors = [];
  if (text === undefined || text.trim().length === 0)
    return { value: undefined, errors };
  const value = parse2(text, errors, { allowTrailingComma: true, disallowComments: false });
  return { value, errors };
}
function readDocumentRules(path) {
  const { value } = parseDocument(readTextFile(path));
  const rules = { array: [], toolsMap: {} };
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return rules;
  const root = value;
  if (Array.isArray(root.permissions)) {
    for (const rule of root.permissions) {
      if (typeof rule !== "object" || rule === null || Array.isArray(rule))
        continue;
      const { action, resource, effect } = rule;
      if (typeof action === "string" && action && typeof resource === "string" && typeof effect === "string") {
        rules.array.push({ action, resource, effect });
      }
    }
  }
  if (typeof root.tools === "object" && root.tools !== null && !Array.isArray(root.tools)) {
    for (const [name, enabled] of Object.entries(root.tools)) {
      if (typeof enabled === "boolean")
        rules.toolsMap[name] = enabled;
    }
  }
  return rules;
}
function readAllToolRules(projectRoot) {
  const disabled = new Set;
  const enabled = new Set;
  const collect = (rules) => {
    for (const rule of rules.array) {
      if (rule.resource !== "*")
        continue;
      if (rule.effect === "deny")
        disabled.add(rule.action);
      else if (rule.effect === "allow") {
        disabled.delete(rule.action);
        enabled.add(rule.action);
      }
    }
    for (const [name, value] of Object.entries(rules.toolsMap)) {
      if (value)
        enabled.add(name);
      else
        disabled.add(name);
    }
  };
  try {
    collect(readDocumentRules(globalConfigPath()));
    collect(readDocumentRules(projectConfigPath(projectRoot)));
  } catch {}
  return { disabled, enabled };
}
function detectFormatting2(text) {
  const eol = text.includes(`\r
`) ? `\r
` : `
`;
  const match = /\n([ \t]+)"/.exec(text);
  if (match) {
    const indent = match[1];
    if (indent.includes("\t"))
      return { insertSpaces: false, tabSize: 1, eol };
    return { insertSpaces: true, tabSize: indent.length, eol };
  }
  return { insertSpaces: true, tabSize: 2, eol };
}
function validateEditable2(text, path) {
  const errors = [];
  const value = parse2(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0)
    throw new Error(`${path}: invalid JSONC; refusing to edit`);
  if (value === undefined)
    return;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected a JSON object; refusing to edit`);
  }
  const permissions = value.permissions;
  if (permissions !== undefined && !Array.isArray(permissions)) {
    throw new Error(`${path}: "permissions" is not an array; refusing to edit`);
  }
}
async function writeToolRule(projectRoot, name, enabled) {
  const path = globalConfigPath();
  const original = readTextFile(path);
  const text = original === undefined || original.trim().length === 0 ? `{}
` : original;
  validateEditable2(text, path);
  const formattingOptions = detectFormatting2(text);
  const { value } = parseDocument(text);
  const permissions = value?.permissions;
  const rules = Array.isArray(permissions) ? permissions : [];
  let targetIndex = -1;
  for (let i = rules.length - 1;i >= 0; i -= 1) {
    const rule = rules[i];
    if (rule?.action === name && rule.resource === "*") {
      targetIndex = i;
      break;
    }
  }
  let edited = text;
  if (enabled) {
    if (targetIndex >= 0) {
      edited = applyEdits(edited, modify(edited, ["permissions", targetIndex], { action: name, resource: "*", effect: "allow" }, { formattingOptions }));
    }
  } else if (targetIndex >= 0) {
    edited = applyEdits(edited, modify(edited, ["permissions", targetIndex], { action: name, resource: "*", effect: "deny" }, { formattingOptions }));
  } else {
    edited = applyEdits(edited, modify(edited, ["permissions", 0], { action: name, resource: "*", effect: "deny" }, { formattingOptions }));
  }
  if (edited === text)
    return;
  await writeTextFileAtomic(path, edited);
}

// src/plugins-config.ts
import { existsSync as existsSync2, readdirSync } from "fs";
import { join as join3 } from "path";
import { homedir as homedir2 } from "os";
var cliJsonPath = () => {
  const base = process.env.XDG_CONFIG_HOME ? join3(process.env.XDG_CONFIG_HOME, "opencode") : join3(homedir2(), ".config", "opencode");
  return join3(base, "cli.json");
};
var pluginDirectory = () => {
  const base = process.env.XDG_CONFIG_HOME ? join3(process.env.XDG_CONFIG_HOME, "opencode") : join3(homedir2(), ".config", "opencode");
  return join3(base, "plugins");
};
var pluginDirectoryPath = pluginDirectory;
var readClean = (path) => {
  const text = readTextFile(path);
  if (text === undefined)
    return;
  return text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
};
function pluginIdFromFile(path) {
  try {
    const text = readClean(path);
    if (text === undefined)
      return;
    const match = /id\s*:\s*["']([^"']+)["']/.exec(text);
    return match?.[1];
  } catch {
    return;
  }
}
function discoverPlugins(root) {
  const out = [];
  if (!existsSync2(root))
    return out;
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true }).map((e) => e.name);
  } catch {
    return out;
  }
  for (const name of entries.sort()) {
    const full = join3(root, name);
    try {
      if (existsSync2(join3(full, "index.ts")) || existsSync2(join3(full, "index.js"))) {
        const id = pluginIdFromFile(join3(full, "index.ts")) ?? pluginIdFromFile(join3(full, "index.js")) ?? name;
        out.push({ id, source: "dir", path: full });
      } else if (name.endsWith(".js") || name.endsWith(".ts")) {
        const id = pluginIdFromFile(full) ?? name.replace(/\.(js|ts)$/, "");
        out.push({ id, source: "file", path: full, file: true });
      }
    } catch {}
  }
  return out;
}
function readCliPlugins() {
  const text = readTextFile(cliJsonPath());
  const result = { entries: [], disabledIDs: new Set, activeIDs: new Set };
  if (text === undefined)
    return result;
  const errors = [];
  const value = parse2(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0 || typeof value !== "object" || value === null)
    return result;
  const plugins = value.plugins;
  if (!Array.isArray(plugins))
    return result;
  for (const entry of plugins) {
    if (typeof entry === "string") {
      result.entries.push(entry);
      if (entry.startsWith("-"))
        result.disabledIDs.add(entry.slice(1));
      else
        result.activeIDs.add(entry);
    } else if (typeof entry === "object" && entry !== null && typeof entry.package === "string") {
      result.entries.push(entry);
      result.activeIDs.add(entry.package);
    }
  }
  return result;
}
function detectFormatting3(text) {
  const eol = text.includes(`\r
`) ? `\r
` : `
`;
  const match = /\n([ \t]+)"/.exec(text);
  if (match) {
    const indent = match[1];
    if (indent.includes("\t"))
      return { insertSpaces: false, tabSize: 1, eol };
    return { insertSpaces: true, tabSize: indent.length, eol };
  }
  return { insertSpaces: true, tabSize: 2, eol };
}
async function setPluginEnabled(id, enabled) {
  const path = cliJsonPath();
  const original = readTextFile(path);
  const text = original === undefined || original.trim().length === 0 ? `{}
` : original;
  const errors = [];
  const value = parse2(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0)
    throw new Error(`${path}: invalid JSONC; refusing to edit`);
  const formattingOptions = detectFormatting3(text);
  const plugins = value?.plugins;
  const entries = Array.isArray(plugins) ? plugins : [];
  let edited = text;
  if (enabled) {
    const minusIndex = entries.findIndex((entry) => entry === `-${id}`);
    if (minusIndex >= 0)
      edited = applyEdits(edited, modify(edited, ["plugins", minusIndex], undefined, { formattingOptions }));
    const hasActive = entries.some((entry) => typeof entry === "string" ? entry === id : entry.package === id);
    if (!hasActive)
      edited = applyEdits(edited, modify(edited, ["plugins", entries.length], id, { formattingOptions }));
  } else {
    const activeIndex = entries.findIndex((entry) => typeof entry === "string" ? entry === id : entry.package === id);
    if (activeIndex >= 0)
      edited = applyEdits(edited, modify(edited, ["plugins", activeIndex], undefined, { formattingOptions }));
    const minusExists = entries.some((entry) => entry === `-${id}`);
    if (!minusExists)
      edited = applyEdits(edited, modify(edited, ["plugins", entries.length], `-${id}`, { formattingOptions }));
  }
  if (edited === text)
    return;
  await writeTextFileAtomic(path, edited);
}

// src/mcp-classes.ts
var DEFAULT_CLASS = "Other";
var DEFAULT_CLASSES = {
  WebSearch: ["searxng", "tavily", "deepseek-search"],
  Browser: ["playwright", "chrome-devtools"],
  Messaging: ["TelegramMCP"],
  Documents: ["markitdown"],
  System: ["windows-mcp"],
  CAD: ["freecad"]
};
function buildClasses(options) {
  const merged = { ...DEFAULT_CLASSES };
  const override = options && typeof options.classes === "object" ? options.classes : null;
  if (override) {
    for (const [label, list] of Object.entries(override)) {
      if (list === null) {
        delete merged[label];
        continue;
      }
      if (Array.isArray(list))
        merged[label] = list;
    }
  }
  const map = new Map;
  for (const [label, list] of Object.entries(merged)) {
    map.set(label, new Set((Array.isArray(list) ? list : []).filter((n) => typeof n === "string" && n.length > 0).map((n) => n.toLowerCase())));
  }
  return map;
}
function classify(name, classes) {
  const lower = String(name).toLowerCase();
  for (const [label, members] of classes) {
    if (members.has(lower))
      return label;
  }
  return;
}
function groupServers(servers, classes, defaultClass = DEFAULT_CLASS) {
  const buckets = new Map;
  for (const server of servers) {
    const label = classify(server.name, classes) ?? defaultClass;
    const list = buckets.get(label);
    if (list)
      list.push(server);
    else
      buckets.set(label, [server]);
  }
  const known = [];
  for (const label of classes.keys()) {
    if (label !== defaultClass && buckets.has(label))
      known.push(label);
  }
  for (const label of buckets.keys()) {
    if (label !== defaultClass && !known.includes(label))
      known.push(label);
  }
  const order = [...known];
  if (buckets.has(defaultClass))
    order.push(defaultClass);
  return order.map((label) => [label, buckets.get(label).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))]);
}

// src/sets.ts
import { join as join4 } from "path";
var dataDirectory = (projectRoot) => join4(projectRoot, ".opencode", ".skills-tui");
var setsPath = (projectRoot) => join4(dataDirectory(projectRoot), "sets.json");
var setStatePath = (projectRoot) => join4(dataDirectory(projectRoot), "set-state.json");
function readJson(path, errors) {
  const text = readTextFile(path);
  if (text === undefined || text.trim().length === 0)
    return;
  const parseErrors = [];
  const value = parse2(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  if (parseErrors.length > 0) {
    errors.push(`${path}: invalid JSON`);
    return;
  }
  return value;
}
function sanitizeSets(value) {
  if (!Array.isArray(value))
    return [];
  const names = new Set;
  const sets = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name || names.has(name))
      continue;
    const rawSkills = entry.skills;
    const skills = Array.isArray(rawSkills) ? [...new Set(rawSkills.filter((id) => typeof id === "string" && id.length > 0))] : [];
    names.add(name);
    sets.push({ name, skills });
  }
  return sets;
}
function readSets(projectRoot) {
  const errors = [];
  const value = readJson(setsPath(projectRoot), errors);
  if (errors.length > 0)
    return { sets: [], error: errors.join("; ") };
  return { sets: sanitizeSets(value) };
}
async function writeSets(projectRoot, sets) {
  await writeTextFileAtomic(setsPath(projectRoot), serializeJson(sanitizeSets(sets)));
}
function sanitizeState(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { sets: {} };
  const raw = value.sets;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return { sets: {} };
  const sets = {};
  for (const [name, entry] of Object.entries(raw)) {
    if (!name || typeof entry !== "object" || entry === null || Array.isArray(entry))
      continue;
    const snapshotRaw = entry.snapshot;
    const snapshot = {};
    if (typeof snapshotRaw === "object" && snapshotRaw !== null && !Array.isArray(snapshotRaw)) {
      for (const [id, effect] of Object.entries(snapshotRaw)) {
        if (id && (effect === "allow" || effect === "deny"))
          snapshot[id] = effect;
      }
    }
    sets[name] = {
      disabled: entry.disabled === true,
      snapshot
    };
  }
  return { sets };
}
function readSetState(projectRoot) {
  const errors = [];
  const value = readJson(setStatePath(projectRoot), errors);
  if (errors.length > 0)
    return { sets: {} };
  return sanitizeState(value);
}
async function writeSetState(projectRoot, state) {
  await writeTextFileAtomic(setStatePath(projectRoot), serializeJson(sanitizeState(state)));
}

// src/mcp-groups.ts
import { join as join5 } from "path";
var GROUPS_FILE = ".opencode/.control-panel/mcp-groups.json";
function readMcpGroups(projectRoot) {
  try {
    const raw = readTextFile(join5(projectRoot, GROUPS_FILE));
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    const groups = parsed.groups ?? {};
    for (const [name, group] of Object.entries(groups)) {
      if (!group || typeof group !== "object") {
        groups[name] = { servers: [], enabled: true };
      } else {
        if (!Array.isArray(group.servers))
          group.servers = [];
        if (typeof group.enabled !== "boolean")
          group.enabled = true;
      }
    }
    return groups;
  } catch {
    return {};
  }
}
async function writeMcpGroups(projectRoot, groups) {
  await writeTextFileAtomic(join5(projectRoot, GROUPS_FILE), `${JSON.stringify({ groups }, null, 2)}
`);
}

// src/presets.ts
import { join as join6 } from "path";
import { homedir as homedir3 } from "os";
var GLOBAL_CONFIG_DIR = process.env.XDG_CONFIG_HOME ? join6(process.env.XDG_CONFIG_HOME, "opencode") : join6(homedir3(), ".config", "opencode");
var GLOBAL_PRESETS_FILE = join6(GLOBAL_CONFIG_DIR, ".control-panel", "presets.json");
var GLOBAL_ACTIVE_PRESET_FILE = join6(GLOBAL_CONFIG_DIR, ".control-panel", "preset-state.json");
function emptyPresets() {
  return { presets: {} };
}
function readPresets(_projectRoot) {
  try {
    const raw = readTextFile(GLOBAL_PRESETS_FILE) ?? readTextFile(join6(_projectRoot, ".opencode/.control-panel/presets.json"));
    if (!raw)
      return emptyPresets();
    const parsed = JSON.parse(raw);
    const presets = parsed.presets && typeof parsed.presets === "object" ? parsed.presets : {};
    for (const [name, state] of Object.entries(presets)) {
      if (!state || typeof state !== "object") {
        presets[name] = { skills: {}, tools: {}, plugins: {}, mcpGroups: {}, mcpServers: {} };
      } else {
        state.skills ??= {};
        state.tools ??= {};
        state.plugins ??= {};
        state.mcpGroups ??= {};
        state.mcpServers ??= {};
      }
    }
    return { presets };
  } catch {
    return emptyPresets();
  }
}
async function writePresets(_projectRoot, data) {
  await writeTextFileAtomic(GLOBAL_PRESETS_FILE, `${JSON.stringify(data, null, 2)}
`);
}
function readActivePreset(_projectRoot) {
  try {
    const raw = readTextFile(GLOBAL_ACTIVE_PRESET_FILE) ?? readTextFile(join6(_projectRoot, ".opencode/.skills-tui/preset-state.json"));
    if (!raw)
      return;
    const parsed = JSON.parse(raw);
    return typeof parsed.activePreset === "string" && parsed.activePreset ? parsed.activePreset : undefined;
  } catch {
    return;
  }
}
async function writeActivePreset(_projectRoot, name) {
  const data = name ? { activePreset: name } : {};
  await writeTextFileAtomic(GLOBAL_ACTIVE_PRESET_FILE, `${JSON.stringify(data, null, 2)}
`);
}

// src/mcp-config.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
var CONFIG_CANDIDATES = [
  "C:/Users/admin/.config/opencode/opencode.jsonc",
  "D:/opencode/config/opencode/opencode.jsonc"
];
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function setMcpServerEnabled(path, server, enabled) {
  let text;
  try {
    text = readFileSync2(path, "utf8");
  } catch {
    return false;
  }
  const esc = escapeRegExp(server);
  const open = new RegExp(`("${esc}"\\s*:\\s*\\{)`);
  const m = open.exec(text);
  if (!m)
    return false;
  const start = m.index + m[0].length;
  let depth = 1;
  let end = start;
  for (;end < text.length; end += 1) {
    const ch = text[end];
    if (ch === "{")
      depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0)
        break;
    }
  }
  if (depth !== 0)
    return false;
  const block = text.slice(start, end);
  const enabledRe = /("enabled"\s*:\s*)(true|false)/;
  let nextBlock;
  if (enabledRe.test(block)) {
    nextBlock = block.replace(enabledRe, `$1${enabled}`);
  } else {
    const indentMatch = block.match(/^([ \t]*)/m);
    const indent = indentMatch ? indentMatch[1] : "      ";
    nextBlock = block.replace(/([\r\n])([ \t]*)\}$/, `$1$2${indent}"enabled": ${enabled}$1$2}`);
  }
  if (nextBlock === block)
    return false;
  writeFileSync2(path, text.slice(0, start) + nextBlock + text.slice(end), "utf8");
  return true;
}
function setMcpServerEnabledAll(server, enabled) {
  let changed = 0;
  for (const path of CONFIG_CANDIDATES) {
    if (setMcpServerEnabled(path, server, enabled))
      changed += 1;
  }
  return changed;
}

// src/item-groups.ts
import { join as join7 } from "path";
var BASE = ".opencode/.control-panel/groups";
function groupsFile(kind, projectRoot) {
  return join7(projectRoot, `${BASE}-${kind}.json`);
}
function readItemGroups(kind, projectRoot) {
  try {
    const raw = readTextFile(groupsFile(kind, projectRoot));
    if (!raw)
      return {};
    const parsed = JSON.parse(raw);
    const groups = parsed.groups ?? {};
    for (const [name, group] of Object.entries(groups)) {
      if (!group || typeof group !== "object") {
        groups[name] = { items: [], enabled: true };
      } else {
        if (!Array.isArray(group.items))
          group.items = [];
        if (typeof group.enabled !== "boolean")
          group.enabled = true;
      }
    }
    return groups;
  } catch {
    return {};
  }
}
async function writeItemGroups(kind, projectRoot, groups) {
  await writeTextFileAtomic(groupsFile(kind, projectRoot), `${JSON.stringify({ groups }, null, 2)}
`);
}

// src/usage.ts
import { join as join8 } from "path";
var USAGE_FILE = ".opencode/.control-panel/usage.json";
function emptyUsage() {
  return { skills: {}, tools: {} };
}
function readUsage(projectRoot) {
  try {
    const raw = readTextFile(join8(projectRoot, USAGE_FILE));
    if (!raw)
      return emptyUsage();
    const parsed = JSON.parse(raw);
    return {
      skills: parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {},
      tools: parsed.tools && typeof parsed.tools === "object" ? parsed.tools : {}
    };
  } catch {
    return emptyUsage();
  }
}
async function writeUsage(projectRoot, data) {
  await writeTextFileAtomic(join8(projectRoot, USAGE_FILE), `${JSON.stringify(data, null, 2)}
`);
}

// src/tui.tsx
var EMPTY_LOADED_SKILLS = new Set;
var BUILD_TAG = "probe-2026-11-08c";
var declaredToolsCache = new Map;
function parseDeclaredTools(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match)
    return [];
  const fm = match[1];
  const lines = fm.split(/\r?\n/);
  let collecting = false;
  const tools = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^tools\s*:\s*\[(.*)\]$/.test(trimmed)) {
      const inline = /^tools\s*:\s*\[(.*)\]$/.exec(trimmed)[1];
      for (const part of inline.split(",")) {
        const name = part.trim().replace(/^['"]|['"]$/g, "");
        if (name)
          tools.push(name);
      }
      collecting = false;
      continue;
    }
    if (/^tools\s*:\s*$/.test(trimmed)) {
      collecting = true;
      continue;
    }
    if (collecting) {
      if (/^-\s+/.test(trimmed)) {
        const name = trimmed.replace(/^-\s+/, "").replace(/^['"]|['"]$/g, "");
        if (name)
          tools.push(name);
      } else if (!/^\s/.test(line)) {
        collecting = false;
      }
    }
  }
  return [...new Set(tools)];
}
var definePlugin = (plugin) => plugin;
var locationKey = (location) => JSON.stringify([location.directory, location.workspaceID]);
function createMarkdownSyntax(theme, owner) {
  const markdown = theme.markdown;
  const bg = theme.surface("dialog").background.base;
  return SyntaxStyle.fromStyles({
    default: {
      fg: markdown.text,
      bg
    },
    "markup.heading": {
      fg: markdown.heading,
      bg,
      bold: true
    },
    "markup.strong": {
      fg: markdown.strong,
      bg,
      bold: true
    },
    "markup.italic": {
      fg: markdown.emphasis,
      bg,
      italic: true
    },
    "markup.list": {
      fg: markdown.listItem,
      bg
    },
    "markup.quote": {
      fg: markdown.blockQuote,
      bg,
      italic: true
    },
    "markup.raw": {
      fg: markdown.code,
      bg
    },
    "markup.link": {
      fg: markdown.link,
      bg,
      underline: true
    },
    "markup.link.url": {
      fg: markdown.link,
      bg,
      underline: true
    },
    "markup.link.label": {
      fg: markdown.linkText,
      bg,
      underline: true
    },
    "markup.strikethrough": {
      fg: theme.text.muted,
      bg,
      dim: true
    }
  }, owner);
}
function updateMarkdownCode(renderable, syntaxStyle) {
  if (renderable instanceof CodeRenderable) {
    renderable.wrapMode = "char";
    renderable.syntaxStyle = syntaxStyle;
  }
  for (const child of renderable.getChildren()) {
    if (isRenderable(child))
      updateMarkdownCode(child, syntaxStyle);
  }
}
function splitFrontmatter(raw) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(raw);
  if (!match)
    return {
      body: raw
    };
  return {
    frontmatter: match[1],
    body: raw.slice(match[0].length)
  };
}
function SkillPreviewDialog(props) {
  const dims = useTerminalDimensions4();
  props.ctx.keymap.layer(() => ({
    mode: "modal",
    priority: 10,
    commands: [{
      bind: "escape",
      run: () => {
        props.ctx.renderer.clearSelection();
        props.ctx.ui.dialog.clear();
      }
    }]
  }));
  const [separatorWidth, setSeparatorWidth] = createSignal4(0);
  const separator = () => {
    const label = " provided by plugin ";
    const dashes = Math.max(0, separatorWidth() - label.length);
    const right = Math.min(7, Math.floor(dashes / 2));
    return `${"-".repeat(dashes - right)}${label}${"-".repeat(right)}`;
  };
  let markdown;
  const scene = useRenderer();
  const syntaxStyle = createMemo2(() => createMarkdownSyntax(props.theme(), scene.nativeScene));
  createEffect3((previous) => {
    const style = syntaxStyle();
    if (markdown)
      updateMarkdownCode(markdown, style);
    previous?.destroy();
    return style;
  });
  onCleanup3(() => syntaxStyle().destroy());
  const background = () => props.theme().surface("dialog").background.base;
  const onPreviewMouseUp = (event) => {
    const url = resolveLinkToOpen(event, () => props.renderer.getSelection() !== null, props.renderer.getLinkAt);
    if (url === null)
      return;
    event.stopPropagation();
    openUrl(url);
  };
  let content;
  if (props.raw) {
    const {
      frontmatter,
      body
    } = splitFrontmatter(props.raw);
    content = frontmatter ? `${frontmatter}

${body.trim()}
` : props.raw;
  } else if (props.skill.description) {
    content = `> ${props.skill.description}

${props.skill.content}`;
  } else {
    content = props.skill.content;
  }
  const path = props.skill.path;
  const source = path || "-";
  const chars = [...content].length.toLocaleString("en-US");
  const tok = (mode) => {
    const tokens = estimateSkillTokens(props.skill, mode);
    return tokens === undefined ? "-" : `~${formatTokenCount(tokens)} tok`;
  };
  return (() => {
    var _el$ = _$createElement4("box"), _el$2 = _$createElement4("scrollbox"), _el$3 = _$createElement4("text"), _el$4 = _$createElement4("text"), _el$5 = _$createElement4("text"), _el$6 = _$createElement4("box"), _el$7 = _$createElement4("text"), _el$8 = _$createElement4("markdown");
    _$insertNode4(_el$, _el$2);
    _$setProp4(_el$, "flexDirection", "column");
    _$setProp4(_el$, "paddingBottom", 1);
    _$setProp4(_el$, "paddingLeft", 2);
    _$setProp4(_el$, "paddingRight", 2);
    _$setProp4(_el$, "width", "100%");
    _$insertNode4(_el$2, _el$3);
    _$insertNode4(_el$2, _el$4);
    _$insertNode4(_el$2, _el$5);
    _$insertNode4(_el$2, _el$6);
    _$insertNode4(_el$2, _el$8);
    _$use3((scrollbox) => {
      scrollbox.verticalScrollBar.resetVisibilityControl();
      scrollbox.horizontalScrollBar.resetVisibilityControl();
    }, _el$2);
    _$setProp4(_el$2, "width", "100%");
    _$setProp4(_el$2, "flexGrow", 1);
    _$setProp4(_el$2, "minHeight", 0);
    _$setProp4(_el$2, "paddingRight", 1);
    _$setProp4(_el$2, "scrollX", false);
    _$setProp4(_el$3, "width", "100%");
    _$setProp4(_el$3, "flexShrink", 0);
    _$setProp4(_el$3, "wrapMode", "char");
    _$insert4(_el$3, () => `id: ${props.skill.id}`);
    _$setProp4(_el$4, "width", "100%");
    _$setProp4(_el$4, "flexShrink", 0);
    _$setProp4(_el$4, "wrapMode", "char");
    _$insert4(_el$4, () => `stats: chars ${chars} \xB7 list entry ${tok("listing")} \xB7 load cost ${tok("load-delta")} \xB7 total cost ${tok("loaded-total")}`);
    _$setProp4(_el$5, "width", "100%");
    _$setProp4(_el$5, "flexShrink", 0);
    _$setProp4(_el$5, "wrapMode", "char");
    _$insert4(_el$5, `path: ${source}`);
    _$insertNode4(_el$6, _el$7);
    _$setProp4(_el$6, "id", "skills-preview.separator");
    _$setProp4(_el$6, "width", "100%");
    _$setProp4(_el$6, "flexShrink", 0);
    _$setProp4(_el$6, "marginBottom", 1);
    _$setProp4(_el$6, "onSizeChange", function() {
      setSeparatorWidth(this.width);
    });
    _$setProp4(_el$7, "width", "100%");
    _$setProp4(_el$7, "flexShrink", 0);
    _$setProp4(_el$7, "wrapMode", "char");
    _$use3((renderable) => {
      markdown = renderable;
      updateMarkdownCode(renderable, syntaxStyle());
    }, _el$8);
    _$setProp4(_el$8, "width", "100%");
    _$setProp4(_el$8, "content", content);
    _$setProp4(_el$8, "tableOptions", {
      wrapMode: "char"
    });
    _$setProp4(_el$8, "onMouseUp", onPreviewMouseUp);
    _$effect4((_p$) => {
      var _v$ = Math.max(1, dims().height - 4), _v$2 = background(), _v$3 = props.theme().text.muted, _v$4 = background(), _v$5 = TextAttributes.ITALIC, _v$6 = props.theme().text.muted, _v$7 = background(), _v$8 = TextAttributes.ITALIC, _v$9 = props.theme().text.muted, _v$0 = background(), _v$1 = TextAttributes.ITALIC, _v$10 = separator(), _v$11 = props.theme().text.muted, _v$12 = background(), _v$13 = TextAttributes.ITALIC, _v$14 = syntaxStyle(), _v$15 = props.theme().markdown.text, _v$16 = background();
      _v$ !== _p$.e && (_p$.e = _$setProp4(_el$, "height", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp4(_el$, "backgroundColor", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp4(_el$3, "fg", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp4(_el$3, "bg", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp4(_el$3, "attributes", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp4(_el$4, "fg", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp4(_el$4, "bg", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp4(_el$4, "attributes", _v$8, _p$.h));
      _v$9 !== _p$.r && (_p$.r = _$setProp4(_el$5, "fg", _v$9, _p$.r));
      _v$0 !== _p$.d && (_p$.d = _$setProp4(_el$5, "bg", _v$0, _p$.d));
      _v$1 !== _p$.l && (_p$.l = _$setProp4(_el$5, "attributes", _v$1, _p$.l));
      _v$10 !== _p$.u && (_p$.u = _$setProp4(_el$7, "content", _v$10, _p$.u));
      _v$11 !== _p$.c && (_p$.c = _$setProp4(_el$7, "fg", _v$11, _p$.c));
      _v$12 !== _p$.w && (_p$.w = _$setProp4(_el$7, "bg", _v$12, _p$.w));
      _v$13 !== _p$.m && (_p$.m = _$setProp4(_el$7, "attributes", _v$13, _p$.m));
      _v$14 !== _p$.f && (_p$.f = _$setProp4(_el$8, "syntaxStyle", _v$14, _p$.f));
      _v$15 !== _p$.y && (_p$.y = _$setProp4(_el$8, "fg", _v$15, _p$.y));
      _v$16 !== _p$.g && (_p$.g = _$setProp4(_el$8, "bg", _v$16, _p$.g));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined,
      r: undefined,
      d: undefined,
      l: undefined,
      u: undefined,
      c: undefined,
      w: undefined,
      m: undefined,
      f: undefined,
      y: undefined,
      g: undefined
    });
    return _el$;
  })();
}
var tui_default = definePlugin({
  id: "opencode.dazhdbog",
  setup(ctx) {
    const [ui, mutateUI] = ctx.storage.memory("prefs", {
      initial: {
        collapsed: false,
        switch: "on",
        scope: "model",
        preview: "left-click",
        mention: "right-click",
        token: "off",
        state: "on"
      }
    });
    const normalizeSettings = (value) => ({
      switch: value.switch ?? "on",
      scope: value.scope ?? "model",
      preview: value.preview ?? "left-click",
      mention: value.mention ?? "right-click",
      token: value.token === "metadata" ? "listing" : value.token === "instructions" ? "load-delta" : value.token ?? "off",
      state: value.state ?? "on"
    });
    const [prefs, mutatePrefs] = ctx.storage.store("settings", {
      initial: normalizeSettings(ui)
    });
    const settings = () => normalizeSettings(prefs);
    const changeSettings = (update) => {
      mutatePrefs((draft) => {
        Object.assign(draft, {
          ...normalizeSettings(draft),
          ...update
        });
      }).catch((error) => {
        if (disposed)
          return;
        ctx.ui.toast.show({
          variant: "error",
          title: "Skills Sidebar",
          message: `Failed to save skills sidebar settings: ${error instanceof Error ? error.message : String(error)}`,
          duration: 5000
        });
      });
    };
    const [treeRev, setTreeRev] = createSignal4(0);
    const [opError, setOpError] = createSignal4();
    const configCache = new Map;
    const setsCache = new Map;
    const setStateCache = new Map;
    const mcpGroupsCache = new Map;
    const itemGroupsCache = new Map;
    const presetsCache = new Map;
    const activePresetCache = new Map;
    const ruCache = new Map;
    const usageCache = new Map;
    let currentToolUsers = new Map;
    const bumpTree = () => setTreeRev((value) => value + 1);
    const readConfigCached = (projectRoot) => {
      const rev = treeRev();
      const hit = configCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.config;
      const config = loadPermissionConfig(projectRoot);
      configCache.set(projectRoot, {
        rev,
        config
      });
      return config;
    };
    const readSetsCached = (projectRoot) => {
      const rev = treeRev();
      const hit = setsCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit;
      const value = readSets(projectRoot);
      const entry = {
        rev,
        ...value
      };
      setsCache.set(projectRoot, entry);
      return entry;
    };
    const readSetStateCached = (projectRoot) => {
      const rev = treeRev();
      const hit = setStateCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.state;
      const state = readSetState(projectRoot);
      setStateCache.set(projectRoot, {
        rev,
        state
      });
      return state;
    };
    const readMcpGroupsCached = (projectRoot) => {
      const rev = treeRev();
      const hit = mcpGroupsCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.groups;
      const groups = readMcpGroups(projectRoot);
      mcpGroupsCache.set(projectRoot, {
        rev,
        groups
      });
      return groups;
    };
    const readItemGroupsCached = (kind, projectRoot) => {
      const rev = treeRev();
      const key = `${kind}:${projectRoot}`;
      const hit = itemGroupsCache.get(key);
      if (hit?.rev === rev)
        return hit.groups;
      const groups = readItemGroups(kind, projectRoot);
      itemGroupsCache.set(key, {
        rev,
        groups
      });
      return groups;
    };
    const mutateItemGroups = async (kind, mutate) => {
      if (disposed)
        return false;
      const root = currentLocation().directory;
      try {
        const groups = readItemGroupsCached(kind, root);
        mutate(groups);
        await writeItemGroups(kind, root, groups);
        itemGroupsCache.set(`${kind}:${root}`, {
          rev: treeRev(),
          groups
        });
        setOpError(undefined);
        bumpTree();
        return true;
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443: ${errorMessage(error)}`);
        return false;
      }
    };
    const createItemGroup = async (kind, preselectItem) => {
      if (disposed)
        return;
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: kind === "tools" ? "\u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432" : "\u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430 \u043F\u043B\u0430\u0433\u0438\u043D\u043E\u0432",
          description: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B",
          placeholder: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed)
        return;
      await mutateItemGroups(kind, (groups) => {
        if (!groups[trimmed])
          groups[trimmed] = {
            items: [],
            enabled: true
          };
        if (preselectItem) {
          for (const g of Object.values(groups))
            g.items = g.items.filter((it) => it !== preselectItem);
          groups[trimmed].items.push(preselectItem);
        }
      });
    };
    const toggleItemGroup = async (kind, label) => {
      await mutateItemGroups(kind, (groups) => {
        if (!groups[label]) {
          let items = [];
          try {
            if (kind === "plugins") {
              const built = buildPlugins(currentLocation(), collapseMap());
              items = built.filter((p) => p.groupLabel === label).map((p) => p.id).filter((id) => !id.startsWith("__group__"));
            } else {
              const built = buildTools(currentLocation(), collapseMap());
              items = built.filter((g) => g.label === label).flatMap((g) => g.tools.map((t) => t.name));
            }
          } catch {}
          groups[label] = {
            items,
            enabled: true
          };
        }
        groups[label].enabled = !groups[label].enabled;
      });
    };
    const renameItemGroup = async (kind, label) => {
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443",
          value: label,
          placeholder: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed || trimmed === label)
        return;
      await mutateItemGroups(kind, (groups) => {
        const cfg = groups[label];
        if (cfg) {
          delete groups[label];
          groups[trimmed] = cfg;
        }
      });
    };
    const deleteItemGroup = async (kind, label) => {
      let confirmed = false;
      try {
        confirmed = await ctx.ui.dialog.confirm({
          title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443",
          message: `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443 \xAB${label}\xBB?`,
          label: {
            confirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
            cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
          }
        }) === true;
      } catch {
        return;
      }
      if (!confirmed)
        return;
      await mutateItemGroups(kind, (groups) => {
        delete groups[label];
      });
    };
    const openItemGroupMenu = (kind, label) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(MenuDialog, {
        ctx,
        title: label,
        options: [{
          label: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C\u2026",
          value: "rename"
        }, {
          label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
          value: "delete",
          danger: true
        }, {
          label: "\u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430\u2026",
          value: "create"
        }],
        onSelect: (value) => {
          ctx.ui.dialog.clear();
          if (value === "rename")
            setTimeout(() => void renameItemGroup(kind, label), 0);
          else if (value === "delete")
            setTimeout(() => void deleteItemGroup(kind, label), 0);
          else if (value === "create")
            setTimeout(() => void createItemGroup(kind), 0);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    const moveItem = async (kind, item, toGroup) => {
      await mutateItemGroups(kind, (groups) => {
        for (const g of Object.values(groups))
          g.items = g.items.filter((it) => it !== item);
        if (toGroup) {
          const target = groups[toGroup];
          if (target)
            target.items.push(item);
        }
      });
    };
    const openItemMenu = (kind, item) => {
      if (disposed)
        return;
      const root = currentLocation().directory;
      const groups = readItemGroupsCached(kind, root);
      const existing = Object.keys(groups).filter((name) => groups[name].enabled);
      const options = [{
        title: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
        value: "__copy__"
      }, {
        title: "\u2014 \u0411\u0435\u0437 \u0433\u0440\u0443\u043F\u043F\u044B \u2014",
        value: "__none__"
      }, ...existing.map((name) => ({
        title: name,
        value: name
      })), {
        title: "+ \u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430\u2026",
        value: "__new__"
      }];
      ctx.renderer.clearSelection();
      ctx.ui.dialog.select({
        title: `\u0413\u0440\u0443\u043F\u043F\u0430 \u0434\u043B\u044F \xAB${item}\xBB`,
        options
      }).then((choice) => {
        if (!choice)
          return;
        if (choice === "__copy__") {
          copyToClipboard(item);
          return;
        }
        if (choice === "__new__") {
          createItemGroup(kind, item);
          return;
        }
        moveItem(kind, item, choice === "__none__" ? null : choice);
      }).catch(() => {
        return;
      });
    };
    const readPresetsCached = (projectRoot) => {
      const rev = treeRev();
      const hit = presetsCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.data;
      const data = readPresets(projectRoot);
      presetsCache.set(projectRoot, {
        rev,
        data
      });
      return data;
    };
    const readActivePresetCached = (projectRoot) => {
      const rev = treeRev();
      const hit = activePresetCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.name;
      const name = readActivePreset(projectRoot);
      activePresetCache.set(projectRoot, {
        rev,
        name
      });
      return name;
    };
    const presetEquals = (a, b) => ["skills", "tools", "plugins", "mcpGroups", "mcpServers"].every((key) => {
      const av = a[key];
      const bv = b[key];
      const ak = Object.keys(av);
      return ak.length === Object.keys(bv).length && ak.every((id) => av[id] === bv[id]);
    });
    const collectCurrentPresetState = (projectRoot) => {
      const location = currentLocation();
      const config = readConfigCached(projectRoot);
      const skills = {};
      for (const skill of ctx.data.location.skill.list(location) ?? []) {
        skills[skill.id] = !isDenied(config, skill.id);
      }
      const {
        disabled
      } = readAllToolRules(projectRoot);
      const tools = {};
      const snapshotRaw = readTextFile(join9(projectRoot, ".opencode", ".control-panel", "tools.json"));
      if (snapshotRaw !== undefined) {
        try {
          const parsed = JSON.parse(snapshotRaw);
          for (const tool of parsed.tools ?? []) {
            if (tool.name)
              tools[tool.name] = !disabled.has(tool.name);
          }
        } catch {}
      }
      const plugins = {};
      for (const plugin of buildPlugins(location, {})) {
        if (!plugin.id.startsWith("__group__") && !plugin.system)
          plugins[plugin.id] = plugin.enabled;
      }
      const mcpGroups = {};
      for (const [label, cfg] of Object.entries(readMcpGroupsCached(projectRoot))) {
        mcpGroups[label] = cfg.enabled;
      }
      const mcpServers = {};
      for (const server of ctx.data.location.mcp.server.list(location) ?? []) {
        mcpServers[server.name] = server.status.status !== "disabled";
      }
      return {
        skills,
        tools,
        plugins,
        mcpGroups,
        mcpServers
      };
    };
    const estimatePresetTokens = (state) => Object.values(state.skills).filter(Boolean).length * 250 + Object.values(state.tools).filter(Boolean).length * 120 + Object.values(state.plugins).filter(Boolean).length * 200 + Object.values(state.mcpGroups).filter(Boolean).length * 50;
    const createPreset = async () => {
      if (disposed)
        return;
      const root = currentLocation().directory;
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0441\u0435\u0442",
          placeholder: "\u0418\u043C\u044F \u043F\u0440\u0435\u0441\u0435\u0442\u0430"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed)
        return;
      const data = readPresetsCached(root);
      data.presets[trimmed] = collectCurrentPresetState(root);
      await writePresets(root, data);
      presetsCache.set(root, {
        rev: treeRev(),
        data
      });
      setOpError(undefined);
      bumpTree();
    };
    const applyPreset = async (name) => {
      if (disposed)
        return;
      const root = currentLocation().directory;
      const state = readPresetsCached(root).presets[name];
      if (!state)
        return;
      try {
        const skillsByID = new Map((ctx.data.location.skill.list(currentLocation()) ?? []).map((s) => [s.id, s]));
        const groups = {
          project: {},
          global: {}
        };
        for (const [id, enabled] of Object.entries(state.skills)) {
          const skill = skillsByID.get(id);
          if (!skill)
            continue;
          const target = targetForSkill(skill.path, root);
          groups[target][id] = enabled ? "allow" : "deny";
        }
        await Promise.all(["project", "global"].map((target) => Object.keys(groups[target]).length > 0 ? writeSkillPermissions(root, target, groups[target]) : Promise.resolve()));
        for (const [toolName, enabled] of Object.entries(state.tools)) {
          await writeToolRule(root, toolName, enabled);
        }
        const localPluginIDs = new Set;
        for (const pluginsRoot of [pluginDirectoryPath(), join9(root, ".opencode", "plugins")]) {
          for (const candidate of discoverPlugins(pluginsRoot))
            localPluginIDs.add(candidate.id);
        }
        for (const [pluginId, enabled] of Object.entries(state.plugins)) {
          if (SYSTEM_PLUGINS.has(pluginId) || localPluginIDs.has(pluginId))
            continue;
          await setPluginEnabled(pluginId, enabled);
        }
        const currentGroups = readMcpGroupsCached(root);
        for (const [label, enabled] of Object.entries(state.mcpGroups)) {
          if (currentGroups[label])
            currentGroups[label].enabled = enabled;
        }
        await writeMcpGroups(root, currentGroups);
        for (const [serverName, enabled] of Object.entries(state.mcpServers)) {
          setMcpServerEnabledAll(serverName, enabled);
        }
        await writeActivePreset(root, name);
        activePresetCache.set(root, {
          rev: treeRev(),
          name
        });
        setOpError(undefined);
        bumpTree();
        ctx.ui.toast.show({
          title: "\u041F\u0440\u0435\u0441\u0435\u0442\u044B",
          message: `\u041F\u0440\u0435\u0441\u0435\u0442 \xAB${name}\xBB \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D`,
          duration: 4000
        });
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u0435\u0441\u0435\u0442: ${errorMessage(error)}`);
      }
    };
    const resavePreset = async (name) => {
      if (disposed)
        return;
      const root = currentLocation().directory;
      const data = readPresetsCached(root);
      const prev = data.presets[name];
      if (!prev)
        return;
      data.presets[name] = {
        ...collectCurrentPresetState(root),
        description: prev.description
      };
      await writePresets(root, data);
      presetsCache.set(root, {
        rev: treeRev(),
        data
      });
      setOpError(undefined);
      bumpTree();
      ctx.ui.toast.show({
        title: "\u041F\u0440\u0435\u0441\u0435\u0442\u044B",
        message: `\u041F\u0440\u0435\u0441\u0435\u0442 \xAB${name}\xBB \u043F\u0435\u0440\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D`,
        duration: 4000
      });
    };
    const deletePreset = async (name) => {
      let confirmed = false;
      try {
        confirmed = await ctx.ui.dialog.confirm({
          title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u0435\u0441\u0435\u0442",
          message: `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u0440\u0435\u0441\u0435\u0442 \xAB${name}\xBB?`,
          label: {
            confirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
            cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
          }
        }) === true;
      } catch {
        return;
      }
      if (!confirmed)
        return;
      const root = currentLocation().directory;
      const data = readPresetsCached(root);
      delete data.presets[name];
      await writePresets(root, data);
      if (readActivePresetCached(root) === name) {
        await writeActivePreset(root, undefined);
        activePresetCache.set(root, {
          rev: treeRev()
        });
      }
      presetsCache.set(root, {
        rev: treeRev(),
        data
      });
      bumpTree();
    };
    const renamePreset = async (name) => {
      let next;
      try {
        next = await ctx.ui.dialog.prompt({
          title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u0435\u0441\u0435\u0442",
          value: name
        });
      } catch {
        return;
      }
      const trimmed = next?.trim();
      if (!trimmed || trimmed === name)
        return;
      const root = currentLocation().directory;
      const data = readPresetsCached(root);
      const state = data.presets[name];
      if (state) {
        delete data.presets[name];
        data.presets[trimmed] = state;
      }
      if (readActivePresetCached(root) === name) {
        await writeActivePreset(root, trimmed);
        activePresetCache.set(root, {
          rev: treeRev(),
          name: trimmed
        });
      }
      await writePresets(root, data);
      presetsCache.set(root, {
        rev: treeRev(),
        data
      });
      bumpTree();
    };
    const fullRestart = async () => {
      if (disposed)
        return;
      let confirmed = false;
      try {
        confirmed = await ctx.ui.dialog.confirm({
          title: "\u041F\u043E\u043B\u043D\u0430\u044F \u043F\u0435\u0440\u0435\u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430",
          message: "\u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C OpenCode (\u0441\u0435\u0440\u0432\u0438\u0441 + \u043A\u043B\u0438\u0435\u043D\u0442)?",
          label: {
            confirm: "\u041F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C",
            cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
          }
        }) === true;
      } catch {
        return;
      }
      if (!confirmed)
        return;
      const task = spawn2("schtasks", ["/Run", "/TN", "opencode-restart-full"], {
        windowsHide: true,
        detached: true,
        stdio: "ignore"
      });
      task.unref();
    };
    const openPresetMenu = (name) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(MenuDialog, {
        ctx,
        title: name,
        options: [{
          label: "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C",
          value: "apply"
        }, {
          label: "\u041F\u0435\u0440\u0435\u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
          value: "resave"
        }, {
          label: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C",
          value: "rename"
        }, {
          label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
          value: "delete",
          danger: true
        }],
        onSelect: (value) => {
          ctx.ui.dialog.clear();
          if (value === "apply")
            setTimeout(() => void applyPreset(name), 0);
          else if (value === "resave")
            setTimeout(() => void resavePreset(name), 0);
          else if (value === "rename")
            setTimeout(() => void renamePreset(name), 0);
          else if (value === "delete")
            setTimeout(() => void deletePreset(name), 0);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    const readRuCached = (projectRoot) => {
      const rev = treeRev();
      const hit = ruCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.map;
      const map = buildRuMap(projectRoot);
      ruCache.set(projectRoot, {
        rev,
        map
      });
      return map;
    };
    const readUsageCached = (projectRoot) => {
      const rev = treeRev();
      const hit = usageCache.get(projectRoot);
      if (hit?.rev === rev)
        return hit.data;
      const data = readUsage(projectRoot);
      usageCache.set(projectRoot, {
        rev,
        data
      });
      return data;
    };
    const bumpUsage = (projectRoot, kind, key) => {
      const current = readUsageCached(projectRoot);
      const next = {
        skills: {
          ...current.skills
        },
        tools: {
          ...current.tools
        }
      };
      next[kind][key] = (next[kind][key] ?? 0) + 1;
      usageCache.set(projectRoot, {
        rev: treeRev(),
        data: next
      });
      writeUsage(projectRoot, next).catch(() => {
        return;
      });
      bumpTree();
    };
    const openDesc = (title, body) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(DescDialog, {
        ctx,
        title,
        body,
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "large",
        centered: true
      });
    };
    const [treeState, mutateTreeState] = ctx.storage.store("tree", {
      initial: {
        collapsed: {}
      }
    });
    const [collapseMap, setCollapseMap] = createSignal4({
      ...treeState.collapsed ?? {}
    });
    const persistCollapse = (next) => {
      setCollapseMap(next);
      mutateTreeState((draft) => {
        draft.collapsed = next;
      }).catch(() => {
        return;
      });
    };
    const toggleNode = (key) => {
      console.log(`[skills-mgr] toggleNode key=${key}`);
      try {
        const current = collapseMap();
        persistCollapse({
          ...current,
          [key]: current[key] !== false
        });
        console.log(`[skills-mgr] after toggle key=${key} next=${JSON.stringify(collapseMap())}`);
      } catch (e) {
        console.error(`[skills-mgr] toggleNode error`, e);
      }
    };
    const currentLocation = () => {
      const route = ctx.ui.router.current();
      if (route.type === "session") {
        const session = ctx.data.session.get(route.sessionID);
        if (session?.location)
          return session.location;
      }
      return ctx.location ?? ctx.data.location.default();
    };
    const reportError = (message) => {
      setOpError(message);
      ctx.ui.toast.show({
        variant: "error",
        title: "Skills",
        message,
        duration: 8000
      });
    };
    const [loadedBySession, setLoadedBySession] = createSignal4(new Map);
    const [fileSamples, setFileSamples] = createSignal4(new Map);
    const sampling = new Map;
    const backfilled = new Set;
    const backfilling = new Map;
    const [refreshByLocation, setRefreshByLocation] = createSignal4(new Map);
    const compactionBySession = new Map;
    const deletedSessions = new Set;
    let disposed = false;
    let refreshID = 0;
    let initialRefreshTimer;
    let stopNativeSelection;
    const sampleKey = (skill, location) => `${locationKey(location)}\x00${skill.path}`;
    const clearFileSamples = (location) => {
      const prefix = `${locationKey(location)}\x00`;
      for (const [key, controller] of sampling) {
        if (!key.startsWith(prefix))
          continue;
        controller.abort();
        sampling.delete(key);
      }
      setFileSamples((current) => {
        const next = new Map([...current].filter(([key]) => !key.startsWith(prefix)));
        return next.size === current.size ? current : next;
      });
    };
    const ensureFileSamples = (skill, location, refresh = false) => {
      if (disposed || skill.name === undefined || !skill.path || !/(?:^|[\\/])SKILL\.md$/.test(skill.path))
        return;
      const key = sampleKey(skill, location);
      if (sampling.has(key) || !refresh && fileSamples().has(key))
        return;
      const controller = new AbortController;
      sampling.set(key, controller);
      loadSkillFileSamples(ctx, skill, location, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])).catch(() => {
        return;
      }).then((files) => {
        if (disposed || controller.signal.aborted || sampling.get(key) !== controller)
          return;
        setFileSamples((current) => new Map(current).set(key, files));
      }).finally(() => {
        if (sampling.get(key) === controller)
          sampling.delete(key);
      });
    };
    const markLoaded = (sessionID, skillID) => {
      if (disposed || deletedSessions.has(sessionID))
        return;
      setLoadedBySession((current) => {
        const loaded = current.get(sessionID);
        if (loaded?.has(skillID))
          return current;
        const next = new Map(current);
        next.set(sessionID, new Set(loaded).add(skillID));
        return next;
      });
    };
    const resetLoaded = (sessionID) => {
      backfilling.get(sessionID)?.abort();
      backfilling.delete(sessionID);
      backfilled.delete(sessionID);
      setLoadedBySession((current) => {
        if (!current.has(sessionID))
          return current;
        const next = new Map(current);
        next.delete(sessionID);
        return next;
      });
    };
    const applyLoads = (sessionID, state) => {
      if (disposed || deletedSessions.has(sessionID))
        return;
      if (state.compactionID && state.compactionID !== compactionBySession.get(sessionID)) {
        compactionBySession.set(sessionID, state.compactionID);
        resetLoaded(sessionID);
      }
      for (const id of state.loaded)
        markLoaded(sessionID, id);
    };
    const ensureBackfill = (sessionID) => {
      if (disposed || deletedSessions.has(sessionID) || backfilled.has(sessionID) || backfilling.has(sessionID))
        return;
      const controller = new AbortController;
      backfilling.set(sessionID, controller);
      backfillLoadedSkills(ctx, sessionID, controller.signal).then((state) => {
        if (disposed || controller.signal.aborted || !state)
          return;
        backfilling.delete(sessionID);
        applyLoads(sessionID, state);
        applyLoads(sessionID, extractSkillLoadState(ctx.data.session.message.list(sessionID)));
        backfilled.add(sessionID);
      }).catch(() => {}).finally(() => {
        if (backfilling.get(sessionID) === controller)
          backfilling.delete(sessionID);
      });
    };
    const countedMessageIds = new Set;
    const rootToolCounts = new Map;
    let scannedSum = -1;
    const scanSessionToolCalls = (sessionID, projectRoot) => {
      try {
        let map = rootToolCounts.get(projectRoot);
        if (!map) {
          map = new Map(Object.entries(readUsageCached(projectRoot).tools));
          rootToolCounts.set(projectRoot, map);
        }
        const messages = ctx.data.session.message.list(sessionID);
        if (!messages)
          return;
        for (const msg of messages) {
          const key = `${sessionID}:${msg.id}`;
          if (!msg.id || countedMessageIds.has(key))
            continue;
          countedMessageIds.add(key);
          const visit = (node) => {
            if (!node || typeof node !== "object")
              return;
            if (Array.isArray(node)) {
              for (const x of node)
                visit(x);
              return;
            }
            const rec = node;
            if (typeof rec.tool === "string" && rec.type === "tool") {
              const name = String(rec.tool);
              map.set(name, (map.get(name) ?? 0) + 1);
            }
            for (const v of Object.values(rec))
              visit(v);
          };
          visit(msg.parts);
        }
        const sum = [...map.values()].reduce((a, b) => a + b, 0);
        if (sum !== scannedSum) {
          scannedSum = sum;
          writeUsage(projectRoot, {
            skills: readUsageCached(projectRoot).skills,
            tools: Object.fromEntries(map)
          }).catch(() => {
            return;
          });
          bumpTree();
        }
      } catch {}
    };
    const toggleCollapsed = () => {
      mutateUI((draft) => {
        draft.collapsed = !draft.collapsed;
      });
    };
    const renderSkillPreview = (skill, location) => {
      let raw;
      if (skill.path) {
        try {
          raw = readFileSync3(skill.path, "utf8").replace(/\r\n/g, `
`);
        } catch {}
      }
      const previewSkill = createMemo2(() => ({
        ...skill,
        fileSamples: fileSamples().get(sampleKey(skill, location))
      }));
      return _$createComponent4(SkillPreviewDialog, {
        ctx,
        get skill() {
          return previewSkill();
        },
        raw,
        theme: () => ctx.theme,
        get renderer() {
          return ctx.renderer;
        }
      });
    };
    const openSkillPreview = (skill, location) => {
      ensureFileSamples(skill, location, true);
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => renderSkillPreview(skill, location));
      ctx.ui.dialog.set({
        size: "xlarge",
        centered: true
      });
    };
    const refreshSkills = async (location) => {
      if (disposed)
        return true;
      const requestID = ++refreshID;
      const key = locationKey(location);
      setRefreshByLocation((current) => new Map(current).set(key, {
        id: requestID
      }));
      try {
        const available = await loadAvailableSkills(ctx, location);
        if (disposed || refreshByLocation().get(key)?.id !== requestID)
          return true;
        return available.length > 0;
      } catch (error) {
        if (disposed || refreshByLocation().get(key)?.id !== requestID)
          return true;
        setRefreshByLocation((current) => new Map(current).set(key, {
          id: requestID,
          failure: {
            skills: ctx.data.location.skill.list(location),
            agents: ctx.data.location.agent.list(location)
          }
        }));
        if (requestID !== refreshID)
          return true;
        ctx.ui.toast.show({
          variant: "error",
          title: "Skills",
          message: `Failed to load skills: ${error instanceof Error ? error.message : String(error)}`,
          duration: 5000
        });
        return false;
      }
    };
    const initialLocation = ctx.location ?? ctx.data.location.default();
    refreshSkills(initialLocation).then((ready) => {
      if (ready || disposed || refreshID !== 1)
        return;
      initialRefreshTimer = setTimeout(() => {
        if (refreshID !== 1)
          return;
        ctx.data.location.skill.invalidate(initialLocation);
        refreshSkills(initialLocation);
      }, 250);
    });
    const unregisterSkillUpdated = ctx.data.on("skill.updated", (event) => {
      const location = event.location ?? initialLocation;
      clearFileSamples(location);
      refreshSkills(location);
    });
    const unregisterProjectUpdated = ctx.data.on("project.updated", () => {
      const location = ctx.location ?? ctx.data.location.default();
      clearFileSamples(location);
      refreshSkills(location);
    });
    const unregisterSkillActivated = ctx.data.on("session.skill.activated", (event) => {
      const sessionID = event.data.sessionID;
      if (disposed || deletedSessions.has(sessionID))
        return;
      ctx.data.session.message.invalidate(sessionID);
      ctx.data.session.message.sync(sessionID).catch(() => {});
      const skillID = event.data.id;
      if (skillID) {
        const loc = ctx.data.session.get(sessionID)?.location ?? ctx.location ?? ctx.data.location.default();
        if (loc?.directory)
          bumpUsage(loc.directory, "skills", String(skillID));
      }
    });
    const unregisterToolUsage = ctx.tool?.hook?.("execute.after", (event) => {
      if (!event || event.status !== "completed" || !event.tool)
        return;
      const loc = currentLocation();
      if (loc?.directory)
        bumpUsage(loc.directory, "tools", String(event.tool));
    }) ?? (() => {});
    const unregisterSessionDeleted = ctx.data.on("session.deleted", (event) => {
      const sessionID = event.data.sessionID;
      deletedSessions.add(sessionID);
      resetLoaded(sessionID);
      compactionBySession.delete(sessionID);
    });
    const unregisterCompactionEnded = ctx.data.on("session.compaction.ended", (event) => {
      const sessionID = event.data.sessionID;
      if (disposed || deletedSessions.has(sessionID))
        return;
      const state = extractSkillLoadState(ctx.data.session.message.list(sessionID));
      if (state.compactionID)
        applyLoads(sessionID, state);
      else
        resetLoaded(sessionID);
      ensureBackfill(sessionID);
    });
    const registeredView = (location, loaded) => {
      const empty = {
        skills: [],
        emptyMessage: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u043E\u0432\u2026"
      };
      if (disposed)
        return empty;
      const registered = ctx.data.location.skill.list(location);
      const failure = refreshByLocation().get(locationKey(location))?.failure;
      const failed = failure && registered === failure.skills;
      if (registered === undefined)
        return {
          ...empty,
          emptyMessage: failed ? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A\u0438" : "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0430\u0432\u044B\u043A\u043E\u0432\u2026"
        };
      return {
        skills: toSummaries(registered, [], loaded, "registered").map((skill) => {
          const files = fileSamples().get(sampleKey(skill, location));
          return files === undefined ? skill : {
            ...skill,
            fileSamples: files
          };
        }),
        emptyMessage: failed ? "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A\u0438" : "\u041D\u0435\u0442 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u043D\u0430\u0432\u044B\u043A\u043E\u0432"
      };
    };
    const buildTree = (location, view, collapsedMap = {}) => {
      treeRev();
      const projectRoot = location.directory;
      const config = readConfigCached(projectRoot);
      const setsResult = readSetsCached(projectRoot);
      const setState = readSetStateCached(projectRoot);
      const toolRules = readAllToolRules(projectRoot);
      const declaredTools = (skill) => {
        if (!skill.path)
          return;
        const cacheKey = `d:${skill.id}`;
        const cached = declaredToolsCache.get(cacheKey);
        if (cached && cached.rev === treeRev())
          return cached.tools;
        let tools;
        try {
          const raw = readTextFile(skill.path);
          if (raw !== undefined) {
            const list = parseDeclaredTools(raw);
            tools = list.map((name) => ({
              name,
              enabled: !toolRules.disabled.has(name)
            }));
          }
        } catch {
          tools = undefined;
        }
        declaredToolsCache.set(cacheKey, {
          rev: treeRev(),
          tools
        });
        return tools;
      };
      const countToolUsers = (skills) => {
        const map = new Map;
        for (const skill of skills) {
          for (const tool of skill.declaredTools ?? [])
            map.set(tool.name, (map.get(tool.name) ?? 0) + 1);
        }
        return map;
      };
      const mcpConnected = new Set;
      for (const server of ctx.data.location.mcp.server.list(location) ?? []) {
        if (server.status?.status === "connected")
          mcpConnected.add(sanitizeMcpNamespace(server.name));
      }
      const snapshotTools = [];
      const snapshotRaw = readTextFile(join9(projectRoot, ".opencode", ".control-panel", "tools.json"));
      if (snapshotRaw !== undefined) {
        try {
          const parsed = JSON.parse(snapshotRaw);
          if (Array.isArray(parsed.tools))
            snapshotTools.push(...parsed.tools);
        } catch {}
      }
      const toolNs = new Map;
      const systemTools = new Set;
      for (const tool of snapshotTools) {
        if (tool.namespace)
          toolNs.set(tool.name, tool.namespace);
        else
          systemTools.add(tool.name);
      }
      for (const name of ["read", "glob", "grep", "write", "edit", "patch", "shell", "question", "skill", "subagent", "webfetch", "websearch", "browser_tabs_list", "browser_tabs_open", "browser_tabs_focus", "browser_tabs_close", "browser_preview", "browser_navigate", "browser_back", "browser_forward", "browser_reload", "browser_stop", "browser_frames", "browser_snapshot", "browser_find", "browser_evaluate", "browser_click", "browser_hover", "browser_drag", "browser_fill", "browser_fill_form", "browser_select", "browser_check", "browser_press", "browser_scroll", "browser_wait", "browser_screenshot", "browser_dialog", "browser_files_list", "browser_files_get", "browser_files_upload", "browser_files_drop", "browser_console", "browser_network_list", "browser_network_get", "browser_trace_start", "browser_trace_stop", "browser_trace_analyze", "browser_cpu_start", "browser_cpu_stop", "browser_cpu_analyze", "browser_heap_snapshot", "browser_heap_summary", "browser_heap_query", "browser_heap_object", "browser_heap_compare", "browser_lighthouse", "opencode_session_rename", "opencode_session_move", "opencode_worktree_create", "opencode_worktree_list", "opencode_worktree_remove", "opencode_models", "opencode_list_mcp_resources", "opencode_read_mcp_resource"]) {
        systemTools.add(name);
      }
      const allSkills = view.skills.filter((skill) => skill.name !== undefined).map((skill) => {
        const enabled = !isDenied(config, skill.id);
        const declared = declaredTools(skill);
        const missingMcpCount = (declared ?? []).filter((tool) => {
          const ns = toolNs.get(tool.name);
          if (ns !== undefined)
            return !mcpConnected.has(ns);
          return !systemTools.has(tool.name);
        }).length;
        return {
          ...skill,
          enabled,
          modelVisible: enabled ? skill.modelVisible : false,
          declaredTools: declared,
          declaredDisabledCount: declared?.filter((tool) => !tool.enabled).length ?? 0,
          missingMcpCount
        };
      });
      const byID = new Map(allSkills.map((skill) => [skill.id, skill]));
      currentToolUsers = countToolUsers(allSkills);
      const skillToolOff = toolRules.disabled.has("skill");
      const alert = skillToolOff ? "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xABskill\xBB \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D \u2014 \u043D\u0430\u0432\u044B\u043A\u0438 \u043D\u0435 \u0441\u043C\u043E\u0433\u0443\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0442\u044C\u0441\u044F." : undefined;
      const assigned = new Set;
      const treeSets = setsResult.sets.map((set) => {
        const skills = set.skills.map((id) => byID.get(id)).filter((skill) => skill !== undefined);
        for (const skill of skills)
          assigned.add(skill.id);
        const entry = setState.sets[set.name];
        const disabled = entry?.disabled === true;
        const key = `set:${set.name}`;
        return {
          key,
          name: set.name,
          allSkills: set.skills,
          skills,
          enabledCount: skills.filter((skill) => skill.enabled).length,
          total: skills.length,
          enabled: !disabled,
          disabled,
          open: collapsedMap["skills"] !== false && collapsedMap[key] !== false
        };
      });
      const unassignedSkills = allSkills.filter((skill) => !assigned.has(skill.id));
      return {
        sets: treeSets,
        unassigned: {
          key: "unassigned",
          label: "Other",
          skills: unassignedSkills,
          open: collapsedMap["skills"] !== false && collapsedMap.unassigned !== false
        },
        allSkills,
        enabledCount: allSkills.filter((skill) => skill.enabled).length,
        total: allSkills.length,
        alert,
        error: setsResult.error ?? (config.errors.length > 0 ? config.errors.join("; ") : undefined)
      };
    };
    const toggleSkill = async (skill) => {
      if (disposed)
        return;
      const location = currentLocation();
      const projectRoot = location.directory;
      const config = readConfigCached(projectRoot);
      const effect = isDenied(config, skill.id) ? "allow" : "deny";
      const target = targetForSkill(skill.path, projectRoot);
      try {
        await writeSkillPermissions(projectRoot, target, {
          [skill.id]: effect
        });
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \xAB${skill.name ?? skill.id}\xBB: ${errorMessage(error)}`);
      }
    };
    const toggleUnassignedAll = async (skills) => {
      if (disposed)
        return;
      const root = currentLocation().directory;
      const anyOn = skills.some((skill) => skill.enabled);
      const effect = anyOn ? "deny" : "allow";
      try {
        const jobs = skills.map((skill) => writeSkillPermissions(root, targetForSkill(skill.path, root), {
          [skill.id]: effect
        }));
        await Promise.all(jobs);
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443 \xAB\u0411\u0435\u0437 \u043D\u0430\u0431\u043E\u0440\u0430\xBB: ${errorMessage(error)}`);
      }
    };
    const sanitizeMcpNamespace = (name) => name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const buildTools = (location, collapsedMap = {}) => {
      treeRev();
      const projectRoot = location.directory;
      const {
        disabled
      } = readAllToolRules(projectRoot);
      const snapshot = readTextFile(join9(projectRoot, ".opencode", ".control-panel", "tools.json"));
      const tools = [];
      if (snapshot !== undefined) {
        try {
          const parsed = JSON.parse(snapshot);
          if (Array.isArray(parsed.tools))
            tools.push(...parsed.tools);
        } catch {}
      }
      const mcpServers = new Set;
      for (const server of ctx.data.location.mcp.server.list(location) ?? []) {
        mcpServers.add(sanitizeMcpNamespace(server.name));
      }
      const custom = readItemGroupsCached("tools", projectRoot);
      const assignedGroup = new Map;
      for (const [gname, cfg] of Object.entries(custom)) {
        for (const item of cfg.items)
          assignedGroup.set(item, gname);
      }
      const mkEntry = (tool) => ({
        name: tool.name,
        description: tool.description,
        chars: tool.description.length,
        tokens: Math.max(1, Math.round(tool.description.length / 4)),
        enabled: !disabled.has(tool.name),
        users: currentToolUsers.get(tool.name) ?? 0
      });
      const buckets = new Map;
      const bucket = (label) => {
        let list = buckets.get(label);
        if (!list) {
          list = [];
          buckets.set(label, list);
        }
        return list;
      };
      const system = [];
      const nsMap = new Map;
      for (const tool of tools) {
        const entry = mkEntry(tool);
        const customLabel = assignedGroup.get(tool.name);
        if (customLabel !== undefined) {
          if (!(tool.namespace && mcpServers.has(tool.namespace)))
            bucket(customLabel).push(entry);
          continue;
        }
        const ns = tool.namespace;
        if (!ns) {
          system.push(entry);
          continue;
        }
        if (mcpServers.has(ns))
          continue;
        const key = nsMap.get(ns) ?? [];
        key.push(entry);
        nsMap.set(ns, key);
      }
      const sortByWeight = (entries) => entries.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
      const result = [];
      const pushGroup = (label, entries, key, enabled = true) => {
        sortByWeight(entries);
        if (!enabled)
          for (const t of entries)
            t.enabled = false;
        result.push({
          key,
          label,
          tools: entries,
          disabledCount: entries.filter((t) => !t.enabled).length,
          total: entries.length,
          open: collapsedMap["tools"] !== false && collapsedMap[key] !== false,
          enabled
        });
      };
      for (const name of Object.keys(custom)) {
        pushGroup(name, buckets.get(name) ?? [], `tools:custom:${name}`, custom[name].enabled);
      }
      if (system.length > 0)
        pushGroup("\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0435", system, "tools:system");
      for (const [ns, entries] of nsMap) {
        if (!custom[ns]?.enabled)
          pushGroup(ns, entries, `tools:${ns}`);
        else if (entries.length > 0)
          pushGroup(ns, entries, `tools:${ns}`);
      }
      return result;
    };
    const toggleTool = async (tool) => {
      if (disposed)
        return;
      const location = currentLocation();
      const projectRoot = location.directory;
      if (tool.enabled) {
        const users = currentToolUsers.get(tool.name) ?? 0;
        const isSkillLoader = tool.name === "skill";
        if (users > 0 || isSkillLoader) {
          let message;
          if (isSkillLoader) {
            message = "\u0418\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xABskill\xBB \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u043D\u0430\u0432\u044B\u043A\u0438. \u0415\u0441\u043B\u0438 \u0435\u0433\u043E \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u0432\u0441\u0435 \u043D\u0430\u0432\u044B\u043A\u0438 \u0441\u0442\u0430\u043D\u0443\u0442 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0434\u043B\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438. \u0412\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C?";
          } else {
            message = `\u041F\u0440\u0438 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u044E\u0442 ${users} ${users === 1 ? "\u0441\u043A\u0438\u043B" : "\u0441\u043A\u0438\u043B\u043E\u0432(\u0430)"}. \u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0435\u0433\u043E \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E?`;
          }
          let confirmed;
          try {
            confirmed = await ctx.ui.dialog.confirm({
              title: "\u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442",
              message,
              label: {
                confirm: "\u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C",
                cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
              }
            });
          } catch {
            return;
          }
          if (!confirmed)
            return;
        }
      }
      try {
        await writeToolRule(projectRoot, tool.name, !tool.enabled);
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 \xAB${tool.name}\xBB: ${errorMessage(error)}`);
      }
    };
    const SYSTEM_PLUGINS = new Set(["opencode.dazhdbog", "opencode.mcp-classify"]);
    const buildPlugins = (location, collapsedMap = {}) => {
      treeRev();
      const projectRoot = location.directory;
      const cli = readCliPlugins();
      const found = [...discoverPlugins(join9(projectRoot, ".opencode", "plugins")), ...discoverPlugins(pluginDirectoryPath())];
      const seen = new Map;
      for (const entry of cli.entries) {
        const id = typeof entry === "string" ? entry.replace(/^-/, "") : entry.package;
        if (!id || seen.has(id))
          continue;
        const enabled = cli.disabledIDs.has(id) ? false : cli.activeIDs.has(id);
        seen.set(id, {
          key: `plugin:${id}`,
          id,
          label: id,
          enabled,
          system: SYSTEM_PLUGINS.has(id),
          tools: [],
          open: collapsedMap["plugins"] !== false && collapsedMap[`plugin:${id}`] !== false
        });
      }
      for (const candidate of found) {
        if (seen.has(candidate.id))
          continue;
        seen.set(candidate.id, {
          key: `plugin:${candidate.id}`,
          id: candidate.id,
          label: candidate.id,
          enabled: !cli.disabledIDs.has(candidate.id),
          system: SYSTEM_PLUGINS.has(candidate.id),
          tools: [],
          open: collapsedMap["plugins"] !== false && collapsedMap[`plugin:${candidate.id}`] !== false
        });
      }
      const snapshot = readTextFile(join9(projectRoot, ".opencode", ".control-panel", "tools.json"));
      const tools = [];
      if (snapshot !== undefined) {
        try {
          const parsed = JSON.parse(snapshot);
          if (Array.isArray(parsed.tools))
            tools.push(...parsed.tools);
        } catch {}
      }
      const {
        disabled
      } = readAllToolRules(projectRoot);
      for (const plugin of seen.values()) {
        const ns = sanitizeMcpNamespace(plugin.id);
        for (const tool of tools) {
          if (tool.namespace !== ns)
            continue;
          plugin.tools.push({
            name: tool.name,
            description: tool.description,
            chars: tool.description.length,
            tokens: Math.max(1, Math.round(tool.description.length / 4)),
            enabled: !disabled.has(tool.name),
            users: currentToolUsers.get(tool.name) ?? 0
          });
        }
        plugin.tools.sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
      }
      const pcustom = readItemGroupsCached("plugins", projectRoot);
      const passign = new Map;
      for (const [gname, cfg] of Object.entries(pcustom)) {
        for (const id of cfg.items)
          passign.set(id, gname);
      }
      const flat = [...seen.values()].sort((a, b) => a.system === b.system ? a.label.localeCompare(b.label) : a.system ? -1 : 1).map((plugin) => {
        const g = passign.get(plugin.id);
        const groupDisabled = g !== undefined && pcustom[g]?.enabled === false;
        return {
          ...plugin,
          groupLabel: g ?? "Other",
          enabled: groupDisabled ? false : plugin.enabled
        };
      });
      const pluginTokensEst = (plugin) => Math.max(1, Math.round(plugin.label.length / 4)) + plugin.tools.reduce((s, t) => s + t.tokens, 0);
      const placeholders = [];
      for (const name of Object.keys(pcustom)) {
        placeholders.push({
          key: `plugin:custom:${name}`,
          id: `__group__${name}`,
          label: name,
          enabled: pcustom[name].enabled,
          system: false,
          tools: [],
          open: collapsedMap["plugins"] !== false && collapsedMap[`plugin:custom:${name}`] !== false,
          tokensTotal: flat.filter((p) => passign.get(p.id) === name).reduce((s, p) => s + pluginTokensEst(p), 0)
        });
      }
      const ungroupedCount = flat.filter((p) => !passign.has(p.id)).length;
      if (ungroupedCount > 0) {
        placeholders.push({
          key: "plugin:custom:Other",
          id: "__group__Other",
          label: "Other",
          enabled: true,
          system: false,
          tools: [],
          open: collapsedMap["plugins"] !== false && collapsedMap["plugin:custom:Other"] !== false,
          tokensTotal: flat.filter((p) => !passign.has(p.id)).reduce((s, p) => s + pluginTokensEst(p), 0)
        });
      }
      return [...placeholders, ...flat];
    };
    const togglePlugin = async (plugin) => {
      if (disposed || plugin.system)
        return;
      try {
        await setPluginEnabled(plugin.id, !plugin.enabled);
        setOpError(undefined);
        bumpTree();
        ctx.ui.toast.show({
          variant: "info",
          title: "\u041F\u043B\u0430\u0433\u0438\u043D\u044B",
          message: `\xAB${plugin.label}\xBB ${plugin.enabled ? "\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D" : "\u0432\u043A\u043B\u044E\u0447\u0451\u043D"} \u2014 \u044D\u0444\u0444\u0435\u043A\u0442 \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430 OpenCode.`,
          duration: 6000
        });
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043F\u043B\u0430\u0433\u0438\u043D \xAB${plugin.label}\xBB: ${errorMessage(error)}`);
      }
    };
    const MCP_STALL_MS = 45000;
    const MCP_REFRESH_MS = 1500;
    const mcpClasses = buildClasses(ctx.options);
    const mcpDefaultClass = typeof ctx.options?.defaultClass === "string" ? ctx.options.defaultClass : DEFAULT_CLASS;
    const [mcpLoading, setMcpLoading] = createSignal4(new Map);
    const mcpPendingSince = new Map;
    const [mcpTick, setMcpTick] = createSignal4(0);
    const [mcpClock, setMcpClock] = createSignal4(Date.now());
    const mcpTimers = new Set;
    const mcpIsLoading = (name) => mcpLoading().has(name);
    const mcpSince = (name) => Math.min(mcpLoading().get(name) ?? Infinity, mcpPendingSince.get(name) ?? Infinity);
    const mcpStalled = (name) => {
      const started = mcpSince(name);
      return Number.isFinite(started) && mcpClock() - started >= MCP_STALL_MS;
    };
    createEffect3(() => {
      const list = ctx.data.location.mcp.server.list(currentLocation()) ?? [];
      const seen = new Set;
      let changed = false;
      for (const server of list) {
        if (server.status.status !== "pending")
          continue;
        seen.add(server.name);
        if (!mcpPendingSince.has(server.name)) {
          mcpPendingSince.set(server.name, Date.now());
          changed = true;
        }
      }
      for (const name of [...mcpPendingSince.keys()]) {
        if (seen.has(name))
          continue;
        mcpPendingSince.delete(name);
        changed = true;
      }
      if (changed)
        setMcpTick((tick) => tick + 1);
    });
    createEffect3(() => {
      if (mcpLoading().size === 0 && mcpPendingSince.size === 0)
        return;
      const timer = setInterval(() => setMcpClock(Date.now()), 1000);
      onCleanup3(() => clearInterval(timer));
    });
    const mcpRefresh = (target) => {
      const api = ctx.data.location.mcp.server;
      try {
        api.invalidate(target);
        if (typeof api.sync === "function")
          Promise.resolve(api.sync(target)).catch(() => {
            return;
          });
      } catch {}
    };
    const mcpApi = () => {
      const client = ctx.client;
      return client?.experimental?.mcp ?? client?.mcp ?? client?.api?.mcp;
    };
    const toggleServer = (server) => {
      if (disposed)
        return;
      const name = server.name;
      if (mcpIsLoading(name))
        return;
      const status = server.status;
      if (status === "pending" && !mcpStalled(name))
        return;
      const api = mcpApi();
      if (!api || typeof api.connect !== "function" || typeof api.disconnect !== "function") {
        ctx.ui.toast.show({
          message: `${name}: MCP API \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 (\u043D\u0435\u0442 experimental.mcp)`,
          variant: "error"
        });
        return;
      }
      const target = currentLocation();
      const input = {
        server: name,
        location: {
          directory: target.directory
        }
      };
      let call;
      try {
        call = status === "connected" ? api.disconnect(input) : api.connect(input);
      } catch (error) {
        ctx.ui.toast.show({
          message: `${name}: ${error?.message ?? error}`,
          variant: "error"
        });
        return;
      }
      setMcpLoading((prev) => new Map(prev).set(name, Date.now()));
      mcpPendingSince.delete(name);
      let done = false;
      const poll = setInterval(() => mcpRefresh(target), MCP_REFRESH_MS);
      const watchdog = setTimeout(finish, MCP_STALL_MS);
      mcpTimers.add(poll);
      mcpTimers.add(watchdog);
      function finish() {
        if (done)
          return;
        done = true;
        clearInterval(poll);
        clearTimeout(watchdog);
        mcpTimers.delete(poll);
        mcpTimers.delete(watchdog);
        mcpRefresh(target);
        setMcpLoading((prev) => {
          const next = new Map(prev);
          next.delete(name);
          return next;
        });
      }
      Promise.resolve(call).catch((error) => ctx.ui.toast.show({
        message: `${name}: ${error?.message ?? error}`,
        variant: "error"
      })).then(finish, finish);
    };
    const buildMcp = (location, collapsedMap) => {
      treeRev();
      const servers = ctx.data.location.mcp.server.list(location) ?? [];
      const projectRoot = location.directory;
      const snapshot = readTextFile(join9(projectRoot, ".opencode", ".control-panel", "tools.json"));
      const tools = [];
      if (snapshot !== undefined) {
        try {
          const parsed = JSON.parse(snapshot);
          if (Array.isArray(parsed.tools))
            tools.push(...parsed.tools);
        } catch {}
      }
      const {
        disabled
      } = readAllToolRules(projectRoot);
      const custom = readMcpGroupsCached(projectRoot);
      const classified = groupServers(servers, mcpClasses, mcpDefaultClass);
      const serverToGroup = new Map;
      for (const [label, list] of classified) {
        for (const server of list)
          serverToGroup.set(server.name, label);
      }
      const customNames = new Set(Object.keys(custom));
      const groupOrder = [];
      for (const name of Object.keys(custom)) {
        groupOrder.push(name);
      }
      for (const [label] of classified) {
        if (!customNames.has(label) && !groupOrder.includes(label) && label !== mcpDefaultClass)
          groupOrder.push(label);
      }
      if (!customNames.has(mcpDefaultClass) && !groupOrder.includes(mcpDefaultClass))
        groupOrder.push(mcpDefaultClass);
      const buckets = new Map;
      for (const server of servers) {
        let label = serverToGroup.get(server.name) ?? mcpDefaultClass;
        for (const [gname, cfg] of Object.entries(custom)) {
          if (cfg.servers.includes(server.name)) {
            label = gname;
            break;
          }
        }
        const list = buckets.get(label);
        if (list)
          list.push(server);
        else
          buckets.set(label, [server]);
      }
      return groupOrder.filter((label) => buckets.has(label) || custom[label]?.enabled === true).map((label) => {
        const key = `mcp:${label}`;
        const list = buckets.get(label) ?? [];
        return {
          key,
          label,
          open: collapsedMap["mcp"] !== false && collapsedMap[key] !== false,
          enabled: custom[label]?.enabled ?? true,
          servers: list.map((server) => {
            const ns = sanitizeMcpNamespace(server.name);
            const serverTools = tools.filter((tool) => tool.namespace === ns).map((tool) => ({
              name: tool.name,
              description: tool.description,
              chars: tool.description.length,
              tokens: Math.max(1, Math.round(tool.description.length / 4)),
              enabled: !disabled.has(tool.name),
              users: currentToolUsers.get(tool.name) ?? 0
            })).sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
            return {
              name: server.name,
              status: server.status.status,
              loading: mcpIsLoading(server.name),
              stalled: mcpStalled(server.name),
              tools: serverTools,
              open: collapsedMap[`mcp:${label}`] !== false && collapsedMap[`mcp-server:${server.name}`] !== false
            };
          })
        };
      });
    };
    const mutateMcpGroups = async (mutate) => {
      if (disposed)
        return false;
      const location = currentLocation();
      const projectRoot = location.directory;
      try {
        const groups = readMcpGroupsCached(projectRoot);
        mutate(groups);
        await writeMcpGroups(projectRoot, groups);
        mcpGroupsCache.set(projectRoot, {
          rev: treeRev(),
          groups
        });
        setOpError(undefined);
        bumpTree();
        return true;
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C MCP-\u0433\u0440\u0443\u043F\u043F\u044B: ${errorMessage(error)}`);
        return false;
      }
    };
    const createMcpGroup = async (preselectServer) => {
      if (disposed)
        return;
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041D\u043E\u0432\u0430\u044F MCP-\u0433\u0440\u0443\u043F\u043F\u0430",
          description: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, Web Search, Database, Internal API\u2026)",
          placeholder: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed)
        return;
      await mutateMcpGroups((groups) => {
        if (!groups[trimmed])
          groups[trimmed] = {
            servers: [],
            enabled: true
          };
        if (preselectServer) {
          for (const group of Object.values(groups))
            group.servers = group.servers.filter((s) => s !== preselectServer);
          groups[trimmed].servers.push(preselectServer);
        }
      });
    };
    const toggleMcpGroup = async (group) => {
      const label = group.label;
      let nextOn = true;
      await mutateMcpGroups((groups) => {
        if (!groups[label]) {
          groups[label] = {
            servers: group.servers.map((s) => s.name),
            enabled: true
          };
        }
        groups[label].enabled = !groups[label].enabled;
        nextOn = groups[label].enabled;
      });
      for (const server of group.servers) {
        setMcpServerEnabledAll(server.name, nextOn);
      }
      bumpTree();
    };
    const renameMcpGroup = async (group) => {
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443",
          value: group.label,
          placeholder: "\u0418\u043C\u044F \u0433\u0440\u0443\u043F\u043F\u044B"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed || trimmed === group.label)
        return;
      await mutateMcpGroups((groups) => {
        const cfg = groups[group.label];
        if (cfg) {
          delete groups[group.label];
          groups[trimmed] = cfg;
        }
      });
    };
    const deleteMcpGroup = async (group) => {
      let confirmed = false;
      try {
        confirmed = await ctx.ui.dialog.confirm({
          title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443",
          message: `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0433\u0440\u0443\u043F\u043F\u0443 \xAB${group.label}\xBB? \u0421\u0435\u0440\u0432\u0435\u0440\u044B \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u043C\u0438, \u0438\u0445 \u0432\u0435\u0440\u043D\u0451\u0442 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F.`,
          label: {
            confirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
            cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
          }
        }) === true;
      } catch {
        return;
      }
      if (!confirmed)
        return;
      await mutateMcpGroups((groups) => {
        delete groups[group.label];
      });
    };
    const openMcpGroupMenu = (group) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(MenuDialog, {
        ctx,
        get title() {
          return group.label;
        },
        options: [{
          label: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C\u2026",
          value: "rename"
        }, {
          label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
          value: "delete",
          danger: true
        }, {
          label: "\u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430\u2026",
          value: "create"
        }],
        onSelect: (value) => {
          ctx.ui.dialog.clear();
          if (value === "rename")
            setTimeout(() => void renameMcpGroup(group), 0);
          else if (value === "delete")
            setTimeout(() => void deleteMcpGroup(group), 0);
          else if (value === "create")
            setTimeout(() => void createMcpGroup(), 0);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    const moveMcpServer = async (server, toGroup) => {
      await mutateMcpGroups((groups) => {
        for (const group of Object.values(groups)) {
          group.servers = group.servers.filter((s) => s !== server.name);
        }
        if (toGroup) {
          const target = groups[toGroup];
          if (target)
            target.servers.push(server.name);
        }
      });
    };
    const togglePersistentServer = (server) => {
      const next = server.status !== "disabled";
      const changed = setMcpServerEnabledAll(server.name, next);
      bumpTree();
      ctx.ui.toast.show({
        title: "MCP",
        message: changed > 0 ? `\xAB${server.name}\xBB ${next ? "\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430" : "\u0432\u043A\u043B\u044E\u0447\u0451\u043D \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430"} \u2014 \u043F\u043E\u0441\u043B\u0435 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430` : "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043A\u043E\u043D\u0444\u0438\u0433",
        duration: 6000
      });
    };
    const openMcpServerMenu = (server) => {
      if (disposed)
        return;
      const location = currentLocation();
      const groups = readMcpGroupsCached(location.directory);
      const existing = Object.keys(groups).filter((name) => groups[name].enabled);
      const options = [{
        title: server.status === "disabled" ? "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430" : "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430",
        value: "__persist__"
      }, {
        title: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
        value: "__copy__"
      }, {
        title: "\u2014 \u0411\u0435\u0437 \u0433\u0440\u0443\u043F\u043F\u044B \u2014",
        value: "__none__"
      }, ...existing.map((name) => ({
        title: name,
        value: name
      })), {
        title: "+ \u041D\u043E\u0432\u0430\u044F \u0433\u0440\u0443\u043F\u043F\u0430\u2026",
        value: "__new__"
      }];
      ctx.renderer.clearSelection();
      ctx.ui.dialog.select({
        title: `\xAB${server.name}\xBB`,
        options
      }).then((choice) => {
        if (!choice)
          return;
        if (choice === "__persist__") {
          togglePersistentServer(server);
          return;
        }
        if (choice === "__copy__") {
          copyToClipboard(server.name);
          return;
        }
        if (choice === "__new__") {
          createMcpGroup(server.name);
          return;
        }
        moveMcpServer(server, choice === "__none__" ? null : choice);
      }).catch(() => {
        return;
      });
    };
    const toggleSet = async (set) => {
      if (disposed)
        return;
      const location = currentLocation();
      const projectRoot = location.directory;
      const config = readConfigCached(projectRoot);
      const state = readSetStateCached(projectRoot);
      const entry = state.sets[set.name];
      const disabled = entry?.disabled === true;
      const skillByID = new Map(set.skills.map((skill) => [skill.id, skill]));
      const groups = {
        project: {},
        global: {}
      };
      const add = (id, effect) => {
        const target = targetForSkill(skillByID.get(id)?.path, projectRoot);
        groups[target][id] = effect;
      };
      const snapshot = disabled ? {
        ...entry?.snapshot ?? {}
      } : {};
      for (const id of set.allSkills) {
        if (disabled)
          add(id, snapshot[id] ?? "allow");
        else {
          snapshot[id] = isDenied(config, id) ? "deny" : "allow";
          add(id, "deny");
        }
      }
      try {
        await Promise.all(["project", "global"].map((target) => Object.keys(groups[target]).length > 0 ? writeSkillPermissions(projectRoot, target, groups[target]) : Promise.resolve()));
        await writeSetState(projectRoot, {
          sets: {
            ...state.sets,
            [set.name]: {
              disabled: !disabled,
              snapshot
            }
          }
        });
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \xAB${set.name}\xBB: ${errorMessage(error)}`);
      }
    };
    const createSet = async (name, ids) => {
      const location = currentLocation();
      const projectRoot = location.directory;
      const existing = readSetsCached(projectRoot).sets;
      const selected = new Set(ids);
      const next = existing.map((set) => ({
        ...set,
        skills: set.skills.filter((id) => !selected.has(id))
      }));
      next.push({
        name,
        skills: [...selected]
      });
      try {
        await writeSets(projectRoot, next);
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \xAB${name}\xBB: ${errorMessage(error)}`);
      }
    };
    const openCreateSet = async (preselect = []) => {
      if (disposed)
        return;
      const location = currentLocation();
      const projectRoot = location.directory;
      const existing = readSetsCached(projectRoot).sets;
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041D\u043E\u0432\u044B\u0439 \u043D\u0430\u0431\u043E\u0440",
          description: "\u0417\u0430\u0442\u0435\u043C \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0430\u0432\u044B\u043A\u0438: Space \u2014 \u043E\u0442\u043C\u0435\u0442\u0438\u0442\u044C, Enter \u2014 \u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C.",
          placeholder: "\u0418\u043C\u044F \u043D\u0430\u0431\u043E\u0440\u0430"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed)
        return;
      if (existing.some((set) => set.name === trimmed)) {
        ctx.ui.toast.show({
          variant: "warning",
          title: "\u041D\u0430\u0431\u043E\u0440\u044B",
          message: `\u041D\u0430\u0431\u043E\u0440 \xAB${trimmed}\xBB \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442`
        });
        return;
      }
      const skills = buildTree(location, registeredView(location, new Set), {}).allSkills;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(SetSelectionDialog, {
        ctx,
        title: `\u041D\u0430\u0431\u043E\u0440 \xAB${trimmed}\xBB`,
        get skills() {
          return skills.map((skill) => ({
            id: skill.id,
            name: skill.name ?? skill.id,
            enabled: skill.enabled
          }));
        },
        initialSelected: preselect,
        onApply: (ids) => {
          createSet(trimmed, ids);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "large",
        centered: true
      });
    };
    const renameSet = async (set) => {
      const location = currentLocation();
      const projectRoot = location.directory;
      const existing = readSetsCached(projectRoot).sets;
      let name;
      try {
        name = await ctx.ui.dialog.prompt({
          title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0431\u043E\u0440",
          value: set.name,
          placeholder: "\u0418\u043C\u044F \u043D\u0430\u0431\u043E\u0440\u0430"
        });
      } catch {
        return;
      }
      const trimmed = name?.trim();
      if (!trimmed || trimmed === set.name)
        return;
      if (existing.some((item) => item.name === trimmed)) {
        ctx.ui.toast.show({
          variant: "warning",
          title: "\u041D\u0430\u0431\u043E\u0440\u044B",
          message: `\u041D\u0430\u0431\u043E\u0440 \xAB${trimmed}\xBB \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442`
        });
        return;
      }
      try {
        await writeSets(projectRoot, existing.map((item) => item.name === set.name ? {
          ...item,
          name: trimmed
        } : item));
        const state = readSetStateCached(projectRoot);
        if (state.sets[set.name]) {
          const {
            [set.name]: entry,
            ...rest
          } = state.sets;
          await writeSetState(projectRoot, {
            sets: {
              ...rest,
              [trimmed]: entry
            }
          });
        }
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \xAB${set.name}\xBB: ${errorMessage(error)}`);
      }
    };
    const deleteSet = async (set) => {
      const location = currentLocation();
      const projectRoot = location.directory;
      let confirmed;
      try {
        confirmed = await ctx.ui.dialog.confirm({
          title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440",
          message: `\u0423\u0434\u0430\u043B\u0438\u0442\u044C \xAB${set.name}\xBB? \u041D\u0430\u0432\u044B\u043A\u0438 \u043E\u0441\u0442\u0430\u043D\u0443\u0442\u0441\u044F \u0432 \u0441\u043F\u0438\u0441\u043A\u0435, \u0438\u0445 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0441\u044F.`,
          label: {
            confirm: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
            cancel: "\u041E\u0442\u043C\u0435\u043D\u0430"
          }
        });
      } catch {
        return;
      }
      if (!confirmed)
        return;
      try {
        await writeSets(projectRoot, readSetsCached(projectRoot).sets.filter((item) => item.name !== set.name));
        const state = readSetStateCached(projectRoot);
        if (state.sets[set.name]) {
          const rest = {
            ...state.sets
          };
          delete rest[set.name];
          await writeSetState(projectRoot, {
            sets: rest
          });
        }
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \xAB${set.name}\xBB: ${errorMessage(error)}`);
      }
    };
    const assignSkill = async (skill) => {
      const location = currentLocation();
      const projectRoot = location.directory;
      const existing = readSetsCached(projectRoot).sets;
      const options = [{
        title: "\u2014 \u0411\u0435\u0437 \u043D\u0430\u0431\u043E\u0440\u0430 \u2014",
        value: "__none__"
      }, ...existing.map((set) => ({
        title: set.name,
        value: set.name
      })), {
        title: "+ \u041D\u043E\u0432\u044B\u0439 \u043D\u0430\u0431\u043E\u0440\u2026",
        value: "__new__"
      }];
      let choice;
      try {
        choice = await ctx.ui.dialog.select({
          title: `\u041D\u0430\u0431\u043E\u0440 \u0434\u043B\u044F \xAB${skill.name ?? skill.id}\xBB`,
          options
        });
      } catch {
        return;
      }
      if (!choice)
        return;
      if (choice === "__new__") {
        await openCreateSet([skill.id]);
        return;
      }
      const next = existing.map((set) => ({
        ...set,
        skills: set.skills.filter((id) => id !== skill.id)
      }));
      if (choice !== "__none__") {
        const target = next.find((set) => set.name === choice);
        if (target)
          target.skills.push(skill.id);
      }
      try {
        await writeSets(projectRoot, next);
        const state = readSetStateCached(projectRoot);
        if (choice !== "__none__" && state.sets[choice]?.disabled) {
          await writeSkillPermissions(projectRoot, targetForSkill(skill.path, projectRoot), {
            [skill.id]: "deny"
          });
        }
        setOpError(undefined);
        bumpTree();
      } catch (error) {
        reportError(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \xAB${skill.name ?? skill.id}\xBB: ${errorMessage(error)}`);
      }
    };
    const openSkillMenu = (skill) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(MenuDialog, {
        ctx,
        get title() {
          return skill.name ?? skill.id;
        },
        get options() {
          return [{
            label: "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
            value: "copy"
          }, {
            label: skill.enabled ? "\u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A" : "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0432\u044B\u043A",
            value: "toggle",
            hint: "\u041B\u041A\u041C"
          }, {
            label: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C SKILL.md",
            value: "preview"
          }, {
            label: "\u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0432 \u043D\u0430\u0431\u043E\u0440\u2026",
            value: "assign"
          }];
        },
        onSelect: (value) => {
          ctx.ui.dialog.clear();
          if (value === "copy")
            copyToClipboard(skill.name ?? skill.id);
          else if (value === "toggle")
            setTimeout(() => void toggleSkill(skill), 0);
          else if (value === "preview")
            setTimeout(() => openSkillPreview(skill, currentLocation()), 0);
          else if (value === "assign")
            setTimeout(() => void assignSkill(skill), 0);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    const openSetMenu = (set) => {
      if (disposed)
        return;
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(MenuDialog, {
        ctx,
        get title() {
          return set.name;
        },
        get options() {
          return [{
            label: set.disabled ? "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440" : "\u0412\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043D\u0430\u0431\u043E\u0440",
            value: "toggle"
          }, {
            label: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C",
            value: "rename"
          }, {
            label: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
            value: "delete",
            danger: true
          }, {
            label: "\u041D\u043E\u0432\u044B\u0439 \u043D\u0430\u0431\u043E\u0440\u2026",
            value: "create"
          }];
        },
        onSelect: (value) => {
          ctx.ui.dialog.clear();
          if (value === "toggle")
            setTimeout(() => void toggleSet(set), 0);
          else if (value === "rename")
            setTimeout(() => void renameSet(set), 0);
          else if (value === "delete")
            setTimeout(() => void deleteSet(set), 0);
          else if (value === "create")
            setTimeout(() => void openCreateSet(), 0);
        },
        onClose: () => ctx.ui.dialog.clear()
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    const insertSkill = (skill, location) => {
      if (disposed)
        return;
      const registered = ctx.data.location.skill.list(location);
      const index = registered?.findIndex((entry) => entry.id === skill.id) ?? -1;
      const warn = (message) => ctx.ui.toast.show({
        title: "Skills",
        variant: "warning",
        message
      });
      if (!registered || index < 0)
        return warn("Skill is no longer registered");
      const ids = registered.map((entry) => entry.id);
      const route = JSON.stringify(ctx.ui.router.current());
      stopNativeSelection?.();
      let prompt;
      let active = true;
      let releaseFrame;
      const gate = new Promise((resolve) => {
        releaseFrame = resolve;
      });
      const beforeFrame = () => gate;
      const ready = () => {
        if (!active || disposed)
          return;
        const currentRoute = ctx.ui.router.current();
        const currentLocation = currentRoute.type === "session" ? ctx.data.session.get(currentRoute.sessionID)?.location : ctx.location ?? ctx.data.location.default();
        if (JSON.stringify(currentRoute) !== route || !currentLocation || locationKey(currentLocation) !== locationKey(location)) {
          stopNativeSelection?.();
          return warn("Session changed; try again");
        }
        const editor = ctx.renderer.currentFocusedEditor;
        if (!prompt) {
          const traits = editor?.traits;
          if (traits?.owner !== "opencode" || traits.role !== "prompt")
            return;
          if (traits.status === "SHELL") {
            stopNativeSelection?.();
            return warn("Prompt busy; try again");
          }
          if (!ctx.keymap.commands().some((command) => command.id === "prompt.skills"))
            return;
          prompt = editor;
          ctx.renderer.setFrameCallback(beforeFrame);
          ctx.keymap.dispatch("prompt.skills");
          return;
        }
        if (editor === prompt) {
          stopNativeSelection?.();
          return;
        }
        if (!(editor instanceof InputRenderable) || editor.traits.status !== "FILTER")
          return;
        stopNativeSelection?.();
        const current = ctx.data.location.skill.list(location);
        if (disposed || prompt.isDestroyed || !current || current.length !== ids.length || current.some((entry, i) => entry.id !== ids[i])) {
          if (!disposed)
            warn("Skills changed; pick the skill again");
          return;
        }
        ctx.keymap.dispatch("dialog.select.home");
        for (let i = 0;i < index; i++)
          ctx.keymap.dispatch("dialog.select.next");
        ctx.keymap.dispatch("dialog.select.submit");
      };
      const timer = setTimeout(() => {
        stopNativeSelection?.();
        if (!disposed)
          warn("Skill picker unavailable; close and try again");
      }, 5000);
      stopNativeSelection = () => {
        active = false;
        clearTimeout(timer);
        ctx.renderer.off(CliRenderEvents3.FOCUSED_EDITOR, ready);
        ctx.renderer.removeFrameCallback(beforeFrame);
        releaseFrame();
        stopNativeSelection = undefined;
      };
      ctx.renderer.on(CliRenderEvents3.FOCUSED_EDITOR, ready);
      ctx.ui.dialog.clear();
      queueMicrotask(ready);
    };
    const openSettings = () => {
      if (disposed)
        return;
      stopNativeSelection?.();
      ctx.renderer.clearSelection();
      ctx.ui.dialog.show(() => _$createComponent4(SkillsDialog, {
        ctx,
        settings,
        onChange: changeSettings
      }));
      ctx.ui.dialog.set({
        size: "medium",
        centered: true
      });
    };
    ctx.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "opencode.dazhdbog.settings",
        title: "Skills Manager",
        description: "\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432",
        group: "Skills",
        palette: true,
        slash: {
          name: "skills-manager"
        },
        run: openSettings
      }, {
        id: "opencode.skills-manager.new-set",
        title: "\u041D\u043E\u0432\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u043D\u0430\u0432\u044B\u043A\u043E\u0432",
        description: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0430\u0431\u043E\u0440 \u0438 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0432 \u043D\u0435\u0433\u043E \u043D\u0430\u0432\u044B\u043A\u0438",
        group: "Skills",
        palette: true,
        slash: {
          name: "skills-set"
        },
        run: () => void openCreateSet()
      }]
    }));
    const unregisterSlot = ctx.ui.slot({
      append: "sidebar.content",
      render: (input) => {
        const session = createMemo2(() => ctx.data.session.get(input.sessionID));
        try {
          const loc = input.sessionID ? session()?.location : undefined;
          const probeLoc = loc ?? ctx.location ?? ctx.data.location.default();
          const list = ctx.data.location.skill.list(probeLoc);
          writeTextFileAtomic(join9(probeLoc.directory, ".opencode", ".control-panel", "tui-probe.json"), JSON.stringify({
            build: BUILD_TAG,
            time: Date.now(),
            sessionID: input.sessionID,
            directory: probeLoc.directory,
            skillsCount: list === undefined ? null : list.length,
            skillIds: list === undefined ? null : list.map((s) => s.id)
          }, null, 2));
        } catch {}
        const location = createMemo2(() => session()?.location ?? ctx.location ?? ctx.data.location.default());
        createEffect3(() => {
          const current = session()?.location;
          if (!current || disposed)
            return;
          refreshSkills({
            directory: current.directory
          });
        });
        const panel = createMemo2(() => registeredView(location(), loadedBySession().get(input.sessionID) ?? EMPTY_LOADED_SKILLS));
        const tree = createMemo2(() => buildTree(location(), panel(), collapseMap()));
        const tools = createMemo2(() => buildTools(location(), collapseMap()));
        const plugins = createMemo2(() => buildPlugins(location(), collapseMap()));
        const mcp = createMemo2(() => buildMcp(location(), collapseMap()));
        createEffect3(() => {
          const token = settings().token;
          if (disposed || settings().switch !== "on" || token !== "load-delta" && token !== "loaded-total")
            return;
          for (const skill of panel().skills)
            ensureFileSamples(skill, location());
        });
        createEffect3(() => {
          applyLoads(input.sessionID, extractSkillLoadState(ctx.data.session.message.list(input.sessionID)));
          ensureBackfill(input.sessionID);
          scanSessionToolCalls(input.sessionID, currentLocation().directory);
        });
        return _$createComponent4(Show4, {
          get when() {
            return settings().switch === "on";
          },
          get children() {
            return _$createComponent4(SkillsManagerPanel, {
              tree,
              tools,
              plugins,
              mcp,
              loadedIDs: () => loadedBySession().get(input.sessionID) ?? EMPTY_LOADED_SKILLS,
              tokenMode: () => settings().token,
              showState: () => settings().state === "on",
              collapsedMap: collapseMap,
              emptyMessage: () => panel().emptyMessage,
              error: opError,
              theme: () => ctx.theme,
              themeMode: () => ctx.themeMode,
              onToggleNode: toggleNode,
              onToggleSkill: (skill) => void toggleSkill(skill),
              onToggleUnassigned: (skills) => void toggleUnassignedAll(skills),
              onSkillMenu: openSkillMenu,
              onSkillMention: (skill) => insertSkill(skill, location()),
              onToggleSet: (set) => void toggleSet(set),
              onSetMenu: openSetMenu,
              onCreateSet: () => void openCreateSet(),
              onAssignSkill: (skill) => void assignSkill(skill),
              onToggleTool: (tool) => void toggleTool(tool),
              onTogglePlugin: (plugin) => void togglePlugin(plugin),
              onToggleServer: (server) => void toggleServer(server),
              onMcpGroupCreate: () => void createMcpGroup(),
              onMcpGroupToggle: (group) => void toggleMcpGroup(group),
              onMcpGroupMenu: openMcpGroupMenu,
              onMcpServerMenu: openMcpServerMenu,
              onToolsGroupCreate: () => void createItemGroup("tools"),
              onToolsGroupToggle: (group) => void toggleItemGroup("tools", group.label),
              onToolsGroupMenu: (group) => openItemGroupMenu("tools", group.label),
              onToolMenu: (tool) => openItemMenu("tools", tool.name),
              onPluginsGroupCreate: () => void createItemGroup("plugins"),
              onPluginsGroupToggle: (plugin) => {
                const label = plugin.id.startsWith("__group__") ? plugin.id.slice(9) : plugin.label;
                toggleItemGroup("plugins", label);
              },
              onPluginsGroupMenu: (plugin) => {
                const label = plugin.id.startsWith("__group__") ? plugin.id.slice(9) : plugin.label;
                openItemGroupMenu("plugins", label);
              },
              onPluginMenu: (plugin) => openItemMenu("plugins", plugin.id),
              onShowDesc: openDesc,
              getRu: (key, fallback) => readRuCached(currentLocation().directory)[key] ?? fallback,
              usageSkills: () => readUsageCached(currentLocation().directory).skills,
              usageTools: () => Object.fromEntries(rootToolCounts.get(currentLocation().directory) ?? new Map),
              presets: () => {
                const root = currentLocation().directory;
                const activeName = readActivePresetCached(root);
                const current = activeName ? collectCurrentPresetState(root) : undefined;
                return Object.entries(readPresetsCached(root).presets).map(([name, st]) => ({
                  name,
                  tokens: estimatePresetTokens(st),
                  active: name === activeName,
                  dirty: !!current && name === activeName && !presetEquals(current, st)
                }));
              },
              onCreatePreset: () => void createPreset(),
              onApplyPreset: (name) => void applyPreset(name),
              onPresetMenu: openPresetMenu,
              onFullRestart: () => void fullRestart()
            });
          }
        });
      }
    });
    return () => {
      disposed = true;
      stopNativeSelection?.();
      if (initialRefreshTimer !== undefined)
        clearTimeout(initialRefreshTimer);
      for (const controller of backfilling.values())
        controller.abort();
      backfilling.clear();
      for (const controller of sampling.values())
        controller.abort();
      sampling.clear();
      unregisterSlot();
      unregisterSkillUpdated();
      unregisterProjectUpdated();
      unregisterSkillActivated();
      unregisterToolUsage();
      unregisterSessionDeleted();
      unregisterCompactionEnded();
    };
  }
});
export {
  tui_default as default
};
