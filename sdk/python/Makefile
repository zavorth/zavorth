.PHONY: install build lint test clean publish-test publish

PYTHON ?= python3
PACKAGE := zavorth-client

install:
	$(PYTHON) -m pip install -e ".[dev]"

build:
	$(PYTHON) -m pip install build && $(PYTHON) -m build --wheel

lint:
	ruff check zavorth/ tests/

test:
	$(PYTHON) -m pytest -v tests/

clean:
	rm -rf dist/ *.egg-info __pycache__ zavorth/__pycache__ tests/__pycache__

publish-test:
	$(PYTHON) -m pip install twine && $(PYTHON) -m build && $(PYTHON) -m twine upload --repository testpypi dist/*

publish:
	$(PYTHON) -m pip install twine && $(PYTHON) -m build && $(PYTHON) -m twine upload dist/*