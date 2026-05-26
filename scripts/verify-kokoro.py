from kokoro import KPipeline
import torch

print("kokoro OK, cuda=", torch.cuda.is_available())
