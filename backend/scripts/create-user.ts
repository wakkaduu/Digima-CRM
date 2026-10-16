import 'dotenv/config';
import type { UserRole } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import * as userModel from '../src/models/user.model';
import { hashPassword } from '../src/services/password';

const [roleArg, name, email, password] = process.argv.slice(2);
const role = roleArg as UserRole;
const usage = 'Usage: npm run user:create -- <admin|sales> "<Full Name>" <email> "<temporary password>"';

(async () => {
    if (!['admin', 'sales'].includes(role) || !name || !email || !password) {
        console.error(usage);
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('The temporary password must be at least 8 characters.');
        process.exit(1);
    }

    try {
        const user = await userModel.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            passwordHash: await hashPassword(password),
            mustChangePassword: true,
        });
        console.log(`Created ${user.role} account for ${user.email}. They must change the password at first login.`);
    } catch (err: any) {
        console.error(err.code === 'P2002' ? 'A user with that email already exists.' : err.message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
})();