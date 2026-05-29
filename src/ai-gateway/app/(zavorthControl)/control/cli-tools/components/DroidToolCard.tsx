"use client";

import ManagedCliToolCard, { MANAGED_CLI_TOOL_PROFILES } from "./ManagedCliToolCard";

export default function DroidToolCard(props) {
  return <ManagedCliToolCard {...props} profile={MANAGED_CLI_TOOL_PROFILES.droid} />;
}
