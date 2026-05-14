# syntax=docker/dockerfile:1.7
# rt_go — multi-stage build for the rtassist transcription gateway.

# ---- Stage 1: build ----
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Cache deps independently of source changes.
COPY go.mod go.sum ./
RUN go mod download

# Build a small static binary.
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /out/rtassist \
    ./cmd/rtassist

# ---- Stage 2: runtime ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S rtassist \
    && adduser -S -G rtassist rtassist

WORKDIR /app
COPY --from=builder /out/rtassist /app/rtassist

USER rtassist

ENV OVERLAY_PORT=8765 \
    AUDIO_RECV_PORT=8766

EXPOSE 8765 8766

ENTRYPOINT ["/app/rtassist"]
