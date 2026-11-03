# Earthmind TerraLink 本地部署

官方基线为 `earth-flow/terralink` 提交 `9b740b853559a28ba744c535bdd4572fb3e4dc05`。本地只补充部署与两项联调兼容修正：现有私网HTTP的cookie设置、Terrabox在HTTP200响应内报告工具失败时的错误展示。版本证据和浏览器记录放在Earthmind的 `research/n069-terralink/`。

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

如主协调agent确认沿用现有Tailscale地址，则先停本进程，再指定该私网IP，避免绑定公共网卡：

```bash
TERRALINK_HOST=100.108.11.72 bash scripts/earthmind/start.sh
```

此时浏览器用 `http://100.108.11.72:4174`。这不会重新启动8010/7861/7862/4173，也不会启动模型。

开发运行使用`next dev`。如需生产模式，先停止本前端、`npm run build`通过后，再执行 `TERRALINK_MODE=start bash scripts/earthmind/start.sh`。本节点的实际构建结果以Earthmind交付记录为准。

## 复验路径

1. 登录后进入Toolkits，可搜索工具箱并打开工具详情。
2. `example` → `Math Add` → Start Test，输入a=2/b=3，Execute Tool，检查实际输出result=5。
3. `geo_basic` → `Area → Pixels`，仅填area_m2=100，保持GSD为空，Execute Tool，应显示Execution Failed及缺GSD错误；不能把HTTP200当工具成功。
4. Execution History中查看真实执行记录，Logout清除本前端会话。

这些是轻量工程联调，不是遥感模型推理或科学任务验证。图谱联合检查由N070新工具就绪后另记。

## 2026-11-03 实际验证记录

图谱联合检查现已完成：登录后目录为18工具箱/128工具；`graph_query.get_item`读取N003及8个成员，`query_nodes`按N003筛选时`limit=1`仍报告完整count=8，`search_graph`实际找到N003；无效作用域显示失败。证据在Earthmind的`research/n069-terralink/browser-graph-verification.json`及08—12截图，截图原始JSON已遮罩以保留私有源字段。

独立4174的停止/启动脚本已实测，最终保留在线地址为`http://100.108.11.72:4174`。该次冷启动94秒、首次页面编译94.3秒；首次浏览器导航120秒超时，暖机后重试通过。当前仍为`next dev`：完整生产构建人工终止，180秒限时no-lint构建超时，未声称生产构建成功。不要在同一`.next`目录并行执行build与dev；如需重试生产构建由主协调agent安排独立停机窗口。
