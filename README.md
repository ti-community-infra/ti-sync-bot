# ti-sync-bot

A GitHub App built with [Probot](https://github.com/probot/probot) that used to sync tidb community info to database, for providing basic data for other bots.

## Require

- Git >= 2.13.0 (**For husky support**)
- Node >= 10
- MYSQL 5.7
- Docker
- Docker Compose >= 3

## Setup

```sh
# Install dependencies
npm install

# Compile
npm run build

# Run
npm run start
```

## Docker

```sh
# 1. Build container
docker build -t ti-sync-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> ti-sync-bot
```

## Contributing

If you have suggestions for how ti-sync-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2021 mini256 <minianter@foxmail.com>
