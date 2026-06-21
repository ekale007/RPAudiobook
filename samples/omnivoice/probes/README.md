# OmniVoice probe outputs

Manifest: `samples/omnivoice/manifest.json`  
Settings: `num_step=16`, GPU `cuda:0`, model `k2-fsa/OmniVoice`.

| File | Mode | Ref / instruct |
|------|------|----------------|
| `de_clone_story_01.wav` | clone | de_narrator_female |
| `de_clone_dialogue_01.wav` | clone | de_protagonist_neutral |
| `de_clone_male_01.wav` | clone | de_narrator_male |
| `en_clone_story_01.wav` | clone | en_narrator_female |
| `en_clone_gb_01.wav` | clone | en_gb_narrator |
| `de_design_warm_female.wav` | design | female, middle-aged, moderate pitch |
| `de_design_low_male.wav` | design | male, low pitch |
| `en_design_british_female.wav` | design | female, british accent, low pitch |
| `de_auto_voice.wav` | auto | — |
| `de_nonverbal_laughter.wav` | clone | de_protagonist_neutral + `[laughter]` |

Vergleich: jeweils `refs/<ref_id>.wav` (Referenz) ↔ `probes/de_clone_*.wav` (Zieltext).
