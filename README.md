# software-engineering

**Coding Agent 原生的软件工程生命周期技能（SDLC Skill for AI Coding Agents）**

把"发起一个软件项目"变成一条可审计的流水线：**立项 → 需求 → 架构 → 计划 → 执行 → 验收 → 发布**。文档先行、每道门禁由人确认、状态机 + 机械校验保证执行不走样、子代理流水线负责生产。

> 传统软件工程为"人岗协作"设计：记忆在团队脑子里，沟通靠开会。当开发与验证由 AI Agent 完成时，前提变了——Agent 是零记忆的、靠上下文工作的、会漂移的。本技能保留经典软件工程的门禁、文档先行、需求追踪思想，把执行层整体改造为 **控制器（主会话）+ 子代理（生产）** 的编排模式。

## 生命周期

```
G0 立项 ──> G1 需求 ──> G2 架构 ──> G3 计划 ──> EXEC 执行(开发⇄测试) ──> G4 验收 ──> G5 发布
PROJECT.md  REQUIREMENTS  ARCHITECTURE  PLAN.md   控制器+子代理生产       TEST-REPORT   RELEASE.md
        全程由 docs/pipeline.json 记录状态，scripts/check_gate.mjs 机械校验
```

## 三层保证（为什么每次执行都一样）

| 层 | 机制 | 防什么 |
|---|---|---|
| 门禁层 | 每阶段产出文档 → **质量归代理（gate-reviewer 初审）、方向归人（决策卡 ≤10 行）**；确认按决策包打包：完整档 3 包、轻量档 2 次 | 方向跑偏、需求变形、人工确认疲劳 |
| 状态层 | `docs/pipeline.json` 是唯一真源：聊天记忆不算确认记录，确认即刻落账；跨会话冷启动三件套接手 | 遗忘漂移、重复劳动 |
| 机械层 | `check_gate.mjs` 校验门禁顺序、文档必备小节、FR 块完整性（描述+优先级+AC-x.y 验收标准）、G4 对每条 AC 的追溯 | 结构走样、验收蒙混 |

## Agent 编排（执行层）

五类角色提示词模板随技能出厂（`assets/agents/`），首次执行一键物化到项目 `.agents/`：

| 角色 | 职责 |
|---|---|
| `implementer` | 实现：先失败测试再实现（TDD）、YAGNI、全量套件绿 |
| `spec-reviewer` | 需求符合评审：不信自述、逐条对照 AC、缺失/多余/误解 |
| `quality-reviewer` | 质量评审：BASE..HEAD 只读 diff、严重度校准、搁置清单 |
| `gate-reviewer` | 门禁审核：文档提交给人之前的四层初审（完整性/一致性/质量/决策提炼），人只看决策卡 |
| `explorer` | 代码勘察：brownfield 项目先摸现状，只回结论 |

硬纪律：主会话是控制器**不写业务代码**；子代理默认零记忆（任务卡自包含到接口签名）；**验证不信自述**（每任务可执行验证命令，控制器亲自跑绿）；同一任务连败 2 次升级用户。

## 工程纪律（吸收自 superpowers 等成熟实践）

- **先证据后断言**：宣称"完成/通过"必须有本次新跑的命令输出为据
- **TDD 红绿循环**：没看过失败的测试不许写实现；全量绿才算绿
- **需求追踪矩阵**：每条 AC 在测试报告中必须有"编号+结果"行，缺一条校验器就过不了
- **任务卡制计划**：精确文件路径 + Interfaces 精确签名 + 全局约束逐字继承 + 评审盲区清单 + 计划自检四项
- **根因先行**：修 bug 先读错误全文/稳定复现/查最近变更，禁止猜着改
- **基线验证**：开工前全量测试基线绿，脏基线让一切失败变得模糊
- **Git 隔离与远端**：feature 分支默认、git worktree 可选、收尾整合菜单（本地合并/建 PR/保留），push 与发布永远经用户确认

## 快速开始

技能目录兼容 ZCode / Claude Code 等的 skills 机制，复制到对应技能目录即可：

```bash
# 通用（跨工具共享）
cp -r software-engineering ~/.agents/skills/
# 或 Claude Code
cp -r software-engineering ~/.claude/skills/
```

对 Agent 说 **"做个项目 / 立项"** 即可触发；小修小改不会误触发（内置分档：单点修复不进流程，小工具走轻量档 2 次确认，多模块系统走完整档）。

三个脚本（Node ≥ 18，零依赖）：

```bash
node scripts/check_gate.mjs <项目根>        # 门禁机械校验（每次提交确认与标记确认时跑）
node scripts/selftest.mjs                   # 校验器自测（9 用例，改动校验规则后必跑）
node scripts/scaffold_agents.mjs <项目根>   # 把 4 份角色模板物化到 <项目根>/.agents/
```

## 目录结构

```
software-engineering/
├── SKILL.md                      # 主流程：生命周期、门禁、分档、铁律
├── references/
│   ├── templates.md              # 各门禁文档 + pipeline.json + 项目 AGENTS.md 模板
│   └── agent-protocol.md         # Agent 编排协议：上下文纪律、派发循环、隔离与整合
├── assets/agents/                # 五类角色提示词模板（出厂正本）
│   ├── implementer.md
│   ├── spec-reviewer.md
│   ├── quality-reviewer.md
│   ├── gate-reviewer.md
│   └── explorer.md
└── scripts/
    ├── check_gate.mjs            # 门禁机械校验器
    ├── selftest.mjs              # 校验器自测
    └── scaffold_agents.mjs       # 角色模板物化脚手架
```

## 设计原则

1. **保留思想，更换载体**：门禁、文档先行、需求追踪这些经典思想不变；"岗位协作"换成"控制器 + 子代理编排"。
2. **LLM 会漂移，文件状态与机械校验不会**：流程状态落文件，结构检查交给脚本，人的确认保留在每道门禁。
3. **分档防官僚化**：修 bug 不进流程、小工具两次确认、大系统全套文档——流程强度与项目规模匹配。
4. **人机边界清晰**：AI 提案、人拍板。需求/架构/计划的确认、需求变更的批准、整合与发布，永远归人。

## License

[MIT](LICENSE)
