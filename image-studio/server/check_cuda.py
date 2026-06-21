import sys

try:
    import torch
except ImportError:
    print("torch not installed")
    sys.exit(1)

if torch.cuda.is_available():
    print(f"CUDA OK: {torch.cuda.get_device_name(0)}")
    sys.exit(0)

print("CUDA not available")
sys.exit(1)
