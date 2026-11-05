# Earthmind TerraLink 本地部署

官方基线为 `earth-flow/terralink` 提交 `9b740b853559a28ba744c535bdd4572fb3e4dc05`。本地补充部署脚本、独立生产构建及联调兼容修正：私网HTTP的cookie设置、Terrabox在HTTP200响应内报告工具失败时的错误展示，以及构建期字体网络依赖和两处JSX转义。版本证据和浏览器记录放在Earthmind的 `research/n069-terralink/`。

## 环境与配置

已使用Node v22.21.0、npm10.9.4执行官方锁文件安装：

```bash
cd /data2/liyezhuoxin/terralink-water-demo
npm ci --no-audit --no-fund
```

新建不提交的 `.env.local`：

```dotenv
NEXT_PUBLIC_TERRALINK_BASE_URL=http://127.0.0.1:8010
JWT_COOKIE_NAME=earthmind_terralink_session
JWT_COOKIE_SECURE=false
```

该文件没有账户密码或API key。浏览器通过同源BFF登录和代理调用；独立cookie名避免同一服务器其他端口前端的会话重名。`JWT_COOKIE_SECURE=false`仅对应目前的组内HTTP入口；改用HTTPS时设为true或移除（生产默认Secure）。cookie始终HttpOnly、SameSite=Lax。

## 启动与停止

默认仅loopback调试，不改变其他服务：

```bash
cd /data2/liyezhuoxin/terralink-water-demo
bash scripts/earthmind/start.sh
curl --noproxy '*' http://127.0.0.1:4174/
bash scripts/earthmind/stop.sh
```

浏览器访问 `http://127.0.0.1:4174`，输入已有Terrabox账号。日志及PID在被忽略的`.runtime/`，停止脚本只处理本目录记录的独立进程组。

当前（2026-11-06）私网地址为`10.171.205.153`，运行的是下文生产release。开发模式如需绑定私网，由主协调先安排端口；不应与生产实例同时占用4174：

```bash
TERRALINK_HOST=10.171.205.153 bash scripts/earthmind/start.sh
```

此时浏览器用 `http://10.171.205.153:4174`。这不会重新启动8010/7861/7862/4173，也不会启动模型。

开发运行使用`next dev`。生产构建与运行按下方独立release流程执行；不要在运行dev的源码目录直接执行`npm run build`。本节点的实际构建结果以Earthmind交付记录为准。

## 复验路径

1. 登录后进入Toolkits，可搜索工具箱并打开工具详情。
2. `example` → `Math Add` → Start Test，输入a=2/b=3，Execute Tool，检查实际输出result=5。
3. `geo_basic` → `Area → Pixels`，仅填area_m2=100，保持GSD为空，Execute Tool，应显示Execution Failed及缺GSD错误；不能把HTTP200当工具成功。
4. Execution History中查看真实执行记录，Logout清除本前端会话。

这些是轻量工程联调，不是遥感模型推理或科学任务验证。图谱联合检查由N070新工具就绪后另记。

## 2026-11-03 实际验证记录

图谱联合检查现已完成：登录后目录为18工具箱/128工具；`graph_query.get_item`读取N003及8个成员，`query_nodes`按N003筛选时`limit=1`仍报告完整count=8，`search_graph`实际找到N003；无效作用域显示失败。证据在Earthmind的`research/n069-terralink/browser-graph-verification.json`及08—12截图，截图原始JSON已遮罩以保留私有源字段。

独立4174的停止/启动脚本已实测，最终保留在线地址为`http://100.108.11.72:4174`。该次冷启动94秒、首次页面编译94.3秒；首次浏览器导航120秒超时，暖机后重试通过。当前仍为`next dev`：完整生产构建人工终止，180秒限时no-lint构建超时，未声称生产构建成功。不要在同一`.next`目录并行执行build与dev；如需重试生产构建由主协调agent安排独立停机窗口。

## 2026-11-06 独立生产构建与切换

上节保留11月3日快照。现在增加独立release脚本，构建无需停止旧dev：

```bash
cd /data2/liyezhuoxin/terralink-water-demo
bash scripts/earthmind/build.sh /data2/liyezhuoxin/terralink-releases/production-NEW
```

目录必须尚不存在，且位于源码树外。脚本复制当前Git已跟踪及未忽略的新源码，复制本地`.env.local`且将其权限设为600，不记录内容；既有`node_modules`仅通过symlink复用，不安装或升级依赖。构建期间也不要另行修改/安装依赖。Next源码、`.next`、类型生成与lint缓存均在release目录内，原4174的`.next`不参与构建。发布目录里的`earthmind-release.json`固定Git HEAD、逐文件SHA256、锁文件hash、Node版本、构建命令/时长/退出码与BUILD_ID，`build.log`保留完整日志。只有`state=READY`且BUILD_ID一致才能启动。完整`next build`包括lint和类型检查；worker限制为2，页面使用系统字体，构建无需Google字体网络请求。

