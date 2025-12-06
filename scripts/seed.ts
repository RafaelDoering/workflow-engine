import 'dotenv/config';
import { PrismaClient } from '@app/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const workflow = await prisma.workflow.upsert({
        where: { name: 'invoice' },
        update: {},
        create: {
            name: 'invoice',
            definition: {
                steps: ['fetch-orders', 'create-invoice', 'pdf-process', 'send-email'],
            },
        },
    });
    console.log({ workflow });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
