# 彩绘玻璃工作室 · 网页拼片台

为彩绘玻璃工作室设计的网页拼片台：输入矩形窗框的正整数毫米宽高，在画布上以**整数毫米坐标**绘制带**编号与颜色**的简单多边形玻璃片；服务端精确校验每一次编辑，只有**完整覆盖窗框且无空隙**的草稿才能发布；发布时生成**铅条下料清单**（公共边只计一次，外框另列）。历史发布版不可变，随时查阅。

围绕已发布图纸还可**安排铅条生产**：登记铅条原材定尺与库存根数，选择发布版本、件数、原材规格与每刀损耗进行排产；系统按 0.01 mm 精确计算切段方案，确认时**原子预留库存**（并发不超卖），计划永久绑定发布快照。

工作室调整拼片并再次发布后，还可选择**同一图纸的任意两个已发布版本核对铅条下料变化**：按几何位置比较内部公共边与四根外框，区分沿用/取消/新增，部分重叠自动拆分；核对全程**只读**，不影响发布快照、生产计划与库存。

大窗框现场拼接时，可对已发布图纸按**实物 1:1 分张打印**：选择不可变发布版本，输入纸张宽高、四边留白与相邻页重叠宽度（整数毫米），预览按行列编号的总页数、每页覆盖的图纸坐标与拼接标记，并逐页下载物理尺寸为毫米的 SVG；玻璃片轮廓、编号与外框全部取自所选发布快照，跨页轮廓裁切到可打印区域，页内带毫米校准标尺。分张预览与下载全程**只读**。

工作室还可直接从**彩色玻璃原片裁出拼片**：为每种颜色登记一种原片规格（宽高 1–2000 整数毫米）与库存张数；选择发布版本、制作件数与片间最小间距（0–50 整数毫米）后按**该版快照的颜色**排样。每片只能平移或旋转 90° 的整数倍（不得镜像、越板或与同板其他片间距不足），预览逐张给出片号、件次、旋转角、放置坐标与轮廓，以及各色用板数与库存缺口；确认时**原子预留所有颜色**所需原片，任一颜色不足则整单失败；方案永久绑定发布快照。

## 功能一览

- **窗框建模**：宽、高为正整数毫米（1–100000）。
- **拼片绘制**：画布点击取点（自动吸附已有顶点/窗框角），双击或“闭合多边形”完成；也可直接输入 `x,y` 坐标。每片有独立编号与颜色。
- **编辑校验（拒绝并标出位置，图中红色 ✕ 标记）**：
  - 顶点必须是整数毫米，且在窗框内 —— 越界拒绝；
  - 必须是简单多边形：自交（边交叉/边重叠/非端点相触）、重复顶点、零边、相邻共线均拒绝；
  - 与现有拼片**面积重叠**拒绝（边交叉、顶点穿入、共边同侧重叠、顶点处内角相交）；
  - 允许合法相邻：共边共享、T 接、顶点相接；
  - **允许相邻片边界一侧是整边、另一侧为数段**。
- **覆盖检查与缺口可视化**：未发布前实时分析草稿，缺口区域以红色斜纹多边形标出并给出每块缺口面积；面积重叠以紫色标出。
- **发布**：仅当无缺口、无重叠、面积合计等于窗框面积时可发布，否则返回 422 并附带缺口数据。发布版带递增版本号，快照不可变。
- **发布图纸**：展示每片编号、颜色与面积（mm²），画布上直接标注编号与面积。
- **铅条下料清单**：
  - 内部公共边无论怎样分段都**合并为一根、只计一次**（T 接处直线继续则不断开）；
  - 外框四根（上/下/左/右）另列；
  - 每根长度、分类小计与总长都是**先求和再四舍五入至 0.01 mm**。
- **草稿/发布分离**：后续编辑、删除、改色与清单重算只作用于草稿；历史发布版通过版本下拉框查阅，内容永不变化。
- **两版铅条核对（本轮新增）**：
  - 选择同一图纸的两个已发布版本，分别比较**内部公共边**与**四根外框**（上/下/左/右）；
  - 两版**共线且空间重叠**的部分为**沿用**，仅较早版覆盖为**取消**，仅较晚版覆盖为**新增**，部分重叠在端点处**自动拆分**；
  - 比较前做无向直线归一与同版区间合并：**反向记录、清单顺序变化、T 接处分段变化（一侧整边/另一侧数段）都不产生虚假差异**；
  - 展示每类线段的起点/终点（mm）、长度（mm）与分类合计；各类合计**先求和再四舍五入到 0.01 mm**；
  - 版本不存在、两个发布版不属于同一图纸时**明确报错**；核对为**只读**，发布快照、生产计划、库存均不变化。
