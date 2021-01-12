# 设计思路

## 整体思路

ti-sync-bot 主要负责将 tidb 社区 Github 上的一些数据同步到数据库当中，它的工作模式主要分为全量同步和增量同步。

### 全量同步

全量同步的设计目的是为了让 bot 能够将新安装仓库中过去的数据或者在 bot 因为故障导致的停机过程中产生的数据同步到数据库当中。

| 事件名称                         | 事件类型     | 触发说明                                   |
| ------------------------------- | ----------- | ----------------------------------------- |
| app.start_up                    | 自定义事件    | 在程序启动时触发，bot 会获取所有安装了该 Github App 的仓库列表逐一进行全量同步。 |
| installation.created            | WebHook 事件 | 当用户初次将 bot 安装到用户账号或组织账号时触发，用户在安装时可以选择安装到所有仓库或指定仓库，bot 会针对安装的仓库进行逐一全量同步。 |
| installation_repositories.added | WebHook 事件 | 用户可以在 Github App 设置对已安装仓库进行添加或删除，当新添加一个仓库时，会触发该事件，bot 会针对新添加的仓库进行逐一全量同步。 |

### 增量同步

增量同步的设计目的是为了能够更加及时的将 Github 上的数据同步到数据库当中，避免全量同步在一个集中的时间段内。

增量同步是基于 Github 的 WebHook 机制实现，为了能够在 bot 启动过程中及时处理 WebHook 发送过来的数据，全量同步和增量同步被设计成并发进行。

## 同步内容

### 同步 Pull Request 内容

| 字段名称         | 字段说明     |
| --------------- | ----------- |
| label           | 使用逗号分隔多个标签名。 |
| relation        | 描述的是 PR 作者与公司的关系，其类型包括："member" / "not member"。 |
| association     | 即 author_association，描述的是 PR 作者与当前仓库所属 org 的关系，其类型包括："COLLABORATOR" / "FIRST_TIME_CONTRIBUTOR" / "CONTRIBUTOR" / "MEMBER" / "NONE"。 |
| comment_type    | 其类型包括："common comment" / "review" / "review comment"。 |
