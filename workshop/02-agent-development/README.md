# Module 02: Agent Development

| | |
|---|---|
| **Duration** | 70 minutes (+15 min extension) |
| **Prerequisites** | Module 05 complete (dashboards deployed), sample-app running locally, Python 3.11+ installed |
| **Learning Objective** | Build, connect, and orchestrate AI agents using Strands SDK, MCP, and AgentCore |

---

## Instructor Facilitation Guide

### Timing Overview

| Time | Activity |
|------|----------|
| 0-10 min | Lecture: Agent architecture concepts |
| 10-30 min | Exercise 1: Build your first agent |
| 30-50 min | Exercise 2: MCP tool server |
| 50-65 min | Exercise 3: Multi-agent orchestration |
| 65-70 min | Wrap-up |
| 70-85 min | Extension Exercise 4: Deploy to AgentCore |

---

### [0-10 min] Agent Architecture: From LLM Calls to Autonomous Agents

> **Instructor Note:** This module is where everything clicks. Participants have spent the workshop building specs, metrics pipelines, eval gates, and dashboards. Now they see how agents tie it all together -- an agent that writes code, calls tools, and emits the same metrics they've been instrumenting. Start with the "why" before the "how."

**Key talking points:**

1. **The gap between "chat with an LLM" and "agent that gets things done."** A raw LLM call is stateless -- you send a prompt, get a response, done. An agent adds a tool-use loop: the model can call tools, observe results, and decide what to do next. This is the difference between asking someone a question and giving someone a job.

2. **The Strands SDK agent loop.** Strands is an open-source Python SDK for building agents on Bedrock. The core loop is simple:

   ```
   User prompt
     -> Model reasons about what to do
       -> Model calls a tool (or multiple tools)
         -> Tool returns a result
           -> Model reasons about the result
             -> Model calls another tool, or responds to the user
   ```

   This is the "agentic loop." The model decides when to use tools and when to stop. You define the tools; the model figures out the orchestration.

3. **MCP: Model Context Protocol.** MCP is an open standard for connecting agents to tool servers. Instead of hardcoding tool definitions in your agent, you point it at an MCP server and it auto-discovers available tools. This is powerful because:
   - Tools can be shared across agents (one MCP server, many consumers)
   - Tool definitions live with the service they wrap (the task API owns its MCP tools)
   - You can add/remove tools without redeploying the agent

4. **Agents-as-Tools: the composition pattern.** When one task is too complex for a single agent, you compose multiple agents. The Strands pattern is to wrap each agent as a `@tool` function, then create an orchestrator agent that calls them. The orchestrator sees "plan", "execute", and "review" as tools -- it doesn't know or care that they're other agents underneath.

5. **AgentCore: production deployment.** Building an agent locally is step one. Running it in production requires runtime management, memory persistence, API gateway, and observability. Amazon Bedrock AgentCore provides these as managed services. Think of it as "ECS for agents."

**Draw this on the whiteboard:**

```
                        +-------------------+
                        |   Orchestrator    |
                        |   (Strands Agent) |
                        +--------+----------+
                                 |
              +------------------+------------------+
              |                  |                  |
       +------+------+   +------+------+   +------+------+
       |   Planner   |   |   Executor  |   |   Reviewer  |
       |   (Agent)   |   |   (Agent)   |   |   (Agent)   |
       +------+------+   +------+------+   +------+------+
              |                  |                  |
              |           +-----+-----+            |
              |           | MCP Server|            |
              |           | (tools)   |            |
              |           +-----+-----+            |
              |                 |                   |
              +-----------------+-------------------+
                                |
                         +------+------+
                         |  Task API   |
                         +-------------+
```

---

### [10-30 min] Exercise 1: Build Your First Agent

Direct participants to `exercises/01-build-first-agent.md`.

They will:
1. Install Strands SDK and dependencies
2. Read the agent spec and understand the tool-use pattern
3. Create a task assistant agent with 5 tools
4. Test it with natural language prompts

> **Instructor Note:** Most participants will be surprised how little code it takes. The agent is ~30 lines. Spend time on the tool definitions -- the docstrings ARE the tool descriptions the model sees. Bad docstrings = bad tool selection. If anyone asks "how does the model know which tool to use?" -- point them at the docstrings and say "that's it, that's the interface."

**Common stumbling points:**
- Forgetting to start the sample-app first (`npm run dev` in sample-app/)
- AWS credentials not configured (use `--mock` flag for offline workshops)
- Python virtual environment not activated

---

### [30-50 min] Exercise 2: MCP Tool Server

Direct participants to `exercises/02-mcp-tool-server.md`.

They will:
1. Review the TypeScript MCP server code in `sample-app/src/mcp/`
2. Start the MCP server
3. Connect the Strands agent to it via MCP client
4. Observe tool auto-discovery

> **Instructor Note:** The key insight here is separation of concerns. In Exercise 1, the agent had tools hardcoded in Python. In Exercise 2, the tools live in the MCP server (TypeScript, same codebase as the API). The agent discovers them at runtime. Ask: "What happens if the API team adds a new endpoint tomorrow?" Answer: they add a tool to the MCP server, and every agent that connects to it gets the new capability automatically. No agent redeployment needed.

**Demo tip:** After everyone connects, add a temporary tool to the MCP server (like `get_task_count`) and have participants restart their MCP connection. They'll see the new tool appear without changing any Python code.

