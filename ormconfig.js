module.exports ={
    type: "mariadb",
    host: process.env.BOT_DB_HOST,
    port: process.env.BOT_DB_PORT,
    username: process.env.BOT_DB_USERNAME,
    password: process.env.BOT_DB_PASSWORD,
    database: process.env.BOT_DB_NAME,
    // To support emoji character.
    charset: 'UTF8MB4_GENERAL_CI',
    // Unified use GMT.
    timezone: 'Z',
    logging: false,
    entities: [
       "lib/db/entities/**/*.js"
    ],
    migrations: [
       "lib/db/migrations/**/*.js"
    ],
    subscribers: [
       "lib/db/subscribers/**/*.js"
    ],
    cli: {
       "entitiesDir":  "src/db/entities",
       "migrationsDir": "src/db/migrations",
       "subscribersDir": "src/db/subscribers"
    }
 }