- **铅条生产（本轮新增）**：
  - **原材登记**：登记原材规格名、**定尺长度**（正数，精确到 0.01 mm）与**库存根数**（非负整数）；非法输入一律拒绝且不改库存。
  - **排产取段**：只取所选**发布版本**铅条清单中的**内部公共边**与**四根外框**（上/下/左/右），按**件数**逐件展开，每一段都是**不可拼接**的独立切段。
  - **切段规则**：切段按长度**降序**排列，同长按清单顺序；依次放入**第一根能容纳**它的原材（首次适应递减 FFD）。每段占用 `成品长度 + 一刀损耗`，放不下就开新原材；输出逐根切段、每根余料与需用根数。
  - **预览不占库存**：任何非法输入、单段连同刀损超过定尺（整单拒绝）都不会改动库存。
  - **缺口与确认**：需用根数超过可用数时返回**缺口根数且不能确认**；确认在一个 `BEGIN IMMEDIATE` 事务中**原子预留**，多计划并发也**不会超卖**。
  - **幂等与释放**：重复确认不会重复预留；取消只释放一次，重复取消不重复改库存；已确认计划不可删除（须先取消）。
  - **快照绑定**：计划一旦建立即绑定该发布版本，后续草稿改动或再发布新版本**都不影响**其用料。
  - 网页“铅条生产”标签可登记库存、预览、确认/取消计划并查看可用库存。
- **1:1 分张打印（本轮新增）**：
  - 在“分张打印”标签选择图纸与**已发布版本**，输入**纸张宽高、四边留白、相邻页重叠宽度（整数毫米）**生成拼接预览；
  - 玻璃片轮廓/编号/颜色/面积与外框**全部取自所选不可变快照**，草稿改动或再发布均不影响已生成的分页（重新预览才取新版本）；
  - 预览给出**行列编号总页数**（行自下而上对应图纸 y 轴、列自左而右）、**每页覆盖的图纸坐标范围**与四边**拼接标记**（邻页页码、重叠带、红色对位十字及其图纸坐标）；
  - 每页可**单独下载 SVG**，也可一键逐页下载：`width/height` 以 **mm** 标定物理尺寸，图纸内容按 1:1 绘制并**裁剪到可打印区域**，重叠带在相邻两页使用**完全相同的图纸坐标**，页内含**毫米校准标尺**（打印请选“实际大小/100%”）；
  - **校验**：纸张尺寸与重叠必须为正，留白可为零；可打印尺寸非正、重叠不小于任一可打印边长、版本不存在、总页数超过 **200** 时**明确拒绝且不输出部分页面**；
  - 预览与下载均为**只读**，不修改草稿、发布版、生产计划或库存。
- **原片裁片（本轮新增）**：
  - **原片登记**：每种**颜色**登记**一种**原片规格（宽、高为 **1–2000 整数毫米**）与**库存张数**（非负整数）；颜色归一为小写 `#rrggbb`，同色重复登记拒绝；只可改备注名与库存（颜色/宽高属于规格身份），**库存不得低于已预留数**。
  - **按快照颜色排样**：选择发布版本、**制作件数**（正整数）与**片间最小间距**（**0–50 整数毫米**），按该不可变版本快照中的拼片**逐件展开、按颜色分板**；**总裁片数最多 60 张**（各色用板之和）。
  - **变换约束**：每片只可**平移**或**旋转 90° 的整数倍**（0/90/180/270，**不得镜像**），不得**越板**，同板两片轮廓距离不得小于最小间距（贴原片边沿无需留缝）。
  - **排样算法**：面积降序（大者优先）+ 逐颜色首次适应 skyline bottom-left；以片包围盒向右/上外扩间距后占位，占位框不重叠即保证轮廓间距。**无须全局最少用板**；相同版本与排样参数的布局逐字节一致（确定性）。
  - **预览**：给出**逐张原片**的**片号、件次、旋转角度、放置坐标 (x,y) 与轮廓**（均为整数毫米原片坐标），以及**各颜色用板数、库存、已预留、可用与缺口**；预览不落库、不占库存。
  - **整单报错（不产生部分方案）**：缺少某颜色的原片登记、单片任何 90° 朝向都放不进该色原片、参数非法（间距/件数/原片宽高越界）、或总张数超过 60 时，整单 4xx/422 拒绝。
  - **原子预留与并发**：确认在一个 `BEGIN IMMEDIATE` 事务内核对**所有颜色**库存，任一颜色不足则**整单失败、不产生任何颜色的预留**；多单并发也不超卖。
  - **幂等与释放**：重复确认不重复预留；**取消只释放一次**（整单释放全部颜色），重复取消不重复改库存；已确认裁片单不可改不可删（须先取消）。
  - **快照绑定**：裁片单一经建立即绑定发布版本，草稿变动或再发布**都不改变**已确认方案（片号/颜色/轮廓/放置均不变）。
  - 网页“原片裁片”标签可登记原片、排样预览、逐色逐板查看并确认/取消裁片单。

