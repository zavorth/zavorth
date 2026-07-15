"""Unit tests for the Zavorth Python SDK client.

These tests mock the HTTP layer so they can run without a live Zavorth runtime.
They verify client initialization, request building, response parsing, and error
handling.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from zavorth import ZavorthApiError, ZavorthClient


# ── Fixtures ───────────────────────────────────────────────────


@pytest.fixture
def client() -> ZavorthClient:
    return ZavorthClient(
        "http://127.0.0.1:33333",
        token="test-token-abc",
        timeout=5.0,
    )


@pytest.fixture
def no_token_client() -> ZavorthClient:
    return ZavorthClient("http://127.0.0.1:33333")


def _mock_response(status: int, body: bytes = b"{}") -> MagicMock:
    """Build a mock HTTP response object."""
    resp = MagicMock()
    resp.status = status
    resp.read.return_value = body
    resp.__enter__ = MagicMock(return_value=resp)
    resp.__exit__ = MagicMock(return_value=False)
    return resp


# ── Initialization tests ──────────────────────────────────────


class TestZavorthClientInit:
    def test_valid_base_url(self):
        c = ZavorthClient("http://localhost:3000")
        assert c.base_url == "http://localhost:3000"

    def test_strips_trailing_slash(self):
        c = ZavorthClient("http://localhost:3000/")
        assert c.base_url == "http://localhost:3000"

    def test_token_stripped(self):
        c = ZavorthClient("http://localhost:3000", token="  abc  ")
        assert c.token == "abc"

    def test_no_token_is_none(self):
        c = ZavorthClient("http://localhost:3000")
        assert c.token is None

    def test_negative_timeout_rejected(self):
        with pytest.raises(ValueError, match="timeout"):
            ZavorthClient("http://localhost:3000", timeout=-1)

    def test_zero_timeout_rejected(self):
        with pytest.raises(ValueError, match="timeout"):
            ZavorthClient("http://localhost:3000", timeout=0)

    def test_non_absolute_url_rejected(self):
        with pytest.raises(ValueError, match="absolute"):
            ZavorthClient("not-a-url")

    def test_embedded_credentials_rejected(self):
        with pytest.raises(ValueError, match="embedded credentials"):
            ZavorthClient("http://user:pass@localhost:3000")

    def test_custom_sdk_label(self):
        c = ZavorthClient("http://localhost:3000", sdk_label="my-app/2.0")
        assert c.sdk_label == "my-app/2.0"

    def test_empty_sdk_label_falls_back(self):
        c = ZavorthClient("http://localhost:3000", sdk_label="  ")
        assert c.sdk_label == "zavorth-python-sdk/1.0"


# ── Request header tests ──────────────────────────────────────


class TestRequestHeaders:
    def test_auth_header_included_when_token_set(self, client):
        headers = client._build_headers()
        assert headers["Authorization"] == "Bearer test-token-abc"

    def test_auth_header_absent_when_no_token(self, no_token_client):
        headers = no_token_client._build_headers()
        assert "Authorization" not in headers

    def test_accept_header_always_present(self, no_token_client):
        headers = no_token_client._build_headers()
        assert headers["Accept"] == "application/json"

    def test_sdk_label_header(self, client):
        headers = client._build_headers()
        assert headers["X-Zavorth-SDK"] == "zavorth-python-sdk/1.0"

    def test_content_type_added_for_body(self, client):
        headers = client._build_headers(has_body=True)
        assert headers["Content-Type"] == "application/json"

    def test_content_type_not_overwritten(self, client):
        headers = client._build_headers(
            headers={"Content-Type": "application/x-zeabus"},
            has_body=True,
        )
        assert headers["Content-Type"] == "application/x-zeabus"

    def test_default_headers_merged(self):
        c = ZavorthClient(
            "http://localhost:3000",
            default_headers={"X-Custom": "yes"},
        )
        headers = c._build_headers()
        assert headers["X-Custom"] == "yes"


# ── Response parsing tests ───────────────────────────────────


class TestResponseParsing:
    def test_parse_valid_json(self, client):
        result = client._parse_json_payload(
            '{"status": "ok"}', status=200,
        )
        assert result["status"] == "ok"

    def test_parse_empty_body(self, client):
        result = client._parse_json_payload("", status=200)
        assert result == {}

    def test_parse_whitespace_only(self, client):
        result = client._parse_json_payload("   \n  ", status=200)
        assert result == {}

    def test_parse_invalid_json_ok_status(self, client):
        result = client._parse_json_payload("not json", status=200)
        assert result["raw"] == "not json"

    def test_parse_invalid_json_error_status(self, client):
        with pytest.raises(ZavorthApiError) as exc:
            client._parse_json_payload("server crashed", status=500)
        assert exc.value.status == 500
        assert "server crashed" in str(exc.value)


# ── Error handling tests ──────────────────────────────────────


class TestErrorHandling:
    def test_build_api_error_with_json_error_body(self, client):
        raw = json.dumps({
            "error": {
                "message": "Invalid token",
                "code": "AUTH_001",
                "details": {"reason": "expired"},
            },
        })
        err = client._build_api_error(raw, status=401)
        assert err.status == 401
        assert err.code == "AUTH_001"
        assert err.details["reason"] == "expired"
        assert "Invalid token" in str(err)

    def test_build_api_error_without_error_key(self, client):
        raw = json.dumps({"raw": "something went wrong"})
        err = client._build_api_error(raw, status=500)
        assert err.status == 500
        assert err.code is None

    def test_build_api_error_with_plain_text(self, client):
        with pytest.raises(ZavorthApiError) as exc:
            client._build_api_error("gateway timeout", status=504)
        assert exc.value.status == 504
        assert "gateway timeout" in str(exc.value)


# ── HTTP call tests (mocked) ──────────────────────────────────


class TestHttpCalls:
    @patch.object(ZavorthClient, "request_json")
    def test_get_gateway_status_success(self, mock_req, client):
        mock_req.return_value = {"status": "online"}
        result = client.get_gateway_status()
        assert result["status"] == "online"
        mock_req.assert_called_once_with("GET", "/api/v1/gateway/status", query=None)

    @patch.object(ZavorthClient, "request_json")
    def test_get_gateway_status_http_error(self, mock_req, client):
        mock_req.side_effect = ZavorthApiError("offline", status=503, code="SERVICE_UNAVAILABLE")
        with pytest.raises(ZavorthApiError) as exc:
            client.get_gateway_status()
        assert exc.value.status == 503
        assert exc.value.code == "SERVICE_UNAVAILABLE"

    @patch.object(ZavorthClient, "request_json")
    def test_post_learning_action(self, mock_req, client):
        mock_req.return_value = {"ok": True}
        result = client.run_learning_action("cand-1", "approve")
        assert result["ok"] is True
        mock_req.assert_called_once_with(
            "POST",
            "/api/v1/learning/actions",
            payload={"candidateId": "cand-1", "actionId": "approve"},
        )

    @patch.object(ZavorthClient, "request_json")
    def test_search_memory(self, mock_req, client):
        mock_req.return_value = {"results": [{"id": 1, "title": "note"}]}
        result = client.search_memory("budget")
        assert len(result["results"]) == 1

    @patch.object(ZavorthClient, "request_json")
    def test_request_json_generic_get(self, mock_req, client):
        mock_req.return_value = {"summary": "ok"}
        result = client.request_json("GET", "/api/v1/platform/catalog")
        assert result["summary"] == "ok"


# ─- Cross-method consistency tests ────────────────────────────


class TestMethodConsistency:
    def test_approve_delegates_to_run_action(self, client):
        with patch.object(client, "run_learning_action") as mock:
            mock.return_value = {"ok": True}
            client.approve_learning_candidate("c1")
            mock.assert_called_once_with("c1", "approve")

    def test_reject_delegates_to_run_action(self, client):
        with patch.object(client, "run_learning_action") as mock:
            mock.return_value = {"ok": True}
            client.reject_learning_candidate("c2")
            mock.assert_called_once_with("c2", "reject")

    def test_promote_delegates_to_run_action(self, client):
        with patch.object(client, "run_learning_action") as mock:
            mock.return_value = {"ok": True}
            client.promote_learning_candidate("c3")
            mock.assert_called_once_with("c3", "promote")