`/tmp`里的release可供临时联调，重启或清理可能删除；上例直接构建到源码树外的持久磁盘目录。构建脚本会拒绝源码树内部的路径，包括`.releases/`，以免把旧release递归复制到新release。依赖symlink仍指向本机原安装目录，不能把这个目录当独立可迁移的发布包。

新端口启动必须先由主协调安排。以下默认只绑定loopback的4176，不触碰旧4174：

```bash
TERRALINK_HOST=127.0.0.1 TERRALINK_PORT=4176 \
  bash scripts/earthmind/start-production.sh /data2/liyezhuoxin/terralink-releases/production-NEW
curl --noproxy '*' http://127.0.0.1:4176/
TERRALINK_PORT=4176 bash scripts/earthmind/stop-production.sh
```

运行PID、release路径和服务日志放在源码`.runtime/production-PORT/`，与旧dev的PID文件分离。启动前检查BUILD_ID及端口占用；停止只向该PID文件记录且cwd/进程组匹配的release发TERM。脚本返回启动进程不代表真实登录或工具验收，应继续完整浏览器路径。

若当前4174仍是旧dev，主协调确认独立生产浏览器通过后，可在短停机窗口复用私网4174。以下是首次dev→production切换示例；当前已是production，应使用`stop-production.sh`停止：

```bash
# 仅停止旧dev，不操作Terrabox/Terraflow/模型。
bash scripts/earthmind/stop.sh
TERRALINK_HOST=10.171.205.153 TERRALINK_PORT=4174 \
  bash scripts/earthmind/start-production.sh /data2/liyezhuoxin/terralink-releases/production-NEW
```

若需回到旧dev，先`TERRALINK_PORT=4174 bash scripts/earthmind/stop-production.sh`，确认端口释放，再按上文旧`start.sh`启动。生产环境的登录与退出现在共同使用`JWT_COOKIE_SECURE`，HTTP私网仍需显式false；HTTPS保持Secure。实际生产build/服务切换/浏览器记录另见Earthmind `research/n069-terralink/2026-11-06/`，旧失败记录不覆盖。


### 当前耐久实例与复验（2026-11-06）

旧`100.108.11.72`当前不在本机接口中，启动绑定该地址实际失败`EADDRNOTAVAIL`；`ip -brief address`确认当前私网为`10.171.205.153`，本机未发现`tailscale`命令。不把当前连接称为已确认的Tailscale服务；默认loopback加SSH隧道仍可用。

完整release04构建于`/tmp/earthmind-terralink-20261106-production-04`，BUILD_ID为`-GnhgIwva6-RzwqzqhmE7`。主协调将其**搬移副本**放在被Git忽略的`/data2/liyezhuoxin/terralink-water-demo/.releases/20261106-production-04`，核对215个文件hash与BUILD_ID不变，`.env.local`权限600。仅更新耐久manifest的`release_directory`并追加`relocated_from`/时间；原始manifest和构建证据保留在Earthmind日期目录。`.releases`是现有构建产物的存放点，不是新build的合法目标。

主协调停止临时4174并从耐久目录启动，PID237622。C随后以真实浏览器确认私网登录、18工具箱/128工具目录、MathAdd(2,3)=5及退出清cookie；pageerror为空。搬移前loopback4176与私网4174均完成登录、目录、轻量成功、缺参数业务错误、执行历史、退出六项；私网图谱联调另完成详情、完整count与截断列表、查找、非法作用域可见错误。证据分别在Earthmind日期目录的`production-loopback/`、`production-private/`、`production-private-graph/`与`production-durable-private/`。图谱输出截图已遮罩。

当前实例的可复现停止/启动命令（由协调者在维护窗口执行）：

```bash
cd /data2/liyezhuoxin/terralink-water-demo
TERRALINK_PORT=4174 bash scripts/earthmind/stop-production.sh
TERRALINK_HOST=10.171.205.153 TERRALINK_PORT=4174 \
  bash scripts/earthmind/start-production.sh /data2/liyezhuoxin/terralink-water-demo/.releases/20261106-production-04
```

本地`.env.local`、`.runtime/`、`.releases/`均不提交。后续源码中的部署文档和ignore规则会晚于该build更新；manifest中的45份源码hash对应**构建时快照**，不能据此声称所有当前文档与release仍相同。现有依赖symlink要求源安装目录继续存在。
