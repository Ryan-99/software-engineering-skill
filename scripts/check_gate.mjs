#!/usr/bin/env node
// SDLC 门禁机械校验器
// 用法: node check_gate.mjs <project-root>
// 退出码: 0=通过  1=存在违规  2=状态文件缺失/损坏
// 校验内容: pipeline.json 结构与门禁顺序 / 已到门禁的文档存在性与必备小节 /
//          需求 FR 块完整性(描述+优先级+AC) / G4 验收对 AC 的逐条追溯
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [root] = process.argv.slice(2);
if (!root) { console.error('用法: node check_gate.mjs <project-root>'); process.exit(2); }
const rootAbs = resolve(root);

const TIERS = {
  light: ['GB', 'GD', 'G4', 'G5'],
  full:  ['G0', 'G1', 'G2', 'G3', 'EXEC', 'G4', 'G5'],
};
const GATE_DEFS = {
  G0:   { name: '立项', doc: 'docs/PROJECT.md',      headers: ['背景', '范围', '成功标准', '风险'] },
  G1:   { name: '需求', doc: 'docs/REQUIREMENTS.md', headers: ['功能需求', '非功能需求'], reqs: true },
  G2:   { name: '架构', doc: 'docs/ARCHITECTURE.md', headers: ['选型', '模块', '数据模型'] },
  G3:   { name: '计划', doc: 'docs/PLAN.md',         headers: ['任务分解', '测试策略'] },
  GB:   { name: '简报', doc: 'docs/BRIEF.md',        headers: ['背景', '范围', '成功标准', '需求清单'], reqs: true },
  GD:   { name: '设计', doc: 'docs/DESIGN.md',       headers: ['选型', '任务分解', '测试策略'] },
  EXEC: { name: '执行', doc: null, headers: [] },
  G4:   { name: '验收', doc: 'docs/TEST-REPORT.md',  headers: ['验收核验', '质量门禁', '缺陷'], coverage: true },
  G5:   { name: '发布', doc: 'docs/RELEASE.md',      headers: ['变更清单', '回滚'] },
};
const STATUSES = ['pending', 'draft', 'in-review', 'confirmed', 'bypassed'];

const violations = [];
const bad = (msg) => violations.push(msg);

// ---------- 状态文件 ----------
const statePath = join(rootAbs, 'docs', 'pipeline.json');
if (!existsSync(statePath)) {
  console.error(`✗ 缺少状态文件 ${statePath}`);
  console.error('  请按技能模板创建 docs/pipeline.json 后重试。');
  process.exit(2);
}
let state;
try { state = JSON.parse(readFileSync(statePath, 'utf8')); }
catch (e) { console.error(`✗ pipeline.json 无法解析: ${e.message}`); process.exit(2); }

if (!state.project || typeof state.project !== 'string') bad('pipeline.json: project 缺失或为空');
if (!TIERS[state.tier]) bad(`pipeline.json: tier 必须是 light|full，当前 "${state.tier}"`);
if (!Array.isArray(state.gates)) { console.error('✗ pipeline.json: gates 必须是数组'); process.exit(2); }

const expectIds = TIERS[state.tier];
const actualIds = state.gates.map((g) => g.id);
if (JSON.stringify(actualIds) !== JSON.stringify(expectIds)) {
  console.error(`✗ pipeline.json: tier=${state.tier} 的门禁应为 [${expectIds.join(', ')}]，实际 [${actualIds.join(', ')}]`);
  process.exit(2);
}
for (const g of state.gates) {
  if (!STATUSES.includes(g.status)) { console.error(`✗ pipeline.json: ${g.id} 非法状态 "${g.status}"`); process.exit(2); }
}
if (Array.isArray(state.changes)) {
  state.changes.forEach((c, i) => {
    if (!c.date || !c.gate || !c.summary) bad(`changes[${i}]: 需含 date/gate/summary`);
  });
}

// ---------- 门禁顺序 ----------
const SATISFIED = ['confirmed', 'bypassed'];
const REACHED = ['draft', 'in-review', 'confirmed', 'bypassed'];
for (let i = 1; i < state.gates.length; i++) {
  const cur = state.gates[i], prev = state.gates[i - 1];
  if (REACHED.includes(cur.status) && !SATISFIED.includes(prev.status)) {
    bad(`门禁顺序: ${cur.id}(${cur.status}) 不应先于 ${prev.id}(${prev.status})`);
  }
}

