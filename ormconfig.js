module.exports ={
    type: "mariadb",
    host: process.env.BOT_DB_HOST,
    port: process.env.BOT_DB_PORT,
    username: process.env.BOT_DB_USERNAME,
    password: process.env.BOT_DB_PASSWORD,
    database: process.env.BOT_DB_NAME,
    timezone: 'Z',
    logging: false,
    entities: [
       "src/db/entities/**/*.ts"
    ],
    migrations: [
       "src/db/migrations/**/*.ts"
    ],
    subscribers: [
       "src/db/subscribers/**/*.ts"
    ],
    cli: {
       "entitiesDir":  "src/db/entities",
       "migrationsDir": "src/db/migrations",
       "subscribersDir": "src/db/subscribers"
    }
 }