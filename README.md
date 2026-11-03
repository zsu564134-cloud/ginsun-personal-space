# GIN SUN — Personal Space

An interactive 3D portfolio connecting architecture, generative imagery, photography and digital products in a rainy-night studio.

**Live portfolio: [ginsunart.com](https://ginsunart.com/)**

## About

Personal portfolio of **Gin Sun / 孙正基**, an architecture master's student at Nanjing University working across AIGC, photography, filmmaking and digital products.

This repository presents the website's frontend implementation. The complete portfolio and resume are available on the live site. Design direction, spatial composition, content and iterative visual decisions are by Gin Sun; implementation was developed with AI coding assistance.

## Experience

- Interactive misted-glass entrance with wiping, droplets and animated typography.
- A Three.js studio with concrete walls, plants, material maps, wind and rain.
- Spatial navigation to AIGC films, architectural projects, photography books and products.
- Data-driven project categories, tags, case-study blocks and book pages.
- A muted television playlist and a selectable music collection.
- Responsive controls and separate portrait/landscape camera framing.

## Implementation

Static HTML, CSS and JavaScript ES modules, with a locally bundled Three.js runtime. The production site is hosted on Tencent Cloud EdgeOne; this repository is not a second deployment of the website.

| File | Responsibility |
|---|---|
| `dist/app.js` | Scene lifecycle, navigation and camera transitions |
| `dist/content.json` | Portfolio content configuration |
| `dist/collection-view.js` | Project readers, books and media controls |
| `dist/night-entry.js` | Entrance interaction |
| `dist/room-world.js` | Interior, lighting and resource queues |
| `dist/rain-garden.js` | Outdoor rain and tree motion |
| `dist/interior-plants.js` | Plant loading and placement |
| `dist/model-download.js` | Chunked loading, retry and decompression |
| `dist/room-television.js` | Narrative-film playback in the room |

## Performance work

Lossless gzip transport reduces the main model and two plant arrangements from approximately **48.63 MB to 38.60 MB**. Decoded model bytes are unchanged. Browsers without decompression support use the original chunks.

Material downloads and plant jobs use separate bounded queues and overlap with main-model preparation. Two roughness textures use lossless WebP with pixel equality checks. Plant bounds calculations avoid repeated geometry scans.

These are transfer-size and implementation improvements, not a claim of measured public-network loading times.

## Assets and local development

**This source showcase intentionally excludes media and model binaries. It is not a self-contained runnable demo.** Videos, music, resume photographs, portfolio PDFs, fonts, texture maps and GLB files are not distributed here. References in `content.json` and asset manifests describe the full site's structure.

With authorized assets restored under `dist/assets/`, serve `dist/` through a static HTTP server, for example:

```sh
python -m http.server 8765 --directory dist
```

Downloader unit tests can run without the portfolio assets using a recent Node.js version:

```sh
node --test tests/model-download.test.mjs
```

The content reference checker requires the complete asset collection:

```sh
node scripts/check-content.mjs
```

## 中文说明

这是个人网站前端代码展示仓库。完整的 AIGC、建筑、摄影和产品作品请访问 [ginsunart.com](https://ginsunart.com/)。仓库不包含完整素材包，不作为可直接运行的作品集副本；网站仍由腾讯云托管。

AIGC 作品由本人独立完成 Brief 拆解、脚本、生成制作、剪辑与交付。网站开发使用了 AI 编程辅助。

## Third-party components

Bundled libraries retain their original license notices, including `dist/vendor/THREE-LICENSE.txt` and notices in individual source files. No license to redistribute third-party portfolio media is granted by this repository.
