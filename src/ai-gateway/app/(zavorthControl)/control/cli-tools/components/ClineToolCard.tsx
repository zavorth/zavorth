"use client";

import ManagedCliToolCard, { MANAGED_CLI_TOOL_PROFILES } from "./ManagedCliToolCard";

export default function ClineToolCard(props) {
  return <ManagedCliToolCard {...props} profile={MANAGED_CLI_TOOL_PROFILES.cline} />;
}