## 技术栈

- Node.js ≥ 20（CommonJS）
- Express 4（Web/API/静态资源）
- better-sqlite3（SQLite，同步事务）
- 原生 HTML/CSS/Canvas + 原生 JS（无前端构建步骤）
- 几何判定全部使用整数坐标的精确整数运算（叉积/射线法），交点以精确分数表示，避免浮点误差

## 快速启动

### 方式一：Docker Compose（推荐，一键启动并初始化数据库）

```bash
docker compose up -d --build
```

首次启动会自动构建镜像、安装依赖，并在容器内对 `/data/studio.db` 执行建表初始化
（`CREATE TABLE IF NOT EXISTS`），无需手动初始化。

浏览器打开：

```
http://localhost:3000
```

停止：

```bash
docker compose down          # 保留数据卷
docker compose down -v       # 同时删除数据库卷
```

### 方式二：本地 Node.js 运行

```bash
npm install
npm start
```

若 better-sqlite3 需要本地编译，请确保具备 Python 3、make、g++（Debian/Ubuntu：
`apt-get install -y python3 make g++`）。

浏览器同样打开 http://localhost:3000 。

运行几何算法测试：

```bash
npm test
```

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_PATH` | `data/studio.db`（本地）/ `/data/studio.db`（Docker） | SQLite 数据库文件路径；目录不存在会自动创建，首次启动自动建表 |

Compose 中通过命名卷 `studio-data` 持久化 `/data`；改宿主机端口只需修改
`docker-compose.yml` 的端口映射（如 `"8080:3000"`）。

## 网页地址与端口

- 应用首页：`http://localhost:3000/`
- 端口：`3000`（可用 `PORT` 环境变量或 compose 端口映射更改）

## HTTP API 摘要

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/designs` | 图纸列表 |
| POST | `/api/designs` | 新建图纸 `{name,width,height}`（宽高正整数毫米） |
| GET | `/api/designs/:id` | 草稿完整汇总（片/面积/缺口/铅条清单） |
| POST | `/api/designs/:id/pieces` | 新增拼片 `{color,polygon:[[x,y],...]}` |
| PUT | `/api/designs/:id/pieces/:pieceId` | 编辑拼片（改色/改顶点） |
| DELETE | `/api/designs/:id/pieces/:pieceId` | 删除拼片（仅草稿） |
| POST | `/api/designs/:id/publish` | 发布（未完整覆盖返回 422 + 缺口数据） |
| GET | `/api/designs/:id/publications` | 发布版列表 |
| GET | `/api/designs/:id/publications/:version` | 查阅指定发布版（不可变快照） |
| GET | `/api/designs/:id/publications/diff?fromVersion=1&toVersion=2` | 两版铅条核对（版本号；自动按版本号定较早/较晚，只读） |
| POST | `/api/designs/:id/publications/:version/print/preview` | 1:1 分张打印预览 `{paperWidth,paperHeight,margin,overlap}`（整数毫米，只读） |
| GET | `/api/designs/:id/publications/:version/print/page?paperWidth&paperHeight&margin&overlap&page=n` | 下载指定页 SVG（`image/svg+xml`，物理尺寸 mm，只读） |
| POST | `/api/publications/diff` | 两版铅条核对 `{publicationIdA,publicationIdB}`（非同图纸返回 400） |
| GET | `/api/materials` | 铅条原材规格与库存（含已预留/可用根数） |
| POST | `/api/materials` | 登记原材 `{name,length,stock}`（定尺正数 mm、库存非负整数） |
| GET | `/api/materials/:id` | 单个原材规格 |
| PATCH | `/api/materials/:id` | 改名称/库存根数 `{name?,stock?}`（定尺不可改；库存不得低于已预留） |
| POST | `/api/plans/preview` | 排产预览 `{publicationId,materialId,copies,kerf}`（不落库、不占库存） |
| POST | `/api/plans` | 建草稿计划（同上，可带 `name`） |
| GET | `/api/plans` | 计划列表（含状态/需用/缺口） |
| GET | `/api/plans/:id` | 计划详情（逐根切段、余料、绑定版本） |
| PUT | `/api/plans/:id` | 修改草稿（重选版本/件数/原材/刀损并重算） |
| POST | `/api/plans/:id/confirm` | 确认并原子预留；缺口返回 409 |
| POST | `/api/plans/:id/cancel` | 取消并释放预留（幂等） |
| DELETE | `/api/plans/:id` | 删除草稿/已取消计划（已确认须先取消） |
| GET | `/api/glass-materials` | 彩色玻璃原片规格与库存（颜色/宽高/库存/已预留/可用张数） |
| POST | `/api/glass-materials` | 登记颜色原片 `{color,width,height,stock,name?}`（宽高 1–2000 整数、库存非负整数） |
| GET | `/api/glass-materials/:id` | 单个颜色原片规格 |
| PATCH | `/api/glass-materials/:id` | 改备注名/库存张数 `{name?,stock?}`（颜色宽高不可改；库存不得低于已预留） |
| POST | `/api/glass-plans/preview` | 裁片排样预览 `{publicationId,copies,gap}`（不落库、不占库存；缺色/放不下/超 60 张整单 422） |
| POST | `/api/glass-plans` | 建草稿裁片单（同上，可带 `name`） |
| GET | `/api/glass-plans` | 裁片单列表（含状态/各色用板/缺口） |
| GET | `/api/glass-plans/:id` | 裁片单详情（逐张原片的片号/件次/角度/坐标/轮廓、绑定版本） |
| PUT | `/api/glass-plans/:id` | 修改草稿（重选版本/件数/间距并重排） |
| POST | `/api/glass-plans/:id/confirm` | 确认并原子预留所有颜色；任一颜色不足返回 409（整单失败） |
| POST | `/api/glass-plans/:id/cancel` | 取消并整单释放预留（只释放一次，幂等） |
| DELETE | `/api/glass-plans/:id` | 删除草稿/已取消裁片单（已确认须先取消） |

校验失败统一返回：

```json
{ "ok": false, "error": "原因", "category": "invalid|out_of_frame|overlap|not_covered",
  "at": [x, y], "gaps": [ { "polygon": [[x,y],...], "area": 1234.5 } ] }
