from zavorth import ZavorthApiError, ZavorthClient


def main() -> None:
    client = ZavorthClient(
        base_url="http://127.0.0.1:33333",
        token=None,
        timeout=8.0,
    )
    try:
        status = client.get_gateway_status()
        catalog = client.get_platform_catalog(query="openrouter")
        public_contracts = client.get_platform_catalog(query="public contracts")
        quality = client.get_ops_quality()
    except ZavorthApiError as error:
        print("[example-client:python] falhou:", error.status, error.code, error)
        raise

    print("[example-client:python] gateway:", status.get("status"), status.get("version"))
    print("[example-client:python] catalogo:", catalog.get("summary", {}).get("total"))
    print("[example-client:python] contratos publicos:", public_contracts.get("summary", {}).get("total"))
    print("[example-client:python] ops quality:", quality.get("score"), quality.get("gate", {}).get("state"))


if __name__ == "__main__":
    main()
