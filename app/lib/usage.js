// Shared helpers for displaying real Gemini API usage (tokens + cost) per
// saved report. `usage` is the {calls, grounded_calls, input_tokens,
// output_tokens, cost_usd} object the backend embeds in each SSE "complete"
// event — see usage_logger.py get_usage_by_run().

export function formatUsage(usage) {
  if (!usage || !usage.calls) return null;
  const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  const tokStr = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K tok` : `${tokens} tok`;
  const cost = usage.cost_usd || 0;
  const costStr = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(3)}`;
  return `${costStr} · ${tokStr} · ${usage.calls} call${usage.calls === 1 ? "" : "s"}`;
}

export function UsageBadge({ usage, style }) {
  const label = formatUsage(usage);
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        color: "#64748b",
        background: "rgba(100,116,139,0.1)",
        padding: "2px 6px",
        borderRadius: 4,
        fontWeight: 600,
        whiteSpace: "nowrap",
        ...style,
      }}
      title={usage ? `${usage.input_tokens ?? 0} input + ${usage.output_tokens ?? 0} output tokens, ${usage.grounded_calls ?? 0} grounded call(s)` : undefined}
    >
      {label}
    </span>
  );
}
