# 小狗的礼物盒

https://leishaforlinminzhi-9.github.io/ — one GitHub Pages site for the gift pages (moved here on 2026-11-11 from their own repos; the addresses did not change):

- `hunt/` 寻宝解谜, 训小狗模拟器 (`train.html`), 密码锁 (`lock.html`) — from `~/treasure-hunt/release`
- `campus/` 清华园 2.5D and the reward film (`film.mp4`) — from `~/campus-25d`
- `poem/` 拼贴诗 — from `~/poem-collage`
- `photo/` 小狗跳进照片 — from `~/puppy-photo`

- `frisbee/` 飞盘计分 — a score page for her frisbee group (not a gift, so not on the home page): edited right here, no sync; the points are saved on the love-calendar Worker (`/api/frisbee/*`, see that repo's README)

爱的日历 stays in its own repo (`love-calendar`, with its Worker and Netlify) at `/love-calendar/`.

Publish a change: commit it in the project, then `tools/sync.sh <name> --push` (for `frisbee/`: commit and push this repo).
