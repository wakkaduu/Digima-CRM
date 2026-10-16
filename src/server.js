const env = require('./config/env');
const app = require('./app');
const { prisma } = require('./config/prisma');

const server = app.listen(env.PORT, () => {
    console.log(`✅ Payment Portal running at ${env.APP_BASE_URL} (${env.NODE_ENV})`);
});

const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));