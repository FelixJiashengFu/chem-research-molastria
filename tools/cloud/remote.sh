#!/usr/bin/env bash
# Runs on the cloud GPU (tools/cloud/run.mjs copies this folder there): UMA in its environment, then MACE-OFF23 in
# whichever Python has mace-torch (the two cannot share one: mace-torch pins e3nn 0.4.4, fairchem needs e3nn >= 0.5).
# Override the guesses with UMA_PY=... MACE_PY=... in front of the command.
set -uo pipefail
cd "$(dirname "$0")"

UMA_PY="${UMA_PY:-/opt/uma/venv/bin/python}"
if [ ! -x "$UMA_PY" ]; then echo "No UMA Python at $UMA_PY (set UMA_PY=/path/to/python)"; exit 2; fi

# RDKit builds the 3D structures; the UMA environment may not have it yet.
if ! "$UMA_PY" -c "import rdkit" 2>/dev/null; then
  echo "Installing RDKit into the UMA environment"
  if [ -x /opt/uma-bootstrap/bin/uv ]; then sudo /opt/uma-bootstrap/bin/uv pip install --python "$UMA_PY" rdkit
  else sudo "$UMA_PY" -m pip install rdkit; fi
fi

# A Hugging Face login is needed for facebook/UMA. Asked here, in your own terminal, only when there is none.
if ! "$UMA_PY" -c "from huggingface_hub import get_token; import sys; sys.exit(0 if get_token() else 1)" 2>/dev/null; then
  HF="$(dirname "$UMA_PY")/hf"
  if [ -t 0 ] && [ -x "$HF" ]; then
    echo "No Hugging Face login on this machine yet. Paste a read token that can see facebook/UMA (it is stored on this VM only):"
    "$HF" auth login || exit 3
  else
    echo "No Hugging Face login on this machine: run  $HF auth login  once over SSH, then start the batch again."; exit 3
  fi
fi

MACE_PY="${MACE_PY:-}"
if [ -z "$MACE_PY" ]; then
  for c in /opt/mace/venv/bin/python /opt/mace-off/venv/bin/python /opt/mace-env/bin/python "$HOME"/mace*/bin/python \
           "$HOME"/mace*/venv/bin/python "$HOME"/.venv/mace*/bin/python /opt/conda/envs/mace*/bin/python /opt/conda/bin/python \
           "$HOME"/miniforge3/envs/mace*/bin/python "$HOME"/miniconda3/envs/mace*/bin/python python3; do
    p="$(command -v "$c" 2>/dev/null || true)"
    [ -n "$p" ] && "$p" -c "import mace.calculators" 2>/dev/null && { MACE_PY="$p"; break; }
  done
fi

nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader 2>/dev/null || echo "nvidia-smi not available"
echo "UMA:  $UMA_PY"
echo "MACE: ${MACE_PY:-not found}"

"$UMA_PY" -u batch_uma.py input.csv out "$@" || exit 4
if [ -n "$MACE_PY" ]; then
  "$MACE_PY" -u batch_mace.py out || { echo "MACE-OFF23 step failed; results.csv has the UMA columns only"; cp out/uma_results.csv out/results.csv; }
else
  echo "MACE-OFF23 not found on this machine (set MACE_PY=/path/to/python); results.csv has the UMA columns only"
  cp out/uma_results.csv out/results.csv
fi
