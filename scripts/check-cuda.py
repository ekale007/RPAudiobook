import sys

import torch

print("cuda=", torch.cuda.is_available(), flush=True)
if torch.cuda.is_available():
    print("gpu=", torch.cuda.get_device_name(0), flush=True)
sys.exit(0 if torch.cuda.is_available() else 1)
