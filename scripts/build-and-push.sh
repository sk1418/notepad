#!/usr/bin/env bash
#
# Build multi-arch (amd64 + arm64) image and push to Docker Hub.
#
# Requires: docker with buildx (Docker Desktop or docker-ce >= 19.03 + buildx plugin).
# Env: DOCKERHUB_USER (required), DOCKERHUB_REPO (default: notepad)
#
set -euo pipefail

: "${DOCKERHUB_USER:?set DOCKERHUB_USER=ak0818}"
REPO="${DOCKERHUB_REPO:-notepad}"
PLATFORMS="linux/amd64,linux/arm64"
BUILDER="notepad-builder"

cd "$(dirname "$0")/.."

VERSION=$(./gradlew -q :properties | awk '/^version:/ {print $2}')
if [[ -z "$VERSION" ]]; then
  echo "Could not read project version from gradle." >&2
  exit 1
fi

IMAGE="docker.io/${DOCKERHUB_USER}/${REPO}"
echo "==> Building ${IMAGE}:{${VERSION},latest} for ${PLATFORMS}"

# Ensure a buildx builder that supports multi-arch exists
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "==> Creating buildx builder '$BUILDER'"
  docker buildx create --name "$BUILDER" --driver docker-container --bootstrap
fi
docker buildx use "$BUILDER"

# Login if not already
if ! docker info 2>/dev/null | grep -q "Username: ${DOCKERHUB_USER}"; then
  echo "==> Logging in to Docker Hub as ${DOCKERHUB_USER}"
  docker login docker.io -u "$DOCKERHUB_USER"
fi

# Multi-arch build must go straight to registry (--push); local daemon can't
# hold multi-platform images.
docker buildx build \
  --platform "$PLATFORMS" \
  --build-arg APP_VERSION="$VERSION" \
  --tag "${IMAGE}:${VERSION}" \
  --tag "${IMAGE}:latest" \
  --push \
  .

echo "==> Pushed:"
echo "     ${IMAGE}:${VERSION}"
echo "     ${IMAGE}:latest"
echo
echo "Pull anywhere:  docker pull ${IMAGE}:${VERSION}"