```

## 使用流程

1. 左侧“新建图纸”，输入名称与窗框宽高（正整数毫米）。
2. 选择颜色，在画布上依次点击顶点绘制多边形（可自动吸附），双击完成；或在文本框逐行输入 `x,y` 后点“闭合多边形”。
3. 若被拒绝，画布会用红色 ✕ 标出问题位置，顶部红条说明原因与坐标。
4. 重复绘制直到覆盖状态变为“✓ 完整覆盖，无空隙”；绘制过程中缺口实时以红色斜纹显示。
5. 点击“发布图纸”，得到新版本；切到“已发布图纸”标签，选择版本查阅图纸、面积明细与铅条下料清单。
6. 发布后仍可继续编辑草稿（产生新版本），旧版本内容保持不变。
7. 切到“版本核对”标签：选择图纸与较早/较晚两个发布版 → “核对铅条下料变化”：画布与表格展示沿用（蓝实线）、取消（红虚线）、新增（绿实线）每一段的位置与长度，以及内部公共边、四根外框与总计三类合计。
8. 切到“铅条生产”标签：登记原材定尺与库存根数 → 选发布版本/件数/原材/每刀损耗 → “排产预览”查看逐根切段与余料 → “存为草稿计划” → 库存足够时“确认计划”原子预留；需要退料时“取消计划”释放预留。
9. 切到“分张打印”标签：选图纸与已发布版本 → 输入纸张宽高、四边留白与相邻页重叠（整数毫米）→ “生成拼接预览”查看行列总页数、每页覆盖坐标与拼接标记 → 逐页或一键“逐页下载全部 SVG”，打印时选择“实际大小/100%”，按重叠带与红色对位十字现场拼接。
10. 切到“原片裁片”标签：为每种颜色登记原片规格（宽高 1–2000 mm）与库存张数 → 选发布版本/件数/片间最小间距 → “排样预览”查看逐色逐张原片上的片号、件次、旋转角、放置坐标与轮廓及各色缺口 → “存为草稿裁片单” → 库存充足时“确认裁片单”原子预留所有颜色；需要退料时“取消裁片单”整单释放一次。

## 铅条生产排产规则

- **长度单位**：所有长度（定尺、切段、刀损、余料）内部都以 **0.01 mm 的整数倍**精确运算，接口接受至多两位小数的毫米数；超过精度（如 `6000.005`）直接拒绝。
- **切段来源**：仅来自所选发布版本 `snapshot.leadList` 的 `internal`（内部公共边）与 `frameBars`（四根外框），按 `件数` 逐件复制，段不可拼接、不可跨件合并。
- **装箱**：切段先按长度降序、同长按清单顺序排序，再依次放入第一根剩余容量足够的原材；每段占位 = 成品长度 + 一刀损耗。某段 `成品 + 刀损 > 定尺` 时整单拒绝（返回 422 与该段信息）。
- **库存口径**：`available = stock − 所有已确认计划的 requiredBars 之和`。预览与草稿都不占库存；只有确认才预留。
- **并发**：确认使用 SQLite `BEGIN IMMEDIATE` 写事务，读取库存→核对缺口→置为 confirmed 在同一事务内完成，并发确认最多售出实际库存。

## 原片裁片排样规则

- **单位与取值**：原片宽/高、片间最小间距、放置坐标全部为**整数毫米**。原片宽高 **1–2000**，间距 **0–50**，件数为正整数；越界一律 400 拒绝。
- **原片与颜色**：每种颜色（小写 `#rrggbb`）**只登记一种**原片规格；颜色与宽高是规格身份，登记后不可改（请新建颜色条目），只可改备注名与库存张数，且**库存不得小于已确认裁片单的预留张数**。
- **任务展开**：按所选发布快照 `snapshot.pieces` 的**颜色**分组，逐件复制；同色片排到该色原片上，不同颜色绝不同板。
- **允许的变换**：仅**平移**与绕片心意义上的 **90° 整数倍旋转**（0/90/180/270，行列式恒为 +1，**不镜像**）；180°/0°、270°/90° 的轴对齐包围盒等价，排样在两个等价类中择优，输出仍给出真实角度。
- **不越板、保间距**：片的多边形恒在其轴对齐包围盒内；排样以包围盒**向右、向上各外扩 gap** 作为占位框（贴板边沿不预留缝），skyline 保证占位框互不重叠，于是同板任意两片在 x 或 y 方向的包围盒距离 ≥ gap，多边形轮廓距离随之 ≥ gap；`gap=0` 时允许共边/T 接/顶点相触。所有坐标保持整数，精确无浮点误差。
- **装箱算法**：片按面积（2 倍整数面积）降序；逐颜色首次适应（FFD）skyline bottom-left——依次放入第一张能容纳它的原片，每片在该板取**最低、再最左**的位置；放不下开新原片。**不追求全局最少用板**；相同版本与排样参数的结果**完全确定**。
- **上限**：所有颜色用板之和超过 **60** 张时整单 422 拒绝（`too_many_sheets`，附 `totalSheets/maxSheets`），**不产生部分方案**。
- **整单失败的其他情形**：快照含未登记的颜色（`color_material_missing`，附 `missingColors`）；单片在 0/90 朝向下都无法进入该色原片（`piece_too_large`，附片号/件次/轮廓宽高/原片宽高）。
- **库存口径**：`available = stock − 所有已确认裁片单该色用板之和`。预览与草稿不占库存；只有确认才预留。
- **原子预留 / 并发**：确认在单个 `BEGIN IMMEDIATE` 事务中读取各色库存、核对全部颜色缺口、置为 confirmed；任一颜色不足即回滚，返回 409 与**逐色** required/available/shortage，**不会只预留部分颜色**；多单并发也不超卖。
- **幂等**：重复确认返回 409 且不重复预留；取消把整单所有颜色释放**一次**，重复取消返回 409 且不再次改库存。
- **快照绑定**：裁片单保存的是发布快照上的确定排样（含每板每片的角度/坐标/轮廓）；之后改草稿、改颜色、再发布都**不影响**已确认方案。

