# Local-model screening strategy

The goal is to find locally hosted models reliable enough for specific roles. A coding-benchmark score is not equivalent to trust.

## Sequence

1. Finish the existing Aragorn coding benchmark by screening the remaining downloaded local models once. Repeat only a model that completes the full task and follows all instructions.
2. Preserve the current methodology, configuration, protocol, and reproducibility records. Score correctness separately from instruction violations, attempted forbidden actions, tool errors, stopping, and reporting.
3. Avoid substantial tuning of failed models and alternate harness integrations during this initial screen.
4. After the initial screen, study established benchmark data, evaluation, and tooling. Use useful ideas to improve `model-tests` lightly rather than replace its framework.
5. Then plan and create a narrow, read-only Legolas benchmark agent for codebase exploration and research. Use reproducible tasks over known repositories with seeded or independently verified findings. Measure coverage, accuracy, false positives, instruction compliance, and tool use.
6. Defer minimal-context OpenCode agents, prompt/tool-schema reduction, experiments on weight quantization and KV-cache settings, and Pi integration unless results justify them.

The remaining inventory is not yet complete. It may include unrun Qwen Base/Swift models and the three newly registered profiles. The three new profiles are not proof that every downloaded model has been screened. Devstral API-03 remains skipped, not a repeat of a failed Devstral trial. Further screening needs a new plan/session and its own operator/runtime gates; this archive does not authorize another run.

## User-supplied resources, not yet reviewed

These links and descriptions were supplied by the user. The cited material has not been independently evaluated, and no benchmark or dataset has been selected for adoption.

- [OctoBench paper](https://aclanthology.org/2026.acl-long.269/): described by the user as repository-grounded, scaffold-aware instruction-compliance work.
- [MiniMax repository](https://github.com/MiniMax-AI/mini-vela)
- [OctoBench dataset](https://huggingface.co/datasets/MiniMaxAI/OctoBench)
- [AgentIF](https://agentif.github.io/): described by the user as instruction following with tool and conditional constraints.
- [MTAC-IFBench](https://arxiv.org/abs/2609.14992): described by the user as multi-turn agentic coding instruction following.
