# 金箔山水背景

## 当前动态版本：用户提供的视频

- `gilded-landscape-wide-loop-v1.mp4`：1280×720，H.264，24fps，7,770,345 bytes。
- `gilded-landscape-mobile-loop-v1.mp4`：720×1280，H.264，24fps，8,153,303 bytes。
- 来源为用户 Downloads 中的同名原件；项目副本只复制视频流、去音轨、前置索引。未重新生成、重新编码或缩小视频。
- 视频流 SHA-256 在处理前后完全一致：横版 `ac02541634648fedc2a65c04064a0d2544265f19d87ab0c651e21ad9229c10f0`；竖版 `2f0c346757851365977dd9d75fb416d7f4c9ddc721d0bb87a2b474ac5994f0ec`。
- 画面整体固定，网站不再添加整图平移/缩放或合成云水层；背景独立循环，真实GLB仍是另一个交互图层。
- 原素材首尾云水形状不同，不是严格无缝循环。原画继续作为静态后备。

## 早期静态画作（保留）

按用户提供的金箔月夜山水参考，以内置 image_gen 生成独立横屏和竖屏背景，不含建筑、网页文字、页码或界面。祈年殿仍使用真实 GLB，背景画不替代模型。

- `gilded-landscape-wide-v1.png`：横屏金箔山水，左侧月亮、两侧墨松山石、中央及右侧雾气留白。
- `gilded-landscape-mobile-v1.png`：竖屏独立构图，中上部给模型留白，中下部为阅读保留宣纸与水面。

原始生成文件保留在本机 Codex generated_images 目录。项目图片由这些输出复制而来，未覆盖用户参考图。

## 生成方式与完整提示词

使用内置 image_gen，用户山水图仅作风格与材质参考；不使用 CLI/API 备用路径。

### 横屏

Use case: style-transfer / website background artwork. Adapt the supplied vertical gold-leaf Chinese landscape into a NEW wide 16:9 composition, 2048x1152 preferred, for an immersive real-time 3D architectural website. The input is a STYLE AND MATERIAL REFERENCE, not a screenshot to preserve. Capture its luxurious hand-painted gold-leaf shanshui on weathered warm silk: irregular torn gold foil glints, mineral pigment granulation, subtle paper fibres, layered mist, quiet reflective river, charcoal pine trees on grey-beige rocky mountains, one pale golden full moon. Palette: moon gold #EFCF74, autumn gold #D6A54A, antique bronze #A16E2C, deep ochre #7E5421; warm rice-paper #D5C5AE, mist grey #8F8675, warm moon white #F5EFE0; ink #3E3A33 and #1A1917. About 70% warm gilded atmosphere, 20% paper/mist, 10% ink details; nuanced and antique, not flat yellow, not shiny 3D metallic render. Composition specifically for overlay: small full moon at x=17%, y=20%; strongest rocky pine silhouettes along far left edge and lower-left corner; distant mountains along the far right edge and upper-right, with evocative broken gold leaf. Central x=30–62% should be airy, quiet mist for a live temple model to sit in; x=65–90%, y=30–78% should be readable pale golden mist/paper, not a busy dark cliff, since real HTML text sits there. Make left and right edges artistically rich but midground spacious, mountain depth clearly atmospheric. Visible rippling liquid-gold reflections near the lower margin. No architecture, no temple, no people, no UI, no letters, no numbers, no 1/7, no border, no labels or watermark. This is ONLY the landscape art layer, not a website mockup. Preserve the reference's painterly craftsmanship, irregular gold-leaf surface and monochrome ink ecology, not generic smooth gradients or geometric shards.

### 竖屏

Create a portrait 9:16 companion background painting, 1152x2048 preferred, from the supplied reference as a style guide for the MOBILE version of a Qiniandian 3D website. Only the painting, not a screenshot or website design. Match the reference's exquisite antique Chinese gold-leaf shanshui on silk and rice-paper: natural ragged gold-leaf flakes, mineral pigment granules, charcoal ink pines, grey-beige mountain rocks, quiet golden reflected river, milky drifting mountain mist. Palette exactly in the spirit of #EFCF74 #D6A54A #A16E2C #7E5421, warm paper #D5C5AE, mist #8F8675, warm white #F5EFE0, ink #3E3A33 #1A1917; rich but aged and painterly, no flat yellow fill. COMPOSITION: one small pale gold full moon near x=17%, y=17%; mountain framing toward upper side edges; the middle x=25–75%, y=20–48% must be airy mist for an actual live temple model to overlay; preserve mountain silhouette and gold-leaf sky visibly at the edges. From y=52% downward keep a gentle warm rice-paper / pale mist / water field with subtle paper fibres and sparsely shimmering gold river, nearly no dark or busy detail there because HTML reading text will overlay. Strongest tiny ink pine accents only at far outer edges, not center or lower text area. It must feel like a genuine luxurious hand-painted gilded mountain scroll rather than CSS gradients, a busy photograph, or 3D metallic wallpaper. No architecture or temples (live model is separate), no humans, no UI, no text, no numbers, no 1/7, no logos, no frame.
