export class Workflow {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly definition: any,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) { }
}
