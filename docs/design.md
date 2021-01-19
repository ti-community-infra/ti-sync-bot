# 设计思路

## 整体思路

ti-sync-bot 主要负责将 tidb 社区 Github 上的一些数据同步到数据库当中，它的工作模式主要分为全量同步和增量同步两种模式。

### 全量同步

全量同步的设计目的是为了让 bot 能够将新安装仓库中过去的数据或者在 bot 因为故障导致的停机过程中产生的数据同步到数据库当中。

| 事件名称                         | 事件类型     | 触发说明                                   |
| ------------------------------- | ----------- | ----------------------------------------- |
| app.start_up                    | 自定义事件    | 在程序启动时触发，bot 会获取所有安装了该 Github App 的仓库列表逐一进行全量同步。 |
| installation.created            | WebHook 事件 | 当用户初次将 bot 安装到用户账号或组织账号时触发，用户在安装时可以选择安装到所有仓库或指定仓库，bot 会针对安装的仓库进行逐一全量同步。 |
| installation_repositories.added | WebHook 事件 | 用户可以在 Github App 设置对已安装仓库进行添加或删除，当新添加一个仓库时，会触发该事件，bot 会针对新添加的仓库进行逐一全量同步。 |

为了测试方便，如果你在 `.env` 文件当中指定 `SYNC_REPOS` 选项，bot 在程序启动时将会针对该配置中指定的仓库进行全量同步。配置示例如下：

```
SYNC_REPOS=tikv/tikv,pingcap/tipocket
```

### 增量同步

增量同步的设计目的是为了能够更加及时的将 Github 上的数据同步到数据库当中，避免全量同步在一个较为集中的时间段内产生大量的数据库操作和 API 接口请求。

增量同步是基于 Github 的 WebHook 机制实现的，为了能够在 bot 启动过程中及时处理 WebHook 发送过来的数据，全量同步和增量同步被设计成并发进行。

ti-sync-bot 通过监听以下类型事件来对 Github 数据进行增量同步：

| 事件类型          | 动作类型      | 触发行为     |
| --------------- | ----------- | ----------- |
| `issue`         | `opened` `edited` `deleted` `closed` `reopened` `labeled` `unlabeled`  | 增量同步 Issue          |
| `issue_comment` | `created` `edited` `deleted`                                           | 增量同步 Issue Comment  |
| `pull_request`  | `opened` `edited` `closed` `reopened` `labeled` `unlabeled`            | 增量同步 Pull Request、Contributor Email |
| `pull_request_review`         | `submitted` `edited` `dismissed`                         | 增量同步 Review         |
| `pull_request_review_comment` | `created` `edited` `deleted`                             | 增量同步 Review Comment |

## 同步内容

### 同步 Pull Request

| 字段名称         | 字段说明     |
| --------------- | ----------- |
| status          | PR 的状态可以分为 `open`、`closed` 和 `merged` 三种状态，Github 只提供了 `open` 和 `closed` 两种状态，如果 PR 的 `merged_at` 不为空，则可以判定为 `merged` 状态。 |
| label           | 使用逗号分隔多个标签名。 |
| relation        | 描述的是 PR 作者与公司的关系，其类型包括：`member`、`not member`。 |
| association     | 即 author_association，描述的是 PR 作者与当前仓库所属 org 的关系，其类型包括：`COLLABORATOR`、`FIRST_TIME_CONTRIBUTOR`、`CONTRIBUTOR`、`MEMBER`、`NONE`。 |

### 同步 Comment

目前，ti-sync-bot 会对 `common comment`、`review` 和 `review comment` 三种类型的评论进行同步。

`common comment` 指的是 Pull Request 与 Issue 共用的一种评论类型，可以通过 [issues.listComments](https://docs.github.com/en/free-pro-team@latest/rest/reference/issues#list-issue-comments) 接口获取 PR 的 comment 列表。

`review` 指的是 reviewer 在提交 review 时填写的评论内容，可以通过 [pulls.listReviews](https://docs.github.com/en/free-pro-team@latest/rest/reference/pulls#list-reviews-for-a-pull-request) 接口获取 PR 的 review 列表。

`review comment` 指的是在 review 过程中针对指定代码添加的评论内容，可以通过 [pulls.listComments](https://docs.github.com/en/free-pro-team@latest/rest/reference/pulls#get-a-review-comment-for-a-pull-request) 接口 review comment 列表。

比较特别的是，在 review 代码的过程中如果使用了 Github 的 "Add single comment" 功能，Github 会自动地添加一条无内容的 review，然后将实际评论（review comment 类型）与之关联。

| 字段名称         | 字段说明     |
| --------------- | ----------- |
| comment_type    | 其类型包括：`common comment`、`review`、`review comment`。 |

### 同步 Issue

| 字段名称         | 字段说明     |
| --------------- | ----------- |
| status          | Issue 的状态可以分为 `open` 和 `closed` 两种状态。 |
| label           | 使用逗号分隔多个标签名。 |
| relation        | 描述的是 PR 作者与公司的关系，其类型包括：`member`、`not member`。 |
| association     | 即 author_association，描述的是 PR 作者与当前仓库所属 org 的关系，其类型包括：`COLLABORATOR`、`FIRST_TIME_CONTRIBUTOR`、`CONTRIBUTOR`、`MEMBER`、`NONE`。 |

### 同步 Contributor Email

代码贡献者向开源仓库贡献代码，Commit 当中会带有贡献者的签名信息，签名的格式一般是：`From: zhangsan <zhangsan@mail.com>`。

另外，一些仓库还提议代码贡献者在 Commit Message 当中添加签名信息，签名的格式一般为：`Signed-off-by: zhangsan <zhangsan@mail.com>`。

ti-sync-bot 通过 Pull Request 的 Patch 格式文件（ [示例](https://patch-diff.githubusercontent.com/raw/tikv/tikv/pull/9385.patch) ）获取代码贡献者的签名信息，并将其中的电子邮箱信息同步到数据库，以建立贡献者基本信息存档。其支持处理上述两种类型的签名格式，并且优先采用 Commit Message 当中的签名信息。

<img width="424" alt="Patch Example" src="https://user-images.githubusercontent.com/5086433/104900941-ae1dae00-59b7-11eb-959a-5bea44ae5410.png">



