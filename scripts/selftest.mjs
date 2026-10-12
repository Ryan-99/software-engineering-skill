#!/usr/bin/env node
// check_gate.mjs 自测：构建临时夹具项目，跑校验器断言退出码与关键输出
// 用法: node selftest.mjs   （全部通过退出 0）
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const checker = join(here, 'check_gate.mjs');
const dirs = [];
const fixture = (name) => {
  const dir = mkdtempSync(join(tmpdir(), 'sdlc-' + name + '-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  dirs.push(dir);
  return dir;
};
const w = (dir, rel, text) => writeFileSync(join(dir, rel), text, 'utf8');
const run = (dir) => spawnSync(process.execPath, [checker, dir], { encoding: 'utf8' });

let failed = 0;
const expect = (name, cond, detail) => {
  if (cond) console.log('PASS ' + name);
  else { failed++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

const PIPE = (tier, gates, extra = {}) =>
  JSON.stringify({ project: 'demo', tier, gates, changes: [], bypass: [], ...extra }, null, 2);

const REQUIREMENTS_OK = `# 需求规格
## 功能需求
### FR-1 登录
- 描述：用户可用账号密码登录
- 优先级：必须
- 验收标准：
  - AC-1.1 正确凭据登录后进入首页
  - AC-1.2 错误密码提示错误且不进入

### FR-2 导出
- 描述：列表可导出 CSV
- 优先级：应该
- 验收标准：AC-2.1 点击导出得到含全部行的 CSV

## 非功能需求
无特殊要求
`;
const REQUIREMENTS_BAD = REQUIREMENTS_OK + '\n### FR-3 打印\n- 描述：可打印\n';
const TESTREPORT_OK = `# 测试与验收报告
## 验收核验
| 验收标准 | 结果 | 证据 |
|---|---|---|
| AC-1.1 正确凭据登录后进入首页 | 通过 | t1 |
| AC-1.2 错误密码提示错误且不进入 | 通过 | t2 |
| AC-2.1 点击导出得到含全部行的 CSV | 通过 | t3 |
## 质量门禁
typecheck 通过
## 缺陷表
无
`;
const TESTREPORT_BAD = TESTREPORT_OK.replace(/\| AC-2\.1[^\n]*\n/, '');
const PROJECT = '# 立项书\n## 背景与目标\n做登录导出。\n## 范围与非目标\n只做 Web。\n## 成功标准\n登录导出可用。\n## 风险清单\n低。\n';
const ARCH = '# 架构\n## 技术选型（ADR）\nReact。\n## 模块划分\n两个模块。\n## 数据模型\n单表。\n';
const PLAN = '# 计划\n## 任务分解\nT1 登录\n## 测试策略\n单测+E2E\n';
const BRIEF = `# 项目简报
## 背景与目标
小工具。
## 范围
做：转换。不做：批量。
## 成功标准
转换正确。
## 需求清单
### FR-1 转换
- 描述：A 转 B
- 优先级：必须
- 验收标准：AC-1.1 输出 B 内容正确
`;
const DESIGN = '# 设计\n## 技术选型\nNode。\n## 任务分解\nT1。\n## 测试策略\n单测。\n';
const RELEASE = '# 发布\n## 变更清单\n初版。\n## 回滚方式\n还原备份。\n';
const STATE_FULL_OK = PIPE('full', [
  { id: 'G0', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G1', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G2', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G3', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'EXEC', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G4', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G5', status: 'pending' },
]);
const STATE_LIGHT_OK = PIPE('light', [
  { id: 'GB', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'GD', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G4', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G5', status: 'pending' },
]);
const STATE_BAD = PIPE('full', [
  { id: 'G0', status: 'draft' },
  { id: 'G1', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G2', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G3', status: 'pending' },
  { id: 'EXEC', status: 'pending' },
  { id: 'G4', status: 'confirmed', confirmed_at: '2026-10-12' },
  { id: 'G5', status: 'pending' },
]);

// 用例 1：完整档全绿 → 0
{
  const d = fixture('full-ok');
  for (const [rel, text] of [['docs/PROJECT.md', PROJECT], ['docs/REQUIREMENTS.md', REQUIREMENTS_OK],
    ['docs/ARCHITECTURE.md', ARCH], ['docs/PLAN.md', PLAN], ['docs/TEST-REPORT.md', TESTREPORT_OK]]) w(d, rel, text);
  w(d, 'docs/pipeline.json', STATE_FULL_OK);
  const r = run(d);
  expect('full-ok 退出码 0', r.status === 0, `实际 ${r.status}\n${r.stdout}${r.stderr}`);
}
// 用例 2：轻量档全绿 → 0
{
  const d = fixture('light-ok');
  for (const [rel, text] of [['docs/BRIEF.md', BRIEF], ['docs/DESIGN.md', DESIGN],
    ['docs/TEST-REPORT.md', TESTREPORT_OK.replace('AC-2.1', 'AC-1.1').replace(/AC-1\.2[^\n]*\n/, '')]]) w(d, rel, text);
  w(d, 'docs/pipeline.json', STATE_LIGHT_OK);
  const r = run(d);
  expect('light-ok 退出码 0', r.status === 0, `实际 ${r.status}\n${r.stdout}${r.stderr}`);
}
// 用例 3：违规齐发 → 1 且逐条点名
{
  const d = fixture('full-bad');
  for (const [rel, text] of [['docs/REQUIREMENTS.md', REQUIREMENTS_BAD], ['docs/ARCHITECTURE.md', ARCH],
    ['docs/TEST-REPORT.md', TESTREPORT_BAD]]) w(d, rel, text);
  w(d, 'docs/pipeline.json', STATE_BAD);
  const r = run(d);
  const out = (r.stdout || '') + (r.stderr || '');
  expect('full-bad 退出码 1', r.status === 1, `实际 ${r.status}\n${out}`);
  expect('full-bad 点名门禁顺序', out.includes('门禁顺序') && out.includes('G1'), out);
  expect('full-bad 点名 FR-2 缺 AC', out.includes('FR-2'), out);
  expect('full-bad 点名 FR-3 缺优先级', out.includes('FR-3'), out);
  expect('full-bad 点名 AC-2.1 追溯缺口', out.includes('AC-2.1'), out);
}
// 用例 4：缺状态文件 → 2
{
  const d = fixture('no-state');
  const r = run(d);
  expect('no-state 退出码 2', r.status === 2, `实际 ${r.status}\n${r.stdout}${r.stderr}`);
}
// 用例 5：bypassed 必须带理由
{
  const d = fixture('bypass');
  w(d, 'docs/BRIEF.md', BRIEF);
  w(d, 'docs/DESIGN.md', DESIGN);
  w(d, 'docs/TEST-REPORT.md', TESTREPORT_OK.replace('AC-2.1', 'AC-1.1').replace(/AC-1\.2[^\n]*\n/, ''));
  w(d, 'docs/pipeline.json', PIPE('light', [
    { id: 'GB', status: 'confirmed', confirmed_at: '2026-10-12' },
    { id: 'GD', status: 'bypassed' },
    { id: 'G4', status: 'confirmed', confirmed_at: '2026-10-12' },
    { id: 'G5', status: 'pending' },
  ]));
  const r = run(d);
  expect('bypass 无理由 → 1', r.status === 1 && (r.stdout || '').includes('reason'), `${r.status}\n${r.stdout}${r.stderr}`);
}

for (const d of dirs) rmSync(d, { recursive: true, force: true });
console.log(failed === 0 ? '\n全部自测通过' : `\n${failed} 项自测失败`);
process.exit(failed === 0 ? 0 : 1);
