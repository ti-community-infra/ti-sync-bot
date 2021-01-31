# 配置

在开发环境当中，你可以在根目录下的 `.env` 文件当中添加机器人的配置，这些配置项包括 [Probot 的配置项](https://probot.github.io/docs/configuration/) 以及 ti-sync-bot 额外添加的一些配置项。 在生产环境当中，你可以使用系统的环境变量来定义这些配置项。

## ti-sync-bot 配置项

| 选项                       | 选项说明                                   |
| ------------------------- | --------------------------------------------------------------------------- |
| GITHUB_ACCESS_TOKEN       | 在全量同步的过程中，需要使用该 ACCESS TOKEN 来访问 Github 的一些 API，你可以在 [开发者设置](https://github.com/settings/tokens/new) 当中生成该 TOKEN。           |
| SYNC_REPOS                | 为了测试方便，如果你在 `.env` 文件当中指定 `SYNC_REPOS` 配置，Bot 在程序启动时将会针对该配置中指定的仓库进行全量同步，例如：`SYNC_REPOS=tikv/tikv,pingcap/tipocket`。 |
