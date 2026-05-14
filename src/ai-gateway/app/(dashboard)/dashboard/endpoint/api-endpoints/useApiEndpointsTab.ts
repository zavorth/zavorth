"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ApiEndpointSection,
  CatalogData,
  Endpoint,
  TryItResult,
  WebhookItem,
} from "./apiEndpointsTypes";

const loadCatalog = async (): Promise<CatalogData | null> => {
  try {
    const res = await fetch("/api/openapi/spec");
    if (res.ok) {
      return (await res.json()) as CatalogData;
    }
  } catch {}
  return null;
};

const fetchWebhooksData = async (): Promise<WebhookItem[]> => {
  try {
    const res = await fetch("/api/webhooks");
    if (res.ok) {
      const data = await res.json();
      return data.webhooks || [];
    }
  } catch {}
  return [];
};

const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function useApiEndpointsTab() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<ApiEndpointSection>("catalog");
  const [search, setSearch] = useState("");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [tryingEndpoint, setTryingEndpoint] = useState<string | null>(null);
  const [tryBody, setTryBody] = useState("");
  const [tryResult, setTryResult] = useState<TryItResult | null>(null);
  const [trying, setTrying] = useState(false);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(["*"]);
  const [whDesc, setWhDesc] = useState("");
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((data) => {
      if (!cancelled) {
        setCatalog(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWebhooks = async () => {
    setWebhooksLoading(true);
    const data = await fetchWebhooksData();
    setWebhooks(data);
    setWebhooksLoading(false);
  };

  useEffect(() => {
    if (section !== "webhooks") return;
    let cancelled = false;
    fetchWebhooksData().then((data) => {
      if (!cancelled) {
        setWebhooks(data);
        setWebhooksLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [section]);

  const filteredEndpoints = useMemo(() => {
    if (!catalog) return [];
    return catalog.endpoints.filter((ep) => {
      const matchesSearch =
        !search ||
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.summary.toLowerCase().includes(search.toLowerCase()) ||
        ep.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
      const matchesTag = !selectedTag || ep.tags.includes(selectedTag);
      return matchesSearch && matchesTag;
    });
  }, [catalog, search, selectedTag]);

  const groupedEndpoints = useMemo(() => {
    const groups: Record<string, Endpoint[]> = {};
    for (const ep of filteredEndpoints) {
      const tag = ep.tags[0] || "Other";
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(ep);
    }
    return groups;
  }, [filteredEndpoints]);

  const allTags = useMemo(() => {
    if (!catalog) return [];
    return catalog.tags.map((tag) => tag.name);
  }, [catalog]);

  const handleTryIt = (ep: Endpoint) => {
    const key = `${ep.method}:${ep.path}`;
    if (tryingEndpoint === key) {
      setTryingEndpoint(null);
      setTryResult(null);
      return;
    }
    setTryingEndpoint(key);
    setTryResult(null);
    setTryBody(ep.method === "GET" ? "" : "{\n  \n}");
  };

  const executeTryIt = async (ep: Endpoint) => {
    setTrying(true);
    try {
      const res = await fetch("/api/openapi/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: ep.method,
          path: ep.path.replace("/api/", "/"),
          body: tryBody ? JSON.parse(tryBody) : undefined,
        }),
      });
      if (res.ok) setTryResult((await res.json()) as TryItResult);
    } catch (err) {
      setTryResult({
        status: 0,
        statusText: "Error",
        headers: {},
        body: { error: getErrorMessage(err) },
        latencyMs: 0,
        contentType: "application/json",
      });
    }
    setTrying(false);
  };

  const addWebhook = async () => {
    if (!whUrl.trim()) return;
    try {
      await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: whUrl, events: whEvents, description: whDesc }),
      });
      setWhUrl("");
      setWhEvents(["*"]);
      setWhDesc("");
      setShowAddWebhook(false);
      await loadWebhooks();
    } catch {}
  };

  const toggleWebhook = async (wh: WebhookItem) => {
    try {
      await fetch(`/api/webhooks/${wh.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !wh.enabled }),
      });
      setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? { ...w, enabled: !w.enabled } : w)));
    } catch {}
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch {}
  };

  const testWebhook = async (id: string) => {
    setTestingWebhookId(id);
    try {
      await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      await loadWebhooks();
    } catch {}
    setTestingWebhookId(null);
  };

  const selectAllWebhookEvents = () => setWhEvents(["*"]);

  const toggleWebhookEvent = (event: string) => {
    if (whEvents.includes("*")) {
      setWhEvents([event]);
    } else if (whEvents.includes(event)) {
      setWhEvents(whEvents.filter((item) => item !== event));
    } else {
      setWhEvents([...whEvents, event]);
    }
  };

  return {
    catalog,
    loading,
    section,
    setSection,
    search,
    setSearch,
    expandedEndpoint,
    setExpandedEndpoint,
    selectedTag,
    setSelectedTag,
    tryingEndpoint,
    tryBody,
    setTryBody,
    tryResult,
    trying,
    webhooks,
    webhooksLoading,
    showAddWebhook,
    setShowAddWebhook,
    whUrl,
    setWhUrl,
    whEvents,
    whDesc,
    setWhDesc,
    testingWebhookId,
    filteredEndpoints,
    groupedEndpoints,
    allTags,
    handleTryIt,
    executeTryIt,
    addWebhook,
    toggleWebhook,
    deleteWebhook,
    testWebhook,
    selectAllWebhookEvents,
    toggleWebhookEvent,
  };
}
