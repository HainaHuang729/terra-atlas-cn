# 泰拉观测站 · TERRA GEOGRAPHIC

《明日方舟》非官方中文交互地图与人物档案。用地图认识泰拉的国家、文明、组织与人物。

**[打开交互网站](https://hainahuang729.github.io/terra-atlas-cn/)** · [人物图鉴](https://hainahuang729.github.io/terra-atlas-cn/#people) · [资料与素材来源](NOTICE.md)

## 功能

- 18 个国家与地区，底图对应的交互轮廓、选中高亮、立体视角与玻璃档案卡片。
- 白天／夜间配色、平面／立体切换、拖拽与缩放、主题导览和探索标记。
- 394 位干员、434 个正式形态，另有 3 位非干员人物；异格与职业切换归入同一人物。
- 每形态原始头像、基础事实、职业分支、星级、技能名称和完整资料入口。
- 搜索人物、中英日别名、技能、国家、地点、组织、概念和篇目；共 569 条资料。
- 人物目录按地区、职业与星级筛选，分批加载；支持 `#person/amiya` 等人物分享链接。
- 桌面侧栏与手机底部档案面板；键盘操作、减少动效偏好与本地收藏。

数据为 **2026-10-26 快照**。包含限定、联动、机器人、异格及职业切换；不包含特殊模式专属临时单位、召唤物或陷阱。这里提供基础资料与独立导读，完整剧情档案和战斗数值通过条目内来源链接阅读。

## 本地运行

这是无运行时外部依赖的静态网站，直接使用仓库中的 `dist/` 即可，无需安装 npm 包。

```sh
git clone https://github.com/HainaHuang729/terra-atlas-cn.git
cd terra-atlas-cn
python3 -m http.server 8769 --directory dist
```

打开 <http://localhost:8769/>。收藏、浏览进度和主题偏好仅保存在当前浏览器；切换域名不会自动迁移这些记录。

## 修改资料与检查

使用 Node.js 20 或更新版本。`npm run` 仅运行本地脚本，无需 `npm install`。

```sh
npm run build
npm run check
```

| 路径 | 用途 |
| --- | --- |
| `dist/` | 可直接发布的网站，包括 HTML、CSS、原生 JavaScript 与素材 |
| `data/expanded-content.json` | 地区、地点、组织、篇目与世界设定资料 |
| `data/operator-source.json` | 434 个干员形态的规范化基础事实与官方分组 |
| `data/curated-characters.json` | 首批复核人物档案与稳定链接 |
| `data/operator-summaries.json` | 后续人物导读与资料限制 |
| `data/characters.json` | 合并后的人物档案，由导入脚本生成 |
| `data/region-geometry.json` | 与 1280×822 底图对应的地区轮廓 |
| `data/*sources.json`、`data/operators-provenance.json` | 素材来源、数据版本和校验值 |
| `scripts/` | 资料合并、前端数据生成与一致性检查 |

编辑资料源后运行构建；`dist/characters-data.js`、`dist/archive-data.js` 与 `dist/region-geometry.js` 为生成文件。改变底图时需重新描边，不能直接套用旧轮廓。完整设计、来源与数据整理说明见 [资料与设计记录](docs/data-and-design-notes.md)。

## GitHub Pages 发布

`main` 保存源码，`gh-pages` 保存 `dist/` 的发布内容。Pages 使用 `gh-pages` 分支根目录发布；`.nojekyll` 禁用 Jekyll 转换。资源均采用相对路径，人物与地区链接采用 hash，兼容 GitHub Pages 项目子目录。

修改后先构建、检查并提交，再发布：

```sh
npm run build
npm run check
git add data dist
git commit -m "Update atlas content"
git push origin main
npm run deploy
```

`npm run deploy` 使用 Git 自带的 `subtree`，推送已提交的 `dist/` 内容。发布状态可在仓库的 **Actions** 与 **Settings → Pages** 中查看。Fork 后请把 Pages 发布源设为自己的 `gh-pages` 分支，并修改本文件及 `package.json` 中的网站链接。

## 许可与致谢

项目原创程序代码和项目文档采用 [MIT License](LICENSE)。游戏原始图像、字标、地图及原始资料不在 MIT 许可范围，相关权利归原权利方所有，详见 [NOTICE.md](NOTICE.md) 及逐文件来源清单。

感谢 [鹰角网络](https://ak.hypergryph.com/)、[PRTS](https://prts.wiki/)、[Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 和 [Aceship/Arknight-Images](https://github.com/Aceship/Arknight-Images) 提供作品与公开资料。