---

### [50-65 min] Exercise 3: Multi-Agent Orchestration

Direct participants to `exercises/03-multi-agent-pattern.md`.

They will:
1. Review the planner/executor/reviewer pattern
2. Run a complex scenario that requires multi-step coordination
3. Trace the agent interactions

> **Instructor Note:** This is the most conceptually dense exercise. The orchestrator is itself an agent with three tools -- but each tool is another agent. When participants see the trace (planner outputs a plan, executor runs it step by step, reviewer validates), the pattern clicks. Emphasize: the orchestrator didn't need to know HOW to plan or review. It just knew to call those tools in order. That's the power of agents-as-tools.

**If running short on time:** Have participants run the pre-built orchestrator instead of building from scratch. The important thing is seeing the trace, not typing the code.

---

### [65-70 min] Wrap-Up

**Check for understanding:**
- "What's the difference between a tool and an agent?"
- "Why would you use MCP instead of hardcoding tools in the agent?"
- "When would you use multi-agent orchestration instead of a single agent with more tools?"
- "How do agents fit into the PRISM metrics pipeline you built in Module 03?"

**Bridge to production:** You've built agents locally. In production, you need runtime management, persistent memory, API access control, and observability. That's what AgentCore provides. If you have 15 more minutes, do the extension exercise.

**Tie it back to PRISM:** Every agent invocation emits a `prism.d1.agent` event to EventBridge. This means your dashboards from Module 05 can show agent-level metrics: invocations, tool usage, success rates, latency. The same metrics pipeline you built powers agent observability.

---

### Key Concepts: MCP Authorization & Agent Safety

**MCP Scope-Based Authorization:**

The MCP server in `sample-app/src/mcp/` includes a scope-based authorization layer. When agents connect, they negotiate a session with granted scopes:

| Scope | Grants Access To | Risk Level |
|---|---|---|
| `tasks:read` | `list_tasks`, `search_tasks` | Low |
| `tasks:write` | `create_task`, `update_task` | Medium |
| `tasks:delete` | `delete_task` | High |

Agents can request a scope profile (`read-only`, `read-write`, `admin`) during session creation. Tool calls outside granted scopes are denied and logged. See `sample-app/src/mcp/auth/` for the implementation.

> **Instructor Note:** This is a critical governance concept. Ask: "What happens if an agent tries to delete a task but only has read-write access?" Answer: the MCP server returns an `Unauthorized` error with the missing scopes, and the tool call is logged as denied in the PRISM metrics pipeline (`prism.d1.mcp.tool_call` event).

**Bedrock Guardrails:**

Agents deployed via AgentCore can have Bedrock Guardrails attached for content safety:
- **Content filters** — block hate speech, violence, prompt attacks
- **PII protection** — automatically anonymize emails/phones, block SSNs/credit cards
- **Denied topics** — prevent agents from discussing competitors or giving financial advice

Every guardrail trigger emits a `prism.d1.guardrail` event with the category, action taken (BLOCK vs ANONYMIZE), and agent name. These appear in the Guardrails & Safety section of the Team Velocity dashboard.

**Agent Metrics Emitted:**

| Metric | CloudWatch Name | Description |
|---|---|---|
| Invocations | `AgentInvocationCount` | Total agent executions |
| Steps | `AgentStepCount` | Reasoning steps per invocation |
| Tools used | `AgentToolInvocationCount` | MCP tool calls per invocation |
| Duration | `AgentDurationMs` | Execution time |
| Tokens | `AgentTokensUsed` | LLM token consumption |
| Guardrails | `AgentGuardrailTriggerCount` | Safety triggers per invocation |
| Success | `AgentSuccessRate` | Completion without errors |

---

### [70-85 min] Extension Exercise 4: Deploy to AgentCore

Direct participants to `exercises/04-deploy-to-agentcore.md`.

> **Instructor Note:** This exercise is a walkthrough, not a live deployment. AgentCore requires account-level setup that's beyond workshop scope. The goal is for participants to understand what production deployment looks like and what components are involved.

---

## Common Questions

**Q: Can I use a different model besides Claude on Bedrock?**
A: Yes. Strands SDK supports any Bedrock model. Change `model_id` in the config. However, tool-use quality varies significantly by model -- Claude models are currently the strongest at multi-step tool orchestration.

**Q: How is this different from Bedrock Agents?**
A: Bedrock Agents is a managed, no-code/low-code agent builder (console or API). Strands SDK is a code-first framework for developers who want full control over the agent loop, tool definitions, and orchestration patterns. They're complementary -- Strands for dev teams, Bedrock Agents for business users.

**Q: What about cost? Won't agents burn through tokens?**
A: A typical agent invocation for task management uses 2,000-5,000 input tokens and 500-1,500 output tokens (including tool calls). With Claude Sonnet on Bedrock, that's roughly $0.01-$0.03 per invocation. The metrics pipeline you built tracks this -- use it.

**Q: Can agents call other agents across services?**
A: Yes. The agents-as-tools pattern works across process boundaries via MCP. Agent A can call Agent B's MCP server, which wraps Agent B as a tool. This is how you build microservice-style agent architectures.

**Q: How do I test agents?**
A: Use `mock=True` for unit tests (deterministic, no API calls). For integration tests, use Bedrock Evaluations (Module 04) to evaluate agent traces against rubrics. For load testing, AgentCore provides built-in metrics.
