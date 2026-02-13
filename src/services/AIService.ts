
// Mock AI Service or Integration point for LLM
// In a real implementation, this would call OpenAI/Gemini/Anthropic APIs

export interface ChangeInfo {
    path: string;
    type: 'add' | 'change' | 'unlink';
    // content?: string; // Optional content for diffing
}

export interface CommitProposal {
    message: string;
    description?: string;
    files: string[]; // Files included in this group
}

export const AIService = {
    generateProposal: async (changes: ChangeInfo[]): Promise<CommitProposal[]> => {
        // Simuluate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Simple heuristic-based grouping (mocking AI behavior)
        const groups: Map<string, ChangeInfo[]> = new Map();

        changes.forEach(change => {
            // Group by directory or file type for demo
            const dir = change.path.includes('/') ? change.path.split('/')[0] : 'root';
            if (!groups.has(dir)) groups.set(dir, []);
            groups.get(dir)?.push(change);
        });

        const proposals: CommitProposal[] = [];

        for (const [group, items] of groups.entries()) {
            const files = items.map(i => i.path);
            let message = `Update ${group} components`;

            // Refine message based on types
            const types = new Set(items.map(i => i.type));
            if (types.has('add') && !types.has('change')) message = `Add new files to ${group}`;
            if (types.has('unlink')) message = `Remove files from ${group}`;

            // "AI" generates a more descriptive message
            if (group === 'src') message = "Refactor source code structure";
            if (group === 'assets') message = "Update asset resources";

            proposals.push({
                message,
                description: `Automatically grouped ${items.length} changes in ${group}.`,
                files
            });
        }

        // Return a single "Grouped" proposal if closely related, or multiple if distinct
        // For this mock, we just return the groups we found.
        return proposals;
    },

    // In the future, replace with actual API call
    // async generateProposalReal(changes: ChangeInfo[]): Promise<CommitProposal[]> { ... }
};
