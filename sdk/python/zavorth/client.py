from __future__ import annotations

import json
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class ZavorthApiError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        code: Optional[str] = None,
        details: Any = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details
        self.body = body


class ZavorthClient:
    def __init__(
        self,
        base_url: str,
        token: Optional[str] = None,
        timeout: float = 10.0,
        default_headers: Optional[Dict[str, str]] = None,
        sdk_label: str = "zavorth-python-sdk/1.0",
    ):
        self.base_url = base_url.rstrip("/")
        self.token = token.strip() if token else None
        self.timeout = timeout
        self.default_headers = dict(default_headers or {})
        self.sdk_label = sdk_label.strip() or "zavorth-python-sdk/1.0"
        if not self.base_url:
            raise ValueError("ZavorthClient requires base_url")

    def get_gateway_status(self) -> Dict[str, Any]:
        return self._get_json("/api/v1/gateway/status")

    def get_gateway_domains(self, detail: str = "summary", **query: Any) -> Dict[str, Any]:
        payload = dict(query)
        payload["detail"] = detail
        return self._get_json("/api/v1/gateway/domains", payload)

    def get_ops_health(self, live: bool = False) -> Dict[str, Any]:
        return self._get_json("/api/v1/ops/health", {"live": "true" if live else None})

    def get_ops_quality(self, live: bool = False, **query: Any) -> Dict[str, Any]:
        payload = dict(query)
        payload["live"] = "true" if live else None
        if "workspaceHint" in payload:
            payload["workspace"] = payload.pop("workspaceHint")
        return self._get_json("/api/v1/ops/quality", payload)

    def list_sessions(self, **query: Any) -> Dict[str, Any]:
        return self._get_json("/api/v1/sessions", query)

    def get_platform_status(self) -> Dict[str, Any]:
        return self._get_json("/api/v1/platform/status")

    def get_platform_catalog(
        self,
        selected_id: Optional[str] = None,
        query: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._get_json(
            "/api/v1/platform/catalog",
            {"selectedId": selected_id, "q": query},
        )

    def get_learning_status(self, **query: Any) -> Dict[str, Any]:
        return self._get_json("/api/v1/learning/status", query)

    def get_learning_candidates(self, **query: Any) -> Dict[str, Any]:
        return self._get_json("/api/v1/learning/candidates", query)

    def get_learning_metrics(self, **query: Any) -> Dict[str, Any]:
        return self._get_json("/api/v1/learning/metrics", query)

    def run_learning_action(self, candidate_id: str, action_id: str) -> Dict[str, Any]:
        return self._post_json(
            "/api/v1/learning/actions",
            {"candidateId": candidate_id, "actionId": action_id},
        )

    def approve_learning_candidate(self, candidate_id: str) -> Dict[str, Any]:
        return self.run_learning_action(candidate_id, "approve")

    def reject_learning_candidate(self, candidate_id: str) -> Dict[str, Any]:
        return self.run_learning_action(candidate_id, "reject")

    def promote_learning_candidate(self, candidate_id: str) -> Dict[str, Any]:
        return self.run_learning_action(candidate_id, "promote")

    def get_memory_status(self, **query: Any) -> Dict[str, Any]:
        if "workspaceHint" in query:
            query["workspace"] = query.pop("workspaceHint")
        return self._get_json("/api/v1/memory/status", query)

    def get_memory_metrics(self, **query: Any) -> Dict[str, Any]:
        if "workspaceHint" in query:
            query["workspace"] = query.pop("workspaceHint")
        return self._get_json("/api/v1/memory/metrics", query)

    def search_memory(self, query: str, **extra: Any) -> Dict[str, Any]:
        payload = dict(extra)
        if "workspaceHint" in payload:
            payload["workspace"] = payload.pop("workspaceHint")
        payload["q"] = query
        return self._get_json("/api/v1/memory/search", payload)

    def get_memory_procedures(self, **query: Any) -> Dict[str, Any]:
        if "workspaceHint" in query:
            query["workspace"] = query.pop("workspaceHint")
        return self._get_json("/api/v1/memory/procedures", query)

    def list_nodes(self, selected_id: Optional[str] = None) -> Dict[str, Any]:
        return self._get_json("/api/v1/nodes", {"selectedId": selected_id})

    def list_transports(self, selected_id: Optional[str] = None) -> Dict[str, Any]:
        return self._get_json("/api/v1/transports", {"selectedId": selected_id})

    def list_artifacts(self, **query: Any) -> Dict[str, Any]:
        return self._get_json("/api/v1/artifacts", query)

    def request_json(
        self,
        method: str,
        pathname: str,
        *,
        query: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        params = {
            key: value
            for key, value in (query or {}).items()
            if value not in (None, "")
        }
        url = f"{self.base_url}{pathname}"
        if params:
            url = f"{url}?{urlencode({key: str(value) for key, value in params.items()})}"

        request_headers = self._build_headers(headers=headers, has_body=payload is not None)
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(url, headers=request_headers, data=body, method=method.upper())
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return self._parse_json_payload(response.read().decode("utf-8"), status=getattr(response, "status", 200))
        except HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            raise self._build_api_error(raw, status=error.code) from error
        except URLError as error:
            raise ZavorthApiError(str(error.reason or error), body=None) from error

    def _get_json(self, pathname: str, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return self.request_json("GET", pathname, query=query)

    def _post_json(self, pathname: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.request_json("POST", pathname, payload=payload)

    def _build_headers(
        self,
        *,
        headers: Optional[Dict[str, str]] = None,
        has_body: bool = False,
    ) -> Dict[str, str]:
        merged = {
            "Accept": "application/json",
            "X-Zavorth-SDK": self.sdk_label,
            **self.default_headers,
            **dict(headers or {}),
        }
        if self.token:
            merged["Authorization"] = f"Bearer {self.token}"
        if has_body and "Content-Type" not in merged:
            merged["Content-Type"] = "application/json"
        return merged

    def _parse_json_payload(self, raw: str, *, status: int) -> Dict[str, Any]:
        text = raw.strip()
        if not text:
            return {}
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            if status >= 400:
                raise ZavorthApiError(text, status=status, body={"raw": text})
            return {"raw": text}

    def _build_api_error(self, raw: str, *, status: int) -> ZavorthApiError:
        payload = self._parse_json_payload(raw, status=status)
        error_payload = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error_payload, dict):
            return ZavorthApiError(
                str(error_payload.get("message") or f"HTTP {status}"),
                status=status,
                code=str(error_payload.get("code")) if error_payload.get("code") else None,
                details=error_payload.get("details"),
                body=payload,
            )
        return ZavorthApiError(str(payload.get("raw") or f"HTTP {status}"), status=status, body=payload)