// ---------- 逐门禁文档检查 ----------
const readDoc = (rel) => {
  const p = join(rootAbs, rel);
  if (!existsSync(p)) { bad(`文档缺失: ${rel}（${p}）`); return null; }
  try { return readFileSync(p, 'utf8'); }
  catch (e) { bad(`文档不可读: ${rel}: ${e.message}`); return null; }
};

for (const g of state.gates) {
  const def = GATE_DEFS[g.id];
  if (g.status === 'bypassed' && !g.reason) bad(`${g.id}: bypassed 必须写明 reason`);
  if (g.status === 'confirmed' && !/^\d{4}-\d{2}-\d{2}$/.test(g.confirmed_at || '')) {
    bad(`${g.id}: confirmed 需记录 confirmed_at(YYYY-MM-DD)`);
  }
  if (g.status === 'pending' || !def.doc) continue;
  const text = readDoc(def.doc);
  if (!text) continue;
  for (const h of def.headers) {
    if (!text.includes(h)) bad(`${g.id} ${def.doc}: 缺必备小节「${h}」`);
  }
}

// ---------- 需求 FR 块完整性 ----------
function collectACs(text, source) {
  const lines = text.split(/\r?\n/);
  const acs = [];               // { id, fr }
  let cur = null, buf = null;
  const flush = () => {
    if (!buf) return;
    const body = buf.join('\n');
    const fr = cur;
    if (!/\r?\n?\s*-\s*描述[:：]\s*\S/.test(body)) bad(`${source}: ${fr} 缺「描述」`);
    const prio = body.match(/优先级[:：]\s*(必须|应该|可以|暂不)/);
    if (!prio) bad(`${source}: ${fr} 缺「优先级」(必须/应该/可以/暂不)`);
    const ids = [...body.matchAll(/AC-\d+\.\d+/g)].map((m) => m[0]);
    if (ids.length === 0) bad(`${source}: ${fr} 缺验收标准(至少一条 AC-x.y)`);
    for (const id of ids) acs.push({ id, fr });
    buf = null;
  };
  for (const line of lines) {
    const h = line.match(/^#+\s*(FR-\d+)/i);
    if (h) { flush(); cur = h[1]; buf = [line]; }
    else if (buf && /^#+\s/.test(line)) flush();
    else if (buf) buf.push(line);
  }
  flush();
  return acs;
}

let acs = [];
const reqsGate = state.gates.find((g) => GATE_DEFS[g.id].reqs);
if (reqsGate && reqsGate.status !== 'pending' && !violations.some((v) => v.includes(GATE_DEFS[reqsGate.id].doc + ': 缺必备'))) {
  const text = readDoc(GATE_DEFS[reqsGate.id].doc);
  if (text) {
    acs = collectACs(text, GATE_DEFS[reqsGate.id].doc);
    if (!/^#+\s*FR-\d+/im.test(text)) bad(`${GATE_DEFS[reqsGate.id].doc}: 未发现任何 FR-n 需求条目`);
  }
}

// ---------- G4 验收追溯 ----------
const g4 = state.gates.find((g) => g.id === 'G4');
if (g4 && g4.status !== 'pending' && acs.length > 0) {
  const text = readDoc(GATE_DEFS.G4.doc);
  if (text) {
    const lines = text.split(/\r?\n/);
    for (const { id, fr } of acs) {
      const hit = lines.find((l) => l.includes(id) && l.includes('通过'));
      if (!hit) bad(`G4 追溯缺口: ${fr} 的 ${id} 在 TEST-REPORT 中无「结果」行(须含 AC 编号+通过/不通过)`);
    }
  }
}

// ---------- 汇总 ----------
const confirmed = state.gates.filter((g) => g.status === 'confirmed').length;
if (violations.length === 0) {
  console.log(`✓ 门禁校验通过  project=${state.project} tier=${state.tier} 确认 ${confirmed}/${state.gates.length}`);
  process.exit(0);
} else {
  console.log(`✗ ${violations.length} 项违规:`);
  for (const v of violations) console.log('  ✗ ' + v);
  process.exit(1);
}
