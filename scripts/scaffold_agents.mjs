#!/usr/bin/env node
// 把 Agent 出厂配置物化到项目：<project>/.agents/
// 用法: node scaffold_agents.mjs <project-root>
// 幂等：目标已存在则跳过不覆盖。退出码 0=成功 1=用法错误 2=源缺失
import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [root] = process.argv.slice(2);
if (!root) { console.error('用法: node scaffold_agents.mjs <project-root>'); process.exit(1); }
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'assets', 'agents');
if (!existsSync(src)) { console.error(`✗ 源目录缺失: ${src}`); process.exit(2); }

const dest = join(resolve(root), '.agents');
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.md'));
let created = 0, skipped = 0;
for (const f of files) {
  const target = join(dest, f);
  if (existsSync(target)) { skipped++; console.log(`  = 已存在，跳过 ${f}`); continue; }
  copyFileSync(join(src, f), target);
  created++;
  console.log(`  + 创建 ${f}`);
}
console.log(`✓ Agent 配置就绪：${dest}（新建 ${created}，跳过 ${skipped}）`);
console.log('下一步：控制器逐份裁剪占位符【】（贴入本项目技术栈/命令/约定），之后按模板派发子代理。');
