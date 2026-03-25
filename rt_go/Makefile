# rtassist Makefile
# =================

# Binary name
BINARY_NAME=rtassist
BINARY_PATH=bin/$(BINARY_NAME)

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Main targets
.PHONY: all build clean run test help

all: build

## build: Build the binary
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p bin
	$(GOBUILD) -o $(BINARY_PATH) ./cmd/rtassist
	@echo "✅ Build complete: $(BINARY_PATH)"

## clean: Remove build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf bin/
	$(GOCLEAN)
	@echo "✅ Clean complete"

## run: Run the application (requires .env)
run: build
	@echo "Starting $(BINARY_NAME)..."
	@if [ -f .env ]; then \
		export $$(cat .env | grep -v '^#' | xargs) && ./$(BINARY_PATH); \
	else \
		echo "❌ No .env file found. Copy .env.example to .env and configure it."; \
		exit 1; \
	fi

## test: Run tests
test:
	$(GOTEST) -v ./...

## test-coverage: Run tests with coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "✅ Coverage report: coverage.html"

## deps: Download dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy
	@echo "✅ Dependencies installed"

## lint: Run linter (requires golangci-lint)
lint:
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "⚠️  golangci-lint not installed. Run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
	fi

## fmt: Format code
fmt:
	$(GOCMD) fmt ./...
	@echo "✅ Code formatted"

## env-setup: Copy .env.example to .env
env-setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Created .env from .env.example"; \
		echo "⚠️  Edit .env with your API keys"; \
	else \
		echo "⚠️  .env already exists"; \
	fi

## chrome: Start Chrome with remote debugging (macOS)
chrome:
	@echo "Starting Chrome with remote debugging on port 9222..."
	@if [ -d "/Applications/Google Chrome.app" ]; then \
		/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
			--remote-debugging-port=9222 \
			--user-data-dir=/tmp/chrome-rt-debug \
			--no-first-run \
			--no-default-browser-check & \
		echo "✅ Chrome started. Open Meet/Teams/Zoom in this window."; \
	else \
		echo "❌ Chrome not found at /Applications/Google Chrome.app"; \
	fi

## help: Show this help
help:
	@echo "rtassist - Real-time interview assistant"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':'

# Development targets
.PHONY: dev

## dev: Development mode with auto-rebuild
dev:
	@echo "Running in development mode..."
	$(GOCMD) run ./cmd/rtassist

# Build for multiple platforms
.PHONY: build-all build-linux build-darwin build-windows

build-all: build-linux build-darwin build-windows

build-linux:
	GOOS=linux GOARCH=amd64 $(GOBUILD) -o bin/$(BINARY_NAME)-linux ./cmd/rtassist

build-darwin:
	GOOS=darwin GOARCH=amd64 $(GOBUILD) -o bin/$(BINARY_NAME)-darwin ./cmd/rtassist

build-windows:
	GOOS=windows GOARCH=amd64 $(GOBUILD) -o bin/$(BINARY_NAME)-windows.exe ./cmd/rtassist