### 原片裁片调用示例（curl）

```bash
# 1) 为颜色登记原片：#ff0000 红玻 500×400 mm、库存 4 张
curl -s localhost:3000/api/glass-materials -H 'Content-Type: application/json' \
  -d '{"color":"#FF0000","name":"红玻 3mm","width":500,"height":400,"stock":4}'
# -> {"ok":true,"material":{"id":1,"color":"#ff0000","width":500,"height":400,
#      "stock":4,"reserved":0,"available":4,...}}   # 颜色归一为小写

# 查各色库存（reserved=已确认裁片单预留，available=还可用于新单）
curl -s localhost:3000/api/glass-materials

# 2) 排样预览：发布版 1，2 件，片间最小间距 4 mm（不落库、不占库存）
curl -s -X POST localhost:3000/api/glass-plans/preview -H 'Content-Type: application/json' \
  -d '{"publicationId":1,"copies":2,"gap":4}'
# -> { ok:true, preview:{ publicationId, designId, version, copies, gap,
#      layout:{ totalSheets, totalPieces, feasible, totalShortage,
#        colors:[{ color, sheetWidth, sheetHeight, usedSheets, pieceCount,
#                  stock, reserved, available, shortage,
#                  boards:[{ index, placements:[
#                    { pieceNo, copy, rotation, x, y, polygon:[[x,y],...], bbox } ] }] }] } } }

# 3) 存草稿 → 确认（原子预留所有颜色）→ 取消（整单释放一次）
curl -s -X POST localhost:3000/api/glass-plans -H 'Content-Type: application/json' \
  -d '{"name":"门面三联窗","publicationId":1,"copies":2,"gap":4}'
curl -s -X POST localhost:3000/api/glass-plans/1/confirm
curl -s -X POST localhost:3000/api/glass-plans/1/cancel

# 缺颜色（快照含 #0000ff 但未登记原片）→ 整单 422，不排任何色
curl -s -X POST localhost:3000/api/glass-plans/preview -H 'Content-Type: application/json' \
  -d '{"publicationId":2,"copies":1,"gap":0}'
# -> 422 {"ok":false,"code":"color_material_missing","missingColors":["#0000ff"], ...}

# 单片放不下（片轮廓 50×100，该色原片 40×40，任何 90° 朝向都放不下）
# -> 422 {"ok":false,"code":"piece_too_large","pieceNo":2,"copy":1,
#         "pieceWidth":50,"pieceHeight":100,"sheetWidth":40,"sheetHeight":40,...}

# 确认时库存不足（任一颜色缺）→ 409，整单不预留
# -> {"ok":false,"code":"shortage",
#     "shortages":[{"color":"#ff0000","required":2,"available":1,"shortage":1}, ...]}

# 非法参数：间距 51、件数 0、原片宽 2001、库存 -1 → 均 400，库存不变
```

