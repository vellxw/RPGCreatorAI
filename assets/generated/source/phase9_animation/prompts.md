# Phase 9 Sprite Forge Prompts

Pinned source: https://github.com/0x0funky/agent-sprite-forge at `fff651a89223b044ccfc0b75ed9f3754c6d739b1`.

Shared prompt invariants:
- same character silhouette, palette, costume, and proportions as the approved in-game seed frame
- one transparent horizontal strip per action/direction
- exactly 4 frames, each 64x64 px, bottom-center anchor at (32, 54)
- crisp readable pixel-art clusters, no scenery, labels, posters, or background
- magenta `#ff00ff` only in runtime BMP transparency key output

Actions requested:
- player_adventurer: idle, walk, interact, attack, hurt, death for down/left/right/up
- npc_old_man and npc_shopkeeper: idle and walk for down/left/right/up
