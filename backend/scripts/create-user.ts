import 'dotenv/config';
import type { UserRole } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import env from '../src/config/env';
import * as userModel from '../src/models/user.model';
import { createInvite } from '../src/services/invite.service';

const [roleArg, name, email] = process.argv.slice(2);
const role = roleArg as UserRole;
const usage = 'Usage: npm run user:create -- <sales|admin|superadmin> "<Full Name>" <email>';

// Adds an account and prints its one-time invite link. There is no password: the person opens the link and signs in
// with QuickBooks, which links their Intuit account. The email is only a label.
(async () => {
    if (!['sales', 'admin', 'superadmin'].includes(role) || !name || !email) {
        console.error(usage);
        process.exit(1);
    }

    try {
        const invite = createInvite();
        const user = await userModel.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            inviteTokenHash: invite.hash,
            inviteExpiresAt: invite.expiresAt,
        });
        console.log(`Created ${user.role} account for ${user.email}. Send them this one-time link (valid until ${invite.expiresAt.toISOString()}):`);
        console.log(`${env.FRONTEND_URL}/invite#${invite.token}`);
    } catch (err: any) {
        console.error(err.code === 'P2002' ? 'A user with that email already exists.' : err.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
})();