## 两版铅条核对规则

- **比较对象**：同一图纸的两个已发布版本（只读快照）。较早版 / 较晚版按版本号自动确定，`fromVersion` 与 `toVersion` 填反也会归一，不会把“沿用”错算成“取消+新增”。
- **分类口径（纯几何）**：把两版每根铅条放到同一根**无向直线**上，以沿直线的参数区间表示其空间覆盖：
  - 两版区间重叠的原子段 = **沿用（kept）**；
  - 仅较早版覆盖 = **取消（removed）**；仅较晚版覆盖 = **新增（added）**；
  - 部分重叠时以双方端点为界**拆分**为沿用/取消/新增三段。
- **不产生虚假差异的归一**：直线与方向无向归一（端点反向、清单顺序无关）；同一版同一直线上相接的区间先合并，因此 **T 接处“一侧整边、另一侧数段”** 等纯分段变化相互抵消；同一直线上两段不连续时中间空隙保留，不会被错误合并。
- **比较范围**：内部公共边（按几何直线自动分组）与四根外框（上/下/左/右分别核对；外框由窗框固定，同图纸两版通常四框全部沿用）。
- **精度**：直线分组与区间运算在“放大 100 倍”的整数坐标上精确完成（端点均为整数毫米）；段长为欧氏长度，**各类合计先对各段原始长度求和，再四舍五入到 0.01 mm**（斜线段可能出现 3 段各 1.41 mm、合计 4.24 mm 而非 4.23 mm 的情形，属预期）。
- **报错**：版本不存在返回 404；两个发布版不属于同一图纸（含窗框尺寸不一致）返回 400/422；接口不写数据库，**发布快照、生产计划、库存根数都不受影响**。

### 两版核对调用示例（curl）

```bash
# 方式一（GET，版本号）：核对 1 号图纸 v1 → v2
curl -s 'localhost:3000/api/designs/1/publications/diff?fromVersion=1&toVersion=2'
# -> { ok:true, meta:{ earlier:{version:1}, later:{version:2}, width,height },
#      diff:{ internal:{ kept:[{from,to,length}], removed:[...], added:[...], counts, totals },
#              frame:{"上框":{kept,removed,added,counts,totals}, ...}, frameOrder,
#              frameTotals, frameCounts, totals, counts } }

# 填反版本号也会自动归位（earlier 恒为较早版）
curl -s 'localhost:3000/api/designs/1/publications/diff?fromVersion=2&toVersion=1'

# 方式二（POST，发布版 id）
curl -s localhost:3000/api/publications/diff -H 'Content-Type: application/json' \
  -d '{"publicationIdA":1,"publicationIdB":2}'

# 版本不存在
curl -s 'localhost:3000/api/designs/1/publications/diff?fromVersion=1&toVersion=99'
# -> 404 {"ok":false,"error":"发布版 v99 不存在"}

# 两个发布版不属于同一图纸
curl -s localhost:3000/api/publications/diff -H 'Content-Type: application/json' \
  -d '{"publicationIdA":1,"publicationIdB":8}'
# -> 400 {"ok":false,"error":"两个发布版不属于同一图纸，不能核对铅条",
#         "designIdA":1,"designIdB":3}
```

