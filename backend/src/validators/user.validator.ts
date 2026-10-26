import { z } from 'zod';

export const userIdSchema = z.string().uuid('Invalid account id');

const role = z.enum(['sales', 'admin', 'superadmin']);

export const createUserSchema = z.object({
    name: z.string().trim().min(1, 'Enter a name').max(100),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    role,
});

export const updateUserSchema = z
    .object({
        name: z.string().trim().min(1, 'Enter a name').max(100),
        role,
        active: z.boolean(),
    })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
