#!/usr/bin/env bash
set -eu

status=0
for ref in "$@"; do
  raw="$(docker buildx imagetools inspect --raw "$ref")"
  case "$raw" in
    *'application/vnd.oci.image.index.v1+json'* | *'application/vnd.docker.distribution.manifest.list.v2+json'*)
      echo "FAIL: $ref is a manifest index/list — the GitLab registry API cannot serve it (the tag shows 'missing manifest digest' and the registry cleaner skips it). Build single-arch with --provenance=false."
      status=1
      ;;
    *)
      echo "OK: $ref is a single servable manifest."
      ;;
  esac
done
exit "$status"
