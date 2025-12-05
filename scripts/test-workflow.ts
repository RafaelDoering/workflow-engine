import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWorkflowId(): Promise<string> {
    const workflow = await prisma.workflow.findFirst({
        where: { name: 'invoice' },
    });
    if (!workflow) {
        throw new Error('Workflow "invoice" not found. Run: npx ts-node seed.ts');
    }
    return workflow.id;
}

async function triggerWorkflow(workflowId: string, orderId: string) {
    console.log(`\n🚀 Triggering workflow for order: ${orderId}`);

    const response = await fetch(`${API_URL}/workflows/${workflowId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { orderId } }),
    });

    if (!response.ok) {
        throw new Error(`Failed to trigger workflow: ${response.statusText}`);
    }

    const data = (await response.json()) as { instanceId: string };
    console.log(`✅ Workflow instance created: ${data.instanceId}`);
    return data.instanceId;
}

async function pollForCompletion(instanceId: string, timeout = 30000) {
    console.log('\n⏳ Polling for task completions...\n');
    const startTime = Date.now();
    const expectedSteps = ['fetch-orders', 'create-invoice', 'pdf-process', 'send-email'];
    let lastTaskCount = 0;

    while (Date.now() - startTime < timeout) {
        const tasks = await prisma.task.findMany({
            where: { workflowInstanceId: instanceId },
            orderBy: { type: 'asc' },
        });

        // Print status table when new task appears or status changes
        if (tasks.length !== lastTaskCount) {
            lastTaskCount = tasks.length;
            printStatusTable(tasks, expectedSteps);
        }

        // Check if all expected steps are completed
        const succeededTypes = tasks
            .filter((t) => t.status === 'SUCCEEDED')
            .map((t) => t.type);
        const allDone = expectedSteps.every((step) => succeededTypes.includes(step));

        if (allDone) {
            console.log('\n✅ All tasks completed successfully!\n');
            return tasks;
        }

        // Check for failures
        const failed = tasks.find((t) => t.status === 'FAILED');
        if (failed) {
            console.log(`\n❌ Task ${failed.type} failed: ${failed.lastError}\n`);
            return tasks;
        }

        await sleep(500);
    }

    throw new Error('Timeout waiting for workflow completion');
}

function printStatusTable(
    tasks: Array<{ type: string; status: string; attempt: number }>,
    expectedSteps: string[],
) {
    console.log('┌─────────────────┬────────────┬─────────┐');
    console.log('│ Task            │ Status     │ Attempt │');
    console.log('├─────────────────┼────────────┼─────────┤');

    for (const step of expectedSteps) {
        const task = tasks.find((t) => t.type === step);
        const status = task?.status ?? 'PENDING';
        const attempt = task?.attempt ?? 0;
        const statusIcon =
            status === 'SUCCEEDED'
                ? '✅'
                : status === 'RUNNING'
                    ? '🔄'
                    : status === 'FAILED'
                        ? '❌'
                        : '⏳';

        console.log(
            `│ ${step.padEnd(15)} │ ${statusIcon} ${status.padEnd(8)} │ ${String(attempt).padStart(7)} │`,
        );
    }

    console.log('└─────────────────┴────────────┴─────────┘');
}

async function printFinalSummary(instanceId: string) {
    const instance = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { tasks: true },
    });

    if (!instance) return;

    console.log('📊 Final Summary:');
    console.log(`   Instance ID: ${instance.id}`);
    console.log(`   Status: ${instance.status}`);
    console.log(`   Tasks: ${instance.tasks.length}`);
    console.log(`   Duration: ${Date.now() - instance.createdAt.getTime()}ms`);
}

async function main() {
    const orderId = `ORDER-${Date.now()}`;

    try {
        const workflowId = await getWorkflowId();
        const instanceId = await triggerWorkflow(workflowId, orderId);
        await pollForCompletion(instanceId);
        await printFinalSummary(instanceId);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