响应中 `diff.totals` 为“内部公共边 + 四根外框”的总合计，`diff.internal.totals`、
`diff.frameTotals` 为分项合计；每个合计都含 `kept/removed/added` 三个长度（mm，
两位小数），`counts` 为对应段数。

## 1:1 分张打印规则

- **输入（全部整数毫米）**：`paperWidth`/`paperHeight` 纸张宽高（必须为正）、`margin` 四边统一留白（可为 0）、`overlap` 相邻页重叠宽度（必须为正）。
- **可打印区域**：`(paperWidth − 2·margin) × (paperHeight − 2·margin)`；非正时整单拒绝（`printable_not_positive`）。重叠必须**严格小于**可打印区域的**每一条**边长，否则拒绝（`overlap_too_large`）。
- **分页步距**：某方向内容长 `L`、可打印长 `p`、重叠 `o`，步距为 `p − o`；页数 `n = L ≤ p ? 1 : ceil((L − o)/(p − o))`，因此任意相邻页重叠不少于 `o`，末页覆盖末端恰好到窗框边。
- **编号**：行自下而上（对应图纸 y 轴正方向）、列自左而右；页码先行内从左到右、再从下到上，`page = (row−1)·cols + col`。
- **拼接标记**：每页四边给出存在相邻页的方向、邻页页码、重叠带范围（相邻两页对同一拼接边算出的范围**完全相同**），长边上沿带长 1/4、1/2、3/4 放置红色对位十字（短边放正中一个），并标注十字的图纸坐标。
- **SVG 内容**：根元素 `width="<paperWidth>mm" height="<paperHeight>mm"`、`viewBox` 同值，打印按 1:1；玻璃片多边形、编号/面积、颜色与外框矩形全部来自发布快照；整页图纸内容套在 `clipPath`（即可打印区域）内，跨页轮廓自然裁切；重叠带在两页以相同图纸坐标重复绘制；页内含 0–100 mm 的**毫米校准标尺**（可打印区域过窄时改竖尺）与“实际大小/100%、勿缩放”提示。
- **页数上限**：`cols × rows > 200` 时返回 422（`too_many_pages`，附 `cols/rows/totalPages`），**不输出任何部分页面**。
- **只读**：两个接口均不写数据库，草稿、发布快照、生产计划、库存都不受影响。

### 分张打印调用示例（curl）

```bash
# 1) 生成拼接预览（A4、四边留白 10mm、相邻页重叠 15mm）
curl -s -X POST localhost:3000/api/designs/1/publications/1/print/preview \
  -H 'Content-Type: application/json' \
  -d '{"paperWidth":210,"paperHeight":297,"margin":10,"overlap":15}'
# -> { ok:true, preview:{ designId, version, publicationId,
#      print:{ paper:{width,height}, margin, overlap,
#              printable:{width,height}, content:{width,height},
#              cols, rows, totalPages, pageNumbering,
#              pages:[ { page,row,col,rows,cols,
#                        coverage:{x0,y0,x1,y1,width,height},
#                        seams:[{edge,direction,paperCoord,drawingCoord,neighborPage,
#                                overlap:{x0,y0,x1,y1,width,height},
#                                crosses:[{x,y}]}],
#                        svgUrl } ] } } }

# 2) 下载第 1 页 SVG（参数须与预览一致；返回 image/svg+xml，物理尺寸 mm）
curl -s -G localhost:3000/api/designs/1/publications/1/print/page \
  --data-urlencode 'paperWidth=210' --data-urlencode 'paperHeight=297' \
  --data-urlencode 'margin=10' --data-urlencode 'overlap=15' \
  --data-urlencode 'page=1' -o page-1.svg

# 非法参数：可打印尺寸非正（留白 200 ≥ 半边长）
curl -s -X POST localhost:3000/api/designs/1/publications/1/print/preview \
  -H 'Content-Type: application/json' \
  -d '{"paperWidth":210,"paperHeight":297,"margin":200,"overlap":5}'
# -> 400 {"ok":false,"code":"printable_not_positive", ...}

# 非法参数：重叠不小于可打印边长（可打印 190×277）
curl -s -X POST localhost:3000/api/designs/1/publications/1/print/preview \
  -H 'Content-Type: application/json' \
  -d '{"paperWidth":210,"paperHeight":297,"margin":10,"overlap":190}'
# -> 400 {"ok":false,"code":"overlap_too_large", ...}

# 页数超过 200（5mm 纸、1mm 留白 → 3×3 可打印，600×400 图纸 = 200×134 页）
curl -s -X POST localhost:3000/api/designs/1/publications/1/print/preview \
  -H 'Content-Type: application/json' \
  -d '{"paperWidth":5,"paperHeight":5,"margin":1,"overlap":1}'
# -> 422 {"ok":false,"code":"too_many_pages","cols":200,"rows":134,"totalPages":26800,"maxPages":200}

# 版本不存在 / 页码越界
curl -s -X POST localhost:3000/api/designs/1/publications/99/print/preview \
  -H 'Content-Type: application/json' \
  -d '{"paperWidth":210,"paperHeight":297,"margin":10,"overlap":15}'
# -> 404 {"ok":false,"error":"发布版 v99 不存在"}
curl -s -G localhost:3000/api/designs/1/publications/1/print/page \
  --data-urlencode 'paperWidth=210' --data-urlencode 'paperHeight=297' \
  --data-urlencode 'margin=10' --data-urlencode 'overlap=15' \
  --data-urlencode 'page=99'
# -> 400 {"ok":false,"error":"页码必须是 1–8 之间的整数"}
```

