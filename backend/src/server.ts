import env from './config/env';
import app from './app';
import { prisma } from './config/prisma';

const server = app.listen(env.PORT, () => {
    console.log(`✅ Payment Portal running at ${env.APP_BASE_URL} (${env.NODE_ENV})`);
});

const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
};
// Last-resort logging: an error nothing caught still leaves a line to find, instead of a silent crash.
process.on('unhandledRejection', (reason) => console.error('[fatal] unhandled promise rejection', reason));
process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaught exception, exiting so the host restarts the process', err);
    process.exit(1);
});
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));