### HTTP 调用示例（curl）

```bash
# 1) 登记原材：定尺 6000.00 mm、库存 10 根
curl -s localhost:3000/api/materials -H 'Content-Type: application/json' \
  -d '{"name":"6m 通用铅条","length":6000,"stock":10}'
# -> {"ok":true,"material":{"id":1,"name":"6m 通用铅条","length":6000,"stock":10,"reserved":0,"available":10,...}}

# 2) 查可用库存（reserved=已确认计划预留，available=还可用于新计划）
curl -s localhost:3000/api/materials

# 3) 排产预览（publicationId 取自发布接口返回的 id；不落库、不占库存）
curl -s localhost:3000/api/plans/preview -H 'Content-Type: application/json' \
  -d '{"publicationId":1,"materialId":1,"copies":3,"kerf":0.5}'
# -> preview.layout.bars[]：每根原材的 cuts（件次/切段名/成品长/刀损）、remainder 余料；
#    requiredBars 需用根数、availableBars 可用、shortage 缺口、feasible 是否可确认

# 4) 建草稿计划
curl -s localhost:3000/api/plans -H 'Content-Type: application/json' \
  -d '{"name":"三联窗订单","publicationId":1,"materialId":1,"copies":3,"kerf":0.5}'

# 5) 确认（库存足够才成功；缺口返回 409 + shortage）
curl -s -X POST localhost:3000/api/plans/1/confirm
# 6) 取消（释放预留；重复取消返回 409 且不再次改库存）
curl -s -X POST localhost:3000/api/plans/1/cancel
# 7) 查全部计划与可用库存
curl -s localhost:3000/api/plans
curl -s localhost:3000/api/materials
```

非法输入示例（均返回 400，库存不变）：定尺 `0`/负数、库存 `-1`、件数 `0`/`1.5`、刀损 `-0.01`、长度精度超过 0.01 mm。

## 目录结构

```
Dockerfile               容器镜像（含 better-sqlite3 编译环境）
docker-compose.yml       一键启动 + 数据卷持久化
src/
  server.js              Express 入口与 API（图纸/发布/两版核对/原材/生产计划）
  db.js                  SQLite 初始化与数据访问（含原子预留事务）
  geometry.js            精确几何校验、覆盖/缺口分析、铅条合并
  leaddiff.js            两版铅条核对（整数直线分组、区间沿用/取消/新增、拆分）
  cutting.js             铅条切段排产（0.01mm 整数运算、FFD、刀损）
  nesting.js             原片裁片排样（整数毫米、90°旋转、skyline bottom-left、精确间距不变量）
  printsheet.js          1:1 分张打印（整数毫米分页、拼接标记、逐页 SVG/毫米标尺）
public/
  index.html / style.css / app.js   单页前端（Canvas 编辑器/发布视图/版本核对/分张打印/铅条生产/原片裁片）
test/
  geometry.test.js       几何算法测试（node --test）
  leaddiff.test.js       两版核对：反向/顺序/T接归一、部分重叠拆分、斜向合计舍入、非同图纸报错
  cutting.test.js        切段解析与 FFD 排产测试
  nesting.test.js        原片排样：参数校验/90°旋转/间距整数判定/越板/60 张上限/确定性
  nesting.invariants.test.js  排样不变量：多组配置下逐放置复核不越板/间距达标/无镜像/布局确定
  printsheet.test.js     分张分页/重叠坐标一致/页数上限/SVG 物理尺寸与裁剪测试
  print.api.test.js      分张打印端到端（预览/逐页 SVG、非法参数整单拒绝、404/422、只读）
  plans.api.test.js      生产计划端到端测试（含并发不超卖、快照绑定）
  glass.api.test.js      原片裁片端到端（缺色/放不下/超 60 整单拒绝、原子预留、并发不超卖、快照绑定）
  diff.api.test.js       两版核对端到端测试（GET/POST、404/400、只读不改变快照/计划/库存）
```
